// Session minutes (protocols): read and written by the CMS (login) and by the map's protocol reader, which needs the
// protocol password. Storage: lib/protocol-store.js (this server only, never the public repo).
//
//   POST /api/protocols/unlock      { password } → { token, expiresAt }   (map; wrong passwords are rate-limited)
//   GET  /api/protocols             list (newest first)                    CMS login or "Authorization: Bearer <token>"
//   GET  /api/protocols/players     names used so far (suggestions)        same
//   GET  /api/protocols/suggestions { players, places } used so far        same
//   GET  /api/protocols/:id         one session                            same
//   POST /api/protocols             new session, unpublished (a draft)     same — from the map only one at a time:
//                                   409 with the open one instead
//   POST /api/protocols/:id/publish the draft becomes the published version
//   DELETE /api/protocols/:id/draft throw the draft away (a never-published session goes with it)
//   PUT  /api/protocols/:id         publish values directly (form, import)  same
//   DELETE /api/protocols/:id       delete (kept in protocols-deleted.json) CMS login only
// Editing itself is live (lib/protocol-live.js) and goes into the session's draft.
//   GET/PUT /api/protocols/settings/password                               CMS login only
//   GET  /api/protocols/export      all private data as one JSON file      CMS login only
//   GET  /api/protocols/links       links shown above the minutes          CMS login or token; PUT: CMS login only
//   GET  /api/protocols/comments    comments on marked passages, by session   CMS login or token (lib/protocol-comments.js)
//   POST /api/protocols/:id/comments          { by, text, quote, prefix, suffix }   same
//   DELETE /api/protocols/:id/comments/:cid   { by } — its writer, or the CMS      same
//
// Tokens: "<expiry>.<passwordVersion>.<hmac>", signed with SESSION_SECRET. Setting a new password bumps the version,
// which ends every token handed out before.
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../lib/protocol-store');
const comments = require('../lib/protocol-comments');
const protocolLive = require('../lib/protocol-live');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const { makeToken, tokenValid } = require('../lib/protocol-auth');

const cmsUser = (req) => (req.session?.authenticated ? (req.session.displayName || req.session.username || 'CMS') : null);

// CMS login, or a valid protocol token from the map
async function requireAccess(req, res, next) {
    try {
        if (cmsUser(req)) { req.protocolVia = 'cms'; req.protocolBy = cmsUser(req); return next(); }
        if (await tokenValid(req.get('authorization'))) { req.protocolVia = 'map'; req.protocolBy = 'Map'; return next(); }
        res.status(401).json({ success: false, error: 'Protocol password required', locked: true });
    } catch (err) { next(err); }
}

// ---------- unlocking (rate-limited per IP: 8 wrong passwords, then 15 minutes pause) ----------

const failures = new Map();
router.post('/unlock', async (req, res) => {
    const ip = req.ip;
    const f = failures.get(ip);
    if (f && f.count >= 8 && Date.now() < f.until) {
        return res.status(429).json({ success: false, error: 'Too many wrong passwords — try again in a few minutes' });
    }
    const s = await store.settings();
    if (!s.passwordHash) return res.status(503).json({ success: false, error: 'No protocol password has been set yet (CMS → Protocols)' });
    const ok = await bcrypt.compare(String(req.body?.password || ''), s.passwordHash);
    if (!ok) {
        const next = { count: (f && Date.now() < f.until ? f.count : 0) + 1, until: Date.now() + 15 * 60000 };
        failures.set(ip, next);
        return res.status(401).json({ success: false, error: 'Wrong password' });
    }
    failures.delete(ip);
    res.json({ success: true, ...makeToken(s.passwordVersion) });
});

// ---------- password (CMS) ----------

router.get('/settings/password', requireAuth, async (req, res) => {
    const s = await store.settings();
    res.json({ success: true, passwordSet: !!s.passwordHash, updatedAt: s.updatedAt || null, updatedBy: s.updatedBy || null });
});

router.put('/settings/password', requireAuth, async (req, res) => {
    const password = String(req.body?.password || '');
    if (password.length < 6) return res.status(400).json({ success: false, error: 'At least 6 characters' });
    const s = await store.settings();
    await store.saveSettings({
        ...s, // keeps the other settings (links)
        passwordHash: await bcrypt.hash(password, 12),
        passwordVersion: (s.passwordVersion || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: cmsUser(req),
    });
    res.json({ success: true, message: 'Password set — devices unlocked with the old one must enter the new one' });
});

// ---------- links shown above the minutes (e.g. the attendance sheet) ----------
// Kept with the settings on this server, not in the map's public code: only unlocked devices get them.

const cleanLinks = (list) => (Array.isArray(list) ? list : [])
    .map((l) => ({ label: String(l?.label || '').trim().slice(0, 80), url: String(l?.url || '').trim() }))
    .filter((l) => l.label && /^https?:\/\/[^\s]+$/i.test(l.url))
    .slice(0, 10);

router.get('/links', requireAccess, async (req, res) => {
    res.json({ success: true, links: (await store.settings()).links || [] });
});

router.put('/links', requireAuth, async (req, res) => {
    const s = await store.settings();
    const links = cleanLinks(req.body?.links);
    await store.saveSettings({ ...s, links });
    res.json({ success: true, links });
});

// ---------- sessions ----------

router.get('/', requireAccess, async (req, res) => {
    res.json({ success: true, sessions: await store.list() });
});

router.get('/players', requireAccess, async (req, res) => {
    res.json({ success: true, players: await store.players() });
});

router.get('/suggestions', requireAccess, async (req, res) => {
    res.json({ success: true, ...(await store.suggestions()) });
});

// Everything private in one file, for the DM's own backup (CMS → Overview → Export): the minutes with their history and
// drafts, deleted sessions, proposals and the password's change date (not the password)
router.get('/export', requireAuth, async (req, res) => {
    const fs = require('fs').promises;
    const read = async (f, fallback) => { try { return JSON.parse(await fs.readFile(require('path').join(store.DIR, f), 'utf8')); } catch { return fallback; } };
    const settings = await store.settings();
    res.setHeader('Content-Disposition', `attachment; filename="adenai-minutes-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
        exportedAt: new Date().toISOString(), exportedBy: cmsUser(req),
        protocols: await read('protocols.json', { sessions: [] }),
        deleted: await read('protocols-deleted.json', { sessions: [] }),
        proposals: await read('pending-entries.json', { entries: [] }),
        password: { set: !!settings.passwordHash, updatedAt: settings.updatedAt || null },
    });
});

// ---------- comments on marked passages (not part of the minutes) ----------

router.get('/comments', requireAccess, async (req, res) => {
    res.json({ success: true, comments: await comments.all() });
});

router.post('/:id/comments', requireAccess, async (req, res) => {
    if (!(await store.get(req.params.id))) return res.status(404).json({ success: false, error: 'Session not found' });
    const r = await comments.add(req.params.id, { ...req.body, by: req.protocolVia === 'cms' && !req.body?.by ? req.protocolBy : req.body?.by });
    if (r.error) return res.status(400).json({ success: false, error: r.error });
    res.status(201).json({ success: true, ...r });
});

router.delete('/:id/comments/:cid', requireAccess, async (req, res) => {
    const r = await comments.remove(req.params.id, req.params.cid, { by: req.body?.by, admin: req.protocolVia === 'cms' });
    if (r.error) return res.status(r.status).json({ success: false, error: r.error });
    res.json({ success: true, ...r });
});

router.get('/:id', requireAccess, async (req, res) => {
    const session = await store.get(req.params.id, { history: req.protocolVia === 'cms' && req.query.history === '1' });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, session });
});

const reply = (res, r) => (r.error ? res.status(r.status).json({ success: false, error: r.error, errors: r.errors, session: r.session }) : res.status(r.status).json({ success: true, session: r.session, deleted: r.deleted }));
const by = (req) => String(req.body?.by || '').trim().slice(0, 40) || req.protocolBy; // the map sends the device's name

router.post('/', requireAccess, async (req, res) => {
    reply(res, await store.create(req.body || {}, { by: by(req), via: req.protocolVia }));
});

router.post('/:id/publish', requireAccess, async (req, res) => {
    await protocolLive.flush(req.params.id);
    reply(res, await store.publish(req.params.id, { by: by(req), via: req.protocolVia }));
});

router.delete('/:id/draft', requireAccess, async (req, res) => {
    await protocolLive.flush(req.params.id);
    reply(res, await store.discardDraft(req.params.id));
});

router.put('/:id', requireAccess, async (req, res) => {
    reply(res, await store.save(req.body || {}, { id: req.params.id, by: req.protocolBy, via: req.protocolVia }));
});

router.delete('/:id', requireAuth, async (req, res) => {
    reply(res, await store.remove(req.params.id));
});

module.exports = router;
