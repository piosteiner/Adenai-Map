// Emotes follow the 7TV sets live: 7TV's event feed (events.7tv.io, server-sent events) reports every change to an
// emote set ("dispatch" with type emote_set.update). A few seconds after one, routes/emotes.js refreshFrom7tv() fetches
// the sources again and saves emotes.json if the emotes changed — open maps reload it (routes/data.js "changed").
// One connection per set; reopened when it drops or heartbeats stop. Every 30 minutes a refresh anyway, which also
// catches a channel switching to another set. Off with EMOTES_LIVE=off (tests).
const EVENTS = process.env.SEVENTV_EVENTS || 'https://events.7tv.io/v3';
const CHECK_EVERY = 30 * 60_000;
const SETTLE_MS = 5000; // several changes in a row: one refresh

let api = null;           // { refreshFrom7tv, setIds } from routes/emotes.js
const feeds = new Map();  // setId → AbortController
let refreshTimer = null;
let log = console;

function refreshSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
        try {
            const r = await api.refreshFrom7tv();
            if (r?.changed) log.log(`Emotes: 7TV set changed — now ${r.count} (+${r.added} −${r.removed})`);
            await sync();
        } catch (err) { log.error('Emotes live refresh:', err.message); }
    }, SETTLE_MS);
}

// Splits a server-sent event stream into events: onEvent(name, data) for every complete block.
function eventParser(onEvent) {
    let buf = '';
    return (text) => {
        buf += text.replace(/\r\n/g, '\n');
        let cut;
        while ((cut = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, cut);
            buf = buf.slice(cut + 2);
            const name = /^event: *(.*)$/m.exec(block)?.[1];
            const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
            if (name) onEvent(name, data);
        }
    };
}

async function follow(setId, retry = 0) {
    const abort = new AbortController();
    feeds.set(setId, abort);
    let beat = 60_000;
    let watchdog = null;
    const alive = () => { clearTimeout(watchdog); watchdog = setTimeout(() => abort.abort(), beat * 2 + 5000); };
    try {
        const res = await fetch(`${EVENTS}@${encodeURIComponent(`emote_set.update<object_id=${setId}>`)}`, {
            headers: { Accept: 'text/event-stream' }, signal: abort.signal,
        });
        if (!res.ok || !res.body) throw new Error(`7TV events answered ${res.status}`);
        retry = 0;
        alive();
        const decoder = new TextDecoder();
        const feed = eventParser((name, data) => {
            if (name === 'hello') { try { beat = JSON.parse(data).heartbeat_interval || beat; } catch { /* keep */ } }
            else if (name === 'dispatch') { try { if (JSON.parse(data)?.type === 'emote_set.update') refreshSoon(); } catch { /* not ours */ } }
        });
        for await (const chunk of res.body) { alive(); feed(decoder.decode(chunk, { stream: true })); }
    } catch (err) {
        if (feeds.get(setId) !== abort) return; // stopped or replaced
        if (err.name !== 'AbortError') log.error(`Emotes live (${setId}):`, err.message);
    } finally {
        clearTimeout(watchdog);
    }
    if (feeds.get(setId) !== abort) return;
    // dropped: back after 5 s, 10 s … at most 5 minutes; a refresh catches what was missed meanwhile
    setTimeout(() => {
        if (feeds.get(setId) !== abort) return;
        refreshSoon();
        follow(setId, retry + 1);
    }, Math.min(300_000, 5000 * 2 ** retry));
}

// Follows exactly the sets the sources point at now
async function sync() {
    if (!api) return;
    let ids;
    try { ids = await api.setIds(); } catch (err) { log.error('Emotes live:', err.message); return; }
    for (const [id, abort] of feeds) if (!ids.includes(id)) { feeds.delete(id); abort.abort(); }
    for (const id of ids) if (!feeds.has(id)) follow(id);
}

function start(emotesRoute, { logger = console } = {}) {
    if (process.env.EMOTES_LIVE === 'off') return;
    api = emotesRoute;
    log = logger;
    sync();
    setInterval(refreshSoon, CHECK_EVERY).unref();
}

function stop() {
    for (const abort of feeds.values()) abort.abort();
    feeds.clear();
    clearTimeout(refreshTimer);
    api = null;
}

module.exports = { start, stop, sync, eventParser };
