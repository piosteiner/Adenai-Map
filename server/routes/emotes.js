// Emotes: ":name:" in any text shows an image, as in a Twitch chat. Typing ":" and a few letters in the editor lists them.
// Stored in the public repo as public/data/emotes.json (the map reads it from there), written through the shared,
// cached GitHub client (lib/github.js).
//   { version, sources: [ { type: 'user', name, setId, setName, count } | { type: 'set', setId, setName, count } | { type: 'global', … } ],
//     custom: [ { name, url } ], emotes: { name: { url, w, h, animated, from, original? } }, lastUpdated }
// (original: the 7TV name, when it had a colon — ":3" is written :3:)
// Sources are 7TV emote sets: a 7TV (or Twitch, Kick, Discord) user name follows the user's active set, a set id or
// link that set. They are fetched again on every save, so "Save" also refreshes. Custom emotes (images from the media
// library) win over 7TV ones of the same name; among the sources the first wins.
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { octokit } = require('../lib/github');

const router = express.Router();
const OWNER = process.env.GITHUB_USERNAME;
const REPO = process.env.GITHUB_REPO;
const PATH = 'public/data/emotes.json';
const API = 'https://7tv.io/v3';

const userOf = (req) => req.session?.displayName || req.session?.username || 'Unknown';
// names that work between colons: no spaces, no colons
const validName = (n) => /^[^\s:]{1,64}$/.test(n);

async function load() {
    try {
        const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        return { file: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')), sha: data.sha };
    } catch (err) {
        if (err.status === 404) return { file: { version: 1, sources: [], custom: [], emotes: {} }, sha: undefined };
        throw err;
    }
}

async function save(file, sha, message) {
    file.lastUpdated = new Date().toISOString();
    await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: PATH, sha, message,
        content: Buffer.from(JSON.stringify(file, null, 2)).toString('base64'),
    });
}

async function get7tv(path, body) {
    const res = await fetch(`${API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw Object.assign(new Error(`7TV answered ${res.status}`), { status: res.status });
    return res.json();
}

// a user name → the 7TV user and the emote set active on their channel (Twitch first)
async function userSet(name) {
    const key = name.toLowerCase();
    const { data } = await get7tv('/gql', {
        query: 'query($q:String!){users(query:$q){id username connections{platform username emote_set_id}}}',
        variables: { q: name },
    });
    const users = data?.users || [];
    const user = users.find((u) => u.username.toLowerCase() === key) || users.find((u) => u.connections.some((c) => c.username.toLowerCase() === key));
    if (!user) throw new Error(`No 7TV user “${name}”`);
    const order = ['TWITCH', 'KICK', 'YOUTUBE', 'DISCORD'];
    const conn = user.connections.filter((c) => c.emote_set_id).sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform))[0];
    if (!conn) throw new Error(`7TV user “${user.username}” has no active emote set`);
    return { name: user.username, setId: conn.emote_set_id };
}

// What was typed in the CMS → a source: "global", a 7TV link (user or emote set), a set id, or a user name
async function parseSource(input) {
    const s = String(input || '').trim();
    if (!s) throw new Error('Enter a 7TV or Twitch name, a 7TV link or a set id');
    if (/^global$/i.test(s)) return { type: 'global' };
    const set = /7tv\.app\/emote-sets\/([0-9A-Za-z]+)/.exec(s);
    if (set) return { type: 'set', setId: set[1] };
    const user = /7tv\.app\/users\/([0-9A-Za-z]+)/.exec(s);
    if (user) {
        const u = await get7tv(`/users/${user[1]}`);
        return { type: 'user', name: u.username };
    }
    if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) return { type: 'set', setId: s.toUpperCase() };
    return { type: 'user', name: s.replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/.*$/, '') };
}

// what an emote's "from" says: the user, "global", or the set's name
const labelOf = (src) => (src.type === 'user' ? src.name : src.type === 'global' ? 'global' : src.setName);

// a source → { source (with set name and count), emotes }; a user's set is looked up again (it may have changed)
async function fetchSource(src) {
    const out = { ...src };
    delete out.error;
    if (src.type === 'user') Object.assign(out, await userSet(src.name));
    const data = await get7tv(src.type === 'global' ? '/emote-sets/global' : `/emote-sets/${out.setId}`);
    out.setId = data.id;
    out.setName = data.name;
    const emotes = {};
    // a name with a colon (":3", "D:") goes without it (:3:, :D:), unless an emote has that name already
    const all = data.emotes || [];
    const named = all.filter((e) => validName(e.name)).map((e) => [e.name, e]);
    const colons = all.filter((e) => !validName(e.name)).map((e) => [e.name.replace(/:/g, '').trim(), e, e.name]).filter(([n]) => validName(n));
    for (const [name, e, original] of [...named, ...colons]) {
        if (emotes[name]) continue;
        const files = e.data?.host?.files || [];
        const small = files.find((f) => f.name === '1x.webp') || files[0] || {};
        emotes[name] = { url: `https://cdn.7tv.app/emote/${e.id}/2x.webp`, w: small.width || 28, h: small.height || 28, animated: !!e.data?.animated, from: labelOf(out), ...(original ? { original } : {}) };
    }
    out.count = Object.keys(emotes).length;
    return { source: out, emotes };
}

// sources and custom emotes → the file's emote list. A source that can't be fetched keeps its emotes from before.
async function build(sources, custom, previous = {}) {
    const results = await Promise.all(sources.map((s) => fetchSource(s).catch((err) => ({ source: { ...s, error: err.message }, emotes: null }))));
    const emotes = {};
    for (const c of custom) emotes[c.name] = { url: c.url, w: c.w || 0, h: c.h || 0, animated: false, from: 'custom' };
    for (const r of results) {
        const own = r.emotes || Object.fromEntries(Object.entries(previous).filter(([, e]) => e.from === labelOf(r.source)));
        for (const [name, e] of Object.entries(own)) if (!emotes[name]) emotes[name] = e;
    }
    return { sources: results.map((r) => r.source), emotes };
}

const fail = (res, what) => (err) => {
    console.error(`Emotes: ${what} failed:`, err.message);
    res.status(err.status === 409 ? 409 : 500).json({ success: false, error: err.status === 409 ? 'The emotes were changed meanwhile — reload and try again' : `Could not ${what}: ${err.message}` });
};

router.get('/', async (req, res) => {
    try { res.json({ success: true, ...(await load()).file }); } catch (err) { fail(res, 'load the emotes')(err); }
});

// What a typed source is, before it is added: { source } with its set name and count, or an error
router.post('/lookup', requireAuth, async (req, res) => {
    try {
        const { source } = await fetchSource(await parseSource(req.body?.input));
        res.json({ success: true, source });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

// The whole setup: { sources: [ { type, name | setId } ], custom: [ { name, url } ] } — 7TV is fetched again
router.put('/', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const sources = (Array.isArray(body.sources) ? body.sources : [])
            .filter((s) => ['user', 'set', 'global'].includes(s?.type))
            .map((s) => (s.type === 'user' ? { type: 'user', name: String(s.name || '').trim() } : s.type === 'set' ? { type: 'set', setId: String(s.setId || '').trim() } : { type: 'global' }))
            .filter((s) => s.type === 'global' || s.name || s.setId);
        const custom = [];
        for (const c of Array.isArray(body.custom) ? body.custom : []) {
            const name = String(c?.name || '').trim();
            const url = String(c?.url || '').trim();
            if (!validName(name)) return res.status(400).json({ success: false, error: `“${name}” can't be an emote name (no spaces or colons)` });
            if (!/^https?:\/\//.test(url)) return res.status(400).json({ success: false, error: `“${name}” needs an image` });
            if (custom.some((x) => x.name === name)) return res.status(400).json({ success: false, error: `“${name}” is there twice` });
            custom.push({ name, url });
        }
        const { file, sha } = await load();
        const built = await build(sources, custom, file.emotes);
        const next = { version: 1, sources: built.sources, custom, emotes: built.emotes };
        await save(next, sha, `Update emotes: ${Object.keys(next.emotes).length} (by ${userOf(req)})`);
        res.json({ success: true, ...next });
        require('../lib/emotes-live').sync(); // the sources may have changed: follow their sets
    } catch (err) { fail(res, 'save the emotes')(err); }
});

// Live (lib/emotes-live.js): the saved sources fetched again from 7TV — after 7TV reported a change to one of the
// sets, and every 30 minutes. Saved (one commit, maps reload it) only when the emotes really changed.
async function refreshFrom7tv() {
    const { file, sha } = await load();
    if (!file.sources?.length) return null;
    const built = await build(file.sources, file.custom || [], file.emotes || {});
    const before = Object.keys(file.emotes || {});
    const after = Object.keys(built.emotes);
    const same = JSON.stringify(file.emotes || {}) === JSON.stringify(built.emotes)
        && JSON.stringify((file.sources || []).map((s) => [s.setId, s.count])) === JSON.stringify(built.sources.map((s) => [s.setId, s.count]));
    if (same) return { changed: false, count: after.length };
    const added = after.filter((n) => !file.emotes?.[n]).length;
    const removed = before.filter((n) => !built.emotes[n]).length;
    await save({ version: 1, sources: built.sources, custom: file.custom || [], emotes: built.emotes }, sha,
        `Update emotes from 7TV: ${after.length} (+${added} −${removed}, live)`);
    return { changed: true, count: after.length, added, removed };
}

// the 7TV sets the emotes come from (to follow them live)
async function setIds() {
    const { file } = await load();
    return [...new Set((file.sources || []).map((s) => s.setId).filter(Boolean))];
}

module.exports = router;
module.exports.refreshFrom7tv = refreshFrom7tv;
module.exports.setIds = setIds;
