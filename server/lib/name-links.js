// Adenai's characters ↔ the name list in the Grimoire (routes/names.js has the CMS's side). A character whose name holds
// a name of the list gets that name's use, linked to it (ref = its id); a use already marked but not linked yet (the
// old name sheet's "used", nobody named) is linked instead of counted twice; a character already linked is left alone.
const BASE = () => (process.env.GRIMOIRE_URL || 'http://127.0.0.1:3005').replace(/\/+$/, '');
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function call(method, p, body) {
    const r = await fetch(`${BASE()}/api/projects/adenai${p}`, { method, headers: { Authorization: `Bearer ${process.env.GRIMOIRE_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    if (!r.ok) throw new Error(`Grimoire ${method} ${p}: ${r.status} ${t}`);
    return t ? JSON.parse(t) : null;
}

// characters: [{ id, name }] → { linked, added, kept, log: [lines] } (dry: only say what would happen)
async function linkCharacters(characters, { dry = false, note = 'linked by name' } = {}) {
    if (!process.env.GRIMOIRE_KEY) throw new Error('The Grimoire key is not set (GRIMOIRE_KEY)');
    const { names } = await call('GET', '/names');
    const byName = new Map(names.map((n) => [fold(n.name), n]));
    const out = { linked: 0, added: 0, kept: 0, log: [] };
    for (const c of characters) {
        for (const word of new Set(fold(c.name).split(/[^a-z0-9'-]+/).filter(Boolean))) {
            const n = byName.get(word);
            if (!n) continue;
            if (n.uses.some((u) => u.ref === c.id)) { out.kept++; continue; }
            const open = n.uses.find((u) => !u.ref && !u.usedFor);
            if (open) {
                out.log.push(`link   ${n.name} → ${c.name}${open.major ? ' ★' : ''}`);
                if (!dry) Object.assign(open, (await call('PUT', `/uses/${open.id}`, { ref: c.id, usedFor: c.name, force: true })).use);
                out.linked++;
            } else {
                out.log.push(`add    ${n.name} → ${c.name}`);
                if (!dry) n.uses.push((await call('POST', `/names/${n.id}/uses`, { ref: c.id, usedFor: c.name, note, force: true })).use);
                out.added++;
            }
        }
    }
    return out;
}

module.exports = { linkCharacters };
