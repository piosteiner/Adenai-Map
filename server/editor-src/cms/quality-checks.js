// What looks wrong or unfinished in the campaign's data — the Quality page (views/quality.js). Pure: the data in,
// a list of issues out, so it can be tested on its own (server/test/quality-checks.test.js).
//
//   checkAll({ characters, locations, terms, media, sessions, proposals }) → [{ key, level, kind, text, entry }]
//     level  error (certainly wrong: a link to nothing, an image that is gone) · warning (probably wrong: dates that
//            contradict each other, two entries with the same name) · hint (unfinished: no description, no picture)
//     key    stable across runs, for "marked OK" (server: data/quality-ok.json)
//     entry  { kind: character|location|term|session, id, name } — what to open
//
// Links resolve as on the map (src/utils/wiki-links.js): a character, a location, a glossary term or one of its
// aliases, or a player's proposal, by name, ignoring case and accents.

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const LINK = /(?<!\\)\[\[([^\]\n|]+)(?:\|[^\]\n]*)?\]\]/g;
const dayOf = (x) => x?.dateStart || x?.date || '';

// the media id of an image address: ".../media/g7b7j6jhzs5f-small.webp" → "g7b7j6jhzs5f"
const mediaIdOf = (url) => (/\/media\/([a-z0-9]+)-(?:thumb|small|medium|large|original)\.webp$/i.exec(String(url || '')) || [])[1] || null;

// names that differ by one letter ("Toftgard" / "Torftgard"): Levenshtein distance ≤ 1
function oneEditApart(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i += 1; j += 1; continue; }
        if (++edits > 1) return false;
        if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
}

export function checkAll({ characters = [], locations = [], terms = [], media = {}, sessions = [], proposals = [] } = {}) {
    const issues = [];
    const add = (level, kind, entry, text, detail = '') => issues.push({ key: `${kind}|${entry.kind}|${entry.id}|${detail}`, level, kind, entry, text });

    const C = characters.map((c) => ({ kind: 'character', id: c.id, name: c.name, x: c }));
    const L = locations.map((f) => ({ kind: 'location', id: f.properties?.name, name: f.properties?.name, x: f.properties || {} }));
    const T = terms.map((t) => ({ kind: 'term', id: t.id, name: t.name, x: t }));
    const all = [...C, ...L, ...T];

    // ---------- links ----------
    const known = new Set([...C, ...L].map((e) => fold(e.name)));
    for (const t of terms) for (const n of [t.name, ...(t.aliases || [])]) known.add(fold(n));
    for (const p of proposals) known.add(fold(p.name));
    const texts = [
        ...C.map((e) => [e, `${e.x.description || ''}\n${e.x.notes || ''}`]),
        ...L.map((e) => [e, e.x.description]),
        ...T.map((e) => [e, e.x.description]),
        ...sessions.map((s) => [{ kind: 'session', id: s.id, name: `Session ${s.number}${s.title ? ` — ${s.title}` : ''}` }, s.content]),
    ];
    for (const [entry, text] of texts) {
        const seen = new Set();
        for (const m of String(text || '').matchAll(LINK)) {
            const name = m[1].trim();
            if (known.has(fold(name)) || seen.has(fold(name))) continue;
            seen.add(fold(name));
            add('error', 'link', entry, `Links to “${name}”, which is no entry`, fold(name));
        }
    }

    // ---------- images ----------
    const libraryIds = new Set(Object.keys(media || {}).map((k) => mediaIdOf(Object.values(media[k].sizes || {})[0]?.url) || k));
    for (const e of all) {
        for (const url of new Set([e.x.image, ...(e.x.images || [])].filter(Boolean))) {
            const id = mediaIdOf(url);
            if (id && !libraryIds.has(id)) add('error', 'image', e, 'Shows an image that is no longer in the media library', id);
        }
    }

    // ---------- names ----------
    const byName = new Map();
    for (const e of all) {
        const k = fold(e.name);
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(e);
    }
    for (const list of byName.values()) {
        if (list.length < 2) continue;
        const kinds = new Set(list.map((e) => e.kind));
        const first = list[0];
        if (kinds.size === list.length) { // different kinds: a link goes to the first (character, then location, then term)
            for (const e of list.slice(1)) add('warning', 'ambiguous', e, `Has the same name as a ${first.kind}: a [[${e.name}]] link opens the ${first.kind}`, first.kind);
        } else {
            for (const e of list.slice(1)) add('warning', 'duplicate', e, `Another ${e.kind} has the same name`, fold(e.name));
        }
    }
    // one letter apart, same kind: perhaps the same entry spelt two ways (names of 5 letters or more)
    for (const group of [C, L, T]) {
        const names = group.map((e) => ({ e, f: fold(e.name).replace(/[^\p{L}\p{N}]/gu, '') })).filter((n) => n.f.length >= 5);
        for (let i = 0; i < names.length; i += 1) {
            for (let j = i + 1; j < names.length; j += 1) {
                if (names[i].f !== names[j].f && !oneEditApart(names[i].f, names[j].f)) continue;
                if (fold(names[i].e.name) === fold(names[j].e.name)) continue; // already a duplicate above
                add('warning', 'similar', names[j].e, `Spelt almost like “${names[i].e.name}” — the same ${names[j].e.kind}?`, fold(names[i].e.name));
            }
        }
    }

    // ---------- in-game dates ----------
    const ordered = [...sessions].filter((s) => s.number !== '' && s.number != null).sort((a, b) => Number(a.number) - Number(b.number));
    const sessionEntry = (s) => ({ kind: 'session', id: s.id, name: `Session ${s.number}${s.title ? ` — ${s.title}` : ''}` });
    for (const s of ordered) {
        if (s.ingameStart && s.ingameEnd && s.ingameStart > s.ingameEnd) add('warning', 'session-dates', sessionEntry(s), `In-game end ${s.ingameEnd} is before its start ${s.ingameStart}`);
        if (!s.ingameStart && s.published !== false) add('hint', 'session-undated', sessionEntry(s), 'No in-game date');
    }
    for (let i = 1; i < ordered.length; i += 1) {
        const a = ordered[i - 1], b = ordered[i];
        const aEnd = a.ingameEnd || a.ingameStart;
        if (aEnd && b.ingameStart && b.ingameStart < aEnd) {
            add('warning', 'session-order', sessionEntry(b), `Begins in-game on ${b.ingameStart}, before session ${a.number} ends (${aEnd}) — a typo, or a look back?`, String(a.number));
        }
    }
    const dated = ordered.filter((s) => s.ingameStart);
    const campaignStart = dated.length ? dated.map((s) => s.ingameStart).sort()[0] : null;
    const campaignEnd = dated.length ? dated.map((s) => s.ingameEnd || s.ingameStart).sort().pop() : null;
    for (const e of C) {
        const moves = [...(e.x.movementHistory || [])];
        for (const m of moves) {
            if (m.dateEnd && dayOf(m) && m.dateEnd < dayOf(m)) add('warning', 'move-dates', e, `Movement to ${m.location}: ends ${m.dateEnd}, before it begins (${dayOf(m)})`, m.id || dayOf(m));
        }
        const byNr = moves.filter((m) => typeof m.movement_nr === 'number').sort((a, b) => a.movement_nr - b.movement_nr);
        for (let i = 1; i < byNr.length; i += 1) {
            if (dayOf(byNr[i]) && dayOf(byNr[i - 1]) && dayOf(byNr[i]) < dayOf(byNr[i - 1])) {
                add('warning', 'move-order', e, `Movements out of order: ${byNr[i].location} (${dayOf(byNr[i])}) comes after ${byNr[i - 1].location} (${dayOf(byNr[i - 1])})`, byNr[i].id || String(i));
                break;
            }
        }
        const current = dayOf(e.x.currentLocation);
        const last = moves.map(dayOf).filter(Boolean).sort().pop();
        if (current && last && last > current) add('warning', 'current-stale', e, `Current location dated ${current}, but a movement is dated ${last}`);
        if (campaignStart) {
            for (const [label, d] of [['Current location', current], ...moves.map((m) => [`Movement to ${m.location}`, dayOf(m)])]) {
                if (d && (d < campaignStart || d > campaignEnd)) add('hint', 'outside-campaign', e, `${label} dated ${d}, outside the sessions (${campaignStart} – ${campaignEnd})`, `${label}|${d}`);
            }
        }
    }

    // ---------- unfinished ----------
    for (const e of all) {
        if (!String(e.x.description || '').trim()) add('hint', 'no-description', e, 'No description');
        if (!e.x.image && !(e.x.images || []).length) add('hint', 'no-image', e, 'No picture');
    }

    const rank = { error: 0, warning: 1, hint: 2 };
    return issues.sort((a, b) => rank[a.level] - rank[b.level] || a.kind.localeCompare(b.kind) || String(a.entry.name).localeCompare(String(b.entry.name)));
}

export const KINDS = {
    link: 'Links to nothing', image: 'Missing image', ambiguous: 'Same name, different kinds', duplicate: 'Same name twice',
    similar: 'Almost the same name', 'session-dates': 'Session dates', 'session-order': 'Sessions out of order',
    'move-dates': 'Movement dates', 'move-order': 'Movements out of order', 'current-stale': 'Current location older than a movement',
    'session-undated': 'Session without in-game date', 'outside-campaign': 'Dated outside the sessions',
    'no-description': 'No description', 'no-image': 'No picture',
};
