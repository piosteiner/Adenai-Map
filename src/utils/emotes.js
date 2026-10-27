// emotes.js - :name: emotes on the map, as in a Twitch chat: public/data/emotes.json (set in the CMS, from 7TV and our
// own images) → RichText (the image in every text) and window.AdenaiEmotes (the editor's ":" suggestions).
// "emotesReady" on document once they are there, for texts drawn before.
// Hovering an emote shows it bigger (at most 112 px) with its name; a click opens nothing.
(function () {
    let emotes = {};
    let lower = new Map();

    const get = (name) => {
        const key = emotes[name] ? name : lower.get(String(name).toLowerCase());
        return key ? { name: key, ...emotes[key] } : null;
    };

    // (again after a change in the CMS: src/utils/live-data.js)
    const load = () => fetch('public/data/emotes.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
            if (!data?.emotes) return;
            emotes = data.emotes;
            lower = new Map();
            for (const name of Object.keys(emotes)) if (!lower.has(name.toLowerCase())) lower.set(name.toLowerCase(), name);
            window.RichText?.setEmotes(emotes);
            document.dispatchEvent(new CustomEvent('emotesReady'));
        })
        .catch(() => { /* no emotes: :name: stays text */ });

    window.AdenaiEmotes = {
        list: () => Object.entries(emotes).map(([name, e]) => ({ name, ...e })),
        get,
        suggest: (field) => suggest(field),
        reload: load,
        ready: load(),
    };

    // ---------- ":" suggestions in a plain text field (the map's comments; the editors have their own) ----------
    // ":ca" lists catJAM, peepoCat …; ↑ ↓ choose, Enter / Tab or a click writes :name:, Esc closes.
    // As in the editor: not after a letter or digit ("10:30"), starting with what was typed first, shorter names first.
    function suggest(field) {
        const box = Object.assign(document.createElement('ul'), { className: 'emote-suggest', role: 'listbox', hidden: true });
        document.body.append(box);
        let items = [];
        let index = 0;
        let match = null;
        const close = () => { box.hidden = true; items = []; match = null; };
        const pick = (e) => {
            const v = field.value;
            const end = field.selectionStart;
            const after = v.slice(end).startsWith(':') ? end + 1 : end;
            const insert = `:${e.name}: `;
            field.value = v.slice(0, match.from) + insert + v.slice(after).replace(/^ /, '');
            field.selectionStart = field.selectionEnd = match.from + insert.length;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            close();
            field.focus();
        };
        const draw = () => {
            box.replaceChildren(...items.map((e, i) => {
                const li = Object.assign(document.createElement('li'), { role: 'option' });
                li.setAttribute('aria-selected', String(i === index));
                const img = Object.assign(document.createElement('img'), { src: e.url, alt: '', loading: 'lazy' });
                li.append(img, `:${e.name}:`);
                li.addEventListener('mousedown', (ev) => { ev.preventDefault(); pick(e); });
                return li;
            }));
            const r = field.getBoundingClientRect();
            const below = window.innerHeight - r.bottom > 220;
            Object.assign(box.style, { left: `${Math.max(8, r.left)}px`, width: `${Math.min(300, r.width)}px`, top: below ? `${r.bottom + 4}px` : '', bottom: below ? '' : `${window.innerHeight - r.top + 4}px` });
            box.hidden = false;
            box.children[index]?.scrollIntoView({ block: 'nearest' });
        };
        const update = () => {
            const before = field.value.slice(0, field.selectionStart);
            const m = /(^|[^\p{L}\p{N}\\]):([^\s:]{1,40})$/u.exec(before);
            if (!m) return close();
            const q = m[2].toLowerCase();
            items = Object.keys(emotes)
                .map((name) => ({ name, n: name.toLowerCase() }))
                .filter((x) => x.n.includes(q))
                .sort((a, b) => (b.n.startsWith(q) - a.n.startsWith(q)) || a.name.length - b.name.length || a.name.localeCompare(b.name))
                .slice(0, 8)
                .map((x) => ({ name: x.name, ...emotes[x.name] }));
            if (!items.length) return close();
            match = { from: m.index + m[1].length };
            index = 0;
            draw();
        };
        field.addEventListener('input', update);
        field.addEventListener('click', update);
        field.addEventListener('blur', () => setTimeout(close, 150));
        field.addEventListener('keydown', (e) => {
            if (box.hidden) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); index = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; draw(); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); pick(items[index]); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        });
        return { close, destroy: () => box.remove() };
    }

    // ---------- hover: the emote bigger ----------

    let tip = null;
    let over = null;
    // 7TV has the emote in 4× as well: sharp at the bigger size
    const bigUrl = (url) => url.replace(/(\/\/cdn\.7tv\.app\/emote\/[^/]+\/)2x\.webp$/, '$14x.webp');

    function show(img) {
        tip ||= Object.assign(document.createElement('div'), { className: 'emote-tip', role: 'tooltip' });
        const big = new Image();
        big.alt = '';
        big.src = bigUrl(img.src);
        big.onerror = () => { big.onerror = null; big.src = img.src; };
        tip.replaceChildren(big, Object.assign(document.createElement('span'), { textContent: img.title }));
        const r = img.getBoundingClientRect();
        const above = r.top > 150; // else below the emote
        Object.assign(tip.style, {
            left: `${Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70)}px`,
            top: `${above ? r.top - 8 : r.bottom + 8}px`,
            transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        });
        document.body.append(tip);
    }

    document.addEventListener('mouseover', (e) => {
        const img = e.target.closest?.('img.emote');
        if (img === over) return;
        over = img;
        if (img) show(img); else tip?.remove();
    });
    ['scroll', 'mousedown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { over = null; tip?.remove(); }, true));
})();
