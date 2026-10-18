// protocol-auth.js - Tokens for the session minutes, handed out for the protocol password (routes/protocols.js) and
// checked by the REST routes and the live connection (lib/protocol-live.js).
// Format "<expiry ms>.<passwordVersion>.<hmac>", signed with SESSION_SECRET; a new password bumps the version.
const crypto = require('crypto');
const store = require('./protocol-store');

const TOKEN_DAYS = 30;
const SECRET = `${process.env.SESSION_SECRET || ''}:protocols`;
const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

function makeToken(passwordVersion) {
    const exp = Date.now() + TOKEN_DAYS * 86400000;
    const payload = `${exp}.${passwordVersion}`;
    return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

// token: the bare token or "Bearer <token>"
async function tokenValid(token) {
    const m = /^(?:Bearer\s+)?(\d+)\.(\d+)\.([\w-]+)$/.exec(String(token || ''));
    if (!m) return false;
    const [, exp, version, mac] = m;
    const expected = sign(`${exp}.${version}`);
    if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
    if (Number(exp) < Date.now()) return false;
    return Number(version) === (await store.settings()).passwordVersion;
}

module.exports = { makeToken, tokenValid };
