// protocols.js - The campaign's session minutes on the map, behind the protocol password, written together live.
//
// The minutes are not in the public data files: they live on the CMS server (server/lib/protocol-store.js). Entering
// the password (set in the CMS → Protocols) unlocks this device for 30 days (token in localStorage); a new password in
// the CMS ends that. The panel shows all sessions as one long scroll (the side bar is the table of contents, it follows
// the scrolling); "✎ Bearbeiten" turns a session into an editor in place. The panel's width can be dragged.
//
// Published version and draft: readers see a session's published version. Editing is live and together
// (server/lib/protocol-live.js, client: server/editor-src/live-client.js in src/vendor/md-editor.js, loaded on opening):
// everyone editing a session sees the others' typing with their cursors and names, and what is typed is kept at once
// as the session's draft — nothing is lost when the tab closes or the connection drops. "💾 Speichern" publishes the
// draft; until then the session is marked "● Entwurf". A new session is a draft until it is saved; there is only ever
// one such new session ("＋ Neu" opens it). Required to save: number, players, real-life date.
class MapProtocols {
    constructor() {
        this.API = 'https://adenai-admin.piogino.ch/api/protocols';
        this.LIVE = 'wss://adenai-admin.piogino.ch/api/protocols/live';
        this.KEY = 'adenai-protocol-token';
        this.NAME_KEY = 'adenai-protocol-name';
        this.sessions = [];
        this.suggestions = { players: [], places: [] };
        this.rooms = new Map(); // session id → live room, while editing
        this.sections = new Map(); // session id → { el, editing }
        this.editorLoading = null;
        this.live = null;
        this.build();
        // an unlocked device knows the minutes from the start, for "Erwähnt in" in the popups
        if (this.unlocked) this.load().catch(() => {});
    }

    // ---------- token, name & API ----------

    get token() {
        try {
            const t = JSON.parse(localStorage.getItem(this.KEY) || 'null');
            return t && Date.parse(t.expiresAt) > Date.now() ? t.token : this.memoryToken || null;
        } catch { return this.memoryToken || null; }
    }
    set token(t) {
        try { if (t) localStorage.setItem(this.KEY, JSON.stringify(t)); else localStorage.removeItem(this.KEY); } catch { /* private mode: until reload */ }
        this.memoryToken = t?.token || null;
    }
    get unlocked() { return !!this.token; }

    get name() { try { return localStorage.getItem(this.NAME_KEY) || ''; } catch { return this.memoryName || ''; } }
    set name(n) { try { localStorage.setItem(this.NAME_KEY, n); } catch { this.memoryName = n; } this.drawName(); this.rooms.forEach((r) => r.setName(n)); }

    async api(path = '', { method = 'GET', body } = {}) {
        const res = await fetch(this.API + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && data.locked) { this.lockDevice('Bitte das Passwort erneut eingeben.'); throw new Error('locked'); }
        if (!res.ok || data.success === false) throw Object.assign(new Error(data.error || `Fehler ${res.status}`), { status: res.status, data });
        return data;
    }

    async load() {
        const [s, sg] = await Promise.all([this.api(''), this.api('/suggestions').catch(() => ({}))]);
        this.sessions = s.sessions || [];
        this.sort();
        this.suggestions = { players: sg.players || [], places: sg.places || [] };
    }

    sort() { this.sessions.sort((a, b) => (Number(this.shown(a).number) || 0) - (Number(this.shown(b).number) || 0)); }

    // what a session shows when not being edited: the published version — a never-saved one has only its draft
    shown(s) {
        if (s.published !== false) return s;
        const d = s.draft?.values || { number: s.draft?.number, title: s.draft?.title };
        return { ...s, ...d };
    }

    // Sessions whose (published) minutes link to name (for "Erwähnt in" in the popups; wiki-links.js)
    mentions(name) {
        if (!this.unlocked || !window.RichText) return [];
        const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        const key = fold(name);
        return this.sessions.filter((s) => s.published !== false && [...RichText.links(`${s.title || ''} ${s.content || ''}`), ...(s.places || [])].some((n) => fold(n) === key));
    }

    // ---------- UI frame ----------

    el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    build() {
        // the map's panel buttons sit in one row below the search (glossary.js adds its own)
        const bar = document.getElementById('map-panel-buttons') || document.body.appendChild(Object.assign(this.el('div'), { id: 'map-panel-buttons' }));
        this.button = this.el('button', 'map-panel-button protocol-button', '📜 Protokoll');
        this.button.type = 'button';
        this.button.title = 'Sitzungsprotokolle der Kampagne';
        this.button.addEventListener('click', () => (this.panel.hidden || this.panel.classList.contains('folded') ? this.open() : this.close()));
        bar.prepend(this.button);

        this.panel = this.el('aside', 'protocol-panel');
        this.panel.hidden = true;
        this.panel.setAttribute('aria-label', 'Sitzungsprotokolle');
        this.panel.innerHTML = `
            <header class="pp-head">
                <strong>📜 Protokolle</strong>
                <span class="pp-status" hidden></span>
                <input type="search" class="pp-search" placeholder="Suchen…" aria-label="Protokolle durchsuchen" hidden>
                <button type="button" class="pp-name" title="Dein Name beim gemeinsamen Schreiben" hidden></button>
                <button type="button" class="pp-new" hidden>＋ Neu</button>
                <button type="button" class="pp-lock" title="Auf diesem Gerät sperren" hidden>🔒</button>
                <button type="button" class="pp-close" title="Schliessen">×</button>
            </header>
            <div class="pp-body"></div>`;
        document.body.appendChild(this.panel);
        window.PanelResize?.attach(this.panel, { edge: 'right', key: 'adenai-protocol-width', min: 340 });
        window.DateField?.observe(this.panel); // date fields you can type and paste into
        this.body = this.panel.querySelector('.pp-body');
        this.search = this.panel.querySelector('.pp-search');
        this.statusEl = this.panel.querySelector('.pp-status');
        this.nameBtn = this.panel.querySelector('.pp-name');
        this.newBtn = this.panel.querySelector('.pp-new');
        this.panel.querySelector('.pp-close').addEventListener('click', () => this.close());
        this.newBtn.addEventListener('click', () => this.newSession());
        this.panel.querySelector('.pp-lock').addEventListener('click', () => this.lockDevice());
        this.nameBtn.addEventListener('click', () => this.askName());
        this.search.addEventListener('input', () => this.filter());
        if (window.L) { L.DomEvent.disableClickPropagation(this.panel); L.DomEvent.disableScrollPropagation(this.panel); }
        // following a [[link]] on a narrow screen: fold the panel away to show the map
        this.panel.addEventListener('click', (e) => {
            if (e.target.closest('a.wiki-link') && window.innerWidth < 800) this.panel.classList.add('folded');
        });
    }

    toolbar(on) {
        ['.pp-search', '.pp-new', '.pp-lock', '.pp-name', '.pp-status'].forEach((s) => { this.panel.querySelector(s).hidden = !on; });
        this.drawName();
    }

    drawName() {
        if (this.nameBtn) this.nameBtn.textContent = `👤 ${this.name || 'Name?'}`;
    }

    setStatus(s) {
        const text = { connecting: '◌ verbindet…', live: '● live', offline: '○ offline – Änderungen werden nachgereicht', locked: '🔒 gesperrt' }[s] || s;
        this.statusEl.textContent = text;
        this.statusEl.className = `pp-status pp-status-${s}`;
        if (s === 'locked') this.lockDevice('Bitte das Passwort erneut eingeben.');
    }

    async open(sessionId = null) {
        this.panel.hidden = false;
        this.panel.classList.remove('folded');
        this.button.classList.add('active');
        if (!this.unlocked) return this.showLock();
        if (this.listEl && this.live) { if (sessionId) this.scrollTo(sessionId); return; }
        this.body.replaceChildren(this.el('p', 'pp-note', 'Lädt…'));
        try {
            await Promise.all([this.load(), this.loadEditor()]);
            this.startLive();
            this.showMain();
            this.scrollTo(sessionId || this.sessions.filter((s) => s.published !== false).at(-1)?.id || this.sessions.at(-1)?.id, false);
        } catch (err) {
            if (err.message !== 'locked') this.body.replaceChildren(this.el('p', 'pp-error', `Protokolle nicht verfügbar: ${err.message}`));
        }
    }

    close() {
        this.panel.hidden = true;
        this.button.classList.remove('active');
        this.stopLive();
        this.listEl = null;
    }

    lockDevice(message = '') {
        this.token = null;
        this.stopLive();
        this.sessions = [];
        this.listEl = null;
        if (!this.panel.hidden) this.showLock(message);
    }

    showLock(message = '') {
        this.toolbar(false);
        const form = this.el('form', 'pp-lockform');
        form.innerHTML = `
            <p>Die Protokolle sind passwortgeschützt. Das Passwort bekommst du von der Spielleitung.</p>
            <input type="password" autocomplete="current-password" placeholder="Passwort" required>
            <button type="submit">Öffnen</button>
            <p class="pp-error" hidden></p>
            <p class="pp-note">Bleibt auf diesem Gerät 30 Tage entsperrt.</p>`;
        const err = form.querySelector('.pp-error');
        if (message) { err.textContent = message; err.hidden = false; }
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true;
            try {
                const res = await fetch(`${this.API}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: form.querySelector('input').value }) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
                this.token = { token: data.token, expiresAt: data.expiresAt };
                this.open();
            } catch (e2) {
                err.textContent = e2.message === 'Wrong password' ? 'Falsches Passwort.' : e2.message;
                err.hidden = false;
                btn.disabled = false;
            }
        });
        this.body.replaceChildren(form);
        form.querySelector('input').focus();
    }

    // ---------- live ----------

    loadEditor() {
        if (window.AdenaiEditor && window.AdenaiLive) return Promise.resolve();
        // md-editor.js finds link targets the way the CMS offers them
        window.adminCharacters ||= { getCharacters: () => window.characterSystem?.getCharacters?.() || [] };
        window.adminLocations ||= { getLocations: () => this.locations().map((name) => ({ properties: { name } })) };
        window.adminGlossary ||= { getTerms: () => window.mapGlossary?.terms || [] };
        this.editorLoading ||= new Promise((resolve, reject) => {
            const sc = document.createElement('script');
            sc.src = 'src/vendor/md-editor.js?v=4';
            sc.onload = () => resolve();
            sc.onerror = () => { this.editorLoading = null; reject(new Error('Editor konnte nicht geladen werden')); };
            document.head.appendChild(sc);
        });
        return this.editorLoading;
    }

    locations() {
        return (window.locationSystem?.getLocations?.() || []).map((l) => l.name || l.feature?.properties?.name).filter(Boolean);
    }

    startLive() {
        if (this.live) return;
        this.live = window.AdenaiLive.connect({ url: this.LIVE, token: this.token, onStatus: (s) => this.setStatus(s), onMessage: (m) => this.onNews(m) });
        this.setStatus(this.live.status());
    }

    stopLive() {
        this.live?.close();
        this.live = null;
        this.rooms.clear();
        this.sections.clear();
        this.observer?.disconnect();
    }

    // what the server tells every device: a session was published / created / discarded, a draft changed
    onNews(m) {
        if (m.t === 'gone') return this.removeSession(m.id);
        const i = this.sessions.findIndex((x) => x.id === (m.session?.id || m.id));
        if (m.t === 'session') {
            if (i >= 0) this.sessions[i] = m.session;
            else this.sessions.push(m.session);
            this.sort();
            if (this.view && !this.sections.has(m.session.id)) { this.view.querySelector('.pp-empty')?.remove(); this.addSection(m.session); this.orderSections(); }
        } else if (m.t === 'draft' && i >= 0) {
            this.sessions[i] = { ...this.sessions[i], draft: m.draft, published: m.published };
        } else return;
        const id = m.session?.id || m.id;
        const sec = this.sections.get(id);
        if (sec && !sec.editing) this.drawSection(id);
        else if (sec) this.drawEditState(id);
        this.drawList();
    }

    removeSession(id) {
        this.sessions = this.sessions.filter((x) => x.id !== id);
        this.rooms.get(id)?.leave();
        this.rooms.delete(id);
        this.sections.get(id)?.el.remove();
        this.sections.delete(id);
        this.drawList();
    }

    joinRoom(s) {
        if (!s || !this.live) return null;
        if (this.rooms.has(s.id)) return this.rooms.get(s.id);
        const room = this.live.join(s.id, { name: this.name || 'Gast' });
        this.rooms.set(s.id, room);
        let t = null;
        room.doc.on('update', () => { clearTimeout(t); t = setTimeout(() => this.drawEditState(s.id), 250); });
        room.awareness.on('change', () => this.drawPeople(s.id));
        room.onGone = () => this.removeSession(s.id);
        return room;
    }

    // a session's values as its live document holds them (the shared draft)
    liveValues(room) {
        const f = room.fields.toJSON();
        const list = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
        const num = (v) => (v === '' || v === undefined ? '' : Number(v));
        return {
            number: num(f.number), title: f.title || '', date: f.date || '', players: list(f.players), places: list(f.places),
            level: num(f.level), ingameStart: f.ingameStart || '', ingameEnd: f.ingameEnd || '', content: room.text.toString(),
        };
    }

    static same(a, b) {
        return ['number', 'title', 'date', 'players', 'places', 'level', 'ingameStart', 'ingameEnd', 'content']
            .every((k) => JSON.stringify(a[k] ?? '') === JSON.stringify(b[k] ?? ''));
    }

    drawPeople(id) {
        const sec = this.sections.get(id);
        const room = this.rooms.get(id);
        if (!sec || !room) return;
        const box = sec.el.querySelector('.pp-people');
        if (!box) return;
        box.replaceChildren(...room.people().map((p) => {
            const chip = this.el('span', 'pp-person', `${p.editing ? '✎ ' : ''}${p.name}`);
            chip.style.borderColor = p.color;
            chip.title = p.editing ? `${p.name} schreibt gerade` : `${p.name} ist dabei`;
            return chip;
        }));
    }

    // ---------- the long scroll ----------

    showMain() {
        this.toolbar(true);
        this.listEl = this.el('nav', 'pp-list');
        this.view = this.el('article', 'pp-view pp-scroll');
        this.body.replaceChildren(this.listEl, this.view);
        this.sections.clear();
        if (!this.sessions.length) this.view.append(this.el('p', 'pp-note pp-empty', 'Noch keine Protokolle. Mit „＋ Neu“ das erste schreiben.'));
        // the table of contents follows the scrolling
        this.observer?.disconnect();
        this.observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (visible) this.setActive(visible.target.dataset.id);
        }, { root: this.view, rootMargin: '0px 0px -70% 0px' });
        for (const s of this.sessions) this.addSection(s);
        this.drawList();
    }

    addSection(s) {
        const el = this.el('section', 'pp-session');
        el.dataset.id = s.id;
        el.id = `pp-s-${s.id}`;
        this.sections.set(s.id, { el, editing: false });
        this.view.append(el);
        this.drawSection(s.id);
        this.observer?.observe(el);
        return el;
    }

    orderSections() {
        for (const s of this.sessions) { const sec = this.sections.get(s.id); if (sec) this.view.append(sec.el); }
    }

    // "● Entwurf": a session never saved, or saved with changes not saved yet
    draftBadge(s) {
        if (!s.draft && s.published !== false) return null;
        const d = s.draft || {};
        const when = d.updatedAt ? new Date(d.updatedAt).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const who = [d.updatedBy, when].filter(Boolean).join(', ');
        const badge = this.el('span', 'pp-draft', s.published === false ? '● Entwurf – noch nicht gespeichert' : '● Ungespeicherte Änderungen');
        if (who) badge.title = `Zuletzt: ${who}`;
        return badge;
    }

    drawSection(id) {
        const sec = this.sections.get(id);
        const raw = this.sessions.find((x) => x.id === id);
        if (!sec || !raw) return;
        const s = this.shown(raw);
        sec.el.classList.toggle('pp-unpublished', raw.published === false);
        const head = this.el('header', 'pp-read-head');
        const h2 = this.el('h2', 'rich-text', `Sitzung ${s.number ?? '?'}${s.title ? ' · ' : ''}`);
        if (s.title) h2.insertAdjacentHTML('beforeend', RichText.render(s.title).replace(/^<p>|<\/p>$/g, ''));
        const meta = this.el('p', 'pp-meta');
        meta.append(
            s.date ? `📅 ${this.date(s.date)}` : '',
            s.ingameStart ? ` · 🗓️ ${this.date(s.ingameStart)}${s.ingameEnd && s.ingameEnd !== s.ingameStart ? ` – ${this.date(s.ingameEnd)}` : ''}` : '',
            s.level ? ` · ⭐ Stufe ${s.level}` : '',
        );
        const edit = this.el('button', 'pp-edit', raw.draft || raw.published === false ? '✎ Weiterschreiben' : '✎ Bearbeiten');
        edit.type = 'button';
        edit.addEventListener('click', () => this.edit(id));
        const badge = this.draftBadge(raw);
        head.append(h2, meta, this.chips(s.players || [], 'pp-players', '👥'), this.chips(s.places || [], 'pp-places', '📍'), ...(badge ? [badge] : []), edit);
        const text = this.el('div', 'pp-text rich-text');
        text.innerHTML = s.content ? RichText.render(s.content) : '<p class="pp-note">Noch kein Text.</p>';
        sec.el.replaceChildren(head, text);
    }

    // names with an entry of the same name (a character, a location, a glossary term) link to it
    chips(names, cls, icon) {
        const box = this.el('p', cls);
        if (!names.length) return box;
        box.append(this.el('span', 'pp-chip-icon', icon));
        names.forEach((p) => {
            const hit = window.WikiLinks?.find(p);
            if (!hit) return box.append(this.el('span', 'pp-chip', p));
            const link = this.el('a', `pp-chip wiki-link wiki-${hit.kind}`, p);
            link.href = '#';
            link.dataset.kind = hit.kind;
            link.dataset.name = hit.name;
            box.append(link);
        });
        return box;
    }

    drawList() {
        if (!this.listEl) return;
        this.listEl.replaceChildren(...this.sessions.map((raw) => {
            const s = this.shown(raw);
            const b = this.el('button', 'pp-item');
            b.type = 'button';
            b.dataset.id = s.id;
            const title = this.el('span', 'pp-item-title', MapProtocols.plain(s.title) || 'Sitzung');
            if (raw.draft || raw.published === false) {
                b.classList.add('has-draft');
                title.prepend(Object.assign(this.el('span', 'pp-item-draft', '● '), { title: raw.published === false ? 'Entwurf – noch nicht gespeichert' : 'Ungespeicherte Änderungen' }));
            }
            b.append(this.el('strong', '', `${s.number ?? '?'}`), title, this.el('span', 'pp-item-meta', this.date(s.date)));
            b.addEventListener('click', () => this.scrollTo(s.id));
            return b;
        }));
        if (this.activeId) this.setActive(this.activeId);
        this.filter();
    }

    setActive(id) {
        this.activeId = id;
        this.listEl?.querySelectorAll('.pp-item').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
        this.listEl?.querySelector('.pp-item.active')?.scrollIntoView({ block: 'nearest' });
    }

    scrollTo(id, smooth = true) {
        const sec = id && this.sections.get(id);
        if (!sec) return;
        sec.el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        this.setActive(id);
    }

    // the search narrows the table of contents and hides sessions that don't match
    filter() {
        const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const q = fold(this.search.value);
        for (const raw of this.sessions) {
            const s = this.shown(raw);
            const hit = !q || fold([s.number, s.title, (s.players || []).join(' '), (s.places || []).join(' '), s.content].join(' ')).includes(q);
            this.listEl?.querySelector(`.pp-item[data-id="${CSS.escape(s.id)}"]`)?.toggleAttribute('hidden', !hit);
            const sec = this.sections.get(s.id);
            if (sec && !sec.editing) sec.el.hidden = !hit;
        }
    }

    // "Nach [[Tangoa|der Stadt]]" → "Nach der Stadt" (titles in the list)
    static plain(text) {
        return String(text || '').replace(/\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]/g, (_, t, l) => (l || t).trim());
    }

    date(iso) {
        const m = /^(\d{4,5})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
    }

    // ---------- writing ----------

    askName() {
        const n = window.prompt('Dein Name beim gemeinsamen Schreiben (die anderen sehen ihn an deinem Cursor):', this.name || '');
        if (n !== null && n.trim()) this.name = n.trim().slice(0, 40);
        return this.name;
    }

    async edit(id) {
        if (!this.name && !this.askName()) return;
        const sec = this.sections.get(id);
        const room = this.joinRoom(this.sessions.find((x) => x.id === id));
        if (!sec || !room || sec.editing) return;
        sec.editing = true;
        sec.el.hidden = false;
        sec.el.classList.add('editing');
        sec.el.replaceChildren(this.el('p', 'pp-note', 'Verbindet…'));
        await Promise.race([room.ready, new Promise((r) => setTimeout(r, 4000))]);
        if (!this.sections.has(id)) return; // discarded meanwhile
        room.awareness.setLocalStateField('editing', true);

        const form = this.el('form', 'pp-form');
        form.addEventListener('submit', (e) => e.preventDefault());
        form.innerHTML = `
            <div class="pp-form-head">
                <h2>Sitzung bearbeiten</h2><div class="pp-people"></div>
                <span class="pp-editstate"></span>
            </div>
            <div class="pp-grid">
                <label>Sitzung Nr. *<input name="number" type="number" min="0" step="1"></label>
                <label>Datum (echt) *<input name="date" type="date"></label>
                <label>Stufe der Gruppe<input name="level" type="number" min="1" max="30" step="1" placeholder="z. B. 3"></label>
                <label class="pp-wide">Titel<input name="title" placeholder="Optional"></label>
                <label>Spielzeit von<input name="ingameStart" type="date" min="5663-01-01"></label>
                <label>bis<input name="ingameEnd" type="date" min="5663-01-01"></label>
                <label class="pp-wide">Anwesende Spieler:innen *<input name="players" list="pp-players-${id}" placeholder="Namen, mit Komma getrennt" autocomplete="off"><datalist id="pp-players-${id}"></datalist></label>
                <label class="pp-wide">Orte<input name="places" list="pp-places-${id}" placeholder="Orte der Sitzung, mit Komma getrennt" autocomplete="off"><datalist id="pp-places-${id}"></datalist></label>
            </div>
            <p class="pp-warn" hidden></p>
            <label class="pp-wide">Protokoll<textarea name="content" rows="18" placeholder="Was ist passiert? [[ verlinkt Charaktere, Orte und Begriffe"></textarea></label>
            <div class="pp-actions">
                <button type="button" class="pp-done pp-publish">💾 Speichern</button>
                <button type="button" class="pp-later" title="Der Entwurf bleibt erhalten – für alle, auf jedem Gerät">Später weiter</button>
                <button type="button" class="pp-discard"></button>
                <span class="pp-note">Alles Getippte wird laufend als Entwurf gesichert. Lesende sehen es erst nach „Speichern“.</span>
            </div>`;
        sec.el.replaceChildren(form);
        window.DateField?.enhanceAll(form);
        this.bindFields(room, form);
        window.AdenaiEditor.enhance(form.elements.content, room);
        form.querySelector('.pp-publish').addEventListener('click', () => this.publish(id, form));
        form.querySelector('.pp-later').addEventListener('click', () => this.stopEditing(id));
        form.querySelector('.pp-discard').addEventListener('click', () => this.discard(id));
        this.drawPeople(id);
        this.drawEditState(id);
        sec.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // in the editor: does the shared draft differ from the published version?
    drawEditState(id) {
        const sec = this.sections.get(id);
        const room = this.rooms.get(id);
        const raw = this.sessions.find((x) => x.id === id);
        const box = sec?.el.querySelector('.pp-editstate');
        if (!box || !room?.synced || !raw) return;
        const fresh = raw.published === false;
        const changed = fresh || !MapProtocols.same(this.liveValues(room), raw);
        box.textContent = fresh ? '● Neu – noch nicht gespeichert' : changed ? '● Ungespeicherte Änderungen' : '✓ Entspricht dem Gespeicherten';
        box.className = `pp-editstate${changed ? ' pp-draft' : ''}`;
        const discard = sec.el.querySelector('.pp-discard');
        discard.textContent = fresh ? '🗑 Verwerfen' : '↺ Änderungen verwerfen';
        discard.hidden = !changed;
    }

    async publish(id, form) {
        const btn = form.querySelector('.pp-publish');
        const warn = form.querySelector('.pp-warn');
        btn.disabled = true;
        try {
            const { session } = await this.api(`/${id}/publish`, { method: 'POST', body: { by: this.name } });
            const i = this.sessions.findIndex((x) => x.id === id);
            if (i >= 0) this.sessions[i] = session;
            this.sort();
            this.orderSections();
            this.stopEditing(id);
        } catch (err) {
            if (err.message === 'locked') return;
            warn.textContent = `Nicht gespeichert: ${this.german(err.message)}`;
            warn.hidden = false;
            btn.disabled = false;
        }
    }

    async discard(id) {
        const raw = this.sessions.find((x) => x.id === id);
        const fresh = raw?.published === false;
        if (!window.confirm(fresh ? 'Diese neue Sitzung ganz verwerfen? Der Text geht verloren.' : 'Alle ungespeicherten Änderungen verwerfen (auch die der anderen)? Es bleibt die gespeicherte Fassung.')) return;
        try {
            const r = await this.api(`/${id}/draft`, { method: 'DELETE' });
            if (r.deleted) return this.removeSession(id);
            const i = this.sessions.findIndex((x) => x.id === id);
            if (i >= 0) this.sessions[i] = r.session;
            this.stopEditing(id);
        } catch (err) {
            if (err.message !== 'locked') window.alert(`Nicht verworfen: ${err.message}`);
        }
    }

    stopEditing(id) {
        const sec = this.sections.get(id);
        const room = this.rooms.get(id);
        const raw = this.sessions.find((x) => x.id === id);
        // until the server's note arrives: mark the draft right away
        if (room?.synced && raw && (raw.published === false || !MapProtocols.same(this.liveValues(room), raw))) {
            const values = this.liveValues(room);
            raw.draft = { values, number: values.number, title: values.title, updatedAt: new Date().toISOString(), updatedBy: this.name };
        } else if (raw && room?.synced) raw.draft = null;
        room?.leave();
        this.rooms.delete(id);
        if (!sec) return;
        sec.editing = false;
        sec.el.classList.remove('editing');
        this.drawSection(id);
        this.drawList();
    }

    german(msg) {
        return String(msg)
            .replace(/^Session (\d+) exists already$/, 'Sitzung $1 gibt es schon')
            .replace('Session number must be a whole number', 'Sitzung Nr. fehlt')
            .replace('At least one player who attended', 'Anwesende Spieler:innen fehlen')
            .replace(/Real-life date of the session \(YYYY-MM-DD\)/, 'Datum (echt) fehlt')
            .replace('Party level must be a whole number from 1 to 30', 'Stufe: ganze Zahl von 1 bis 30');
    }

    // form inputs ↔ the document's fields (last writer wins per field); a field being typed in isn't overwritten
    bindFields(room, form) {
        const f = form.elements;
        const split = (v) => [...new Set(String(v).split(',').map((x) => x.trim()).filter(Boolean))];
        const LISTS = ['players', 'places'];
        const toInput = (k, v) => { if (!LISTS.includes(k)) return v; try { return JSON.parse(v || '[]').join(', '); } catch { return ''; } };
        const fromInput = (k, v) => (LISTS.includes(k) ? JSON.stringify(split(v)) : String(v));
        const keys = ['number', 'date', 'level', 'title', 'ingameStart', 'ingameEnd', 'players', 'places'];
        const visible = (k) => f[k].closest('.date-field')?.querySelector('input[type=text]') || f[k];
        const warn = form.querySelector('.pp-warn');
        const check = () => {
            const missing = [];
            if (f.number.value === '' || !Number.isInteger(Number(f.number.value))) missing.push('Sitzung Nr.');
            if (!f.date.value) missing.push('Datum');
            if (!split(f.players.value).length) missing.push('Spieler:innen');
            warn.textContent = missing.length ? `Zum Speichern fehlt noch: ${missing.join(', ')} (der Entwurf ist trotzdem gesichert).` : '';
            warn.hidden = !missing.length;
        };
        const fill = (k) => {
            if (document.activeElement === visible(k)) return;
            f[k].value = toInput(k, room.fields.get(k) ?? '');
        };
        keys.forEach(fill);
        for (const k of keys) {
            const push = () => { room.fields.set(k, fromInput(k, f[k].value)); check(); };
            f[k].addEventListener('change', push);
            if (!['date', 'ingameStart', 'ingameEnd'].includes(k)) f[k].addEventListener('input', push);
            visible(k).addEventListener('blur', () => setTimeout(() => fill(k), 0));
        }
        room.fields.observe((e) => { e.keysChanged.forEach((k) => { if (keys.includes(k)) fill(k); }); check(); });
        f.ingameStart.addEventListener('change', () => { f.ingameEnd.min = f.ingameStart.value || '5663-01-01'; });
        // suggestions for the last name being typed: players used before; places of the map and used before
        const suggest = (k, names) => {
            const datalist = form.querySelector(`#pp-${k}-${CSS.escape(room.id)}`);
            const update = () => {
                const chosen = new Set(split(f[k].value).map((x) => x.toLowerCase()));
                const prefix = f[k].value.includes(',') ? `${f[k].value.replace(/,[^,]*$/, '')}, ` : '';
                datalist.replaceChildren(...names().filter((p) => !chosen.has(p.toLowerCase())).slice(0, 400)
                    .map((p) => Object.assign(document.createElement('option'), { value: `${prefix}${p}` })));
            };
            f[k].addEventListener('input', update);
            update();
        };
        suggest('players', () => this.suggestions.players);
        suggest('places', () => [...new Set([...this.locations(), ...this.suggestions.places])].sort((a, b) => a.localeCompare(b, 'de')));
        check();
    }

    async newSession() {
        if (!this.name && !this.askName()) return;
        // only one new, unsaved session at a time: that one opens
        const open = this.sessions.find((s) => s.published === false);
        if (open) { this.scrollTo(open.id); return this.edit(open.id); }
        const last = this.sessions.filter((s) => s.published !== false).at(-1);
        try {
            const res = await this.api('', {
                method: 'POST',
                body: {
                    by: this.name,
                    date: new Date().toISOString().slice(0, 10),
                    players: last?.players?.length ? last.players : [],
                    level: last?.level || '',
                    ingameStart: last ? (last.ingameEnd || last.ingameStart || '') : '',
                },
            });
            this.adopt(res.session);
        } catch (err) {
            if (err.message === 'locked') return;
            if (err.status === 409 && err.data?.session) return this.adopt(err.data.session); // someone was quicker
            window.alert(`Nicht angelegt: ${this.german(err.message)}`);
        }
    }

    adopt(session) {
        if (!this.sessions.some((x) => x.id === session.id)) this.sessions.push(session);
        this.sort();
        this.view.querySelector('.pp-empty')?.remove();
        if (!this.sections.has(session.id)) this.addSection(session);
        this.orderSections();
        this.drawList();
        this.edit(session.id);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.mapProtocols = new MapProtocols(); });
