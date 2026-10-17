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
        if (hit.kind === 'character') window.characterSystem.focusCharacter(hit.name);
        else window.locationSystem.focusLocation(hit.name);
    });

    window.WikiLinks = { find };
})();
