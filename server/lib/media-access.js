// The pictures of the media library (/media, uploads/optimized) are not public (2026-11-20) — except those marked open, the owner's own and AI ones (lib/media-open.js): most come from artists
// who never allowed showing them on an open website. They are for the group: the GM (CMS login) and everyone who
// has the minutes password. Unlocking the minutes (routes/protocols.js) also sets a cookie for /media holding the same
// signed token (lib/protocol-auth.js, 30 days, ended by a new password); a device unlocked before swaps its stored
// token for the cookie (POST /api/protocols/media-access). The map (adenai.piogino.ch) and this host share
// piogino.ch, so the browser sends the cookie with every picture the map shows. Without it a picture answers 401, and
// the map puts a placeholder in its place (src/utils/media-lock.js).
const cors = require('cors');
const { tokenValid } = require('./protocol-auth');
const { isGm } = require('../middleware/auth');
const { openFiles } = require('./media-open');
const github = require('./github');

// the pictures everyone may see (lib/media-open.js), from the library in the CMS's memory (lib/github-cache.js)
async function isOpen(file) {
    try {
        const { data } = await github.octokit.rest.repos.getContent({ owner: process.env.GITHUB_USERNAME, repo: process.env.GITHUB_REPO, path: 'public/data/media-library.json' });
        return openFiles(JSON.parse(Buffer.from(data.content, 'base64').toString()), data.sha).has(file);
    } catch { return false; } // the library unreadable: closed, as before
}

const COOKIE = 'adenai_media';
// the map's addresses: they may send the password and receive the cookie (credentials need a named origin)
const MAP_ORIGINS = (process.env.MAP_ORIGINS || 'https://adenai.piogino.ch').split(',').map((s) => s.trim()).filter(Boolean);
const CREDENTIAL_PATHS = ['/api/protocols/unlock', '/api/protocols/media-access'];

const cookieOf = (req) => {
    const m = /(?:^|;\s*)adenai_media=([^;]+)/.exec(req.headers.cookie || '');
    return m ? decodeURIComponent(m[1]) : null;
};

// the global CORS: everywhere open as before, but the two credential routes only for the map, with credentials
const plainCors = cors();
const credentialCors = cors({ origin: MAP_ORIGINS, credentials: true });
const corsFor = (req, res, next) => (CREDENTIAL_PATHS.includes(req.path) ? credentialCors : plainCors)(req, res, next);

// other servers of the owner that show the pictures (the OBS controller): a key of their own in X-Media-Key; stored
// here only as its SHA-256, MEDIA_KEYS="obs:<sha256 hex>,…"
const crypto = require('crypto');
const MEDIA_KEYS = (process.env.MEDIA_KEYS || '').split(',').map((s) => s.trim().split(':')[1]).filter(Boolean);
function keyValid(key) {
    if (!key || !MEDIA_KEYS.length) return false;
    const h = crypto.createHash('sha256').update(String(key)).digest('hex');
    return MEDIA_KEYS.some((k) => k.length === h.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(h)));
}

// in front of /media: open pictures for everyone, else the GM, or a valid token in the cookie; otherwise 401 (no body: the map shows its placeholder)
async function gate(req, res, next) {
    try {
        res.set('Vary', 'Cookie');
        // the owner's own pictures and AI pictures: for everyone
        if (await isOpen(decodeURIComponent(req.path.replace(/^\//, '')))) {
            res.set('Cache-Control', 'public, max-age=86400');
            return next();
        }
        if (isGm(req) || keyValid(req.get('x-media-key')) || await tokenValid(cookieOf(req))) {
            res.set('Cache-Control', 'private, max-age=86400'); // the browser may keep it, no shared cache
            return next();
        }
        res.set('Cache-Control', 'no-store');
        return res.status(401).end();
    } catch (err) { return next(err); }
}

function setCookie(res, token, expiresAt) {
    res.cookie(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/media', expires: new Date(expiresAt) });
}
const clearCookie = (res) => res.clearCookie(COOKIE, { path: '/media', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });

module.exports = { keyValid, gate, setCookie, clearCookie, corsFor, cookieOf, COOKIE, MAP_ORIGINS };
