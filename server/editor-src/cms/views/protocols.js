// Protocols: the campaign's session minutes. List (number, title, date, players; drafts marked) and the selected session
// — the text with [[links]] and Markdown, players, places, party level, real-life and in-game dates; the protocol
// password in the side bar. Stored on the CMS server only (server/lib/protocol-store.js), never in the public repo.
//
// Editing is live, together with the players on the map (server/lib/protocol-live.js): what is typed is kept at once as
// the session's draft — nothing is lost on leaving the page. "Publish" (Ctrl+S) makes the draft what readers see;
// "Discard changes" goes back to the published version. A new session is a draft until published.
import { h, toast, confirmDialog, formatDate, fold } from '../dom';
import { store, canEdit, locationByName, characterByName, termByName } from '../store';
import { api } from '../api';
import { createList } from '../list';
import { field, input } from '../form';

const CAMPAIGN_MIN = '5663-01-01';
const today = () => new Date().toISOString().slice(0, 10);
const FIELDS = ['number', 'title', 'date', 'players', 'places', 'level', 'ingameStart', 'ingameEnd', 'content'];
const LISTS = ['players', 'places'];
const same = (a, b) => FIELDS.every((k) => JSON.stringify(a[k] ?? '') === JSON.stringify(b[k] ?? ''));
// a never-published session shows its draft
const shown = (s) => (s.published === false ? { ...s, ...(s.draft?.values || { number: s.draft?.number, title: s.draft?.title }) } : s);

export function protocolsView(app) {
    let sessions = [];
    let suggestions = { players: [], places: [] };
    let current = null; // { id, room, drawState, publish }
    let loaded = false;
    let live = null;
    const detail = h('section.detail');
    const list = createList({
        noun: 'sessions',
        newLabel: 'New session',
        keyOf: (s) => s.id,
        thumbOf: () => null,
        initialOf: (s) => String(shown(s).number ?? '?'),
        titleOf: (raw) => { const s = shown(raw); return `${s.number ?? '?'}${s.title ? ` · ${plain(s.title)}` : ''}`; },
        subtitleOf: (raw) => { const s = shown(raw); return [formatDate(s.date), (s.players || []).join(', ')].filter(Boolean).join(' · '); },
        badgesOf: (s) => [
            s.published === false ? h('span.pill.warn', { title: 'Never published' }, 'new draft')
                : s.draft ? h('span.pill.warn', { title: `Unpublished changes${s.draft.updatedBy ? ` by ${s.draft.updatedBy}` : ''}` }, 'draft') : null,
            s.updatedVia === 'map' ? h('span.pill', { title: 'Last published on the map' }, 'map') : null,
        ],
        searchDoc: (raw) => { const s = shown(raw); return { name: `${s.number ?? ''} ${s.title || ''}`.trim(), fields: [
            { label: 'Players', text: (s.players || []).join(', '), weight: 2 }, { label: 'Places', text: (s.places || []).join(', '), weight: 2 },
            { label: 'Date', text: formatDate(s.date), weight: 1.5 }, { label: 'Minutes', text: s.content, weight: 1 }] }; },
        textOf: (raw) => { const s = shown(raw); return [s.number, s.title, (s.players || []).join(' '), (s.places || []).join(' '), s.date, s.content].join(' '); },
        filters: [
            { id: 'player', label: 'All players', options: () => suggestions.players.map((p) => ({ value: p, label: p })), test: (s, v) => (shown(s).players || []).includes(v) },
            { id: 'place', label: 'All places', options: () => suggestions.places.map((p) => ({ value: p, label: p })), test: (s, v) => (shown(s).places || []).includes(v) },
            { id: 'draft', label: 'All sessions', options: () => [{ value: 'yes', label: 'Drafts only' }], test: (s) => !!s.draft || s.published === false },
        ],
        onSelect: (key) => app.go(`protocols/${encodeURIComponent(key)}`),
        onNew: () => app.go('protocols/new'),
    });
    const el = h('div.split', {}, list.el, detail);

    const sort = () => sessions.sort((a, b) => (Number(shown(a).number) || 0) - (Number(shown(b).number) || 0));
    const refreshList = () => list.update(sessions, current?.id || null);

    async function load() {
        const [s, sg] = await Promise.all([api('/api/protocols'), api('/api/protocols/suggestions')]);
        sessions = s.sessions || [];
        sort();
        suggestions = { players: sg.players || [], places: sg.places || [] };
        loaded = true;
    }

    // one live connection (the login cookie is the access) — and the news of every session through it
    function connect() {
        if (live) return live;
        live = window.AdenaiLive.connect({
            url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/protocols/live`,
            onStatus: (st) => { const s = document.querySelector('.pp-live-status'); if (s) s.textContent = { live: '● live', connecting: '◌ connecting…', offline: '○ offline — changes sent when back', locked: '🔒 logged out' }[st] || st; },
            onMessage: (m) => {
                if (m.t === 'gone') {
                    sessions = sessions.filter((x) => x.id !== m.id);
                    if (current?.id === m.id) { leave(); app.go('protocols', { force: true }); toast('That session was discarded', 'warn'); }
                } else if (m.t === 'session') {
                    const i = sessions.findIndex((x) => x.id === m.session.id);
                    if (i >= 0) sessions[i] = m.session; else sessions.push(m.session);
                    sort();
                } else if (m.t === 'draft') {
                    const s = sessions.find((x) => x.id === m.id);
                    if (s) Object.assign(s, { draft: m.draft, published: m.published });
                }
                refreshList();
                if (current && current.id === (m.session?.id || m.id)) current.drawState();
            },
        });
        return live;
    }

    function leave() {
        current?.room.leave();
        current = null;
    }

    async function open(key) {
        leave();
        if (!canEdit()) {
            list.update([], null);
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Log in to read and write the session minutes.' })));
            return;
        }
        if (!loaded) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Loading…' })));
            try { await load(); } catch (err) { detail.replaceChildren(h('div.placeholder', {}, h('p.error', { text: err.message }))); return; }
        }
        connect();
        if (key === 'new') return createSession();
        const session = key ? sessions.find((s) => s.id === key) : null;
        list.update(sessions, session?.id || null);
        if (key && !session) { detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'No such session.' })), passwordBlock()); return; }
        if (!key) {
            const drafts = sessions.filter((s) => s.draft || s.published === false).length;
            detail.replaceChildren(h('div.detail-cols', {},
                h('div.placeholder.pad', {}, h('p', { text: sessions.length ? `${sessions.length} sessions${drafts ? `, ${drafts} with unpublished changes` : ''}. Pick one on the left, or press ＋ New.` : 'No minutes yet. Press ＋ New — or let the players write them on the map.' })),
                h('aside.detail-side', {}, passwordBlock())));
            return;
        }
        render(session);
    }

    // a new session starts as a draft; an unpublished one that exists already is opened instead
    async function createSession() {
        const pending = sessions.find((s) => s.published === false);
        if (pending) { toast(`Session ${shown(pending).number} is still an unpublished draft — continuing it`, 'warn'); return app.go(`protocols/${encodeURIComponent(pending.id)}`, { force: true }); }
        const last = [...sessions].reverse().find((s) => s.published !== false);
        try {
            const res = await api('/api/protocols', {
                method: 'POST',
                body: { date: today(), players: last ? [...last.players] : [], level: last?.level || '', ingameStart: last?.ingameEnd || last?.ingameStart || '' },
            });
            if (!sessions.some((x) => x.id === res.session.id)) sessions.push(res.session);
            sort();
            app.go(`protocols/${encodeURIComponent(res.session.id)}`, { force: true });
        } catch (err) { toast(`Not created: ${err.message}`, 'bad', 7000); }
    }

    async function render(s) {
        const name = store.auth.username || 'CMS';
        const room = connect().join(s.id, { name });
        current = { id: s.id, room, drawState: () => {}, publish: () => {} };
        const me = current;
        detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Connecting…' })));
        await Promise.race([room.ready, new Promise((r) => setTimeout(r, 5000))]);
        if (current !== me) return; // moved on meanwhile
        if (!room.synced) { detail.replaceChildren(h('div.placeholder', {}, h('p.error', { text: 'The live connection does not answer — try again in a moment.' }))); return; }
        room.awareness.setLocalStateField('editing', true);

        const number = input('', { type: 'number', min: '0', step: '1', required: true });
        const date = input('', { type: 'date', required: true, title: 'Real-life date of the session' });
        const level = input('', { type: 'number', min: '1', max: '30', step: '1', placeholder: 'e.g. 3', title: 'Party level' });
        const title = input('', { placeholder: 'Optional, e.g. "Ankunft in [[Tangoa]]"' });
        const players = input('', { list: 'player-list', placeholder: 'Names, separated by commas', autocomplete: 'off' });
        const places = input('', { list: 'place-list', placeholder: 'Places of the session, separated by commas', autocomplete: 'off' });
        const ingameStart = input('', { type: 'date', min: CAMPAIGN_MIN });
        const ingameEnd = input('', { type: 'date', min: CAMPAIGN_MIN });
        ingameStart.addEventListener('change', () => { ingameEnd.min = ingameStart.value || CAMPAIGN_MIN; });
        const content = h('textarea', { rows: 22, placeholder: 'What happened… [[ links to characters, places and terms', 'data-md': '' });
        const inputs = { number, date, level, title, players, places, ingameStart, ingameEnd };

        // suggestions for the part after the last comma
        const datalist = (id, input_, names) => {
            const dl = h(`datalist#${id}`);
            const update = () => {
                const chosen = new Set(splitList(input_.value).map(fold));
                const prefix = input_.value.includes(',') ? `${input_.value.replace(/,[^,]*$/, '')}, ` : '';
                dl.replaceChildren(...names().filter((p) => !chosen.has(fold(p))).slice(0, 400).map((p) => h('option', { value: `${prefix}${p}` })));
            };
            input_.addEventListener('input', update);
            requestAnimationFrame(update);
            return dl;
        };
        const placeNames = () => [...new Set([...store.locations.map((l) => l.properties.name), ...suggestions.places])].sort((a, b) => a.localeCompare(b, 'de'));
        const playerChips = h('div.side-row');
        const placeChips = h('div.side-row');
        const drawChips = () => {
            playerChips.replaceChildren(...splitList(players.value).map(chip));
            placeChips.replaceChildren(...splitList(places.value).map(chip));
        };

        // inputs ↔ the live document's fields (last writer wins per field); a field being typed in isn't overwritten
        const toInput = (k, v) => { if (!LISTS.includes(k)) return v ?? ''; try { return JSON.parse(v || '[]').join(', '); } catch { return ''; } };
        const fromInput = (k, v) => (LISTS.includes(k) ? JSON.stringify(splitList(v)) : String(v));
        const visible = (k) => inputs[k].closest?.('.date-field')?.querySelector('input[type=text]') || inputs[k];
        const fill = (k) => { if (document.activeElement !== visible(k)) inputs[k].value = toInput(k, room.fields.get(k)); };
        Object.keys(inputs).forEach(fill);
        for (const [k, inp] of Object.entries(inputs)) {
            const push = () => { room.fields.set(k, fromInput(k, inp.value)); drawChips(); };
            inp.addEventListener('change', push);
            if (!['date', 'ingameStart', 'ingameEnd'].includes(k)) inp.addEventListener('input', push);
            requestAnimationFrame(() => visible(k).addEventListener('blur', () => setTimeout(() => fill(k), 0)));
        }
        room.fields.observe((e) => { e.keysChanged.forEach((k) => { if (inputs[k]) fill(k); }); drawChips(); });

        const liveValues = () => {
            const f = room.fields.toJSON();
            const lst = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
            const num = (v) => (v === '' || v === undefined ? '' : Number(v));
            return { number: num(f.number), title: f.title || '', date: f.date || '', players: lst(f.players), places: lst(f.places), level: num(f.level), ingameStart: f.ingameStart || '', ingameEnd: f.ingameEnd || '', content: room.text.toString() };
        };

        const state = h('span.save-state');
        const people = h('span.muted');
        const heading = h('h2');
        const sub = h('span.muted');
        const links = h('div');
        const publishBtn = h('button.btn.primary', { type: 'button', title: 'Publish the draft (Ctrl+S)', on: { click: () => publish() } }, 'Publish');
        const discardBtn = h('button.btn.ghost', { type: 'button', on: { click: () => discard() } }, 'Discard changes');
        const drawState = () => {
            const raw = sessions.find((x) => x.id === s.id) || s;
            const v = liveValues();
            const fresh = raw.published === false;
            const changed = fresh || !same(v, raw);
            state.textContent = fresh ? '● new — not published yet' : changed ? '● unpublished changes (kept as draft)' : '✓ published';
            state.classList.toggle('warn', changed);
            publishBtn.disabled = !changed;
            discardBtn.textContent = fresh ? 'Discard session' : 'Discard changes';
            discardBtn.hidden = !changed;
            heading.textContent = `Session ${v.number === '' ? '?' : v.number}${v.title ? ` · ${plain(v.title)}` : ''}`;
            sub.textContent = [formatDate(v.date), v.level ? `level ${v.level}` : '', v.players.join(', ')].filter(Boolean).join(' · ');
            links.replaceChildren(linksBlock(`${v.title} ${v.content}`));
        };
        const drawPeople = () => {
            const others = room.people();
            people.textContent = others.length ? `with ${others.map((p) => `${p.editing ? '✎ ' : ''}${p.name}`).join(', ')}` : '';
        };
        let t = null;
        room.doc.on('update', () => { clearTimeout(t); t = setTimeout(drawState, 250); });
        room.awareness.on('change', drawPeople);

        async function publish() {
            const v = liveValues();
            if (!Number.isInteger(v.number)) return toast('Session number is required', 'warn');
            if (!v.players.length) return toast('Who attended? At least one player', 'warn');
            if (!v.date) return toast('The real-life date is required', 'warn');
            publishBtn.disabled = true;
            publishBtn.textContent = 'Publishing…';
            try {
                const res = await api(`/api/protocols/${encodeURIComponent(s.id)}/publish`, { method: 'POST', body: {} });
                const i = sessions.findIndex((x) => x.id === s.id);
                if (i >= 0) sessions[i] = res.session;
                sort();
                refreshList();
                toast(`Published session ${v.number}`);
            } catch (err) {
                toast(`Not published: ${err.message}`, 'bad', 7000);
            } finally {
                publishBtn.textContent = 'Publish';
                drawState();
            }
        }

        async function discard() {
            const raw = sessions.find((x) => x.id === s.id) || s;
            const fresh = raw.published === false;
            if (!(await confirmDialog(fresh ? 'Discard this new session and its text?' : 'Discard all unpublished changes (also those of others editing now)? The published version stays.', { ok: 'Discard', danger: true }))) return;
            try {
                const r = await api(`/api/protocols/${encodeURIComponent(s.id)}/draft`, { method: 'DELETE' });
                if (r.deleted) { sessions = sessions.filter((x) => x.id !== s.id); leave(); app.go('protocols', { force: true }); return; }
                const i = sessions.findIndex((x) => x.id === s.id);
                if (i >= 0) sessions[i] = r.session;
                toast('Back to the published version');
                refreshList();
            } catch (err) { toast(`Not discarded: ${err.message}`, 'bad', 7000); }
        }

        async function remove() {
            if (!(await confirmDialog(`Delete the minutes of session ${shown(s).number}? (They are kept aside on the server and can be restored.)`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/protocols/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
                sessions = sessions.filter((x) => x.id !== s.id);
                leave();
                toast(`Deleted session ${shown(s).number}`);
                app.go('protocols', { force: true });
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        const form = h('form.detail-body', { on: { submit: (e) => { e.preventDefault(); publish(); } } },
            h('div.grid', {},
                field('Session no. *', number),
                field('Date (real life) *', date),
                field('Party level', level),
                field('Title', title),
                field('In-game from', ingameStart),
                field('In-game to', ingameEnd)),
            field('Players who attended *', h('div', {}, players, datalist('player-list', players, () => suggestions.players), playerChips), { wide: true }),
            field('Places', h('div', {}, places, datalist('place-list', places, placeNames), placeChips), { wide: true }),
            field('Minutes', content, { wide: true, hint: 'Typing is kept as a draft at once and shared live with everyone editing this session; readers on the map see it after Publish.' }));

        detail.replaceChildren(
            h('header.detail-head', {},
                h('div.detail-cover.empty', { text: '📜' }),
                h('div.detail-title', {}, heading, sub),
                h('span.spacer'), h('span.muted.pp-live-status', { text: live.status() === 'live' ? '● live' : '◌ connecting…' }), people, state,
                h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete'),
                discardBtn, publishBtn),
            h('div.detail-cols', {},
                form,
                h('aside.detail-side', {},
                    links,
                    h('div.side-block.meta', {}, h('p.muted', { text: `Created ${formatDate(s.createdAt)} by ${s.createdBy} (${s.createdVia})${s.published !== false ? ` · published ${formatDate(s.updatedAt)} by ${s.updatedBy} (${s.updatedVia}) · ${s.versions} earlier version${s.versions === 1 ? '' : 's'} kept` : ''}` })),
                    passwordBlock())));
        requestAnimationFrame(() => window.AdenaiEditor?.enhance(content, room));
        Object.assign(current, { drawState, publish });
        drawChips();
        drawState();
        drawPeople();
    }

    // a name with an entry of that name links to it: character, location, glossary term (missing ones marked)
    function chip(n) {
        const c = characterByName(n);
        const l = !c && locationByName(n);
        const t = !c && !l && termByName(n);
        if (c) return h('a.chip', { href: `#/characters/${encodeURIComponent(c.id)}`, title: 'Character' }, '👤 ', c.name);
        if (l) return h('a.chip', { href: `#/locations/${encodeURIComponent(l.properties.name)}`, title: 'Location' }, '📍 ', l.properties.name);
        if (t) return h('a.chip', { href: `#/glossary/${encodeURIComponent(t.id)}`, title: 'Glossary' }, '📖 ', t.name);
        return h('span.chip.missing', { title: 'No character, location or term of this name' }, n);
    }

    // What the minutes link to
    function linksBlock(text) {
        const names = [...new Set([...String(text || '').matchAll(/\[\[([^\[\]|\n]+?)(?:\|[^\[\]\n]+?)?\]\]/g)].map((m) => m[1].trim()))];
        return h('div.side-block', {}, h('h3', { text: `Links (${names.length})` }), names.length ? h('p.side-row', {}, names.map(chip)) : h('p.muted', { text: 'No [[links]] yet.' }));
    }

    // The password the map asks for before showing the minutes
    function passwordBlock() {
        const box = h('div.side-block', {}, h('h3', { text: 'Protocol password' }), h('p.muted', { text: 'Loading…' }));
        api('/api/protocols/settings/password').then((s) => {
            const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: s.passwordSet ? 'New password' : 'Set a password', minlength: '6' });
            const btn = h('button.btn.small', { type: 'button' }, s.passwordSet ? 'Change' : 'Set');
            btn.addEventListener('click', async () => {
                if (pw.value.length < 6) return toast('At least 6 characters', 'warn');
                if (s.passwordSet && !(await confirmDialog('Change the protocol password? Every device that unlocked the minutes with the old one has to enter the new one.', { ok: 'Change' }))) return;
                try {
                    await api('/api/protocols/settings/password', { method: 'PUT', body: { password: pw.value } });
                    toast('Protocol password set');
                    box.replaceWith(passwordBlock());
                } catch (err) { toast(err.message, 'bad'); }
            });
            box.replaceChildren(h('h3', { text: 'Protocol password' }),
                h('p.muted', { text: s.passwordSet ? `Set · last changed ${formatDate(s.updatedAt)} by ${s.updatedBy}. Players need it to read and write the minutes on the map (unlocks a device for 30 days).` : 'Not set yet: the minutes cannot be opened on the map until you set one.' }),
                h('div.pair', {}, pw, btn));
        }).catch((err) => box.replaceChildren(h('h3', { text: 'Protocol password' }), h('p.error', { text: err.message })));
        return box;
    }

    return {
        el,
        open,
        focusSearch: () => list.focusSearch(),
        isDirty: () => false, // drafts are kept on the server as they are typed
        save: () => current?.publish(),
        async reloadAll() { loaded = false; },
    };
}

// "Nach [[Tangoa|der Stadt]]" → "Nach der Stadt"
const plain = (text) => String(text || '').replace(/\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]/g, (_, t, l) => (l || t).trim());
const splitList = (text) => [...new Set(String(text || '').split(',').map((p) => p.trim()).filter(Boolean))];
export const sessionFold = fold;
