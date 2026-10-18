// Glossary: terms that are neither characters nor locations (factions, spells, objects, events, customs …).
// Stored like them in the public repo as public/data/glossary.json, written through the shared, cached GitHub
// client (lib/github.js). [[Name]] — or an alias — links to a term, as to characters and locations.
//   { version, terms: [ { id, name, aliases: [], category, description, images: [], image, createdAt, updatedAt, … } ] }
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { octokit } = require('../lib/github');
const { normalizeImages } = require('../lib/images');
const linkRename = require('../lib/link-rename');

const router = express.Router();
const OWNER = process.env.GITHUB_USERNAME;
const REPO = process.env.GITHUB_REPO;
const PATH = 'public/data/glossary.json';

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const userOf = (req) => req.session?.displayName || req.session?.username || 'Unknown';

async function load() {
    try {
        const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        return { glossary: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')), sha: data.sha };
    } catch (err) {
        if (err.status === 404) return { glossary: { version: 1, terms: [] }, sha: undefined };
        throw err;
    }
}

async function save(glossary, sha, message) {
    glossary.lastUpdated = new Date().toISOString();
    glossary.terms.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: PATH, sha, message,
        content: Buffer.from(JSON.stringify(glossary, null, 2)).toString('base64'),
    });
}

// Input → a clean term; a name must be unique among terms (and their aliases)
function clean(body, terms, id = null) {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'A term needs a name' };
    const aliases = [...new Set((Array.isArray(body.aliases) ? body.aliases : String(body.aliases || '').split(','))
        .map((a) => String(a).trim()).filter((a) => a && fold(a) !== fold(name)))];
    const taken = terms.find((t) => t.id !== id && [t.name, ...(t.aliases || [])].some((n) => [name, ...aliases].some((m) => fold(m) === fold(n))));
    if (taken) return { error: `“${taken.name}” already uses this name or alias` };
    return {
        value: {
            name,
            aliases,
            category: String(body.category || '').trim().slice(0, 80),
            description: String(body.description || ''),
            ...normalizeImages(body.images, body.image),
        },
    };
}

const fail = (res, what) => (err) => {
    console.error(`Glossary: ${what} failed:`, err.message);
    res.status(err.status === 409 ? 409 : 500).json({ success: false, error: err.status === 409 ? 'The glossary was changed meanwhile — reload and try again' : `Could not ${what}` });
};

router.get('/', async (req, res) => {
    try { res.json({ success: true, ...(await load()).glossary }); } catch (err) { fail(res, 'load the glossary')(err); }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const { glossary, sha } = await load();
        const { error, value } = clean(req.body || {}, glossary.terms);
        if (error) return res.status(400).json({ success: false, error });
        const now = new Date().toISOString();
        const term = { id: `term_${crypto.randomBytes(5).toString('hex')}`, ...value, createdAt: now, updatedAt: now, createdBy: userOf(req), updatedBy: userOf(req) };
        glossary.terms.push(term);
        await save(glossary, sha, `Add glossary term: ${term.name} (by ${userOf(req)})`);
        res.status(201).json({ success: true, term });
    } catch (err) { fail(res, 'add the term')(err); }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { glossary, sha } = await load();
        const term = glossary.terms.find((t) => t.id === req.params.id);
        if (!term) return res.status(404).json({ success: false, error: 'Term not found' });
        const { error, value } = clean(req.body || {}, glossary.terms, term.id);
        if (error) return res.status(400).json({ success: false, error });
        const oldName = term.name;
        Object.assign(term, value, { updatedAt: new Date().toISOString(), updatedBy: userOf(req) });
        const renamed = oldName !== term.name;
        const linksUpdated = { terms: renamed ? linkRename.renameInTerms(glossary, oldName, term.name) : 0 };
        await save(glossary, sha, `Update glossary term: ${oldName}${renamed ? ` → ${term.name}` : ''} (by ${userOf(req)})`);
        let linksWarning = null;
        if (renamed) {
            const r = await linkRename.renameElsewhere(octokit, OWNER, REPO, 'term', oldName, term.name, userOf(req));
            Object.assign(linksUpdated, r.counts);
            if (r.warnings.length) linksWarning = `Saved, but some links still use the old name — ${r.warnings.join('; ')}`;
        }
        res.json({ success: true, term, linksUpdated, linksWarning });
    } catch (err) { fail(res, 'save the term')(err); }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { glossary, sha } = await load();
        const i = glossary.terms.findIndex((t) => t.id === req.params.id);
        if (i < 0) return res.status(404).json({ success: false, error: 'Term not found' });
        const [term] = glossary.terms.splice(i, 1);
        await save(glossary, sha, `Delete glossary term: ${term.name} (by ${userOf(req)})`);
        res.json({ success: true, term });
    } catch (err) { fail(res, 'delete the term')(err); }
});

module.exports = router;
