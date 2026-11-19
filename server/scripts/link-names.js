// Links Adenai's characters with the name list in the Grimoire: every character whose name holds a name of the list
// gets that name's use, linked to the character (ref = its id). A use already marked but not yet linked (from the old
// name sheet: "used", nobody named) is linked rather than counted twice; a character already linked is left alone.
// Safe to run again.
//   node scripts/link-names.js [--dry]
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

const BASE = (process.env.GRIMOIRE_URL || 'http://127.0.0.1:3005').replace(/\/+$/, '');
const dry = process.argv.includes('--dry');
const call = async (method, p, body) => {
    const r = await fetch(`${BASE}/api/projects/adenai${p}`, { method, headers: { Authorization: `Bearer ${process.env.GRIMOIRE_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${t}`);
    return t ? JSON.parse(t) : null;
};
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

(async () => {
    const { characters } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/characters.json'), 'utf8'));
    const { names } = await call('GET', '/names');
    const byName = new Map(names.map((n) => [fold(n.name), n]));
    let linked = 0; let added = 0; let kept = 0;
    for (const c of characters) {
        for (const word of new Set(fold(c.name).split(/[^a-z0-9'-]+/).filter(Boolean))) {
            const n = byName.get(word);
            if (!n) continue;
            if (n.uses.some((u) => u.ref === c.id)) { kept++; continue; }
            const open = n.uses.find((u) => !u.ref && !u.usedFor);
            if (open) {
                console.log(`link   ${n.name} → ${c.name}${open.major ? ' ★' : ''}`);
                if (!dry) Object.assign(open, (await call('PUT', `/uses/${open.id}`, { ref: c.id, usedFor: c.name, force: true })).use);
                linked++;
            } else {
                console.log(`add    ${n.name} → ${c.name}`);
                if (!dry) n.uses.push((await call('POST', `/names/${n.id}/uses`, { ref: c.id, usedFor: c.name, note: 'linked by name (scripts/link-names.js)', force: true })).use);
                added++;
            }
        }
    }
    console.log(`${dry ? '(dry run) ' : ''}${linked} marked uses linked, ${added} uses added, ${kept} already linked`);
})().catch((e) => { console.error(e.message); process.exit(1); });
