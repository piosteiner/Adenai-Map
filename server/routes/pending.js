// Entries proposed by the players (lib/pending-store.js): created on the map while writing the minutes, confirmed or
// rejected by the DM in the CMS (→ Proposals).
//
//   GET    /api/pending            the proposals                      CMS login or "Authorization: Bearer <token>"
//   POST   /api/pending            propose { kind, name, description, category, by }        same (at most 60 an hour)
//   PUT    /api/pending/:id        { kind, description, category } — and the name, from the CMS (links follow)
//   DELETE /api/pending/:id        ?confirmedAs=<name of the created entry> | ?unlink=1   CMS login only
// The protocol token is the one the map gets for the protocol password (lib/protocol-auth.js).
const express = require('express');
const store = require('../lib/pending-store');
const { requireAuth } = require('../middleware/auth');
const { tokenValid } = require('../lib/protocol-auth');
const { octokit } = require('../lib/github');

const router = express.Router();
const OWNER = process.env.GITHUB_USERNAME;
const REPO = process.env.GITHUB_REPO;

const cmsUser = (req) => (req.session?.authenticated ? (req.session.displayName || req.session.username || 'CMS') : null);
async function requireAccess(req, res, next) {
    try {
        if (cmsUser(req)) { req.via = 'cms'; req.by = cmsUser(req); return next(); }
        if (await tokenValid(req.get('authorization'))) { req.via = 'map'; req.by = String(req.body?.by || '').trim().slice(0, 40) || 'Map'; return next(); }
        res.status(401).json({ success: false, error: 'Protocol password required', locked: true });
    } catch (err) { next(err); }
}

// the names of the existing characters, locations and glossary terms (and aliases) — from the cached GitHub client
async function takenNames() {
    const read = async (p) => {
        try { const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: p }); return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')); } catch { return null; }
    };
    const [chars, places, glossary] = await Promise.all([read('public/data/characters.json'), read('public/data/places.geojson'), read('public/data/glossary.json')]);
    return [
        ...(chars?.characters || []).map((c) => c.name),
        ...(places?.features || []).map((f) => f.properties?.name),
        ...(glossary?.terms || []).flatMap((t) => [t.name, ...(t.aliases || [])]),
    ].filter(Boolean);
}

const reply = (res, r) => res.status(r.status).json(r.error ? { success: false, error: r.error, entry: r.entry } : { success: true, entry: r.entry, unlinked: r.unlinked });

router.get('/', requireAccess, async (req, res) => {
    res.json({ success: true, entries: await store.list() });
});

// a little protection against a runaway script on an unlocked device
const created = new Map();
router.post('/', requireAccess, async (req, res) => {
    if (req.via === 'map') {
        const hour = Date.now() - 3600000;
        const times = (created.get(req.ip) || []).filter((t) => t > hour);
        if (times.length >= 60) return res.status(429).json({ success: false, error: 'Too many new entries in an hour' });
        created.set(req.ip, [...times, Date.now()]);
    }
    reply(res, await store.create(req.body || {}, { by: req.by, takenNames: await takenNames() }));
});

router.put('/:id', requireAccess, async (req, res) => {
    const allowRename = req.via === 'cms';
    reply(res, await store.update(req.params.id, req.body || {}, { by: req.by, allowRename, takenNames: allowRename ? await takenNames() : [] }));
});

router.delete('/:id', requireAuth, async (req, res) => {
    const confirmedAs = req.query.confirmedAs ? String(req.query.confirmedAs).slice(0, 120) : null;
    reply(res, await store.remove(req.params.id, { confirmedAs, unlink: req.query.unlink === '1', by: cmsUser(req) || 'CMS' }));
});

module.exports = router;
