// protocol-store.js - The campaign's session minutes, kept on this server only.
//
// Unlike locations and characters they are NOT in the public repo: public/data is readable by anyone on GitHub and
// GitHub Pages, and the minutes are behind a password. Files (git-ignored, in the nightly encrypted backup):
//   data/protocols.json          { sessions: [ … ] }
//   data/protocol-settings.json  { passwordHash, passwordVersion, updatedAt, updatedBy }
// Writes go through one queue and an atomic rename, so two saves can't interleave or leave a half-written file.
//
// Published version and draft: a session's fields (FIELDS) are what readers see. Editing — live and together
// (lib/protocol-live.js) — happens in its `draft` { values, updatedAt, updatedBy }, the one shared working copy;
// nothing typed is lost, and "Speichern" (publish) makes the draft the published version, keeping the previous one
// in `history` (newest first, at most HISTORY_MAX). A new session starts unpublished (published: false) with only a
// draft; on the map there can be only one such session at a time.
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// 'changed' (session, { published }) when published values or the draft changed other than by live typing (publish,
// discard, REST save, rename), 'draft' (session) when live typing changed the draft, 'deleted' (id):
// lib/protocol-live.js keeps open live documents in step and tells every connected device
const events = new EventEmitter();

const DIR = process.env.PROTOCOL_DATA_DIR || path.join(__dirname, '..', 'data'); // tests use their own folder
const FILE = path.join(DIR, 'protocols.json');
const SETTINGS = path.join(DIR, 'protocol-settings.json');
const BIN = path.join(DIR, 'protocols-deleted.json');
const HISTORY_MAX = 30;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = ['number', 'title', 'date', 'players', 'places', 'level', 'ingameStart', 'ingameEnd', 'content'];

let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job, job));

async function readJson(file, fallback) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return fallback; throw err; }
}
async function writeJson(file, data) {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await fs.rename(tmp, file);
}

const load = () => readJson(FILE, { version: 2, sessions: [] });
const strip = ({ history, ...s }) => ({ ...s, versions: (history || []).length });
const pick = (s) => Object.fromEntries(FIELDS.map((k) => [k, s[k]]));
const same = (a, b) => FIELDS.every((k) => JSON.stringify(a[k] ?? '') === JSON.stringify(b[k] ?? ''));
// what the editors work on: the draft, or the published version when there is none
const working = (s) => (s.draft ? { ...s, ...s.draft.values } : s);

// ---------- values ----------

const list_ = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean))].slice(0, 60);

// strict: for publishing (required: number, players, real-life date). Lenient (drafts): invalid fields are left out,
// so the caller keeps the previous value — while typing a field can be empty or half-typed for a moment.
function clean(input, { strict = true } = {}) {
    const errors = [];
    const out = {};
    const number = Number(input.number);
    if (input.number !== '' && input.number !== undefined && Number.isInteger(number) && number >= 0) out.number = number;
    else if (strict) errors.push('Session number must be a whole number');

    const players = list_(input.players);
    if (players.length || !strict) out.players = players;
    if (!players.length && strict) errors.push('At least one player who attended');
    out.places = list_(input.places);

    const date = String(input.date || '').trim();
    if (DATE.test(date) && !Number.isNaN(Date.parse(date))) out.date = date;
    else if (strict) errors.push('Real-life date of the session (YYYY-MM-DD)');

    for (const k of ['ingameStart', 'ingameEnd']) {
        const v = String(input[k] ?? '').trim();
        if (!v || DATE.test(v)) out[k] = v;
        else if (strict) errors.push(`${k === 'ingameStart' ? 'In-game start' : 'In-game end'} must be YYYY-MM-DD`);
    }
    const level = input.level === '' || input.level === null || input.level === undefined ? '' : Number(input.level);
    if (level === '' || (Number.isInteger(level) && level >= 1 && level <= 30)) out.level = level;
    else if (strict) errors.push('Party level must be a whole number from 1 to 30');

    out.title = String(input.title ?? '').trim().slice(0, 200);
    out.content = String(input.content ?? '').slice(0, 300000);
    return { errors, value: out };
}

const blank = { number: '', title: '', date: '', players: [], places: [], level: '', ingameStart: '', ingameEnd: '', content: '' };

// ---------- reading ----------

async function list() {
    return (await load()).sessions.map(strip).sort((a, b) => (working(a).number || 0) - (working(b).number || 0));
}

async function get(id, { history = false } = {}) {
    const s = (await load()).sessions.find((x) => x.id === id);
    if (!s) return null;
    return history ? s : strip(s);
}

// ---------- writing ----------

// A new session: unpublished, its values only in the draft. via 'map': only one unpublished session may exist —
// then that one is returned (status 409) instead of a second draft for the same evening.
function create(input, { by = 'unknown', via = 'cms' } = {}) {
    return serial(async () => {
        const data = await load();
        if (via === 'map') {
            const open = data.sessions.find((x) => x.published === false);
            if (open) return { status: 409, error: 'There is an unsaved new session already', session: strip(open) };
        }
        const { value } = clean(input, { strict: false });
        const number = value.number ?? Math.max(0, ...data.sessions.map((x) => working(x).number || 0)) + 1;
        if (data.sessions.some((x) => working(x).number === number)) return { status: 409, error: `Session ${number} exists already` };
        const now = new Date().toISOString();
        const session = {
            id: crypto.randomUUID(), ...blank, published: false,
            draft: { values: { ...blank, ...value, number }, updatedAt: now, updatedBy: by },
            createdAt: now, createdBy: by, createdVia: via, updatedAt: now, updatedBy: by, updatedVia: via, history: [],
        };
        data.sessions.push(session);
        await writeJson(FILE, data);
        events.emit('changed', session);
        return { status: 201, session: strip(session) };
    });
}

// Publish values directly (REST save from a form, the import): strict. A draft that now equals them goes away.
function save(input, { id = null, by = 'unknown', via = 'cms' } = {}) {
    return serial(async () => {
        const data = await load();
        const existing = id ? data.sessions.find((x) => x.id === id) : null;
        if (id && !existing) return { status: 404, error: 'Session not found' };
        const { errors, value } = clean(input);
        if (errors.length) return { status: 400, error: errors.join(' · '), errors };
        const clash = data.sessions.find((x) => x.id !== id && (x.number === value.number || working(x).number === value.number));
        if (clash) return { status: 409, error: `Session ${value.number} exists already` };
        const now = new Date().toISOString();
        let session;
        if (existing) {
            const { history = [], ...previous } = existing;
            session = Object.assign(existing, value, { published: true, updatedAt: now, updatedBy: by, updatedVia: via });
            if (previous.published !== false) session.history = [previous, ...history].slice(0, HISTORY_MAX);
            if (session.draft && same(session.draft.values, session)) session.draft = null;
        } else {
            session = { id: crypto.randomUUID(), ...value, published: true, draft: null, createdAt: now, createdBy: by, createdVia: via, updatedAt: now, updatedBy: by, updatedVia: via, history: [] };
            data.sessions.push(session);
        }
        await writeJson(FILE, data);
        events.emit('changed', session);
        return { status: existing ? 200 : 201, session: strip(session) };
    });
}

// What the live editors typed (lib/protocol-live.js) → the draft. Lenient: an invalid field keeps the draft's
// previous value. A draft equal to the published version is no draft. Readers see nothing of it until published.
function saveDraft(id, input, { by = 'live' } = {}) {
    return serial(async () => {
        const data = await load();
        const s = data.sessions.find((x) => x.id === id);
        if (!s) return null;
        const { value } = clean(input, { strict: false });
        const values = { ...pick(working(s)), ...value };
        if (s.published !== false && same(values, s)) {
            if (!s.draft) return strip(s);
            s.draft = null;
        } else {
            if (s.draft && same(values, s.draft.values)) return strip(s);
            s.draft = { values, updatedAt: new Date().toISOString(), updatedBy: by };
        }
        await writeJson(FILE, data);
        events.emit('draft', s);
        return strip(s);
    });
}

// "Speichern": the draft becomes the published version (strict check), the previous one goes into the history
function publish(id, { by = 'unknown', via = 'map' } = {}) {
    return serial(async () => {
        const data = await load();
        const s = data.sessions.find((x) => x.id === id);
        if (!s) return { status: 404, error: 'Session not found' };
        const { errors, value } = clean(pick(working(s)));
        if (errors.length) return { status: 400, error: errors.join(' · '), errors };
        if (data.sessions.some((x) => x.id !== id && x.number === value.number)) return { status: 409, error: `Session ${value.number} exists already` };
        const now = new Date().toISOString();
        const { history = [], ...previous } = s;
        if (s.published !== false) s.history = [previous, ...history].slice(0, HISTORY_MAX);
        Object.assign(s, value, { published: true, draft: null, updatedAt: now, updatedBy: by, updatedVia: via });
        await writeJson(FILE, data);
        events.emit('changed', s, { published: true });
        return { status: 200, session: strip(s) };
    });
}

// Throw the draft away: back to the published version — or, for a session never published, the session itself
// (kept aside in protocols-deleted.json like a deletion).
function discardDraft(id) {
    return serial(async () => {
        const data = await load();
        const i = data.sessions.findIndex((x) => x.id === id);
        if (i < 0) return { status: 404, error: 'Session not found' };
        const s = data.sessions[i];
        if (s.published === false) {
            data.sessions.splice(i, 1);
            await toBin(s);
            await writeJson(FILE, data);
            events.emit('deleted', id);
            return { status: 200, deleted: true };
        }
        s.draft = null;
        await writeJson(FILE, data);
        events.emit('changed', s);
        return { status: 200, session: strip(s) };
    });
}

async function toBin(s) {
    const bin = await readJson(BIN, { sessions: [] });
    bin.sessions.unshift({ ...s, deletedAt: new Date().toISOString() });
    await writeJson(BIN, bin);
}

function remove(id) {
    return serial(async () => {
        const data = await load();
        const i = data.sessions.findIndex((x) => x.id === id);
        if (i < 0) return { status: 404, error: 'Session not found' };
        const [gone] = data.sessions.splice(i, 1);
        await toBin(gone); // kept aside rather than lost
        await writeJson(FILE, data);
        events.emit('deleted', id);
        return { status: 200, session: strip(gone) };
    });
}

// A character, location or term was renamed: its [[links]] follow in titles and texts, and the name in the players and
// places lists, published and drafts (lib/link-rename.js). The previous published text goes into the history. Returns the number of sessions changed.
function renameLinks(oldName, newName, by = 'rename') {
    const { renameInText } = require('./link-rename');
    const fold = (x) => String(x).normalize('NFC').trim().toLowerCase();
    const renameInList = (list) => (Array.isArray(list) ? [...new Set(list.map((x) => (fold(x) === fold(oldName) ? newName : x)))] : list);
    return serial(async () => {
        const data = await load();
        const changedSessions = [];
        const now = new Date().toISOString();
        for (const s of data.sessions) {
            let touched = false;
            const renamed = (v) => ({
                title: renameInText(v.title, oldName, newName),
                content: renameInText(v.content, oldName, newName),
                players: renameInList(v.players),
                places: renameInList(v.places),
            });
            const changed = (v, r) => Object.keys(r).some((k) => JSON.stringify(v[k] ?? '') !== JSON.stringify(r[k] ?? ''));
            const r = renamed(s);
            if (changed(s, r)) {
                const { history = [], ...previous } = s;
                if (s.published !== false) s.history = [previous, ...history].slice(0, HISTORY_MAX);
                Object.assign(s, r, { updatedAt: now, updatedBy: by, updatedVia: 'rename' });
                touched = true;
            }
            if (s.draft) {
                const rd = renamed(s.draft.values);
                if (changed(s.draft.values, rd)) { Object.assign(s.draft.values, rd); touched = true; }
            }
            if (touched) changedSessions.push(s);
        }
        if (changedSessions.length) {
            await writeJson(FILE, data);
            changedSessions.forEach((s) => events.emit('changed', s));
        }
        return changedSessions.length;
    });
}

// Names used in sessions so far, most frequent first (suggestions for the players and places fields)
async function suggestions() {
    const count = { players: new Map(), places: new Map() };
    for (const s of (await load()).sessions) {
        for (const k of ['players', 'places']) for (const v of working(s)[k] || []) count[k].set(v, (count[k].get(v) || 0) + 1);
    }
    const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([n]) => n);
    return { players: sorted(count.players), places: sorted(count.places) };
}
const players = async () => (await suggestions()).players;

// ---------- settings ----------

const settings = () => readJson(SETTINGS, { passwordHash: null, passwordVersion: 0 });
const saveSettings = (s) => serial(() => writeJson(SETTINGS, s));

module.exports = {
    list, get, create, save, saveDraft, publish, discardDraft, remove, renameLinks, players, suggestions, settings, saveSettings,
    working, pick, strip, FIELDS, events, DIR,
};
