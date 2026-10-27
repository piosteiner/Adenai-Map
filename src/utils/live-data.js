// live-data.js - The map's data files from the CMS server, and changes to them while the map is open.
//
// Where the data comes from: characters.json, places.geojson, glossary.json, emotes.json and media-library.json are
// asked from the CMS server first (server/routes/data.js, answered from its cache: a change saved in the CMS is there at
// once), and from GitHub Pages as before when the server doesn't answer within a few seconds (Pages has a change about
// a minute after it was saved). Every part of the map fetches "public/data/…" as it always did: this file answers
// those requests (it wraps fetch), so it is loaded before everything else that loads data.
//
// Live: the server tells the map when one of them changed ("changed", and "versions" on connecting, so whatever changed
// while the connection was down is caught up). The part of the map it belongs to loads it again in place — places
// (markers, and the character paths that use their positions), characters (paths, movement markers, the character
// panel, the search), the glossary, emotes, the media library. Characters and places wait while a popup is open, so
// nothing vanishes under the reader's eyes.
(function () {
    const API = 'https://adenai-admin.piogino.ch/api/data';
    const FILES = ['characters.json', 'places.geojson', 'glossary.json', 'emotes.json', 'media-library.json'];
    const TIMEOUT_MS = 4000;
    const nativeFetch = window.fetch.bind(window);
    const versions = {};     // file → the version this page has (from X-Data-Version)
    const loaded = new Set(); // files this page has loaded at least once
    let serverDown = false;   // the server didn't answer: Pages for the rest of this visit (until it's back)

    // "public/data/characters.json?t=…" (relative or absolute, this site) → "characters.json", else null
    function dataFile(input) {
        try {
            const url = new URL(typeof input === 'string' ? input : input?.url, location.href);
            if (url.origin !== location.origin) return null;
            const m = /\/public\/data\/([\w.-]+)$/.exec(url.pathname);
            return m && FILES.includes(m[1]) ? m[1] : null;
        } catch { return null; }
    }

    window.fetch = async (input, init) => {
        const file = dataFile(input);
        if (!file) return nativeFetch(input, init);
        loaded.add(file);
        if (!serverDown) {
            try {
                const res = await nativeFetch(`${API}/${file}`, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
                if (res.ok) {
                    versions[file] = res.headers.get('X-Data-Version') || versions[file];
                    return res;
                }
            } catch { serverDown = true; }
        }
        return nativeFetch(input, init); // GitHub Pages
    };

    // ---------- live ----------

    const fetchJson = async (file) => (await window.fetch(`public/data/${file}`)).json();
    const popupOpen = () => !!document.querySelector('.leaflet-popup, .panel-anchored-popup');
    // characters and places rebuild markers and popups: not while someone reads one
    const whenNoPopup = (fn) => (popupOpen() ? setTimeout(() => whenNoPopup(fn), 2000) : fn());

    const RELOAD = {
        'places.geojson': () => whenNoPopup(async () => {
            await window.locationSystem?.reloadLocations();
            await window.movementSystem?.reloadPaths(); // paths go through the places' positions
        }),
        'characters.json': () => whenNoPopup(() => window.characterSystem?.reloadCharacters()), // → paths, panel, search
        'glossary.json': () => window.mapGlossary?.reload(),
        'emotes.json': () => window.AdenaiEmotes?.reload(),
        'media-library.json': async () => {
            const data = await fetchJson('media-library.json');
            for (const sys of [window.locationSystem, window.imagePopupManager, window.imageHoverPreview]) if (sys) sys.mediaLibrary = data;
        },
    };

    const pending = new Map(); // file → timer: several saves in a row load once
    function changed(file, sha) {
        if (!RELOAD[file] || !loaded.has(file) || (sha && versions[file] === sha)) return;
        clearTimeout(pending.get(file));
        pending.set(file, setTimeout(() => {
            pending.delete(file);
            Promise.resolve(RELOAD[file]()).catch((err) => console.warn(`live-data: reloading ${file} failed:`, err));
        }, 600));
    }

    function connect() {
        if (!window.EventSource) return;
        const source = new EventSource(`${API}/events`);
        const on = (event, fn) => source.addEventListener(event, (e) => { try { fn(JSON.parse(e.data)); } catch { /* ignore */ } });
        on('versions', (all) => { serverDown = false; Object.entries(all).forEach(([file, sha]) => changed(file, sha)); });
        on('changed', ({ file, sha }) => changed(file, sha));
        // EventSource reconnects by itself; "versions" then catches up on what was missed
    }
    if (document.readyState === 'complete') connect(); else window.addEventListener('load', connect);

    window.LiveData = { versions, changed };
})();
