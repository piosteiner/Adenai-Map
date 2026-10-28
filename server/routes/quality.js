// The Quality page's "OK" marks (CMS → Quality, editor-src/cms/views/quality.js): an issue someone has looked at and
// found to be intended ("a look back to the evening before") stays out of the list. Kept on this server only, beside
// the minutes (data/quality-ok.json; the issues themselves are computed in the CMS from the data).
//   GET    /api/quality/ok          { ok: { <issue key>: { reason, by, at } } }
//   POST   /api/quality/ok          { key, reason }  → mark
//   DELETE /api/quality/ok?key=…    → unmark
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const FILE = path.join(__dirname, '..', 'data', 'quality-ok.json');
const userOf = (req) => req.session.displayName || req.session.username || 'CMS';

async function load() {
    try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return {}; throw err; }
}
// one write at a time; whole or not at all
let queue = Promise.resolve();
function change(fn) {
    const job = queue.then(async () => {
        const ok = await load();
        fn(ok);
        await fs.writeFile(`${FILE}.tmp`, JSON.stringify(ok, null, 2));
        await fs.rename(`${FILE}.tmp`, FILE);
        return ok;
    });
    queue = job.catch(() => {});
    return job;
}

router.get('/ok', requireAuth, async (req, res) => res.json({ success: true, ok: await load() }));

router.post('/ok', requireAuth, async (req, res) => {
    const key = String(req.body?.key || '').slice(0, 500);
    if (!key) return res.status(400).json({ success: false, error: 'Which issue?' });
    const ok = await change((o) => { o[key] = { reason: String(req.body.reason || '').slice(0, 500), by: userOf(req), at: new Date().toISOString() }; });
    res.json({ success: true, ok });
});

router.delete('/ok', requireAuth, async (req, res) => {
    const key = String(req.query.key || '');
    const ok = await change((o) => { delete o[key]; });
    res.json({ success: true, ok });
});

module.exports = router;
