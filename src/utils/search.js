// search.js - One search for the whole site: the map (search bar, glossary, character panel, minutes, [[ suggestions)
// and the CMS (every list). Modelled on the art history site's search (arthistory/frontend/src/search.ts, fold.ts).
//
//   AdenaiSearch.rank(items, query, docOf, { limit })  → [{ item, score, why }] best first
//   docOf(item) → { name, aliases: [], fields: [{ label, text, weight }] }
//   AdenaiSearch.highlight(text, query) → HTML with <mark>; AdenaiSearch.fold(text); AdenaiSearch.matches(text, query)
//
// Spelling doesn't matter (case, accents, ligatures, apostrophes: "akonetchie" finds Akónetchie, "zurakthar" doesn't —
// but "zurak'thar" and "zurak’thar" do). Every word typed must be found (in the name, an alias or another field).
// Ranking, best first:
//   name is the query · an alias is the query · name starts with it · a word of the name starts with it ("Rena" in
//   "Siedlung südlich von Rena") · the words are in the name · in an alias · only in other fields (the more important
//   the field — title, type, region before description — the higher)
// and within that the shorter name first. Only when nothing matches as typed, names with a typo or two count
// ("glesbrug" → Glesburg, "mondsten" → Mondstein).
(function (root) {
    const SPELLED = { ß: 'ss', ẞ: 'ss', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe', ø: 'o', Ø: 'o', ł: 'l', Ł: 'l', đ: 'd', Đ: 'd', ð: 'd', Ð: 'd', þ: 'th', Þ: 'th', ı: 'i' };
    const fold = (s) => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
        .replace(/[ßẞæÆœŒøØłŁđĐðÐþÞı]/g, (c) => SPELLED[c])
        .replace(/[’‘ʼ`´]/g, "'").replace(/[‐‑‒–—―]/g, '-')
        .toLowerCase();
    const words = (q) => [...new Set(fold(q).split(/[\s,;]+/).map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')).filter(Boolean))];
    const WORD = /[\p{L}\p{N}']+/gu;
    const wordsOf = (text) => fold(text).match(WORD) || [];
    // [[Name|text]] → text, **bold** → bold: what a reader sees, for matching and for the "why" snippet
    const plain = (t) => String(t ?? '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\[([^\]\n]+)\]\(https?:[^)\s]+\)/g, '$1').replace(/[*_~+]{2}|\\(?=.)/g, '').replace(/^#+\s*|^\s*[-*]\s+/gm, '');

    // Damerau-Levenshtein distance, stopping early above max
    function distance(a, b, max) {
        if (Math.abs(a.length - b.length) > max) return max + 1;
        const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
        for (let j = 1; j <= b.length; j++) d[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            let rowMin = Infinity;
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                rowMin = Math.min(rowMin, d[i][j]);
            }
            if (rowMin > max) return max + 1;
        }
        return d[a.length][b.length];
    }
    const typosAllowed = (w) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

    function prepare(doc) {
        const name = fold(plain(doc.name));
        const aliases = (doc.aliases || []).filter(Boolean).map((a) => fold(plain(a)));
        const fields = (doc.fields || []).filter((f) => f && f.text).map((f) => ({ label: f.label || '', raw: plain(f.text), text: fold(plain(f.text)), weight: f.weight ?? 1 }));
        return { name, nameWords: name.match(WORD) || [], aliases, aliasWords: aliases.flatMap((a) => a.match(WORD) || []), fields };
    }

    // → { score, why } or null. score: tiers of 1000 (see above), plus field weight, minus a little per name length
    function score(doc, query, p = prepare(doc)) {
        const q = fold(query).trim();
        const ws = words(query);
        if (!ws.length) return { score: 0, why: null };
        const lengthPenalty = Math.min(p.name.length, 200) / 1000;
        const nameHasAll = ws.every((w) => p.name.includes(w));
        const prefixOfNameWords = ws.every((w) => p.nameWords.some((n) => n.startsWith(w)));
        if (p.name === q) return { score: 9000, why: null };
        if (p.aliases.includes(q)) return { score: 8000 - lengthPenalty, why: { label: 'auch', text: doc.aliases[p.aliases.indexOf(q)] } };
        if (p.name.startsWith(q)) return { score: 7000 - lengthPenalty, why: null };
        if (prefixOfNameWords) return { score: 6000 - lengthPenalty, why: null };
        if (nameHasAll) return { score: 5000 - lengthPenalty, why: null };
        const aliasIdx = p.aliases.findIndex((a) => ws.every((w) => a.includes(w)));
        if (aliasIdx >= 0) return { score: (p.aliases[aliasIdx].startsWith(q) ? 4500 : 4000) - lengthPenalty, why: { label: 'auch', text: doc.aliases[aliasIdx] } };
        // every word somewhere: name, aliases or fields — weighted by where
        let weight = 0;
        let why = null;
        for (const w of ws) {
            if (p.name.includes(w) || p.aliases.some((a) => a.includes(w))) { weight += 3; continue; }
            const f = p.fields.filter((x) => x.text.includes(w)).sort((a, b) => b.weight - a.weight)[0];
            if (!f) { weight = -1; break; }
            weight += f.weight * (new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(f.text) ? 1 : 0.6);
            if (!why || f.weight > why.weight) why = { label: f.label, text: snippet(f.raw, ws), weight: f.weight };
        }
        if (weight >= 0) return { score: 1000 + Math.min(weight, 900) - lengthPenalty, why: why && { label: why.label, text: why.text } };
        return null;
    }

    // typo-tolerant name match, for when nothing matches as typed
    function fuzzy(doc, query, p = prepare(doc)) {
        const ws = words(query).filter((w) => w.length >= 4);
        if (!ws.length || ws.length !== words(query).length) return null;
        let total = 0;
        for (const w of ws) {
            const max = typosAllowed(w);
            let best = max + 1;
            for (const n of [...p.nameWords, ...p.aliasWords]) best = Math.min(best, distance(w, n.slice(0, Math.max(n.length, w.length)), max), n.length > w.length ? distance(w, n.slice(0, w.length), max) : max + 1);
            if (best > max) return null;
            total += best;
        }
        return { score: 500 - total * 100 - Math.min(p.name.length, 200) / 1000, why: { label: 'ähnlich', text: doc.name } };
    }

    // a piece of text around the first word found, for "why" lines
    function snippet(text, ws, around = 50) {
        const f = fold(text);
        const at = Math.min(...ws.map((w) => f.indexOf(w)).filter((i) => i >= 0));
        if (!Number.isFinite(at)) return text.slice(0, around * 2);
        const from = Math.max(0, at - around);
        return `${from ? '…' : ''}${text.slice(from, at + around).replace(/\s+/g, ' ').trim()}${at + around < text.length ? '…' : ''}`;
    }

    function rank(items, query, docOf, { limit = Infinity } = {}) {
        const out = [];
        const docs = items.map((item) => ({ item, doc: docOf(item) }));
        for (const { item, doc } of docs) {
            const s = score(doc, query);
            if (s) out.push({ item, score: s.score, why: s.why, name: doc.name });
        }
        if (!out.length) {
            for (const { item, doc } of docs) {
                const s = fuzzy(doc, query);
                if (s) out.push({ item, score: s.score, why: s.why, name: doc.name, fuzzy: true });
            }
        }
        out.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'de', { numeric: true }));
        return out.slice(0, limit);
    }

    const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    // text (escaped) with every occurrence of the query's words in <mark>, regardless of accents
    function highlight(text, query) {
        text = String(text ?? '');
        const ws = words(query);
        if (!ws.length || !text) return escape(text);
        let folded = '';
        const origin = [];
        let pos = 0;
        for (const ch of text) {
            const f = fold(ch);
            for (let k = 0; k < f.length; k++) origin.push(pos);
            folded += f;
            pos += ch.length;
        }
        const ranges = [];
        for (const w of ws) for (let i = folded.indexOf(w); i >= 0; i = folded.indexOf(w, i + w.length)) ranges.push([origin[i], origin[i + w.length - 1] + 1]);
        if (!ranges.length) return escape(text);
        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]); }
        let html = '';
        let at = 0;
        for (const [a, b] of merged) { html += `${escape(text.slice(at, a))}<mark>${escape(text.slice(a, b))}</mark>`; at = b; }
        return html + escape(text.slice(at));
    }

    // does text contain every word of query (for simple filters)
    const matches = (text, query) => { const f = fold(plain(text)); return words(query).every((w) => f.includes(w)); };

    const api = { fold, words, plain, score, fuzzy, rank, highlight, matches, snippet, distance };
    root.AdenaiSearch = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
