// protocols.js - The campaign's session minutes on the map, behind the protocol password.
//
// The minutes are not in the public data files: they live on the CMS server (server/lib/protocol-store.js) and are
// fetched from /api/protocols with a token. Entering the password (set in the CMS → Protocols) unlocks this device
// for 30 days (token in localStorage); a new password in the CMS ends that. Players can read, add and edit minutes
// here, with the same Markdown / [[link]] editor as the CMS (src/vendor/md-editor.js, loaded only when writing).
// Required for a session: number, players who attended, real-life date.
class MapProtocols {
    constructor() {
        this.API = 'https://adenai-admin.piogino.ch/api/protocols';
        this.KEY = 'adenai-protocol-token';
        this.sessions = [];
        this.players = [];
        this.selected = null;
        this.editorLoading = null;
        this.build();
        // an unlocked device knows the minutes from the start, for "Erwähnt in" in the popups
        if (this.unlocked) this.load().catch(() => {});
    }

    // ---------- token & API ----------

    get token() {
        try {
            const t = JSON.parse(localStorage.getItem(this.KEY) || 'null');
            return t && Date.parse(t.expiresAt) > Date.now() ? t.token : null;
        } catch { return null; }
    }
    set token(t) {
        try { if (t) localStorage.setItem(this.KEY, JSON.stringify(t)); else localStorage.removeItem(this.KEY); } catch { /* private mode: until reload */ }
        this.memoryToken = t?.token || null;
    }
    get unlocked() { return !!(this.token || this.memoryToken); }

    async api(path = '', { method = 'GET', body } = {}) {
        const res = await fetch(this.API + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(this.unlocked ? { Authorization: `Bearer ${this.token || this.memoryToken}` } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && data.locked) { this.token = null; this.showLock('Bitte das Passwort erneut eingeben.'); throw new Error('locked'); }
        if (!res.ok || data.success === false) throw new Error(data.error || `Fehler ${res.status}`);
        return data;
    }

    async load() {
        const [s, p] = await Promise.all([this.api(''), this.api('/players')]);
        this.sessions = s.sessions || [];
        this.players = p.players || [];
    }

    // Sessions whose minutes link to name (for "Erwähnt in" in the popups; wiki-links.js)
    mentions(name) {
        if (!this.unlocked || !window.RichText) return [];
        const key = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        return this.sessions.filter((s) => RichText.links(`${s.title || ''} ${s.content || ''}`).some((n) => fold(n) === key));
    }

    // ---------- UI ----------

    el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    build() {
        this.button = this.el('button', 'protocol-button', '📜 Protokoll');
        this.button.type = 'button';
        this.button.title = 'Sitzungsprotokolle der Kampagne';
        this.button.addEventListener('click', () => this.open());
        document.body.appendChild(this.button);

        this.panel = this.el('aside', 'protocol-panel');
        this.panel.hidden = true;
        this.panel.setAttribute('aria-label', 'Sitzungsprotokolle');
        this.panel.innerHTML = `
            <header class="pp-head">
                <strong>📜 Protokolle</strong>
                <input type="search" class="pp-search" placeholder="Suchen…" aria-label="Protokolle durchsuchen" hidden>
                <button type="button" class="pp-new" hidden>＋ Neu</button>
                <button type="button" class="pp-lock" title="Auf diesem Gerät sperren" hidden>🔒</button>
                <button type="button" class="pp-close" title="Schliessen">×</button>
            </header>
            <div class="pp-body"></div>`;
        document.body.appendChild(this.panel);
        this.body = this.panel.querySelector('.pp-body');
        this.search = this.panel.querySelector('.pp-search');
        this.panel.querySelector('.pp-close').addEventListener('click', () => this.close());
        this.panel.querySelector('.pp-new').addEventListener('click', () => this.edit(null));
        this.panel.querySelector('.pp-lock').addEventListener('click', () => { this.token = null; this.sessions = []; this.showLock(); });
        this.search.addEventListener('input', () => this.drawList());
        if (window.L) { L.DomEvent.disableClickPropagation(this.panel); L.DomEvent.disableScrollPropagation(this.panel); }
        // following a [[link]] on a narrow screen: fold the panel away to show the map
        this.panel.addEventListener('click', (e) => {
            if (e.target.closest('a.wiki-link') && window.innerWidth < 800) this.panel.classList.add('folded');
        });
        this.button.addEventListener('click', () => this.panel.classList.remove('folded'));
    }

    async open(sessionId = null) {
        this.panel.hidden = false;
        this.panel.classList.remove('folded');
        this.button.classList.add('active');
        if (!this.unlocked) return this.showLock();
        this.body.replaceChildren(this.el('p', 'pp-note', 'Lädt…'));
        try {
            await this.load();
            this.showMain(sessionId || this.selected?.id || this.sessions[0]?.id || null);
        } catch (err) {
            if (err.message !== 'locked') this.body.replaceChildren(this.el('p', 'pp-error', `Protokolle nicht verfügbar: ${err.message}`));
        }
    }

    close() {
        if (this.dirty && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
        this.dirty = false;
        this.panel.hidden = true;
        this.button.classList.remove('active');
    }

    toolbar(on) {
        ['.pp-search', '.pp-new', '.pp-lock'].forEach((s) => { this.panel.querySelector(s).hidden = !on; });
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

    showMain(id) {
        this.toolbar(true);
        this.listEl = this.el('nav', 'pp-list');
        this.view = this.el('article', 'pp-view');
        this.body.replaceChildren(this.listEl, this.view);
        this.drawList();
        const s = this.sessions.find((x) => x.id === id);
        if (s) this.read(s);
        else this.view.replaceChildren(this.el('p', 'pp-note', this.sessions.length ? 'Wähle eine Sitzung.' : 'Noch keine Protokolle. Mit „＋ Neu“ das erste schreiben.'));
    }

    drawList() {
        if (!this.listEl) return;
        const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const q = fold(this.search.value);
        const list = this.sessions.filter((s) => !q || fold([s.number, s.title, s.players.join(' '), s.content].join(' ')).includes(q));
        this.listEl.replaceChildren(...list.map((s) => {
            const b = this.el('button', `pp-item${this.selected?.id === s.id ? ' active' : ''}`);
            b.type = 'button';
            b.append(this.el('strong', '', `${s.number}`), this.el('span', 'pp-item-title', MapProtocols.plain(s.title) || 'Sitzung'), this.el('span', 'pp-item-meta', this.date(s.date)));
            b.addEventListener('click', () => this.confirmLeave() && this.read(s));
            return b;
        }));
        if (!list.length) this.listEl.append(this.el('p', 'pp-note', q ? 'Nichts gefunden.' : ''));
    }

    // "Nach [[Tangoa|der Stadt]]" → "Nach der Stadt" (titles in the list)
    static plain(text) {
        return String(text || '').replace(/\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]/g, (_, t, l) => (l || t).trim());
    }

    date(iso) {
        const m = /^(\d{4,5})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
    }

    confirmLeave() {
        if (this.dirty && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return false;
        this.dirty = false;
        return true;
    }

    read(s) {
        this.selected = s;
        this.drawList();
        const head = this.el('header', 'pp-read-head');
        head.append(this.el('h2', 'rich-text', `Sitzung ${s.number}${s.title ? ' · ' : ''}`));
        if (s.title) head.firstChild.insertAdjacentHTML('beforeend', RichText.render(s.title).replace(/^<p>|<\/p>$/g, ''));
        const meta = this.el('p', 'pp-meta');
        meta.append(`📅 ${this.date(s.date)}`, s.ingameStart ? ` · 🗓️ ${this.date(s.ingameStart)}${s.ingameEnd ? ` – ${this.date(s.ingameEnd)}` : ''}` : '');
        const players = this.el('p', 'pp-players');
        s.players.forEach((p) => players.append(this.el('span', 'pp-chip', p)));
        const edit = this.el('button', 'pp-edit', '✎ Bearbeiten');
        edit.type = 'button';
        edit.addEventListener('click', () => this.edit(s));
        head.append(meta, players, edit);
        const text = this.el('div', 'pp-text rich-text');
        text.innerHTML = s.content ? RichText.render(s.content) : '<p class="pp-note">Noch kein Text.</p>';
        this.view.replaceChildren(head, text);
        this.view.scrollTop = 0;
    }

    // ---------- writing ----------

    loadEditor() {
        if (window.AdenaiEditor) return Promise.resolve();
        // md-editor.js finds link targets the way the CMS offers them
        window.adminCharacters ||= { getCharacters: () => window.characterSystem?.getCharacters?.() || [] };
        window.adminLocations ||= { getLocations: () => (window.locationSystem?.getLocations?.() || []).map((l) => l.feature || { properties: { name: l.name } }) };
        this.editorLoading ||= new Promise((resolve, reject) => {
            const sc = document.createElement('script');
            sc.src = 'src/vendor/md-editor.js?v=1';
            sc.onload = () => resolve();
            sc.onerror = () => reject(new Error('Editor konnte nicht geladen werden'));
            document.head.appendChild(sc);
        });
        return this.editorLoading;
    }

    async edit(s) {
        if (!this.confirmLeave()) return;
        if (!this.view) this.showMain(null);
        const latest = this.sessions[0];
        const d = s || {
            number: latest ? latest.number + 1 : 1,
            date: new Date().toISOString().slice(0, 10),
            players: latest ? [...latest.players] : [],
            title: '', ingameStart: latest?.ingameEnd || latest?.ingameStart || '', ingameEnd: '', content: '',
        };
        const form = this.el('form', 'pp-form');
        form.innerHTML = `
            <h2>${s ? `Sitzung ${s.number} bearbeiten` : 'Neues Protokoll'}</h2>
            <div class="pp-grid">
                <label>Sitzung Nr. *<input name="number" type="number" min="0" step="1" required></label>
                <label>Datum (echt) *<input name="date" type="date" required></label>
                <label class="pp-wide">Titel<input name="title" placeholder="Optional"></label>
                <label>Spielzeit von<input name="ingameStart" type="date" min="5663-01-01"></label>
                <label>bis<input name="ingameEnd" type="date" min="5663-01-01"></label>
                <label class="pp-wide">Anwesende Spieler:innen *<input name="players" list="pp-players" placeholder="Namen, mit Komma getrennt" required><datalist id="pp-players"></datalist></label>
            </div>
            <label class="pp-wide">Protokoll<textarea name="content" rows="18" data-md placeholder="Was ist passiert? [[ verlinkt Charaktere und Orte"></textarea></label>
            <p class="pp-error" hidden></p>
            <div class="pp-actions"><button type="button" class="pp-cancel">Abbrechen</button><button type="submit" class="pp-save">Speichern</button></div>`;
        const f = form.elements;
        f.number.value = d.number;
        f.date.value = d.date;
        f.title.value = d.title || '';
        f.ingameStart.value = d.ingameStart || '';
        f.ingameEnd.value = d.ingameEnd || '';
        f.players.value = (d.players || []).join(', ');
        f.content.value = d.content || '';
        const split = (v) => [...new Set(String(v).split(',').map((x) => x.trim()).filter(Boolean))];
        const datalist = form.querySelector('#pp-players');
        const suggest = () => {
            const chosen = new Set(split(f.players.value).map((x) => x.toLowerCase()));
            const prefix = f.players.value.includes(',') ? `${f.players.value.replace(/,[^,]*$/, '')}, ` : '';
            datalist.replaceChildren(...this.players.filter((p) => !chosen.has(p.toLowerCase())).map((p) => Object.assign(document.createElement('option'), { value: `${prefix}${p}` })));
        };
        f.players.addEventListener('input', suggest);
        suggest();
        f.ingameStart.addEventListener('change', () => { f.ingameEnd.min = f.ingameStart.value || '5663-01-01'; });
        form.addEventListener('input', () => { this.dirty = true; });
        form.querySelector('.pp-cancel').addEventListener('click', () => { if (this.confirmLeave()) (s ? this.read(s) : this.showMain(this.selected?.id)); });
        const err = form.querySelector('.pp-error');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                number: Number(f.number.value), date: f.date.value, title: f.title.value.trim(), players: split(f.players.value),
                ingameStart: f.ingameStart.value, ingameEnd: f.ingameEnd.value, content: f.content.value,
            };
            if (!body.players.length) { err.textContent = 'Wer war dabei? Mindestens eine Person.'; err.hidden = false; return; }
            const btn = form.querySelector('.pp-save');
            btn.disabled = true;
            btn.textContent = 'Speichert…';
            try {
                const res = await this.api(s ? `/${encodeURIComponent(s.id)}` : '', { method: s ? 'PUT' : 'POST', body });
                this.dirty = false;
                await this.load();
                this.showMain(res.session.id);
            } catch (e2) {
                if (e2.message === 'locked') return;
                err.textContent = e2.message.replace(/^Session (\d+) exists already$/, 'Sitzung $1 gibt es schon.');
                err.hidden = false;
                btn.disabled = false;
                btn.textContent = 'Speichern';
            }
        });
        this.view.replaceChildren(form);
        this.dirty = false;
        try {
            await this.loadEditor();
            window.AdenaiEditor.enhance(f.content);
        } catch { /* the plain textarea still works */ }
        (s ? f.content : f.number).focus?.();
    }
}

document.addEventListener('DOMContentLoaded', () => { window.mapProtocols = new MapProtocols(); });
