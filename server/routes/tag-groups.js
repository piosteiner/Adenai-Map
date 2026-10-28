// The tags to click beside an image's tags (CMS → Media → "Tag lists…"): groups such as gender, age and ancestry,
// each for some categories of images. Stored in the public repo as public/data/media-tag-groups.json, written through
// the shared, cached GitHub client (lib/github.js); the CMS gets them with its config (routes/config.js).
//   { version, groups: [ { label, categories: ['characters', …], tags: ['male', …] } ], lastUpdated, updatedBy }
//   GET /api/media-tag-groups          { groups }
//   PUT /api/media-tag-groups          { groups } → saved (tags written as all tags are: lower case, settled spellings)
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { octokit } = require('../lib/github');
const { normalizeTags } = require('../lib/tags');

const router = express.Router();
const OWNER = process.env.GITHUB_USERNAME;
const REPO = process.env.GITHUB_REPO;
const PATH = 'public/data/media-tag-groups.json';
const CATEGORIES = ['characters', 'locations', 'items', 'creatures', 'maps', 'sessions', 'general'];
const userOf = (req) => req.session?.displayName || req.session?.username || 'Unknown';

// until the file exists: the lists as they were in routes/config.js
const DEFAULT_GROUPS = [
    { label: 'Gender', categories: ['characters'], tags: ['male', 'female', 'nonbinary'] },
    { label: 'Age', categories: ['characters'], tags: ['child', 'youth', 'elder'] },
    { label: 'Ancestry', categories: ['characters', 'creatures'], tags: [
        'human', 'elf', 'half-elf', 'drow', 'dwarf', 'halfling', 'gnome', 'orc', 'goblin', 'kobold', 'tiefling',
        'dragonborn', 'harengon', 'tabaxi', 'kenku', 'aarakocra', 'firbolg', 'lizardfolk', 'grung', 'centaur',
        'faun', 'fairy', 'triton', 'yuan-ti', 'goliath', 'genasi'] },
];

async function load() {
    try {
        const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        return { file: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')), sha: data.sha };
    } catch (err) {
        if (err.status === 404) return { file: { version: 1, groups: DEFAULT_GROUPS }, sha: undefined };
        throw err;
    }
}
const loadGroups = async () => (await load()).file.groups || [];

// what a request may save: a label, known categories, tags as tags are written; empty groups dropped
function clean(groups) {
    if (!Array.isArray(groups)) throw Object.assign(new Error('groups: a list is needed'), { status: 400 });
    if (groups.length > 30) throw Object.assign(new Error('At most 30 lists'), { status: 400 });
    const out = groups.map((g) => ({
        label: String(g?.label || '').trim().slice(0, 40),
        categories: [...new Set((Array.isArray(g?.categories) ? g.categories : []).filter((c) => CATEGORIES.includes(c)))],
        tags: normalizeTags(g?.tags).slice(0, 300),
    })).filter((g) => g.tags.length);
    const nameless = out.find((g) => !g.label);
    if (nameless) throw Object.assign(new Error('Every list needs a name'), { status: 400 });
    const noCategory = out.find((g) => !g.categories.length);
    if (noCategory) throw Object.assign(new Error(`“${noCategory.label}”: choose at least one category`), { status: 400 });
    return out;
}

router.get('/', async (req, res) => {
    try { res.json({ success: true, groups: await loadGroups() }); } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/', requireAuth, async (req, res) => {
    try {
        const groups = clean(req.body?.groups);
        const { file, sha } = await load();
        Object.assign(file, { version: 1, groups, lastUpdated: new Date().toISOString(), updatedBy: userOf(req) });
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path: PATH, sha, message: `Media tag lists (by ${userOf(req)})`,
            content: Buffer.from(JSON.stringify(file, null, 2)).toString('base64'),
        });
        res.json({ success: true, groups });
    } catch (err) {
        res.status(err.status === 400 ? 400 : err.status === 409 ? 409 : 500).json({ success: false, error: err.status === 409 ? 'Changed meanwhile — reload and try again' : err.message });
    }
});

module.exports = { router, loadGroups, clean, DEFAULT_GROUPS };
