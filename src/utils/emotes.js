// emotes.js - :name: emotes on the map, as in a Twitch chat: public/data/emotes.json (set in the CMS, from 7TV and our
// own images) → RichText (the image in every text) and window.AdenaiEmotes (the editor's ":" suggestions).
// "emotesReady" on document once they are there, for texts drawn before.
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
})();
