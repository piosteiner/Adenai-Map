// link-cards.js - A small card for a [[link]] while the pointer rests on it (or the keyboard focuses it): a character's
// portrait, title, status and where they are; a location's picture, type and region; a glossary term's definition — the
// beginning of the description below. The text is not left: a click still opens the entry (wiki-links.js).
// Only with a pointer that hovers (no cards on touch screens, where a tap opens the entry as before).
//
// In the minutes a click (or tap) opens the entry right there instead: a card at the link with the whole description,
// whose links open in the same card (← zurück), and a button for the map or the glossary. The minutes stay open and the
// map stays where it is (LinkCards.open, called by wiki-links.js for links in the minutes and their comments).
(function () {
    const hover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const esc = (s) => (window.RichText ? RichText.escape(String(s ?? '')) : String(s ?? ''));
    const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const plain = (t) => (window.AdenaiSearch?.plain ? AdenaiSearch.plain(t) : String(t || ''))
        .replace(/==|\|\||^\s*(?:\d+[.)]|[-*+]|>|\[[ xX]\])\s*/gm, '').replace(/\s+/g, ' ').trim();
    const cut = (t, n = 170) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')} …` : t);
    const label = (fn, v) => (v ? window.AdenaiConfig?.[fn]?.(v) || v : '');

    const card = document.createElement('div');
    card.className = 'link-card';
    card.setAttribute('role', 'tooltip');
    card.hidden = true;
    document.addEventListener('DOMContentLoaded', () => document.body.append(card));
    if (document.body) document.body.append(card);

    function character(name) {
        const c = (window.characterSystem?.getCharacters?.() || []).find((x) => fold(x.name) === fold(name));
        if (!c) return null;
        const img = window.EntityImages?.imagesOf(c)[0];
        const where = window.characterSystem.getCurrentLocation?.(c);
        return {
            img, images: window.EntityImages?.imagesOf(c), title: c.name, sub: c.title,
            tags: [label('getCharacterStatusLabel', c.status), label('getCharacterRelationshipLabel', c.relationship), c.faction ? `🛡️ ${c.faction}` : ''],
            line: where && !/unbekannt|unknown/i.test(where) ? `📍 ${where}` : '',
            text: plain(c.description),
            desc: c.description,
        };
    }
    function location(name) {
        const l = (window.locationSystem?.getLocations?.() || []).find((x) => fold(x.feature?.properties?.name || x.name) === fold(name));
        const p = l?.feature?.properties || l;
        if (!p) return null;
        return {
            img: window.EntityImages?.imagesOf(p)[0], images: window.EntityImages?.imagesOf(p), title: p.name,
            tags: [label('getLocationTypeLabel', p.type), label('getLocationRegionLabel', p.region), p.visited ? '✓ besucht' : ''],
            text: plain(p.description),
            desc: p.description,
        };
    }
    function term(name) {
        const t = window.mapGlossary?.find?.(name);
        if (!t) return null;
        return {
            img: window.EntityImages?.imagesOf(t)[0], images: window.EntityImages?.imagesOf(t), title: t.name, sub: t.pending ? '⏳ Vorschlag, noch nicht bestätigt' : '',
            tags: [t.category ? `📖 ${t.category}` : '📖 Glossar'],
            text: plain(t.definition || t.description),
            desc: t.description || t.definition,
        };
    }

    // what a link points to: { kind, ...data } or null
    function entryOf(link) {
        const kind = link.dataset.kind;
        const name = link.dataset.name;
        if (!name || link.classList.contains('missing')) return null;
        const tries = kind === 'character' ? [['character', character]] : kind === 'location' ? [['location', location]]
            : kind === 'term' || kind === 'pending' ? [['term', term]] : [['character', character], ['location', location], ['term', term]];
        for (const [k, fn] of tries) { const d = fn(name); if (d) return { kind: k, name, ...d }; }
        return null;
    }

    // ---------- in the minutes: the entry in a card at the link ----------

    const minutes = (link) => !!link.closest('.protocol-panel:not(.glossary-panel), .pp-ccard, .pp-ctoast, .link-card-pinned');
    let pinned = null;
    let pinnedLink = null;
    let trail = []; // links followed inside the card, for "← zurück"

    function placeAt(el, link) {
        const r = link.getBoundingClientRect();
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        let top = r.bottom + 8;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
    }

    function drawPinned(d) {
        const img = d.img ? window.EntityImages.thumbOf(d.img) : '';
        const tags = d.tags.filter(Boolean);
        // a click on the picture: the image viewer with all of the entry's pictures (image-popup-manager.js)
        const zoom = d.img ? ` title="Bild vergrössern" data-src="${esc(d.img)}"${window.EntityImages.galleryAttrs(d.images || [d.img], d.img)}` : '';
        const go = d.kind === 'term' ? '📖 Im Glossar öffnen' : '🗺️ Auf der Karte zeigen';
        pinned.innerHTML = `
            <div class="link-card-bar">
              ${trail.length ? '<button type="button" class="link-card-back">← zurück</button>' : ''}
              <button type="button" class="link-card-close" title="Schliessen" aria-label="Schliessen">✕</button>
            </div>
            <div class="link-card-headrow">
              ${img ? `<img class="link-card-img link-card-zoom" src="${esc(img)}" alt=""${zoom}>` : ''}
              <div class="link-card-body">
                <div class="link-card-title">${esc(d.title)}</div>
                ${d.sub ? `<div class="link-card-sub">${esc(d.sub)}</div>` : ''}
                ${tags.length ? `<div class="link-card-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
                ${d.line ? `<div class="link-card-line">${esc(d.line)}</div>` : ''}
              </div>
            </div>
            ${d.desc ? `<div class="link-card-desc rich-text">${RichText.render(d.desc)}</div>` : '<p class="link-card-hint">Noch keine Beschreibung.</p>'}
            <div class="link-card-actions"><button type="button" class="link-card-go">${go}</button></div>`;
        pinned.querySelector('.link-card-close').addEventListener('click', close);
        pinned.querySelector('.link-card-zoom')?.addEventListener('click', (e) => {
            const v = window.imagePopupManager;
            if (!v) return;
            v.setGallery(e.currentTarget, { title: d.title });
            v.showImagePopup(d.img, { title: d.title });
        });
        pinned.querySelector('.link-card-back')?.addEventListener('click', () => { const prev = trail.pop(); drawPinned(prev); });
        pinned.querySelector('.link-card-go').addEventListener('click', () => {
            close();
            if (d.kind !== 'term') window.mapProtocols?.foldForMap(); // a phone: the map instead of the minutes
            window.WikiLinks?.go(d.name);
        });
        pinned.dataset.current = JSON.stringify({ kind: d.kind, name: d.name });
        pinned.current = d;
    }

    // a link in the minutes was clicked: its entry in the card (a link inside the card: the card shows that one)
    function open(link) {
        const d = entryOf(link);
        if (!d) return false;
        if (hover) hide(); // the small card (only with a hovering pointer)
        if (pinned && pinned.contains(link)) {
            trail.push(pinned.current);
            drawPinned(d);
            pinned.scrollTop = 0;
            return true;
        }
        close();
        pinned = document.createElement('div');
        pinned.className = 'link-card link-card-pinned visible';
        pinned.setAttribute('role', 'dialog');
        pinned.setAttribute('aria-label', d.title);
        trail = [];
        drawPinned(d);
        document.body.append(pinned);
        pinnedLink = link;
        placeAt(pinned, link);
        pinned.querySelector('.link-card-img')?.addEventListener('load', () => pinned && pinnedLink === link && placeAt(pinned, link), { once: true });
        return true;
    }

    function close() {
        pinned?.remove();
        pinned = null;
        pinnedLink = null;
        trail = [];
    }

    // anywhere else (caught on the way down: the minutes panel stops clicks from reaching the map), Esc, or the text
    // scrolling away under it
    // (the image viewer opened from the card is not "elsewhere": the card is still there once it closes)
    const viewerOpen = () => !!document.querySelector('.image-popup-overlay.active');
    document.addEventListener('pointerdown', (e) => { if (pinned && !pinned.contains(e.target) && !e.target.closest?.('a.wiki-link, .image-popup-overlay')) close(); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned && !viewerOpen()) { e.stopPropagation(); close(); } }, true);
    document.addEventListener('scroll', (e) => { if (pinned && !pinned.contains(e.target)) close(); }, true);

    window.LinkCards = { open, close, inMinutes: minutes };

    if (!hover) return;

    function contentFor(link) {
        const d = entryOf(link);
        if (!d) return null;
        const thumb = d.img ? window.EntityImages.thumbOf(d.img) : '';
        const tags = d.tags.filter(Boolean);
        return `${thumb ? `<img class="link-card-img" src="${esc(thumb)}" alt="">` : ''}
            <div class="link-card-body">
              <div class="link-card-title">${esc(d.title)}</div>
              ${d.sub ? `<div class="link-card-sub">${esc(d.sub)}</div>` : ''}
              ${tags.length ? `<div class="link-card-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
              ${d.line ? `<div class="link-card-line">${esc(d.line)}</div>` : ''}
              ${d.text ? `<div class="link-card-text">${esc(cut(d.text))}</div>` : ''}
              <div class="link-card-hint">${minutes(link) ? 'Klicken zeigt den ganzen Eintrag' : 'Klicken öffnet den Eintrag'}</div>
            </div>`;
    }

    // below the link, or above it when there is no room; always inside the window
    function place(link) {
        const r = link.getBoundingClientRect();
        const w = card.offsetWidth;
        const h = card.offsetHeight;
        const gap = 8;
        let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        let top = r.bottom + gap;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap);
        card.style.left = `${Math.round(left)}px`;
        card.style.top = `${Math.round(top)}px`;
    }

    let current = null;
    let showTimer = null;
    let hideTimer = null;
    function show(link) {
        if (pinned?.contains(link) && pinned.current?.name === link.dataset.name) return;
        const html = contentFor(link);
        if (!html) return;
        current = link;
        card.innerHTML = html;
        card.hidden = false;
        card.classList.remove('visible');
        place(link);
        card.querySelector('img')?.addEventListener('load', () => current === link && place(link), { once: true });
        requestAnimationFrame(() => card.classList.add('visible'));
    }
    function hide() {
        clearTimeout(showTimer);
        current = null;
        card.classList.remove('visible');
        card.hidden = true;
    }
    const linkOf = (e) => e.target.closest?.('a.wiki-link');

    document.addEventListener('pointerover', (e) => {
        const link = linkOf(e);
        if (!link) return;
        clearTimeout(hideTimer);
        if (link === current) return;
        clearTimeout(showTimer);
        showTimer = setTimeout(() => show(link), current ? 80 : 350); // a short rest first; moving on to the next link: at once
    });
    document.addEventListener('pointerout', (e) => {
        const link = linkOf(e);
        if (!link || link.contains(e.relatedTarget)) return;
        clearTimeout(showTimer);
        hideTimer = setTimeout(hide, 120);
    });
    document.addEventListener('focusin', (e) => { const link = linkOf(e); if (link) show(link); });
    document.addEventListener('focusout', (e) => { if (linkOf(e)) hide(); });
    // a click opens the entry: the card goes; so does scrolling (it would point at a link that moved)
    document.addEventListener('click', (e) => { if (linkOf(e)) hide(); }, true);
    document.addEventListener('scroll', () => { if (current) hide(); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
})();
