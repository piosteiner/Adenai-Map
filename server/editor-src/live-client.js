// live-client.js - The browser side of writing the session minutes together (server: server/lib/protocol-live.js).
//
//   const live = AdenaiLive.connect({ url, token, onStatus, onMessage });   // token: the map's protocol token; the CMS
//                                                                          // uses its login. onMessage: session news
//                                                                          // ({ t: 'session' | 'draft' | 'gone' | 'pending' })
//   const room = live.join(sessionId, { name, color });           // { doc, text, fields, awareness, undoManager, ready, leave }
//
// One WebSocket for all rooms. Local changes go out as they happen; while offline they stay in the Yjs document and are
// sent on reconnect (the server tells us its state vector, we send what it lacks). Every copy ends up the same (CRDT).
// Status: 'connecting' | 'live' | 'offline' | 'locked'.
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { toBase64, fromBase64 } from 'lib0/buffer';

const COLORS = ['#b0561d', '#2f6f9f', '#7a4bb0', '#2f8f5b', '#b03a5b', '#8a6d1d', '#1d7f86', '#a1477f'];
export const colorFor = (name) => COLORS[[...String(name || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

export function connect({ url, token = null, onStatus = () => {}, onMessage = () => {} }) {
    const rooms = new Map();
    let ws = null;
    let status = 'connecting';
    let ready = false;
    let retry = 0;
    let closedByUs = false;

    const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };
    const send = (msg) => { if (ws && ws.readyState === 1 && ready) ws.send(JSON.stringify(msg)); };

    function open() {
        setStatus(navigator.onLine === false ? 'offline' : 'connecting');
        ws = new WebSocket(url);
        ready = false;
        ws.onopen = () => { if (token) ws.send(JSON.stringify({ t: 'auth', token })); };
        ws.onmessage = (ev) => {
            let m;
            try { m = JSON.parse(ev.data); } catch { return; }
            if (m.t === 'ready') {
                ready = true;
                retry = 0;
                setStatus('live');
                for (const room of rooms.values()) room.sendJoin();
                return;
            }
            if (m.t === 'error' && m.error === 'locked') { closedByUs = true; setStatus('locked'); return; }
            if (m.t === 'session' || m.t === 'draft' || m.t === 'gone' || m.t === 'pending') onMessage(m);
            const room = rooms.get(m.id);
            if (!room) return;
            if (m.t === 'sync') room.onSync(m);
            else if (m.t === 'update') Y.applyUpdate(room.doc, fromBase64(m.u), 'remote');
            else if (m.t === 'awareness') awarenessProtocol.applyAwarenessUpdate(room.awareness, fromBase64(m.u), 'remote');
            else if (m.t === 'gone') room.onGone?.();
        };
        ws.onclose = (ev) => {
            ready = false;
            for (const room of rooms.values()) room.synced = false;
            if (ev.code === 4401) { setStatus('locked'); return; }
            if (closedByUs) return;
            setStatus('offline');
            retry = Math.min(retry + 1, 6);
            setTimeout(open, 500 * 2 ** retry); // 1 s … 32 s
        };
    }

    function join(id, { name = 'Gast', color = colorFor(name) } = {}) {
        if (rooms.has(id)) return rooms.get(id);
        const doc = new Y.Doc();
        const awareness = new awarenessProtocol.Awareness(doc);
        awareness.setLocalStateField('user', { name, color, colorLight: `${color}33` });
        let resolveReady;
        const room = {
            id, doc, awareness,
            text: doc.getText('content'),
            fields: doc.getMap('fields'),
            undoManager: null,
            synced: false,
            ready: new Promise((r) => { resolveReady = r; }),
            sendJoin() { send({ t: 'join', id, name }); },
            onSync(m) {
                Y.applyUpdate(doc, fromBase64(m.state), 'remote');
                const mine = Y.encodeStateAsUpdate(doc, fromBase64(m.sv)); // what we typed while offline
                if (mine.length > 2) send({ t: 'update', id, u: toBase64(mine), name });
                room.synced = true;
                const states = [...awareness.getStates().keys()].filter((k) => k === doc.clientID);
                if (states.length) send({ t: 'awareness', id, u: toBase64(awarenessProtocol.encodeAwarenessUpdate(awareness, states)) });
                resolveReady(room);
            },
            setName(n) { awareness.setLocalStateField('user', { name: n, color: colorFor(n), colorLight: `${colorFor(n)}33` }); },
            // others in this session: [{ name, color, editing }]
            people() {
                return [...awareness.getStates().entries()].filter(([k, s]) => k !== doc.clientID && s.user).map(([, s]) => ({ ...s.user, editing: !!s.editing }));
            },
            leave() {
                send({ t: 'leave', id });
                awareness.destroy();
                doc.destroy();
                rooms.delete(id);
            },
        };
        room.undoManager = new Y.UndoManager(room.text); // undo only one's own typing
        doc.on('update', (u, origin) => { if (origin !== 'remote' && room.synced) send({ t: 'update', id, u: toBase64(u), name: awareness.getLocalState()?.user?.name }); });
        awareness.on('update', ({ added, updated, removed }, origin) => {
            if (origin === 'remote') return;
            const changed = [...added, ...updated, ...removed];
            if (room.synced) send({ t: 'awareness', id, u: toBase64(awarenessProtocol.encodeAwarenessUpdate(awareness, changed)) });
        });
        rooms.set(id, room);
        room.sendJoin();
        return room;
    }

    window.addEventListener('online', () => { if (!ws || ws.readyState > 1) { retry = 0; open(); } });
    open();
    return {
        join,
        status: () => status,
        close() { closedByUs = true; for (const r of [...rooms.values()]) r.leave(); ws?.close(); },
    };
}
