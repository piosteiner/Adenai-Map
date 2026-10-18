// glossary.js - The glossary on the map: terms that are neither characters nor locations (public/data/glossary.json,
// edited in the CMS). [[Term]] — or one of its aliases — anywhere on the map opens it here; the panel lists all terms
// with a search and categories, and shows what mentions a term. It opens on the right, so it can sit beside the
// protocol panel (left) while reading the minutes.
//
// Proposals: on a device unlocked for the minutes, the entries the players created while writing (a person, a place or
// a thing — server/lib/pending-store.js) are here too, marked "⏳", until the DM confirms them in the CMS. They work like
// terms: [[links]] to them resolve and open them here, they can be searched and described further. The map gets new
// ones live (components/protocols.js passes the news on).
class MapGlossary {
    constructor() {
        this.API = 'https://adenai-admin.piogino.ch/api/pending';
        this.KINDS = { character: '👤 Person', location: '📍 Ort', term: '📖 Gegenstand / Begriff' };
        this.terms = [];
        this.pending = [];
        this.current = null;
        this.fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        this.build();
        this.ready = fetch('public/data/glossary.json', { cache: 'no-cache' })
            .then((r) => (r.ok ? r.json() : { terms: [] }))
            .then((g) => { this.terms = (g.terms || []).sort((a, b) => a.name.localeCompare(b.name, 'de')); this.drawButton(); })
            .catch(() => { this.terms = []; });
        setTimeout(() => this.loadPending(), 0); // after components/protocols.js knows whether this device is unlocked
    }

    // ---------- proposals ----------

    async loadPending() {
        const token = window.mapProtocols?.token;
        if (!token) return this.setPending([]);
        try {
            const res = await fetch(this.API, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) this.setPending(data.entries || []);
        } catch { /* offline: no proposals */ }
    }

    setPending(entries) {
        const before = this.pending.map((p) => p.name).join('\n');
        this.pending = (entries || []).map((p) => ({ ...p, aliases: [], pending: true, kindLabel: this.KINDS[p.kind] || this.KINDS.term, category: p.category || '' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
        this.drawButton();
        if (!this.panel.hidden) {
            this.drawList();
            if (this.current?.pending) { const now = this.pending.find((p) => p.id === this.current.id); if (now && !this.editing) this.show(now); }
        }
        // links to a new (or removed) proposal resolve differently now
        if (before !== this.pending.map((p) => p.name).join('\n')) window.mapProtocols?.redrawAll?.();
    }

    // everything [[links]] can point to here: the terms and the proposals
    allTerms() { return [...this.terms, ...this.pending]; }

    // Creating a proposal from the editor's [[ suggestions (src/vendor/md-editor.js): asks what it is, sends it, returns
    // the name to link to — or null when cancelled
    createEntry(typed) {
        return new Promise((resolve) => {
            const dialog = this.el('dialog', 'gl-create');
            dialog.innerHTML = `
                <form method="dialog">
                    <h3>Neuer Eintrag</h3>
                    <label>Name<input name="name" required maxlength="80"></label>
                    <fieldset><legend>Was ist es?</legend>
                        ${Object.entries(this.KINDS).map(([k, l], i) => `<label class="gl-kind"><input type="radio" name="kind" value="${k}"${i === 0 ? ' checked' : ''}> ${l}</label>`).join('')}
                    </fieldset>
                    <label>Kurzbeschreibung <span class="pp-note">(optional, auch später)</span><textarea name="description" rows="3" placeholder="Wer oder was ist das? [[ verlinkt"></textarea></label>
                    <p class="pp-note">Der Eintrag funktioniert sofort für alle und wird von der Spielleitung bestätigt.</p>
                    <p class="pp-error" hidden></p>
                    <div class="gl-create-actions"><button type="button" value="cancel" class="pp-later">Abbrechen</button><button type="submit" class="pp-done">Anlegen</button></div>
                </form>`;
            document.body.appendChild(dialog);
            const form = dialog.querySelector('form');
            const err = dialog.querySelector('.pp-error');
            form.elements.name.value = typed;
            const finish = (name) => { dialog.close(); dialog.remove(); resolve(name); };
            dialog.querySelector('[value=cancel]').addEventListener('click', () => finish(null));
            dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('[type=submit]');
                btn.disabled = true;
                try {
                    const res = await fetch(this.API, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.mapProtocols?.token}` },
                        body: JSON.stringify({ name: form.elements.name.value, kind: form.elements.kind.value, description: form.elements.description.value, by: window.mapProtocols?.name || 'Map' }),
                    });
                    const data = await res.json().catch(() => ({}));
                    // proposed already by someone else: just link to it
                    if (res.status === 409 && data.entry) return finish(data.entry.name);
                    if (!res.ok) throw new Error(data.error === 'An entry of this name exists already' ? 'Diesen Namen gibt es schon – bitte aus der Liste wählen.' : (data.error || `Fehler ${res.status}`));
                    this.setPending([...this.pending.filter((p) => p.id !== data.entry.id), data.entry]);
                    finish(data.entry.name);
                } catch (e2) {
                    err.textContent = e2.message;
                    err.hidden = false;
                    btn.disabled = false;
                }
            });
            dialog.showModal();
            form.elements.name.select();
        });
    }

    async savePending(p, values) {
        const res = await fetch(`${this.API}/${encodeURIComponent(p.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.mapProtocols?.token}` },
            body: JSON.stringify({ ...values, by: window.mapProtocols?.name || 'Map' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
        this.setPending(this.pending.map((x) => (x.id === p.id ? data.entry : x)));
        return this.pending.find((x) => x.id === p.id);
    }

    // ---------- terms ----------

    // by name or alias → the term (or proposal)
    find(name) {
        const key = this.fold(name);
        return this.allTerms().find((t) => [t.name, ...(t.aliases || [])].some((n) => this.fold(n) === key)) || null;
    }

    el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    drawButton() {
        this.button.hidden = !this.terms.length && !this.pending.length;
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
        this.category.replaceChildren(Object.assign(this.el('option', '', 'Alle'), { value: '' }),
            ...(this.pending.length ? [Object.assign(this.el('option', '', '⏳ Vorschläge'), { value: '__pending' })] : []),
            ...cats.map((c) => Object.assign(this.el('option', '', c), { value: c })));
        const term = (name && this.find(name)) || this.current || this.allTerms()[0];
        this.drawList();
        if (term) this.show(term);
        else this.view.replaceChildren(this.el('p', 'pp-note', 'Noch keine Begriffe.'));
        // narrow screens show either the list or an entry: from the button, the list first
        if (!name) this.panel.classList.remove('gl-detail');
    }

    close() {
        this.panel.hidden = true;
        this.button.classList.remove('active');
    }

    drawList() {
        const q = this.fold(this.search.value);
        const cat = this.category.value;
        const fits = (t) => (!q || this.fold([t.name, ...(t.aliases || []), t.category, t.kindLabel, t.description].join(' ')).includes(q));
        const list = [
            ...this.pending.filter((p) => (!cat || cat === '__pending') && fits(p)),
            ...this.terms.filter((t) => (!cat || t.category === cat) && fits(t)),
        ];
        this.list.replaceChildren(...list.map((t) => {
            const b = this.el('button', `pp-item gl-item${this.current?.id === t.id ? ' active' : ''}${t.pending ? ' gl-pending' : ''}`);
            b.type = 'button';
            b.append(this.el('span', 'pp-item-title', t.pending ? `⏳ ${t.name}` : t.name), this.el('span', 'pp-item-meta', t.pending ? `Vorschlag · ${t.kindLabel.replace(/^\S+ /, '')}` : t.category || ''));
            b.addEventListener('click', () => this.show(t));
            return b;
        }));
        if (!list.length) this.list.append(this.el('p', 'pp-note', 'Nichts gefunden.'));
    }

    show(t) {
        this.current = t;
        this.editing = false;
        this.drawList();
        this.panel.classList.add('gl-detail');
        const head = this.el('header', 'pp-read-head');
        const back = this.el('button', 'gl-back', '← Alle Begriffe');
        back.type = 'button';
        back.addEventListener('click', () => this.panel.classList.remove('gl-detail'));
        head.append(back, this.el('h2', '', t.name));
        const meta = t.pending
            ? t.kindLabel
            : [t.category, (t.aliases || []).length ? `auch: ${t.aliases.join(', ')}` : ''].filter(Boolean).join(' · ');
        if (meta) head.append(this.el('p', 'pp-meta', meta));
        const parts = [head];
        if (t.pending) {
            const when = t.createdAt ? new Date(t.createdAt).toLocaleDateString('de-CH') : '';
            parts.push(this.el('p', 'gl-pending-note', `⏳ Vorschlag von ${t.createdBy || 'jemandem'}${when ? ` (${when})` : ''} – wartet auf Bestätigung durch die Spielleitung.`));
        }
        const images = !t.pending && window.EntityImages ? EntityImages.imagesOf(t) : [];
        if (images.length) {
            const fig = this.el('div', 'gl-images');
            fig.innerHTML = `<img class="gl-cover" src="${RichText.escape(images[0])}" alt="${RichText.escape(t.name)}"${EntityImages.galleryAttrs(images, images[0])}>${EntityImages.galleryStrip(images, t.name)}`;
            parts.push(fig);
        }
        const text = this.el('div', 'pp-text rich-text');
        text.innerHTML = t.description ? RichText.render(t.description) : '<p class="pp-note">Noch keine Beschreibung.</p>';
        parts.push(text);
        if (t.pending && window.mapProtocols?.unlocked) {
            const edit = this.el('button', 'pp-edit', '✎ Ergänzen');
            edit.type = 'button';
            edit.addEventListener('click', () => this.editPending(t));
            parts.push(edit);
        }
        // what mentions it, by name or alias (texts on the map, and the minutes on an unlocked device)
        const slot = this.el('div', 'backlinks');
        slot.dataset.backlinksFor = t.name;
        parts.push(slot);
        this.view.replaceChildren(...parts);
        this.view.scrollTop = 0;
    }

    // players describe a proposal further (and may correct what it is); the name stays — the DM can change it
    editPending(p) {
        this.editing = true;
        const form = this.el('form', 'gl-edit');
        form.innerHTML = `
            <fieldset><legend>Was ist es?</legend>
                ${Object.entries(this.KINDS).map(([k, l]) => `<label class="gl-kind"><input type="radio" name="kind" value="${k}"${p.kind === k ? ' checked' : ''}> ${l}</label>`).join('')}
            </fieldset>
            <label>Beschreibung<textarea name="description" rows="8"></textarea></label>
            <p class="pp-error" hidden></p>
            <div class="gl-create-actions"><button type="button" class="pp-later">Abbrechen</button><button type="submit" class="pp-done">Speichern</button></div>`;
        form.elements.description.value = p.description || '';
        form.querySelector('.pp-later').addEventListener('click', () => this.show(p));
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try { this.show(await this.savePending(p, { kind: form.elements.kind.value, description: form.elements.description.value })); } catch (err) {
                const box = form.querySelector('.pp-error');
                box.textContent = err.message;
                box.hidden = false;
            }
        });
        this.view.querySelector('.pp-text').replaceWith(form);
        this.view.querySelector('.pp-edit')?.remove();
        window.AdenaiEditor?.enhance?.(form.elements.description);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.mapGlossary = new MapGlossary(); });
