// protocol-comments.js - Comments on the minutes: a marked passage and what someone wrote about it, under their name.
// Kept apart from the minutes — never in their text, history or export: data/protocol-comments.json
//   { version: 1, sessions: { <session id>: [ { id, by, text, quote, prefix, suffix } ] } }
// quote is the marked text as read; prefix / suffix (a few characters around it) find the right place when the same
// words occur more than once. Nothing else is kept (no date): the comment and its writer's name are all there is.
// "changed" (session id, its comments) on events, for the live connection (lib/protocol-live.js).
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { DIR } = require('./protocol-store');

const FILE = path.join(DIR, 'protocol-comments.json');
const events = new EventEmitter();

let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job, job));

async function load() {
    try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return { version: 1, sessions: {} }; throw err; }
}
async function write(data) {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await fs.rename(tmp, FILE);
}

const str = (v, max) => String(v ?? '').slice(0, max);

async function all() {
    return (await load()).sessions;
}

// → { comment, comments } or { error }
function add(sessionId, input) {
    return serial(async () => {
        const by = str(input.by, 40).trim();
        const text = str(input.text, 2000).trim();
        const quote = str(input.quote, 1000);
        if (!by) return { error: 'Ein Name fehlt' };
        if (!text) return { error: 'Der Kommentar ist leer' };
        if (!quote.trim()) return { error: 'Keine Textstelle markiert' };
        const data = await load();
        const list = (data.sessions[sessionId] ||= []);
        const comment = { id: crypto.randomBytes(6).toString('hex'), by, text, quote, prefix: str(input.prefix, 40), suffix: str(input.suffix, 40) };
        list.push(comment);
        await write(data);
        events.emit('changed', sessionId, list);
        return { comment, comments: list };
    });
}

// Only its writer (the same name) or the CMS may change a comment's text → { comment, comments } or { error, status }
function update(sessionId, commentId, { by = '', text = '', admin = false } = {}) {
    return serial(async () => {
        const value = str(text, 2000).trim();
        if (!value) return { error: 'Der Kommentar ist leer', status: 400 };
        const data = await load();
        const list = data.sessions[sessionId] || [];
        const comment = list.find((c) => c.id === commentId);
        if (!comment) return { error: 'Kommentar nicht gefunden', status: 404 };
        if (!admin && comment.by !== String(by).trim()) return { error: 'Nur wer ihn geschrieben hat, kann ihn ändern', status: 403 };
        comment.text = value;
        await write(data);
        events.emit('changed', sessionId, list);
        return { comment, comments: list };
    });
}

// Only its writer (the same name) or the CMS may delete a comment → { comments } or { error, status }
function remove(sessionId, commentId, { by = '', admin = false } = {}) {
    return serial(async () => {
        const data = await load();
        const list = data.sessions[sessionId] || [];
        const i = list.findIndex((c) => c.id === commentId);
        if (i < 0) return { error: 'Kommentar nicht gefunden', status: 404 };
        if (!admin && list[i].by !== String(by).trim()) return { error: 'Nur wer ihn geschrieben hat, kann ihn löschen', status: 403 };
        list.splice(i, 1);
        if (!list.length) delete data.sessions[sessionId];
        await write(data);
        events.emit('changed', sessionId, list);
        return { comments: list };
    });
}

module.exports = { all, add, update, remove, events };
