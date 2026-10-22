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

    window.AdenaiEmotes = {
        list: () => Object.entries(emotes).map(([name, e]) => ({ name, ...e })),
        get,
        ready: fetch('public/data/emotes.json', { cache: 'no-cache' })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data?.emotes) return;
                emotes = data.emotes;
                lower = new Map();
                for (const name of Object.keys(emotes)) if (!lower.has(name.toLowerCase())) lower.set(name.toLowerCase(), name);
                window.RichText?.setEmotes(emotes);
                document.dispatchEvent(new CustomEvent('emotesReady'));
            })
            .catch(() => { /* no emotes: :name: stays text */ }),
    };

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
