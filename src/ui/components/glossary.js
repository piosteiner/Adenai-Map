// glossary.js - The glossary on the map: terms that are neither characters nor locations (public/data/glossary.json,
// edited in the CMS). [[Term]] — or one of its aliases — anywhere on the map opens it here; the panel lists all terms
// with a search and categories, and shows what mentions a term. It opens on the right, so it can sit beside the
// protocol panel (left) while reading the minutes.
class MapGlossary {
    constructor() {
        this.terms = [];
        this.current = null;
        this.fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        this.build();
        this.ready = fetch('public/data/glossary.json', { cache: 'no-cache' })
            .then((r) => (r.ok ? r.json() : { terms: [] }))
            .then((g) => { this.terms = (g.terms || []).sort((a, b) => a.name.localeCompare(b.name, 'de')); this.button.hidden = !this.terms.length; })
            .catch(() => { this.terms = []; });
    }

    // by name or alias → the term
    find(name) {
        const key = this.fold(name);
        return this.terms.find((t) => [t.name, ...(t.aliases || [])].some((n) => this.fold(n) === key)) || null;
    }

    el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    build() {
        const bar = document.getElementById('map-panel-buttons') || document.body.appendChild(Object.assign(this.el('div'), { id: 'map-panel-buttons' }));
        this.button = this.el('button', 'map-panel-button', '📖 Glossar');
        this.button.type = 'button';
        this.button.title = 'Begriffe der Kampagne';
        this.button.hidden = true; // until there are terms
        this.button.addEventListener('click', () => (this.panel.hidden ? this.open() : this.close()));
        bar.appendChild(this.button);

        this.panel = this.el('aside', 'protocol-panel glossary-panel');
        this.panel.hidden = true;
        this.panel.setAttribute('aria-label', 'Glossar');
        this.panel.innerHTML = `
            <header class="pp-head">
                <strong>📖 Glossar</strong>
                <input type="search" class="pp-search" placeholder="Suchen…" aria-label="Glossar durchsuchen">
                <select class="gl-category" aria-label="Kategorie"><option value="">Alle</option></select>
                <button type="button" class="pp-close" title="Schliessen">×</button>
            </header>
            <div class="pp-body"><nav class="pp-list"></nav><article class="pp-view"></article></div>`;
        document.body.appendChild(this.panel);
        window.PanelResize?.attach(this.panel, { edge: 'left', key: 'adenai-glossary-width', min: 340 });
        this.list = this.panel.querySelector('.pp-list');
        this.view = this.panel.querySelector('.pp-view');
        this.search = this.panel.querySelector('.pp-search');
        this.category = this.panel.querySelector('.gl-category');
        this.panel.querySelector('.pp-close').addEventListener('click', () => this.close());
        this.search.addEventListener('input', () => this.drawList());
        this.category.addEventListener('change', () => this.drawList());
        if (window.L) { L.DomEvent.disableClickPropagation(this.panel); L.DomEvent.disableScrollPropagation(this.panel); }
        this.panel.addEventListener('click', (e) => {
            if (e.target.closest('a.wiki-link') && window.innerWidth < 800) this.close();
        });
    }

    async open(name = null) {
        await this.ready;
        this.panel.hidden = false;
        this.button.classList.add('active');
        const cats = [...new Set(this.terms.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
        this.category.replaceChildren(Object.assign(this.el('option', '', 'Alle'), { value: '' }), ...cats.map((c) => Object.assign(this.el('option', '', c), { value: c })));
        const term = (name && this.find(name)) || this.current || this.terms[0];
        this.drawList();
        if (term) this.show(term);
        else this.view.replaceChildren(this.el('p', 'pp-note', 'Noch keine Begriffe.'));
    }

    close() {
        this.panel.hidden = true;
        this.button.classList.remove('active');
    }

    drawList() {
        const q = this.fold(this.search.value);
        const cat = this.category.value;
        const list = this.terms.filter((t) => (!cat || t.category === cat) && (!q || this.fold([t.name, ...(t.aliases || []), t.category, t.description].join(' ')).includes(q)));
        this.list.replaceChildren(...list.map((t) => {
            const b = this.el('button', `pp-item gl-item${this.current?.id === t.id ? ' active' : ''}`);
            b.type = 'button';
            b.append(this.el('span', 'pp-item-title', t.name), this.el('span', 'pp-item-meta', t.category || ''));
            b.addEventListener('click', () => this.show(t));
            return b;
        }));
        if (!list.length) this.list.append(this.el('p', 'pp-note', 'Nichts gefunden.'));
    }

    show(t) {
        this.current = t;
        this.drawList();
        const head = this.el('header', 'pp-read-head');
        head.append(this.el('h2', '', t.name));
        const meta = [t.category, (t.aliases || []).length ? `auch: ${t.aliases.join(', ')}` : ''].filter(Boolean).join(' · ');
        if (meta) head.append(this.el('p', 'pp-meta', meta));
        const images = window.EntityImages ? EntityImages.imagesOf(t) : [];
        const parts = [head];
        if (images.length) {
            const fig = this.el('div', 'gl-images');
            fig.innerHTML = `<img class="gl-cover" src="${RichText.escape(images[0])}" alt="${RichText.escape(t.name)}"${EntityImages.galleryAttrs(images, images[0])}>${EntityImages.galleryStrip(images, t.name)}`;
            parts.push(fig);
        }
        const text = this.el('div', 'pp-text rich-text');
        text.innerHTML = t.description ? RichText.render(t.description) : '<p class="pp-note">Noch keine Beschreibung.</p>';
        parts.push(text);
        // what mentions it, by name or alias (texts on the map, and the minutes on an unlocked device)
        const slot = this.el('div', 'backlinks');
        slot.dataset.backlinksFor = t.name;
        parts.push(slot);
        this.view.replaceChildren(...parts);
        this.view.scrollTop = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => { window.mapGlossary = new MapGlossary(); });
