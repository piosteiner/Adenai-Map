// link-cards.js - A small card for a [[link]] while the pointer rests on it (or the keyboard focuses it): a character's
// portrait, title, status and where they are; a location's picture, type and region; a glossary term's definition — the
// beginning of the description below. The text is not left: a click still opens the entry (wiki-links.js).
// Only with a pointer that hovers (no cards on touch screens, where a tap opens the entry as before).
(function () {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
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
            img, title: c.name, sub: c.title,
            tags: [label('getCharacterStatusLabel', c.status), label('getCharacterRelationshipLabel', c.relationship), c.faction ? `🛡️ ${c.faction}` : ''],
            line: where && !/unbekannt|unknown/i.test(where) ? `📍 ${where}` : '',
            text: plain(c.description),
        };
    }
    function location(name) {
        const l = (window.locationSystem?.getLocations?.() || []).find((x) => fold(x.feature?.properties?.name || x.name) === fold(name));
        const p = l?.feature?.properties || l;
        if (!p) return null;
        return {
            img: window.EntityImages?.imagesOf(p)[0], title: p.name,
            tags: [label('getLocationTypeLabel', p.type), label('getLocationRegionLabel', p.region), p.visited ? '✓ besucht' : ''],
            text: plain(p.description),
        };
    }
    function term(name) {
        const t = window.mapGlossary?.find?.(name);
        if (!t) return null;
        return {
            img: window.EntityImages?.imagesOf(t)[0], title: t.name, sub: t.pending ? '⏳ Vorschlag, noch nicht bestätigt' : '',
            tags: [t.category ? `📖 ${t.category}` : '📖 Glossar'],
            text: plain(t.definition || t.description),
        };
    }

    function contentFor(link) {
        const kind = link.dataset.kind;
        const name = link.dataset.name;
        if (!name || link.classList.contains('missing')) return null;
        const d = kind === 'character' ? character(name) : kind === 'location' ? location(name)
            : kind === 'term' || kind === 'pending' ? term(name) : character(name) || location(name) || term(name);
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
              <div class="link-card-hint">Klicken öffnet den Eintrag</div>
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
