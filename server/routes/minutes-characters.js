// Characters from the minutes: the people the minutes name but the map does not know yet, read from the minutes
// (2026-11-19) into data/minutes-characters/ — create.json (checked: to create) and left-out.json (unsure: a pun, a
// nickname, a god …). The CMS (views/minutes-characters.js) shows them; the GM ticks and edits, and creating them
//   - adds the characters in one commit (routes/characters.js createCharacters), "first met" the in-game date of the
//     first session naming them,
//   - turns the first plain mention per session into a link (lib/protocol-store.js linkMentions, with history),
//   - links them with the name list in the Grimoire (lib/name-links.js).
// Created ones leave the lists. GM only, like all of /api.
const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('../lib/protocol-store');
const { createCharacters } = require('./characters');
const { linkCharacters } = require('../lib/name-links');

const router = express.Router();
const DIR = path.join(process.env.PROTOCOL_DATA_DIR || path.join(__dirname, '..', 'data'), 'minutes-characters');
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return []; } };
const write = (f, v) => fs.writeFileSync(path.join(DIR, f), `${JSON.stringify(v, null, 1)}\n`);
const STATUS = ['alive', 'dead', 'undead', 'missing', 'unknown'];
const REL = ['friendly', 'neutral', 'suspicious', 'enemy', 'hostile', 'unknown', 'ally'];
const key = (s) => String(s || '').trim().toLowerCase();

router.get('/', (req, res) => {
    res.json({ candidates: [...read('create.json').map((c) => ({ ...c, suggested: true })), ...read('left-out.json').map((c) => ({ ...c, suggested: false }))] });
});

router.post('/create', async (req, res) => {
    const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 300).filter((c) => String(c?.name || '').trim());
    if (!items.length) return res.status(400).json({ error: 'Nothing ticked' });
    try {
        const ingame = new Map((await store.list()).map((s) => [String(s.number), s.ingameStart || '']));
        const firstMet = (c) => { const n = [...(c.sessions || [])].map(Number).filter(Boolean).sort((a, b) => a - b)[0]; return (n && ingame.get(String(n))) || ''; };
        const user = req.session?.displayName || req.session?.username || 'Unknown';
        const { created, skipped } = await createCharacters(items.map((c) => ({
            name: String(c.name).trim().slice(0, 120), title: String(c.title || '').slice(0, 200), description: String(c.description || '').slice(0, 5000),
            status: STATUS.includes(c.status) ? c.status : 'unknown', relationship: REL.includes(c.relationship) ? c.relationship : 'unknown',
            placeOfOrigin: String(c.placeOfOrigin || ''), firstMet: firstMet(c),
        })), user, req.session?.role);
        const done = new Set(created.map((c) => key(c.name)));
        const forms = (c) => [...new Set([c.name, ...(c.forms || [])].map((f) => String(f).trim()).filter((f) => f.length >= 4))];
        const links = created.length ? await store.linkMentions(items.filter((c) => done.has(key(c.name))).map((c) => ({ name: String(c.name).trim(), forms: forms(c) })), `${user} (characters from the minutes)`) : { sessions: 0, links: 0 };
        let names = null;
        try { names = await linkCharacters(created, { note: 'linked when created from the minutes' }); } catch (err) { names = { error: err.message }; }
        for (const f of ['create.json', 'left-out.json']) write(f, read(f).filter((c) => !done.has(key(c.name))));
        res.json({ created: created.map((c) => ({ id: c.id, name: c.name })), skipped, links, names: names.error ? names : { linked: names.linked, added: names.added } });
    } catch (err) {
        console.error('minutes-characters:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
