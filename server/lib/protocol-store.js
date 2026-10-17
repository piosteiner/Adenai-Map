// protocol-store.js - The campaign's session minutes, kept on this server only.
//
// Unlike locations and characters they are NOT in the public repo: public/data is readable by anyone on GitHub and
// GitHub Pages, and the minutes are behind a password. Files (git-ignored, in the nightly encrypted backup):
//   data/protocols.json          { sessions: [ … ] }
//   data/protocol-settings.json  { passwordHash, passwordVersion, updatedAt, updatedBy }
// Writes go through one queue and an atomic rename, so two saves can't interleave or leave a half-written file.
// Every change keeps the previous version in the session's `history` (newest first, at most HISTORY_MAX).
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.PROTOCOL_DATA_DIR || path.join(__dirname, '..', 'data'); // tests use their own folder
const FILE = path.join(DIR, 'protocols.json');
const SETTINGS = path.join(DIR, 'protocol-settings.json');
const HISTORY_MAX = 30;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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

const load = () => readJson(FILE, { version: 1, sessions: [] });
const strip = ({ history, ...s }) => ({ ...s, versions: (history || []).length });

// ---------- validation: the only required fields are the session number, players and the real-life date ----------

function clean(input, existing = {}) {
    const errors = [];
    const out = {};
    const number = Number(input.number);
    if (!Number.isInteger(number) || number < 0) errors.push('Session number must be a whole number');
    out.number = number;

    const players = (Array.isArray(input.players) ? input.players : String(input.players || '').split(','))
        .map((p) => String(p).trim()).filter(Boolean);
    if (!players.length) errors.push('At least one player who attended');
    out.players = [...new Set(players)].slice(0, 40);

    out.date = String(input.date || '').trim();
    if (!DATE.test(out.date) || Number.isNaN(Date.parse(out.date))) errors.push('Real-life date of the session (YYYY-MM-DD)');

    for (const k of ['ingameStart', 'ingameEnd']) {
        const v = String(input[k] ?? existing[k] ?? '').trim();
        if (v && !DATE.test(v)) errors.push(`${k === 'ingameStart' ? 'In-game start' : 'In-game end'} must be YYYY-MM-DD`);
        out[k] = v;
    }
    out.title = String(input.title ?? existing.title ?? '').trim().slice(0, 200);
    out.content = String(input.content ?? existing.content ?? '').slice(0, 300000);
    return { errors, value: out };
}

// ---------- sessions ----------

async function list() {
    const data = await load();
    return data.sessions.map(strip).sort((a, b) => b.number - a.number);
}

async function get(id, { history = false } = {}) {
    const s = (await load()).sessions.find((x) => x.id === id);
    if (!s) return null;
    return history ? s : strip(s);
}

function save(input, { id = null, by = 'unknown', via = 'cms' } = {}) {
    return serial(async () => {
        const data = await load();
        const existing = id ? data.sessions.find((x) => x.id === id) : null;
        if (id && !existing) return { status: 404, error: 'Session not found' };
        const { errors, value } = clean(input, existing || {});
        if (errors.length) return { status: 400, error: errors.join(' · '), errors };
        const clash = data.sessions.find((x) => x.number === value.number && x.id !== id);
        if (clash) return { status: 409, error: `Session ${value.number} exists already` };

        const now = new Date().toISOString();
        let session;
        if (existing) {
            const { history = [], ...previous } = existing;
            session = Object.assign(existing, value, { updatedAt: now, updatedBy: by, updatedVia: via });
            session.history = [previous, ...history].slice(0, HISTORY_MAX);
        } else {
            session = { id: crypto.randomUUID(), ...value, createdAt: now, createdBy: by, createdVia: via, updatedAt: now, updatedBy: by, updatedVia: via, history: [] };
            data.sessions.push(session);
        }
        await writeJson(FILE, data);
        return { status: existing ? 200 : 201, session: strip(session) };
    });
}

function remove(id) {
    return serial(async () => {
        const data = await load();
        const i = data.sessions.findIndex((x) => x.id === id);
        if (i < 0) return { status: 404, error: 'Session not found' };
        const [gone] = data.sessions.splice(i, 1);
        // kept aside rather than lost: data/protocols-deleted.json
        const bin = await readJson(path.join(DIR, 'protocols-deleted.json'), { sessions: [] });
        bin.sessions.unshift({ ...gone, deletedAt: new Date().toISOString() });
        await writeJson(path.join(DIR, 'protocols-deleted.json'), bin);
        await writeJson(FILE, data);
        return { status: 200, session: strip(gone) };
    });
}

// Names that appeared in sessions, most frequent first (suggestions for the players field)
async function players() {
    const count = new Map();
    for (const s of (await load()).sessions) for (const p of s.players || []) count.set(p, (count.get(p) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([name]) => name);
}

// ---------- settings ----------

const settings = () => readJson(SETTINGS, { passwordHash: null, passwordVersion: 0 });
const saveSettings = (s) => serial(() => writeJson(SETTINGS, s));

module.exports = { list, get, save, remove, players, settings, saveSettings };
