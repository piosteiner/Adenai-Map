// wiki-links.js - What [[links]] in descriptions do on the map (they are rendered by rich-text.js)
// A click on a character's link opens that character (as the character panel does), a location's link flies
// to the place and opens its popup. Popups are partly built while the data is still loading, so a name that
// can't be resolved yet still becomes a link and is looked up again when clicked.
(function () {
    const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

    function find(name) {
        const key = fold(name);
        const character = (window.characterSystem?.getCharacters?.() || []).find((c) => fold(c.name) === key);
        if (character) return { kind: 'character', name: character.name };
        const location = (window.locationSystem?.getLocations?.() || [])
            .map((l) => l.feature?.properties?.name || l.name)
            .find((n) => fold(n) === key);
        if (location) return { kind: 'location', name: location };
        return null;
    }

    RichText.setResolver((name) => find(name) || { kind: 'auto', name });

    // The popup a link was clicked in stays open ("pinned") while the linked one opens, so links can be followed
    // in a chain; pinned popups close with their × only. Without this, Leaflet's autoClose, the single tracked
    // character popup and the location markers' "close the previous popup" each closed it in some cases.
    function pinSource(link) {
        const cs = window.characterSystem;
        const ls = window.locationSystem;
        MapUtils.withMap((map) => {
            map.eachLayer((layer) => {
                if (!(layer instanceof L.Popup) || !layer.getElement()?.contains(link)) return;
                layer.options.autoClose = false;
                layer.options.closeOnClick = false;
                layer.getElement().classList.add('popup-pinned');
                if (cs && cs.currentCharacterPopup === layer) { cs.currentCharacterPopup = null; cs.currentFocusedCharacter = null; }
                if (ls && layer._source && ls.currentOpenPopup === layer._source) ls.currentOpenPopup = null;
            });
        });
        const panel = link.closest('.panel-anchored-popup');
        if (panel && cs && cs.currentPanelPopup === panel) {
            panel.classList.add('pinned');
            panel.removeAttribute('id');
            cs.currentPanelPopup = null;
            cs.currentFocusedCharacter = null;
        }
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest && e.target.closest('a.wiki-link');
        if (!link) return;
        e.preventDefault();
        const hit = find(link.dataset.name);
        if (!hit) {
            link.classList.add('missing');
            link.title = `Nicht gefunden: ${link.dataset.name}`;
            return;
        }
        pinSource(link);
        if (hit.kind === 'character') window.characterSystem.focusCharacter(hit.name);
        else window.locationSystem.focusLocation(hit.name);
    });

    // ---------- backlinks: "Erwähnt in …" ----------
    // Every location description and character description/notes that links to name (not counting the entry itself).
    function backlinks(name) {
        const key = fold(name);
        const sources = [
            ...(window.characterSystem?.getCharacters?.() || []).map((c) => ({ kind: 'character', name: c.name, texts: [c.description, c.notes] })),
            ...(window.locationSystem?.getLocations?.() || []).map((l) => {
                const p = l.feature?.properties || l;
                return { kind: 'location', name: p.name, texts: [p.description] };
            }),
        ];
        return sources
            .filter((s) => s.name && fold(s.name) !== key && s.texts.some((t) => RichText.links(t).some((n) => fold(n) === key)))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    // Popups contain this empty slot; it is filled once it is on the page, when all data has loaded.
    function backlinksSlot(name) {
        return `<div class="backlinks" data-backlinks-for="${RichText.escape(name)}" hidden></div>`;
    }

    function fill(slot) {
        slot.dataset.filled = '1';
        const hits = backlinks(slot.dataset.backlinksFor);
        if (!hits.length) return;
        const links = hits.map((h) => `<a href="#" class="wiki-link wiki-${h.kind}" data-kind="${h.kind}" data-name="${RichText.escape(h.name)}">${RichText.escape(h.name)}</a>`);
        slot.innerHTML = `🔗 <strong>Erwähnt in:</strong> ${links.join(', ')}`;
        slot.classList.add('rich-text');
        slot.hidden = false;
    }

    const fillAll = (root) => root.querySelectorAll?.('.backlinks:not([data-filled])').forEach(fill);
    new MutationObserver((records) => {
        for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) fillAll(n.matches?.('.backlinks') ? n.parentNode : n);
    }).observe(document.documentElement, { childList: true, subtree: true });

    window.WikiLinks = { find, backlinks, backlinksSlot };
})();
