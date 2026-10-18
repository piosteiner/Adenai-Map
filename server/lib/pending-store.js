// pending-store.js - Entries proposed by the players on the map, waiting for the DM to confirm them in the CMS.
//
// While writing the minutes, a player types [[Name]] for someone or something that has no entry yet and creates one on
// the spot: a person, a place or a thing (term), with a short description. Until confirmed it lives here, on this server
// only (like the minutes; data/pending-entries.json, git-ignored, in the nightly encrypted backup) — readable by the
// devices unlocked for the minutes and by the CMS — and already works on the map: links resolve, it can be opened,
// searched and described further. Confirming (CMS → Proposals) creates the real character, location or glossary term
// and removes the proposal; rejecting removes it, optionally with its [[links]] in the minutes.
//   { entries: [ { id, kind: 'character'|'location'|'term', name, description, category, createdBy, createdAt,
//                  updatedBy, updatedAt } ] }
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const protocolStore = require('./protocol-store');

const FILE = path.join(protocolStore.DIR, 'pending-entries.json');
const KINDS = new Set(['character', 'location', 'term']);
const events = new EventEmitter(); // 'changed' (entries) — lib/protocol-live.js tells every connected device

let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job, job));
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function load() {
    try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return { entries: [] }; throw err; }
}
async function write(data) {
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await fs.rename(tmp, FILE);
    events.emit('changed', data.entries);
}

const list = async () => (await load()).entries;

function clean(input, previous = {}) {
    const out = {};
    if (input.name !== undefined) out.name = String(input.name).replace(/[\[\]|\n]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (input.kind !== undefined) out.kind = KINDS.has(input.kind) ? input.kind : previous.kind || 'term';
    if (input.description !== undefined) out.description = String(input.description).slice(0, 5000);
    if (input.category !== undefined) out.category = String(input.category).trim().slice(0, 60);
    return out;
}

// takenNames: the names (and aliases) of the existing characters, locations and terms — a proposal may not repeat one
function create(input, { by = 'Map', takenNames = [] } = {}) {
    return serial(async () => {
        const data = await load();
        const v = clean({ kind: 'term', description: '', category: '', ...input });
        if (!v.name) return { status: 400, error: 'A name is required' };
        const key = fold(v.name);
        const existing = data.entries.find((e) => fold(e.name) === key);
        if (existing) return { status: 409, error: 'Already proposed', entry: existing };
        if (takenNames.some((n) => fold(n) === key)) return { status: 409, error: 'An entry of this name exists already' };
        const now = new Date().toISOString();
        const entry = { id: `p_${crypto.randomBytes(6).toString('hex')}`, ...v, createdBy: String(by).slice(0, 40), createdAt: now, updatedBy: String(by).slice(0, 40), updatedAt: now };
        data.entries.push(entry);
        await write(data);
        return { status: 201, entry };
    });
}

// Players change the kind, category and description; the name only the CMS (renames its [[links]] in the minutes)
function update(id, input, { by = 'Map', allowRename = false, takenNames = [] } = {}) {
    return serial(async () => {
        const data = await load();
        const entry = data.entries.find((e) => e.id === id);
        if (!entry) return { status: 404, error: 'Proposal not found' };
        const v = clean(input, entry);
        if (!allowRename) delete v.name;
        const oldName = entry.name;
        if (v.name !== undefined) {
            if (!v.name) return { status: 400, error: 'A name is required' };
            const key = fold(v.name);
            if (key !== fold(oldName) && (data.entries.some((e) => e.id !== id && fold(e.name) === key) || takenNames.some((n) => fold(n) === key))) {
                return { status: 409, error: 'An entry of this name exists already' };
            }
        }
        Object.assign(entry, v, { updatedBy: String(by).slice(0, 40), updatedAt: new Date().toISOString() });
        await write(data);
        if (v.name && v.name !== oldName) await renameEverywhere(oldName, v.name, by);
        return { status: 200, entry };
    });
}

// [[old]] → [[new]] in the minutes and in the other proposals' descriptions
async function renameEverywhere(oldName, newName, by) {
    const { renameInText } = require('./link-rename');
    await protocolStore.renameLinks(oldName, newName, by);
    const data = await load();
    let touched = false;
    for (const e of data.entries) {
        const d = renameInText(e.description, oldName, newName);
        if (d !== e.description) { e.description = d; touched = true; }
    }
    if (touched) await write(data);
}

// Confirmed (as an entry named confirmedAs — links follow if the name changed) or rejected (unlink: the [[links]] to it
// in the minutes become plain text)
function remove(id, { confirmedAs = null, unlink = false, by = 'CMS' } = {}) {
    return serial(async () => {
        const data = await load();
        const i = data.entries.findIndex((e) => e.id === id);
        if (i < 0) return { status: 404, error: 'Proposal not found' };
        const [entry] = data.entries.splice(i, 1);
        await write(data);
        if (confirmedAs && confirmedAs !== entry.name) await renameEverywhere(entry.name, confirmedAs, by);
        let unlinked = 0;
        if (unlink && !confirmedAs) unlinked = await protocolStore.unlinkName(entry.name, by);
        return { status: 200, entry, unlinked };
    });
}

module.exports = { list, create, update, remove, events, FILE, KINDS };
