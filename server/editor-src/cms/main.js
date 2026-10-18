// Adenai CMS (v2): a split-view editor for the map's data. Same server, API and logins as the classic CMS at /.
// Built with `npm run build:cms` (server/editor-src) into admin-interface/v2/app.{js,css}.
// Routes are in the hash: #/locations/<name>, #/characters/<id>.
import '../md-editor.js'; // window.AdenaiEditor: Markdown editor with [[link]] suggestions
import '../../../src/utils/date-field.js'; // window.DateField: date inputs you can type and paste into (dd.mm.yyyy)
import './style.css';
import { h, toast } from './dom';
import { api } from './api';
import { store, loadAll, reload, onChange } from './store';
import { installHoverPreview } from './gallery';
import { locationsView } from './views/locations';
import { charactersView } from './views/characters';
import { protocolsView } from './views/protocols';
import { glossaryView } from './views/glossary';
import { proposalsView, loadPending } from './views/proposals';
import { mediaView } from './views/media';
import { historyView } from './views/history';
import { overviewView } from './views/overview';

// md-editor.js finds link targets through the classic CMS's modules: give it the same interface
window.adminCharacters = { getCharacters: () => store.characters };
window.adminLocations = { getLocations: () => store.locations };
window.adminGlossary = { getTerms: () => store.terms };

const AREAS = [
    { id: 'overview', label: 'Overview', icon: '◆', count: () => '' },
    { id: 'locations', label: 'Locations', icon: '📍', count: () => store.locations.length },
    { id: 'characters', label: 'Characters', icon: '👤', count: () => store.characters.length },
    { id: 'glossary', label: 'Glossary', icon: '📖', count: () => store.terms.length },
    { id: 'protocols', label: 'Protocols', icon: '📜', count: () => '' },
    { id: 'proposals', label: 'Proposals', icon: '⏳', count: () => (store.pending?.length ? store.pending.length : '') },
    { id: 'media', label: 'Media', icon: '🖼', count: () => Object.keys(store.media || {}).length },
    { id: 'history', label: 'History', icon: '🕘', count: () => '' },
];
const VIEWS = { overview: overviewView, locations: locationsView, characters: charactersView, glossary: glossaryView, protocols: protocolsView, proposals: proposalsView, media: mediaView, history: historyView };

const app = {
    area: null,
    views: {},
    // go('characters/mae'); a view with unsaved changes asks first (force: after its own save)
    async go(path, { force = false } = {}) {
        const target = `#/${path}`;
        if (!force && location.hash !== target && app.currentView()?.isDirty()) {
            const { confirmDialog } = await import('./dom');
            if (!(await confirmDialog('Discard the unsaved changes?', { ok: 'Discard', danger: true }))) return;
        }
        if (location.hash === target) route(true); else { skipGuard = true; location.hash = target; }
    },
    currentView: () => app.views[app.area],
};
let skipGuard = false;

// ---------- shell ----------

const tabs = h('nav.tabs', { 'aria-label': 'Areas' });
const userBox = h('div.user');
const main = h('main.main');
document.body.append(
    h('header.topbar', {},
        h('a.brand', { href: '#/overview' }, h('span.brand-mark', { text: '◆' }), 'Adenai', h('span.muted', { text: ' CMS' })),
        tabs,
        h('span.spacer'),
        h('a.btn.ghost.small', { href: 'https://adenai.piogino.ch/', target: '_blank', rel: 'noopener' }, 'Map ↗'),
        themeButton(),
        userBox),
    main);

function drawTabs() {
    tabs.replaceChildren(...AREAS.map((a) => h('a.tab', { href: `#/${a.id}`, 'aria-current': a.id === app.area ? 'page' : null },
        `${a.icon} ${a.label}`, store.loaded && a.count() !== '' ? h('span.tab-count', { text: a.count() }) : null)));
}

function drawUser() {
    const a = store.auth;
    userBox.replaceChildren(a.authenticated
        ? h('span.user-name', { title: `Role: ${a.role}` }, `👤 ${a.username}`)
        : h('span.muted', { text: 'read-only' }),
    a.authenticated
        ? h('button.btn.ghost.small', { type: 'button', on: { click: logout } }, 'Log out')
        : h('button.btn.primary.small', { type: 'button', on: { click: loginDialog } }, 'Log in'));
}

function themeButton() {
    const get = () => { try { return localStorage.getItem('adenai-cms-theme') || 'system'; } catch { return 'system'; } };
    const apply = (t) => { if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; };
    const order = ['system', 'light', 'dark'];
    const btn = h('button.btn.ghost.small', { type: 'button', title: 'Theme' });
    const show = (t) => { btn.textContent = { system: '◐', light: '☀', dark: '☾' }[t]; btn.title = `Theme: ${t}`; };
    let t = get();
    apply(t); show(t);
    btn.addEventListener('click', () => {
        t = order[(order.indexOf(t) + 1) % order.length];
        try { localStorage.setItem('adenai-cms-theme', t); } catch { /* private mode */ }
        apply(t); show(t);
    });
    return btn;
}

// ---------- auth ----------

function loginDialog() {
    const user = h('input', { autocomplete: 'username', required: true });
    const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const err = h('p.error', { hidden: true });
    const close = () => overlay.remove();
    const form = h('form.dialog.small', { on: { submit: async (e) => {
        e.preventDefault();
        try {
            await api('/api/login', { method: 'POST', body: { username: user.value, password: pass.value } });
            close();
            await reload('auth'); if (store.auth.authenticated) await loadPending(); else store.pending = [];
            toast(`Logged in as ${store.auth.username}`);
            route(true);
        } catch (e2) { err.textContent = e2.status === 401 ? 'Wrong user name or password' : e2.message; err.hidden = false; }
    } } },
    h('h3', { text: 'Log in' }),
    h('label.field', {}, h('span.field-label', { text: 'User' }), user),
    h('label.field', {}, h('span.field-label', { text: 'Password' }), pass), err,
    h('div.dialog-actions', {}, h('button.btn', { type: 'button', on: { click: close } }, 'Cancel'), h('button.btn.primary', { type: 'submit' }, 'Log in')));
    const overlay = h('div.overlay', { on: { mousedown: (e) => { if (e.target === overlay) close(); } } }, form);
    document.body.append(overlay);
    user.focus();
}

async function logout() {
    if (app.currentView()?.isDirty() && !(await (await import('./dom')).confirmDialog('Log out and discard the unsaved changes?', { ok: 'Log out', danger: true }))) return;
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    await reload('auth'); if (store.auth.authenticated) await loadPending(); else store.pending = [];
    route(true);
}

// ---------- routing ----------

let lastHash = '';
async function route(force = false) {
    if (!store.loaded) return;
    const [, area = 'overview', ...rest] = location.hash.replace(/^#\/?/, '#/').split('/');
    const key = rest.length ? decodeURIComponent(rest.join('/')) : null;
    if (!AREAS.some((a) => a.id === area)) { location.replace('#/overview'); return; }
    if (area !== app.area) {
        app.area = area;
        app.views[area] ||= VIEWS[area](app);
        main.replaceChildren(app.views[area].el);
    }
    drawTabs();
    drawUser();
    document.title = `${key && key !== 'new' ? `${key} · ` : ''}${AREAS.find((a) => a.id === area).label} · Adenai CMS`;
    if (force || location.hash !== lastHash) app.views[area].open(key);
    lastHash = location.hash;
}

// Back/forward or a typed address: guard unsaved changes, then follow
window.addEventListener('hashchange', async () => {
    if (skipGuard) { skipGuard = false; return route(); }
    if (app.currentView()?.isDirty()) {
        const { confirmDialog } = await import('./dom');
        if (!(await confirmDialog('Discard the unsaved changes?', { ok: 'Discard', danger: true }))) {
            skipGuard = true;
            location.hash = lastHash;
            return;
        }
    }
    route();
});
window.addEventListener('beforeunload', (e) => { if (app.currentView()?.isDirty()) { e.preventDefault(); e.returnValue = ''; } });

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); app.currentView()?.save(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (e.key === '/' && !typing) { e.preventDefault(); app.currentView()?.focusSearch(); }
});

onChange(() => { drawTabs(); drawUser(); });

// ---------- start ----------

installHoverPreview();
window.DateField.observe(document.body);
main.append(h('div.placeholder', {}, h('p', { text: 'Loading…' })));
app.drawTabs = () => drawTabs();
loadAll()
    .then(() => (store.auth.authenticated ? loadPending() : null))
    .then(() => route(true))
    .catch((err) => main.replaceChildren(h('div.placeholder', {}, h('p.error', { text: `Could not load the data: ${err.message}` }))));
