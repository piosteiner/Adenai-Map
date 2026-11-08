// The CMS for the browser tests: server.js on port 3091 with a GM account and a player account of its own,
// a journal and sessions in fresh folders, and nothing written to GitHub (ADENAI_READ_ONLY) — it reads the live
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
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); });
process.chdir(path.join(__dirname, '..', '..')); // server.js serves its folders relative to server/
require('../../server.js');
