// protocol-live.js - Writing the session minutes together, live (WebSocket at /api/protocols/live).
//
// One Yjs document per session that someone has open:
//   getText('content')   the minutes — concurrent typing merges character by character (a CRDT: every copy that has
//                        received the same updates has the same text, whatever order they arrived in)
//   getMap('fields')     number, title, date, players + places (JSON), level, ingameStart, ingameEnd — last writer
//                        wins per field
// Awareness carries who is there (the name each device chose) and their cursors.
// The server relays updates between the people in a session, and persists: the Yjs state in
// data/protocol-live/<id>.yjs (so a device that edited offline can merge after a server restart) and the plain values
// as the session's draft (protocol-store.saveDraft, lenient). Readers see the draft only once someone publishes it.
// Saves through the REST API and renames are applied into an open document as minimal diffs (live editors keep
// their cursors). Messages are JSON; Yjs binary updates are base64.
//
// Access: a CMS login (session cookie, checked on upgrade) or the protocol token, sent as the first message
// { t: 'auth', token } — browsers can't set headers on WebSockets, and a token in the URL would end up in logs.
// Only pages of the CMS and the map may connect (Origin check against cross-site WebSocket hijacking).
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const awarenessProtocol = require('y-protocols/awareness');
const decoding = require('lib0/decoding');
const { diffChars } = require('diff');
const fs = require('fs').promises;
const path = require('path');
const store = require('./protocol-store');
const { tokenValid } = require('./protocol-auth');

const PATHNAME = '/api/protocols/live';
const ORIGINS = new Set(['https://adenai-admin.piogino.ch', 'https://adenai.piogino.ch']);
const LIVE_DIR = path.join(store.DIR, 'protocol-live');
const FIELDS = ['number', 'title', 'date', 'players', 'places', 'level', 'ingameStart', 'ingameEnd'];
const LISTS = new Set(['players', 'places']);
const PERSIST_MS = 1500;
const UNLOAD_MS = 60000;

const docs = new Map(); // session id → entry { id, doc, awareness, conns: Set, contributors: Set, timer, unload, ready }
const conns = new Set(); // every open connection, for the heartbeat
const b64 = (u8) => Buffer.from(u8).toString('base64');
const fromB64 = (s) => new Uint8Array(Buffer.from(String(s || ''), 'base64'));
const fileOf = (id) => path.join(LIVE_DIR, `${String(id).replace(/[^\w-]/g, '')}.yjs`);

// Replace a Y.Text's content with a minimal character diff — other editors' cursors stay where they were.
function setText(ytext, value) {
    const old = ytext.toString();
    if (old === value) return;
    let pos = 0;
    for (const part of diffChars(old, value)) {
        if (part.added) { ytext.insert(pos, part.value); pos += part.value.length; }
        else if (part.removed) ytext.delete(pos, part.value.length);
        else pos += part.value.length;
    }
}

const fieldValue = (s, f) => (LISTS.has(f) ? JSON.stringify(s[f] || []) : String(s[f] ?? ''));

function applySession(entry, s, origin) {
    const fields = entry.doc.getMap('fields');
    entry.doc.transact(() => {
        setText(entry.doc.getText('content'), String(s.content || ''));
        for (const f of FIELDS) if (fields.get(f) !== fieldValue(s, f)) fields.set(f, fieldValue(s, f));
    }, origin);
}

function valuesOf(entry) {
    const m = entry.doc.getMap('fields').toJSON();
    const list = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : undefined; } catch { return undefined; } }; // garbage: keep the stored list
    return {
        number: m.number === '' || m.number === undefined ? '' : Number(m.number),
        title: m.title || '', date: m.date || '', players: list(m.players), places: list(m.places),
        level: m.level === '' || m.level === undefined ? '' : Number(m.level),
        ingameStart: m.ingameStart || '', ingameEnd: m.ingameEnd || '',
        content: entry.doc.getText('content').toString(),
    };
}

function send(conn, msg) {
    if (conn.ws.readyState === 1) conn.ws.send(JSON.stringify(msg));
}

function broadcast(entry, msg, except = null) {
    for (const c of entry.conns) if (c !== except) send(c, msg);
}

async function persist(entry) {
    clearTimeout(entry.timer);
    entry.timer = null;
    try {
        await fs.mkdir(LIVE_DIR, { recursive: true, mode: 0o700 });
        await fs.writeFile(fileOf(entry.id), Buffer.from(Y.encodeStateAsUpdate(entry.doc)), { mode: 0o600 });
        const by = [...entry.contributors].join(', ') || 'live';
        await store.saveDraft(entry.id, valuesOf(entry), { by });
    } catch (err) {
        console.error(`protocol-live: saving ${entry.id} failed:`, err.message);
    }
}

function schedulePersist(entry) {
    if (!entry.timer) entry.timer = setTimeout(() => persist(entry), PERSIST_MS);
}

async function open(id) {
    if (docs.has(id)) { const e = docs.get(id); await e.ready; return e.gone ? null : e; }
    const entry = { id, doc: new Y.Doc(), conns: new Set(), contributors: new Set(), timer: null, unload: null };
    entry.awareness = new awarenessProtocol.Awareness(entry.doc);
    entry.awareness.setLocalState(null); // the server itself is nobody
    docs.set(id, entry);
    entry.ready = (async () => {
        const session = await store.get(id);
        if (!session) { entry.gone = true; docs.delete(id); return; }
        try { Y.applyUpdate(entry.doc, new Uint8Array(await fs.readFile(fileOf(id))), 'disk'); } catch { /* first time live */ }
        applySession(entry, store.working(session), 'server'); // the stored draft may be newer (REST save, rename): merge it in
        entry.doc.on('update', (update, origin) => {
            broadcast(entry, { t: 'update', id, u: b64(update) }, origin && origin.ws ? origin : null);
            schedulePersist(entry);
        });
        entry.awareness.on('update', ({ added, updated, removed }, origin) => {
            const changed = [...added, ...updated, ...removed];
            broadcast(entry, { t: 'awareness', id, u: b64(awarenessProtocol.encodeAwarenessUpdate(entry.awareness, changed)) }, origin && origin.ws ? origin : null);
        });
    })();
    await entry.ready;
    return entry.gone ? null : entry;
}

async function leave(conn, id) {
    const entry = docs.get(id);
    if (!entry || !entry.conns.has(conn)) return;
    entry.conns.delete(conn);
    const ids = [...(conn.clients.get(id) || [])];
    conn.clients.delete(id);
    if (ids.length) awarenessProtocol.removeAwarenessStates(entry.awareness, ids, null);
    if (!entry.conns.size) {
        await persist(entry);
        entry.unload = setTimeout(() => { if (!entry.conns.size) { entry.doc.destroy(); docs.delete(id); } }, UNLOAD_MS);
    }
}

async function handle(conn, msg) {
    if (msg.t === 'auth') {
        if (conn.user) return;
        if (await tokenValid(msg.token)) { conn.user = { name: 'Map', via: 'map' }; send(conn, { t: 'ready' }); }
        else { send(conn, { t: 'error', error: 'locked' }); conn.ws.close(4401, 'locked'); }
        return;
    }
    if (!conn.user) return send(conn, { t: 'error', error: 'locked' });
    const id = String(msg.id || '');
    if (msg.t === 'join') {
        const entry = await open(id);
        if (!entry) return send(conn, { t: 'gone', id });
        clearTimeout(entry.unload);
        entry.conns.add(conn);
        conn.clients.set(id, new Set());
        if (msg.name) entry.contributors.add(String(msg.name).slice(0, 40));
        const states = [...entry.awareness.getStates().keys()];
        send(conn, { t: 'sync', id, state: b64(Y.encodeStateAsUpdate(entry.doc)), sv: b64(Y.encodeStateVector(entry.doc)) });
        if (states.length) send(conn, { t: 'awareness', id, u: b64(awarenessProtocol.encodeAwarenessUpdate(entry.awareness, states)) });
        return;
    }
    const entry = docs.get(id);
    if (!entry || !entry.conns.has(conn)) return;
    if (msg.t === 'update') {
        Y.applyUpdate(entry.doc, fromB64(msg.u), conn); // origin = the connection: not echoed back to it
        if (msg.name) entry.contributors.add(String(msg.name).slice(0, 40));
    } else if (msg.t === 'awareness') {
        const u = fromB64(msg.u);
        // remember which awareness client ids belong to this connection, to remove them when it goes
        const decoder = decoding.createDecoder(u);
        const n = decoding.readVarUint(decoder);
        for (let i = 0; i < n; i++) {
            conn.clients.get(id)?.add(decoding.readVarUint(decoder)); // client id
            decoding.readVarUint(decoder); // clock
            decoding.readVarString(decoder); // state JSON
        }
        awarenessProtocol.applyAwarenessUpdate(entry.awareness, u, conn);
    } else if (msg.t === 'leave') {
        await leave(conn, id);
    }
}

// REST saves, renames and deletions while a document is open
// Every connected device hears of new, published and discarded sessions ({ t: 'session' }, the whole session) and of
// drafts changing ({ t: 'draft' }, just who and when) — it joins a session's document only to edit it.
const everyone = (msg) => { for (const c of conns) if (c.user) send(c, msg); };
const draftInfo = (s) => (s.draft ? { updatedAt: s.draft.updatedAt, updatedBy: s.draft.updatedBy, number: s.draft.values.number, title: s.draft.values.title } : null);

// (publishing makes the live text the published one: nothing to apply)
store.events.on('changed', (session, { published = false } = {}) => {
    const entry = docs.get(session.id);
    if (entry && !entry.gone && !published) applySession(entry, store.working(session), 'server');
    everyone({ t: 'session', session: store.strip(session) });
});
// proposed entries (lib/pending-store.js): every device gets the new list
require('./pending-store').events.on('changed', (entries) => everyone({ t: 'pending', entries }));
store.events.on('draft', (session) => everyone({ t: 'draft', id: session.id, published: session.published !== false, draft: draftInfo(session) }));
store.events.on('deleted', async (id) => {
    const entry = docs.get(id);
    if (entry) {
        entry.gone = true;
        clearTimeout(entry.timer);
        entry.doc.destroy();
        docs.delete(id);
    }
    everyone({ t: 'gone', id });
    await fs.unlink(fileOf(id)).catch(() => {});
});

function attach(server, sessionMiddleware) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
    server.on('upgrade', (req, socket, head) => {
        const reject = (status, text) => { socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
        try {
            if (new URL(req.url, 'http://x').pathname !== PATHNAME) return; // other upgrades aren't ours
            if (!ORIGINS.has(req.headers.origin)) return reject(403, 'Forbidden');
            sessionMiddleware(req, {}, () => {
                wss.handleUpgrade(req, socket, head, (ws) => {
                    const s = req.session;
                    const conn = { ws, alive: true, clients: new Map(), user: s?.authenticated ? { name: s.displayName || s.username, via: 'cms' } : null };
                    if (conn.user) send(conn, { t: 'ready' });
                    // a map client has 5 s to authenticate with its token
                    const authTimer = setTimeout(() => { if (!conn.user) ws.close(4401, 'locked'); }, 5000);
                    let chain = Promise.resolve();
                    ws.on('message', (data) => {
                        let msg;
                        try { msg = JSON.parse(data); } catch { return; }
                        chain = chain.then(() => handle(conn, msg)).catch((err) => console.error('protocol-live:', err.message));
                    });
                    ws.on('pong', () => { conn.alive = true; });
                    ws.on('close', () => {
                        clearTimeout(authTimer);
                        for (const id of [...conn.clients.keys()]) leave(conn, id);
                    });
                    conns.add(conn);
                    ws.on('close', () => conns.delete(conn));
                });
            });
        } catch (err) {
            console.error('protocol-live upgrade failed:', err.message);
            reject(500, 'Internal Server Error');
        }
    });
    // a connection that doesn't answer a ping within 30 s is gone (laptop closed, network lost)
    setInterval(() => {
        for (const c of conns) {
            if (!c.alive) { c.ws.terminate(); continue; }
            c.alive = false;
            c.ws.ping();
        }
    }, 30000).unref();
}

// before publishing: what was typed in the last moments goes into the draft first
async function flush(id) {
    const entry = docs.get(id);
    if (entry && !entry.gone) await persist(entry);
}

// before the server stops: write every open document
async function flushAll() {
    await Promise.all([...docs.values()].filter((e) => !e.gone).map((e) => persist(e)));
}

module.exports = { attach, flush, flushAll };
