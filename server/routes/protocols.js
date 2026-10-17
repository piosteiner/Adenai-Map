// Session minutes (protocols): read and written by the CMS (login) and by the map's protocol reader, which needs the
// protocol password. Storage: lib/protocol-store.js (this server only, never the public repo).
//
//   POST /api/protocols/unlock      { password } → { token, expiresAt }   (map; wrong passwords are rate-limited)
//   GET  /api/protocols             list (newest first)                    CMS login or "Authorization: Bearer <token>"
//   GET  /api/protocols/players     names used so far (suggestions)        same
//   GET  /api/protocols/:id         one session                            same
//   POST /api/protocols             create                                 same
//   PUT  /api/protocols/:id         update                                 same
//   DELETE /api/protocols/:id       delete (kept in protocols-deleted.json) CMS login only
//   GET/PUT /api/protocols/settings/password                               CMS login only
//
// Tokens: "<expiry>.<passwordVersion>.<hmac>", signed with SESSION_SECRET. Setting a new password bumps the version,
// which ends every token handed out before.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const store = require('../lib/protocol-store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const TOKEN_DAYS = 30;
const SECRET = `${process.env.SESSION_SECRET || ''}:protocols`;

const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

function makeToken(passwordVersion) {
    const exp = Date.now() + TOKEN_DAYS * 86400000;
    const payload = `${exp}.${passwordVersion}`;
    return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

async function tokenValid(header) {
    const m = /^Bearer\s+(\d+)\.(\d+)\.([\w-]+)$/.exec(header || '');
    if (!m) return false;
    const [, exp, version, mac] = m;
    const expected = sign(`${exp}.${version}`);
    if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
    if (Number(exp) < Date.now()) return false;
    return Number(version) === (await store.settings()).passwordVersion;
}

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
        passwordHash: await bcrypt.hash(password, 12),
        passwordVersion: (s.passwordVersion || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: cmsUser(req),
    });
    res.json({ success: true, message: 'Password set — devices unlocked with the old one must enter the new one' });
});

// ---------- sessions ----------

router.get('/', requireAccess, async (req, res) => {
    res.json({ success: true, sessions: await store.list() });
});

router.get('/players', requireAccess, async (req, res) => {
    res.json({ success: true, players: await store.players() });
});

router.get('/:id', requireAccess, async (req, res) => {
    const session = await store.get(req.params.id, { history: req.protocolVia === 'cms' && req.query.history === '1' });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, session });
});

const reply = (res, r) => (r.error ? res.status(r.status).json({ success: false, error: r.error, errors: r.errors }) : res.status(r.status).json({ success: true, session: r.session }));

router.post('/', requireAccess, async (req, res) => {
    reply(res, await store.save(req.body || {}, { by: req.protocolBy, via: req.protocolVia }));
});

router.put('/:id', requireAccess, async (req, res) => {
    reply(res, await store.save(req.body || {}, { id: req.params.id, by: req.protocolBy, via: req.protocolVia }));
});

router.delete('/:id', requireAuth, async (req, res) => {
    reply(res, await store.remove(req.params.id));
});

module.exports = router;
