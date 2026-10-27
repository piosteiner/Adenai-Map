// The map's data files straight from this server's cache (lib/github-cache.js): a change saved in the CMS is there at
// once, instead of after GitHub Pages has built the site again (about a minute). The map falls back to the files on
// GitHub Pages when this server can't be reached (src/utils/live-data.js).
//
//   GET /api/data/:file      characters.json, places.geojson, glossary.json, emotes.json, media-library.json — the
//                            file as in the repo; X-Data-Version: its git sha
//   GET /api/data/events     Server-Sent Events: "versions" { file: sha } on connecting, then "changed" { file, sha }
//                            whenever one of them changes (a CMS save, or a commit from elsewhere, found within a
//                            minute while someone is connected)
const express = require('express');
const { octokit, cache } = require('../lib/github');

const router = express.Router();
const OWNER = process.env.GITHUB_USERNAME;
const REPO = process.env.GITHUB_REPO;
const FILES = ['characters.json', 'places.geojson', 'glossary.json', 'emotes.json', 'media-library.json'];
const pathOf = (file) => `public/data/${file}`;

// decoded once per version (the media library is over 1 MB)
const decoded = new Map(); // file → { sha, text }
async function read(file) {
    const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: pathOf(file) });
    const hit = decoded.get(file);
    if (hit?.sha === data.sha) return hit;
    const entry = { sha: data.sha, text: Buffer.from(data.content, 'base64').toString('utf8') };
    decoded.set(file, entry);
    return entry;
}

// ---------- live: who is connected, and what changed ----------

const clients = new Set();
const send = (res, event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); res.flush?.(); };

cache.events.on('changed', (path, sha) => {
    const file = FILES.find((f) => pathOf(f) === path);
    if (!file) return;
    for (const res of clients) send(res, 'changed', { file, sha });
});

// While maps are connected, look for commits from elsewhere every minute (conditional requests: an unchanged file
// costs GitHub nothing); a newer version comes as "changed" above.
setInterval(() => {
    if (!clients.size) return;
    for (const f of FILES) octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: pathOf(f) }).catch(() => {});
}, 60 * 1000).unref();

router.get('/events', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx: pass every event on at once
    });
    res.write('retry: 5000\n\n');
    clients.add(res);
    const ping = setInterval(() => { res.write(': ping\n\n'); res.flush?.(); }, 25 * 1000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    const versions = {};
    await Promise.all(FILES.map(async (f) => { try { versions[f] = (await read(f)).sha; } catch { /* left out */ } }));
    send(res, 'versions', versions);
});

router.get('/:file', async (req, res) => {
    const file = req.params.file;
    if (!FILES.includes(file)) return res.status(404).json({ success: false, error: 'No such data file' });
    try {
        const { sha, text } = await read(file);
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Data-Version': sha,
            'Access-Control-Expose-Headers': 'X-Data-Version',
        });
        res.send(text);
    } catch (err) {
        console.error(`Data: ${file} failed:`, err.message);
        res.status(502).json({ success: false, error: `Could not read ${file}` });
    }
});

module.exports = router;
