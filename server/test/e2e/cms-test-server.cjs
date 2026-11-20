// The CMS for the browser tests: server.js on port 3091 with a GM account and a player account of its own,
// a journal and sessions in fresh folders, the minutes in a copy, and nothing written to GitHub (ADENAI_READ_ONLY) — it reads the live
// data, it can't change it. Started by playwright.config.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adenai-cms-e2e-'));
Object.assign(process.env, {
    PORT: '3091',
    NODE_ENV: 'test', // a plain http cookie
    ADMIN_USERNAME: 'e2e-gm',
    ADMIN_PASSWORD_HASH: bcrypt.hashSync('e2e-gm-pass', 4),
    ADENAI_TEST_PLAYER_HASH: bcrypt.hashSync('e2e-player-pass', 4),
    ADENAI_READ_ONLY: '1',
    ADENAI_JOURNAL_DIR: path.join(dir, 'github-pending'),
    ADENAI_SESSIONS_DIR: path.join(dir, 'sessions'),
    // the minutes in a copy (2026-11-20): a test may set the minutes password, never on the real ones
    PROTOCOL_DATA_DIR: path.join(dir, 'protocols'),
    // the pictures and names are the Grimoire's (lib/grimoire-images.js): a test instance never writes there
    GRIMOIRE_KEY: '',
});
fs.mkdirSync(process.env.PROTOCOL_DATA_DIR, { recursive: true });
for (const f of ['protocols.json', 'protocol-settings.json', 'protocol-comments.json', 'protocols-deleted.json']) {
    const from = path.join(__dirname, '..', '..', 'data', f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(process.env.PROTOCOL_DATA_DIR, f));
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); });
process.chdir(path.join(__dirname, '..', '..')); // server.js serves its folders relative to server/
require('../../server.js');
