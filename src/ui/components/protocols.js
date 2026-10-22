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
        // where this device stopped reading ({ id, offset }), and which version of each session it has seen ({ id: updatedAt })
        this.READ_KEY = 'adenai-protocol-reading';
        this.SEEN_KEY = 'adenai-protocol-seen';
        this.sessions = [];
        this.suggestions = { players: [], places: [] };
        this.rooms = new Map(); // session id → live room, while editing
        this.sections = new Map(); // session id → { el, editing }
        this.editorLoading = null;
        this.live = null;
        this.build();
        // emotes that arrive after the texts were drawn
        document.addEventListener('emotesReady', () => this.redrawAll());
        // an unlocked device knows the minutes from the start, for "Erwähnt in" in the popups
        if (this.unlocked) this.load().then(() => window.WikiLinks?.refreshBacklinks?.()).catch(() => {});
    }

    // ---------- reading: where this device stopped, what it has seen ----------

    stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
    store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }
    // where el starts within the scrolling text column
    topIn(el) { return el.getBoundingClientRect().top - this.view.getBoundingClientRect().top + this.view.scrollTop; }

    // the session in view and how far into it, a moment after the scrolling stops
    rememberPosition() {
        clearTimeout(this.readTimer);
        this.readTimer = setTimeout(() => {
            const sec = this.activeId && this.sections.get(this.activeId);
            if (!sec || !this.view || this.view.scrollTop < 4) return;
            const offset = this.view.scrollTop - this.topIn(sec.el);
            this.store(this.READ_KEY, { id: this.activeId, offset: Math.max(0, Math.round(offset)), at: Date.now() });
        }, 400);
    }

    // back where this device stopped reading: true when there was such a place
    resume() {
        const r = this.stored(this.READ_KEY, null);
        const sec = r && this.sections.get(r.id);
        if (!sec || sec.el.hidden) return false;
        const latest = this.sessions.filter((x) => x.published !== false).at(-1);
        const view = this.view;
        view.scrollTo({ top: Math.max(0, this.topIn(sec.el) + (r.offset || 0)), behavior: 'instant' });
        this.setActive(r.id);
        const s = this.sessions.find((x) => x.id === r.id);
        if (latest && latest.id !== r.id) {
            // floating over the text (a sticky holder of no height): showing or hiding it moves nothing
            const holder = this.el('div', 'pp-resume-holder');
            const note = this.el('div', 'pp-resume');
            holder.append(note);
            note.append(this.el('span', '', `📖 Weitergelesen bei Sitzung ${this.shown(s).number ?? ''}`));
            const go = this.el('button', 'pp-resume-latest', `Zur neusten (Sitzung ${this.shown(latest).number ?? ''}) →`);
            go.type = 'button';
            go.addEventListener('click', () => { holder.remove(); this.scrollTo(latest.id); });
            const x = this.el('button', 'pp-resume-close', '×');
            x.type = 'button';
            x.title = 'Schliessen';
            x.addEventListener('click', () => holder.remove());
            note.append(go, x);
            this.view.prepend(holder);
            setTimeout(() => holder.remove(), 15000);
        }
        return true;
    }

    // "neu" / "geändert": a session this device has not seen in this version. The first visit sees everything as known.
    seenState(raw) {
        const seen = this.seen ??= this.stored(this.SEEN_KEY, null);
        if (!seen) return '';
        const at = raw.updatedAt || raw.createdAt || '';
        if (!(raw.id in seen)) return 'neu';
        return at && at > seen[raw.id] ? 'geändert' : '';
    }
    markSeen(id) {
        const raw = this.sessions.find((x) => x.id === id);
        if (!raw) return;
        this.seen ??= this.stored(this.SEEN_KEY, null) || {};
        const at = raw.updatedAt || raw.createdAt || '';
        if (this.seen[id] === at) return;
        this.seen[id] = at;
        this.store(this.SEEN_KEY, this.seen);
        this.listEl?.querySelector(`.pp-item[data-id="${CSS.escape(id)}"] .pp-fresh`)?.remove();
    }
    // the first visit: everything there is now counts as seen
    initSeen() {
        if (this.stored(this.SEEN_KEY, null)) return;
        this.seen = Object.fromEntries(this.sessions.map((x) => [x.id, x.updatedAt || x.createdAt || '']));
        this.store(this.SEEN_KEY, this.seen);
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
        const [s, sg, ln] = await Promise.all([this.api(''), this.api('/suggestions').catch(() => ({})), this.api('/links').catch(() => ({}))]);
        this.links = ln.links || []; // shown above the minutes (set in the CMS → Protocols), e.g. the attendance sheet
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
                <button type="button" class="pp-toc" title="Sitzungen" aria-label="Liste der Sitzungen" hidden>☰</button>
                <input type="search" class="pp-search" placeholder="Suchen…" aria-label="Protokolle durchsuchen" title="Enter: nächster Treffer · Umschalt+Enter: vorheriger" hidden>
                <span class="pp-find-count" hidden></span>
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
        // narrow screens: the list of sessions is a drawer over the text
        this.tocBtn = this.panel.querySelector('.pp-toc');
        this.tocBtn.addEventListener('click', () => this.panel.classList.toggle('toc-open'));
        this.search.addEventListener('input', () => { this.filter(); clearTimeout(this.findTimer); this.findTimer = setTimeout(() => this.find(), 200); });
        this.search.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            this.find();
            this.step(e.shiftKey ? -1 : 1);
        });
        if (window.L) { L.DomEvent.disableClickPropagation(this.panel); L.DomEvent.disableScrollPropagation(this.panel); }
        // following a [[link]] on a narrow screen: fold the panel away to show the map
        this.panel.addEventListener('click', (e) => {
            if (e.target.closest('a.wiki-link') && window.innerWidth < 800) this.panel.classList.add('folded');
        });
    }

    toolbar(on) {
        if (!on) this.panel.querySelector('.pp-find-count').hidden = true;
        ['.pp-search', '.pp-new', '.pp-lock', '.pp-name', '.pp-status', '.pp-toc'].forEach((s) => { this.panel.querySelector(s).hidden = !on; });
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

    // highlight: a name (character, place, term) whose mentions in that session are marked ("Erwähnt in" in popups)
    async open(sessionId = null, { highlight = null } = {}) {
        this.panel.hidden = false;
        this.panel.classList.remove('folded');
        this.button.classList.add('active');
        if (!this.unlocked) return this.showLock();
        if (this.listEl && this.live) { if (sessionId) this.scrollTo(sessionId, true, highlight); return; }
        this.body.replaceChildren(this.el('p', 'pp-note', 'Lädt…'));
        try {
            await Promise.all([this.load(), this.loadEditor()]);
            this.startLive();
            this.initSeen();
            this.showMain();
            // a session asked for (a link, a mention): there; else where this device stopped reading; else the newest
            if (sessionId || !this.resume()) this.scrollTo(sessionId || this.sessions.filter((s) => s.published !== false).at(-1)?.id || this.sessions.at(-1)?.id, false, highlight);
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
        window.mapGlossary?.setPending([]);
        this.stopLive();
        this.sessions = [];
        this.listEl = null;
        if (!this.panel.hidden) this.showLock(message);
    }

    showLock(message = '') {
        this.toolbar(false);
        const form = this.el('form', 'pp-lockform');
        form.innerHTML = `
            <div class="pp-lock-icon" aria-hidden="true">🔒</div>
            <h2>Sitzungsprotokolle</h2>
            <p class="pp-lock-text">Die Protokolle sind passwortgeschützt. Das Passwort bekommst du von der Spielleitung.</p>
            <label class="pp-pw">
                <span class="pp-visually-hidden">Passwort</span>
                <input type="password" name="password" autocomplete="current-password" placeholder="Passwort" required>
                <button type="button" class="pp-pw-toggle" aria-label="Passwort zeigen" title="Passwort zeigen">👁</button>
            </label>
            <p class="pp-error" role="alert" hidden></p>
            <button type="submit" class="pp-unlock">Öffnen</button>
            <p class="pp-lock-note">Bleibt auf diesem Gerät 30 Tage entsperrt.</p>`;
        const input = form.elements.password;
        const err = form.querySelector('.pp-error');
        const btn = form.querySelector('.pp-unlock');
        const toggle = form.querySelector('.pp-pw-toggle');
        const showError = (text) => {
            err.textContent = text;
            err.hidden = false;
            form.classList.remove('shake');
            void form.offsetWidth; // restart the animation
            form.classList.add('shake');
        };
        if (message) showError(message);
        toggle.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            toggle.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort zeigen');
            toggle.title = toggle.getAttribute('aria-label');
            toggle.classList.toggle('on', show);
            input.focus();
        });
        input.addEventListener('input', () => { err.hidden = true; });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.textContent = 'Prüft…';
            try {
                const res = await fetch(`${this.API}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: input.value }) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
                this.token = { token: data.token, expiresAt: data.expiresAt };
                window.mapGlossary?.loadPending();
                this.open();
            } catch (e2) {
                showError(e2.message === 'Wrong password' ? 'Falsches Passwort.' : e2.message.startsWith('Too many') ? 'Zu viele Versuche – bitte in ein paar Minuten nochmals.' : e2.message);
                input.select();
                btn.disabled = false;
                btn.textContent = 'Öffnen';
            }
        });
        this.body.classList.add('pp-locked');
        this.body.replaceChildren(form);
        input.focus();
    }

    // ---------- live ----------

    loadEditor() {
        if (window.AdenaiEditor && window.AdenaiLive) return Promise.resolve();
        // md-editor.js finds link targets the way the CMS offers them
        window.adminCharacters ||= { getCharacters: () => window.characterSystem?.getCharacters?.() || [] };
        window.adminLocations ||= { getLocations: () => this.locations().map((name) => ({ properties: { name } })) };
        window.adminGlossary ||= { getTerms: () => window.mapGlossary?.allTerms?.() || window.mapGlossary?.terms || [] };
        this.editorLoading ||= new Promise((resolve, reject) => {
            const sc = document.createElement('script');
            sc.src = 'src/vendor/md-editor.js?v=9';
            sc.onload = () => {
                // "[[Name" for something without an entry: players propose one (components/glossary.js)
                window.AdenaiEditor.onCreateEntry = (typed) => window.mapGlossary?.createEntry(typed);
                resolve();
            };
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
        if (m.t === 'pending') return window.mapGlossary?.setPending(m.entries);
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

    // links render differently once a name has an entry (a new proposal): the sessions not being edited are drawn again
    redrawAll() {
        for (const [id, sec] of this.sections) if (!sec.editing) this.drawSection(id);
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
        this.body.classList.remove('pp-locked');
        this.listEl = this.el('nav', 'pp-list');
        this.view = this.el('article', 'pp-view pp-scroll');
        this.body.replaceChildren(this.listEl, this.view);
        this.sections.clear();
        const top = this.linksBar('pp-links-top');
        if (top) this.view.append(top);
        if (!this.sessions.length) this.view.append(this.el('p', 'pp-note pp-empty', 'Noch keine Protokolle. Mit „＋ Neu“ das erste schreiben.'));
        // the table of contents follows the scrolling
        this.observer?.disconnect();
        this.observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (visible) this.setActive(visible.target.dataset.id);
        }, { root: this.view, rootMargin: '0px 0px -70% 0px' });
        for (const s of this.sessions) this.addSection(s);
        this.drawList();
        this.view.addEventListener('scroll', () => this.rememberPosition(), { passive: true });
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
        if (this.findQuery) { this.findMarks = null; this.findQuery = null; clearTimeout(this.findTimer); this.findTimer = setTimeout(() => this.find(), 50); }
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

    // the links from the CMS (e.g. the attendance sheet) and the stats as a bar: above the text, and pinned at the top of the list
    linksBar(cls) {
        const bar = this.el('nav', `pp-links ${cls}`);
        bar.setAttribute('aria-label', 'Links zu den Protokollen');
        for (const l of this.links || []) {
            const a = this.el('a', 'pp-link', `${l.label} ↗`);
            a.href = l.url;
            a.target = '_blank';
            a.rel = 'noopener';
            bar.append(a);
        }
        const stats = this.el('button', 'pp-link', '📈 Protokoll-Stats');
        stats.type = 'button';
        stats.addEventListener('click', () => this.showStats());
        bar.append(stats);
        return bar;
    }

    // ---------- stats over all published minutes ----------

    // the text of a session as read (no Markdown, no link brackets), one line per block
    static readText(content) {
        const box = document.createElement('div');
        box.innerHTML = RichText.render(content || '');
        box.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div, tr, br').forEach((e) => e.append('\n'));
        return box.textContent.split('\n').map((l) => l.trim()).filter(Boolean);
    }

    // words too common to be anyone's favourite
    static COMMON = new Set(('traktandum mitteilungen werden wieder wurden worden würden hatten haben können konnte konnten wollen wollte '
        + 'wollten sollen sollte müssen musste möchte dieser dieses diesen diesem welche welcher welches nachdem zurück dabei damit '
        + 'darauf daraus deshalb jedoch allerdings nämlich zusammen unsere unserer unseren andere anderen anderer einige einigen '
        + 'keinen keiner später sodass sondern zwischen während obwohl bereits nochmal').split(' '));

    // the player characters: they are in every session, so they would top the links and the favourite words
    static PLAYERS = new Set(['abu', 'ally', 'niall', 'poison', 'luna', 'tasbor']);

    static isPlayer(name) {
        const n = name.toLowerCase();
        return MapProtocols.PLAYERS.has(n) || MapProtocols.PLAYERS.has(n.replace(/s$/, ''));
    }

    stats() {
        const sessions = this.sessions.filter((s) => s.published !== false);
        const count = (map, key) => map.set(key, (map.get(key) || 0) + 1);
        const top = (map, n = 5) => [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).slice(0, n);
        const links = new Map(), places = new Map(), words = new Map(), long = new Map();
        let chars = 0, charsNoSpace = 0, gold = 0, agenda = 0;
        const per = sessions.map((s) => {
            const lines = MapProtocols.readText(s.content);
            const text = lines.join(' ');
            const w = text.split(/\s+/).filter(Boolean);
            chars += lines.reduce((n, l) => n + [...l].length, 0);
            charsNoSpace += [...text.replace(/\s+/g, '')].length;
            for (const n of RichText.links(s.content || '')) if (!MapProtocols.isPlayer(n)) count(links, n);
            (s.places || []).forEach((p) => count(places, p));
            for (const word of text.match(/[\p{L}][\p{L}-]*/gu) || []) {
                if (!long.has(word.toLowerCase())) long.set(word.toLowerCase(), { word, n: [...word].length, s });
                if ([...word].length >= 6 && !MapProtocols.COMMON.has(word.toLowerCase()) && !MapProtocols.isPlayer(word)) count(words, word);
            }
            for (const m of text.matchAll(/(\d[\d'’]*)\s*(?:Gold|GM)\b/g)) gold += Number(m[1].replace(/['’]/g, ''));
            agenda += (s.content.match(/^#\s/gm) || []).length;
            return { s, words: w.length };
        });
        const total = per.reduce((n, p) => n + p.words, 0);
        const byLength = [...per].sort((a, b) => b.words - a.words);
        const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
        const dated = (key) => sessions.map((s) => s[key]).filter((d) => /^\d{4,5}-\d{2}-\d{2}$/.test(d || '')).sort();
        const ingame = [...dated('ingameStart'), ...dated('ingameEnd')].sort();
        const real = dated('date');
        // longest first, where each was first used; the list stops before the first length shared by more than 5 words (but has at least 10)
        const longest = [...long.values()].sort((a, b) => b.n - a.n || a.word.localeCompare(b.word, 'de'));
        const lengths = new Map();
        longest.forEach((w) => count(lengths, w.n));
        const cut = longest.findIndex((w) => lengths.get(w.n) > 5);
        longest.splice(Math.max(10, cut < 0 ? longest.length : cut));
        return {
            sessions: sessions.length, words: total, chars, charsNoSpace, gold, agenda, longest, per,
            longestSession: byLength[0], shortestSession: byLength.at(-1),
            ingame: ingame.length ? { from: ingame[0], to: ingame.at(-1), days: days(ingame[0], ingame.at(-1)) } : null,
            real: real.length ? { from: real[0], to: real.at(-1), days: days(real[0], real.at(-1)) } : null,
            links: top(links), places: top(places), topWords: top(words),
        };
    }

    showStats() {
        this.panel.querySelector('.pp-stats-layer')?.remove();
        const st = this.stats();
        const num = (n) => Number(n).toLocaleString('de-CH');
        // 400 → 1 Jahr 35 Tage (a year counted as 365 days)
        const span = (d) => {
            const y = Math.floor(d / 365), r = d % 365;
            if (d <= 365) return `${num(d)} Tage`;
            return `${num(y)} ${y === 1 ? 'Jahr' : 'Jahre'}${r ? ` ${num(r)} ${r === 1 ? 'Tag' : 'Tage'}` : ''}`;
        };
        const layer = this.el('div', 'pp-stats-layer');
        const box = this.el('section', 'pp-stats');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Protokoll-Stats');
        const close = () => { layer.remove(); document.removeEventListener('keydown', onKey, true); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
        document.addEventListener('keydown', onKey, true);
        layer.addEventListener('mousedown', (e) => { if (e.target === layer) close(); });
        const x = this.el('button', 'pp-stats-close', '✕');
        x.type = 'button';
        x.title = 'Schliessen';
        x.addEventListener('click', close);
        const head = this.el('header', 'pp-stats-head');
        head.append(this.el('h2', '', '📈 Protokoll-Stats'), x);
        box.append(head, this.el('p', 'pp-note', `Über alle ${st.sessions} gespeicherten Protokolle.`));

        const tile = (value, label, sub) => {
            const t = this.el('div', 'pp-stat');
            t.append(this.el('strong', '', value), this.el('span', '', label));
            if (sub) t.append(this.el('small', '', sub));
            return t;
        };
        const label = (p) => `Sitzung ${p.s.number ?? '?'}${p.s.title ? ` · ${MapProtocols.plain(p.s.title)}` : ''}`;
        const tiles = this.el('div', 'pp-stat-grid');
        tiles.append(
            tile(num(st.chars), 'Zeichen mit Leerzeichen'),
            tile(num(st.charsNoSpace), 'Zeichen ohne Leerzeichen'),
            tile(num(st.words), 'Wörter', `Ø ${num(Math.round(st.words / (st.sessions || 1)))} pro Sitzung`),
            tile(`${num(Math.round(st.words / 230))} min`, 'Lesezeit für alles', 'bei 230 Wörtern pro Minute'),
            tile(num(st.agenda), 'Traktanden'),
            tile(num(st.gold), 'Gold erwähnt', 'alle Beträge mit «Gold» zusammengezählt'),
        );
        if (st.ingame) tiles.append(tile(span(st.ingame.days), 'Ingame erlebt', `${this.date(st.ingame.from)} – ${this.date(st.ingame.to)}`));
        if (st.real) tiles.append(tile(span(st.real.days), 'Im echten Leben gespielt', `${this.date(st.real.from)} – ${this.date(st.real.to)}`));
        box.append(tiles);

        const facts = this.el('dl', 'pp-stat-facts');
        const fact = (k, v) => facts.append(this.el('dt', '', k), this.el('dd', '', v));
        if (st.longestSession) fact('📜 Längstes Protokoll', `${label(st.longestSession)} (${num(st.longestSession.words)} Wörter)`);
        if (st.shortestSession) fact('🩳 Kürzestes Protokoll', `${label(st.shortestSession)} (${num(st.shortestSession.words)} Wörter)`);
        box.append(facts);

        // the longest words over the whole width, 10 more at a time; a click goes to the word in its session.
        // A soft hyphen between letters, so a word wrapped over lines gets a «-»
        if (st.longest.length) {
            const sec = this.el('div', 'pp-stat-rank pp-stat-long');
            const ol = this.el('ol');
            const more = this.el('button', 'pp-stat-more');
            more.type = 'button';
            const add = () => {
                for (const w of st.longest.slice(ol.children.length, ol.children.length + 10)) {
                    const li = this.el('li');
                    const go = this.el('button', 'pp-stat-word', [...w.word].join('\u00AD'));
                    go.type = 'button';
                    go.title = `In Sitzung ${w.s.number ?? '?'} zeigen`;
                    go.addEventListener('click', () => { close(); this.scrollTo(w.s.id, true, w.word); });
                    li.append(go, this.el('span', 'pp-stat-n', `${num(w.n)} Buchstaben`));
                    ol.append(li);
                }
                const left = st.longest.length - ol.children.length;
                more.hidden = left <= 0;
                more.textContent = `${Math.min(10, left)} weitere anzeigen`;
            };
            more.addEventListener('click', add);
            add();
            sec.append(this.el('h3', '', '🐍 Die längsten Wörter'), ol, more);
            box.append(sec);
        }

        const ranking = (title, rows, unit) => {
            if (!rows.length) return;
            const sec = this.el('div', 'pp-stat-rank');
            sec.append(this.el('h3', '', title));
            const ol = this.el('ol');
            for (const [name, n] of rows) {
                const li = this.el('li');
                li.append(this.el('span', '', name), this.el('span', 'pp-stat-n', `${num(n)} ${unit}`));
                ol.append(li);
            }
            sec.append(ol);
            ranks.append(sec);
        };
        const ranks = this.el('div', 'pp-stat-ranks');
        ranking('🔗 Am häufigsten verlinkt', st.links, '×');
        ranking('📍 Meistbesuchte Orte', st.places, '×');
        ranking('💬 Lieblingswörter (ab 6 Buchstaben)', st.topWords, '×');
        box.append(ranks);

        // words per session as bars, in session order
        const max = Math.max(1, ...st.per.map((p) => p.words));
        const chart = this.el('div', 'pp-stat-bars');
        chart.setAttribute('role', 'img');
        chart.setAttribute('aria-label', 'Wörter pro Sitzung');
        for (const p of st.per) {
            const bar = this.el('span', 'pp-stat-bar');
            bar.style.height = `${Math.max(2, (p.words / max) * 100)}%`;
            bar.title = `${label(p)}: ${num(p.words)} Wörter`;
            chart.append(bar);
        }
        box.append(this.el('h3', '', '📊 Wörter pro Sitzung'), chart);

        layer.append(box);
        this.panel.append(layer);
        x.focus();
    }

    drawList() {
        if (!this.listEl) return;
        const pinned = this.linksBar('pp-links-pinned');
        this.listEl.replaceChildren(...(pinned ? [pinned] : []), ...this.sessions.map((raw) => {
            const s = this.shown(raw);
            const b = this.el('button', 'pp-item');
            b.type = 'button';
            b.dataset.id = s.id;
            const title = this.el('span', 'pp-item-title', MapProtocols.plain(s.title) || 'Sitzung');
            if (raw.draft || raw.published === false) {
                b.classList.add('has-draft');
                title.prepend(Object.assign(this.el('span', 'pp-item-draft', '● '), { title: raw.published === false ? 'Entwurf – noch nicht gespeichert' : 'Ungespeicherte Änderungen' }));
            }
            const fresh = raw.published !== false ? this.seenState(raw) : '';
            if (fresh) title.append(' ', Object.assign(this.el('span', 'pp-fresh', fresh), { title: fresh === 'neu' ? 'Neu seit dem letzten Lesen' : 'Seit dem letzten Lesen geändert' }));
            b.append(this.el('strong', '', `${s.number ?? '?'}`), title, this.el('span', 'pp-item-meta', this.date(s.date)));
            b.addEventListener('click', () => { this.panel.classList.remove('toc-open'); this.scrollTo(s.id); });
            return b;
        }));
        if (this.activeId) this.setActive(this.activeId);
        this.filter();
    }

    setActive(id) {
        this.activeId = id;
        clearTimeout(this.seenTimer);
        this.seenTimer = setTimeout(() => { if (this.activeId === id) this.markSeen(id); }, 1500); // read a moment: seen
        this.listEl?.querySelectorAll('.pp-item').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
        const item = this.listEl?.querySelector('.pp-item.active');
        if (item) {
            // only the list scrolls (scrollIntoView would also shift the panel and the page)
            const l = this.listEl;
            const pinned = l.querySelector('.pp-links-pinned')?.offsetHeight || 0; // the sticky links bar covers the top
            if (item.offsetTop - pinned < l.scrollTop) l.scrollTop = item.offsetTop - pinned - 4;
            else if (item.offsetTop + item.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = item.offsetTop + item.offsetHeight - l.clientHeight + 4;
        }
        const s = this.sessions.find((x) => x.id === id);
        if (this.tocBtn && s) this.tocBtn.textContent = `☰ ${this.shown(s).number ?? ''}`;
    }

    // Scrolls the text column to el — and nothing else: Element.scrollIntoView also scrolls every scrollable ancestor,
    // which on a narrow screen shifted the whole panel sideways and cut off its left edge
    scrollWithin(el, { block = 'start', smooth = true } = {}) {
        const view = this.view;
        if (!view || !el) return;
        const top = el.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop;
        const target = block === 'center' ? top - (view.clientHeight - el.getBoundingClientRect().height) / 2 : top - 8;
        // far jumps (another session) at once; smooth only nearby, where the movement helps to follow
        const far = Math.abs(target - view.scrollTop) > view.clientHeight * 3;
        view.scrollTo({ top: Math.max(0, target), behavior: smooth && !far ? 'smooth' : 'instant' }); // 'auto' would follow the CSS scroll-behavior: smooth
        this.panel.scrollLeft = 0;
    }

    scrollTo(id, smooth = true, highlight = null) {
        const sec = id && this.sections.get(id);
        if (!sec) return;
        if (highlight) {
            // a hidden session (search filter) would have nothing to show
            if (sec.el.hidden) { this.search.value = ''; this.filter(); this.find(); }
            const first = this.mark(sec.el, highlight);
            if (first) {
                this.scrollWithin(first, { block: 'center', smooth });
                this.setActive(id);
                return;
            }
        }
        this.scrollWithin(sec.el, { smooth });
        this.setActive(id);
    }

    // From the map's search: the panel opens with query in its search field (matches highlighted) at the first match in
    // session id — or, without one, at the first match at all. Enter goes on from there.
    async openSearch(id, query) {
        await this.open();
        if (!this.listEl) return;
        this.search.value = query;
        this.filter();
        this.findQuery = null;
        this.find();
        if (!this.findMarks?.length) return;
        const first = id ? this.findMarks.findIndex((m) => m.closest('.pp-session')?.dataset.id === id) : 0;
        this.findIndex = Math.max(0, first) - 1;
        this.step(1);
    }

    // ---------- highlighting ----------

    // The ways a name appears in the minutes: the name, a glossary term's aliases, and the short form of a person's
    // name ("Viktoria" for Viktoria Karthright, "Torrack" for König Torrack)
    variants(name) {
        const titles = new Set(['König', 'Königin', 'Prinz', 'Prinzessin', 'Lady', 'Lord', 'Sir', 'Graf', 'Gräfin', 'Kardinal']);
        const out = new Set([name, ...(window.mapGlossary?.find(name)?.aliases || [])]);
        const parts = name.split(/\s+/);
        if (parts.length > 1 && window.WikiLinks?.find(name)?.kind === 'character') {
            const short = titles.has(parts[0]) ? parts[1] : parts[0];
            if (short && short.length >= 3) out.add(short);
        }
        return [...out].filter((v) => v.length >= 2).sort((a, b) => b.length - a.length);
    }

    // Marks the mentions of name in a session (links to it and the name in plain text); returns the first mark
    mark(el, name) {
        this.unmark('pp-hl');
        const fold = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        const variants = this.variants(name);
        const keys = new Set(variants.map(fold));
        el.querySelectorAll('a.wiki-link').forEach((a) => { if (keys.has(fold(a.dataset.name || '')) || keys.has(fold(a.textContent))) a.classList.add('pp-hl'); });
        const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${variants.map(MapProtocols.loose).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
        this.wrap(el, re, 'pp-hl', (node) => !node.parentElement.closest('a.wiki-link'));
        const first = el.querySelector('.pp-hl');
        first?.classList.add('pp-hl-flash');
        return first;
    }

    // wraps every match of re in the text nodes under el into <mark class=cls>
    wrap(el, re, cls, accept = () => true) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodes = [];
        for (let n; (n = walker.nextNode());) if (n.nodeValue.trim() && !n.parentElement.closest('mark, button, .pp-form') && accept(n)) nodes.push(n);
        for (const node of nodes) {
            const text = node.nodeValue;
            re.lastIndex = 0;
            if (!re.test(text)) continue;
            re.lastIndex = 0;
            const frag = document.createDocumentFragment();
            let last = 0;
            for (const m of text.matchAll(re)) {
                if (!m[0]) continue;
                frag.append(text.slice(last, m.index), Object.assign(document.createElement('mark'), { className: cls, textContent: m[0] }));
                last = m.index + m[0].length;
            }
            frag.append(text.slice(last));
            node.replaceWith(frag);
        }
    }

    unmark(cls) {
        this.view?.querySelectorAll(`mark.${cls}`).forEach((m) => m.replaceWith(m.textContent));
        this.view?.querySelectorAll(`a.${cls}`).forEach((a) => a.classList.remove(cls, 'pp-hl-flash'));
        this.view?.normalize();
    }

    // The search: matches in the shown sessions are marked; Enter / Shift+Enter go to the next / previous one
    find() {
        const q = this.search.value.trim();
        if (q === this.findQuery && this.findMarks) return;
        this.findQuery = q;
        this.unmark('pp-find');
        this.findMarks = [];
        this.findIndex = -1;
        const count = this.panel.querySelector('.pp-find-count');
        if (q.length < 2 || !this.view) { count.hidden = true; return; }
        const re = new RegExp(MapProtocols.loose(q), 'giu');
        for (const sec of this.sections.values()) if (!sec.el.hidden && !sec.editing) this.wrap(sec.el, re, 'pp-find');
        this.findMarks = [...this.view.querySelectorAll('mark.pp-find')];
        count.hidden = false;
        count.textContent = this.findMarks.length ? `${this.findMarks.length} Treffer` : 'keine Treffer';
    }

    step(dir) {
        if (!this.findMarks?.length) return;
        this.findMarks[this.findIndex]?.classList.remove('current');
        this.findIndex = (this.findIndex + dir + this.findMarks.length) % this.findMarks.length;
        const m = this.findMarks[this.findIndex];
        m.classList.add('current');
        this.scrollWithin(m, { block: 'center' });
        this.panel.querySelector('.pp-find-count').textContent = `${this.findIndex + 1} / ${this.findMarks.length}`;
        const id = m.closest('.pp-session')?.dataset.id;
        if (id) this.setActive(id);
    }

    // the search narrows the table of contents and hides sessions that don't match
    filter() {
        const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const q = fold(this.search.value);
        for (const raw of this.sessions) {
            const s = this.shown(raw);
            const hit = !q || window.AdenaiSearch.matches([s.number, s.title, (s.players || []).join(' '), (s.places || []).join(' '), s.content].join(' '), this.search.value);
            this.listEl?.querySelector(`.pp-item[data-id="${CSS.escape(s.id)}"]`)?.toggleAttribute('hidden', !hit);
            const sec = this.sections.get(s.id);
            if (sec && !sec.editing) sec.el.hidden = !hit;
        }
    }

    // A regex source matching text regardless of accents: "Akonetchie" finds "Akónetchie" and the other way round
    static loose(text) {
        const ACCENTS = { a: 'àáâãäå', c: 'ç', e: 'èéêë', i: 'ìíîï', n: 'ñ', o: 'òóôõöø', u: 'ùúûü', y: 'ýÿ' };
        return [...String(text)].map((c) => {
            const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (ACCENTS[base]) return `[${base}${ACCENTS[base]}]`;
            return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
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
        this.scrollWithin(sec.el);
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
        const proposedPlaces = () => (window.mapGlossary?.pending || []).filter((p) => p.kind === 'location').map((p) => p.name);
        suggest('places', () => [...new Set([...this.locations(), ...proposedPlaces(), ...this.suggestions.places])].sort((a, b) => a.localeCompare(b, 'de')));
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
