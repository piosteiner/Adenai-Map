// Protocols: the campaign's session minutes. List (number, title, date, players) and the selected session — the text
// with [[links]] and Markdown, players, real-life and in-game dates; the protocol password in the side bar.
// Stored on the CMS server only (server/lib/protocol-store.js), never in the public repo.
import { h, toast, confirmDialog, formatDate, fold } from '../dom';
import { api } from '../api';
import { canEdit, locationByName, characterByName } from '../store';
import { createList } from '../list';
import { field, input, markdown, tracker } from '../form';

const CAMPAIGN_MIN = '5663-01-01';
const today = () => new Date().toISOString().slice(0, 10);

export function protocolsView(app) {
    let sessions = [];
    let players = [];
    let current = null;
    let loaded = false;
    const detail = h('section.detail');
    const list = createList({
        noun: 'sessions',
        newLabel: 'New session',
        keyOf: (s) => s.id,
        thumbOf: () => null,
        titleOf: (s) => `${s.number}${s.title ? ` · ${plain(s.title)}` : ''}`,
        subtitleOf: (s) => [formatDate(s.date), s.players.join(', ')].filter(Boolean).join(' · '),
        badgesOf: (s) => [s.updatedVia === 'map' ? h('span.pill', { title: 'Last changed on the map' }, 'map') : null],
        textOf: (s) => [s.number, s.title, s.players.join(' '), s.date, s.content].join(' '),
        filters: [
            { id: 'player', label: 'All players', options: () => players.map((p) => ({ value: p, label: p })), test: (s, v) => s.players.includes(v) },
        ],
        onSelect: (key) => app.go(`protocols/${encodeURIComponent(key)}`),
        onNew: () => app.go('protocols/new'),
    });
    const el = h('div.split', {}, list.el, detail);

    async function load() {
        const [s, p] = await Promise.all([api('/api/protocols'), api('/api/protocols/players')]);
        sessions = s.sessions || [];
        players = p.players || [];
        loaded = true;
    }

    async function open(key) {
        current = null;
        if (!canEdit()) {
            list.update([], null);
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Log in to read and write the session minutes.' })));
            return;
        }
        if (!loaded) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Loading…' })));
            try { await load(); } catch (err) { detail.replaceChildren(h('div.placeholder', {}, h('p.error', { text: err.message }))); return; }
        }
        const session = key && key !== 'new' ? sessions.find((s) => s.id === key) : null;
        list.update(sessions, session?.id || null);
        if (key && key !== 'new' && !session) { detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'No such session.' })), passwordBlock()); return; }
        if (!key) {
            detail.replaceChildren(h('div.detail-cols', {},
                h('div.placeholder.pad', {}, h('p', { text: sessions.length ? `${sessions.length} sessions. Pick one on the left, or press ＋ New.` : 'No minutes yet. Press ＋ New — or let the players write them on the map.' })),
                h('aside.detail-side', {}, passwordBlock())));
            return;
        }
        render(session);
    }

    function render(s) {
        const latest = sessions[0];
        const d = s || {
            number: latest ? latest.number + 1 : 1,
            date: today(),
            players: latest ? [...latest.players] : [],
            title: '',
            ingameStart: latest?.ingameEnd || latest?.ingameStart || '',
            ingameEnd: '',
            content: '',
        };
        const number = input(d.number, { type: 'number', min: '0', step: '1', required: true });
        const date = input(d.date, { type: 'date', required: true, title: 'Real-life date of the session' });
        const title = input(d.title, { placeholder: 'Optional, e.g. "Ankunft in [[Tangoa]]"' });
        const playersInput = input(d.players.join(', '), { list: 'player-list', placeholder: 'Names, separated by commas', required: true });
        // suggestions: the names used before that aren't in the field yet, completing the part after the last comma
        const playerList = h('datalist#player-list');
        const suggest = () => {
            const chosen = new Set(splitPlayers(playersInput.value).map(fold));
            const prefix = playersInput.value.includes(',') ? `${playersInput.value.replace(/,[^,]*$/, '')}, ` : '';
            playerList.replaceChildren(...players.filter((p) => !chosen.has(fold(p))).map((p) => h('option', { value: `${prefix}${p}` })));
        };
        const ingameStart = input(d.ingameStart, { type: 'date', min: CAMPAIGN_MIN });
        const ingameEnd = input(d.ingameEnd, { type: 'date', min: d.ingameStart || CAMPAIGN_MIN });
        ingameStart.addEventListener('change', () => { ingameEnd.min = ingameStart.value || CAMPAIGN_MIN; });
        const content = markdown(d.content, { placeholder: 'What happened… [[ links to characters and places', rows: 22 });
        const chips = h('div.side-row');
        const drawChips = () => chips.replaceChildren(...splitPlayers(playersInput.value).map((p) => h('span.chip', { text: p })));
        playersInput.addEventListener('input', () => { drawChips(); suggest(); });
        drawChips();
        suggest();

        const read = () => ({
            number: number.value === '' ? '' : Number(number.value), date: date.value, title: title.value.trim(),
            players: splitPlayers(playersInput.value), ingameStart: ingameStart.value, ingameEnd: ingameEnd.value, content: content.value,
        });
        const state = h('span.save-state');
        const saveBtn = h('button.btn.primary', { type: 'button', disabled: !!s, title: 'Save (Ctrl+S)', on: { click: () => save() } }, 'Save');
        const track = tracker(read, (dirty) => { saveBtn.disabled = !dirty && !!s; state.textContent = dirty ? '● unsaved changes' : ''; });

        async function save() {
            const v = read();
            if (!Number.isInteger(v.number)) return toast('Session number is required', 'warn');
            if (!v.players.length) return toast('Who attended? At least one player', 'warn');
            if (!v.date) return toast('The real-life date is required', 'warn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const res = s ? await api(`/api/protocols/${encodeURIComponent(s.id)}`, { method: 'PUT', body: v }) : await api('/api/protocols', { method: 'POST', body: v });
                await load();
                track.reset();
                toast(`Saved session ${v.number}`);
                app.go(`protocols/${encodeURIComponent(res.session.id)}`, { force: true });
            } catch (err) {
                toast(`Not saved: ${err.message}`, 'bad', 7000);
                saveBtn.disabled = false;
            } finally {
                saveBtn.textContent = 'Save';
            }
        }

        async function remove() {
            if (!(await confirmDialog(`Delete the minutes of session ${s.number}? (They are kept aside on the server and can be restored.)`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/protocols/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
                await load();
                track.reset();
                toast(`Deleted session ${s.number}`);
                app.go('protocols', { force: true });
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        const form = h('form.detail-body', { on: { input: () => track.check(), change: () => track.check(), submit: (e) => { e.preventDefault(); save(); } } },
            h('div.grid', {},
                field('Session no. *', number),
                field('Date (real life) *', date),
                field('Title', title),
                field('In-game from', ingameStart),
                field('In-game to', ingameEnd)),
            field('Players who attended *', h('div', {}, playersInput, playerList, chips), { wide: true }),
            field('Minutes', content, { wide: true }));

        detail.replaceChildren(
            h('header.detail-head', {},
                h('div.detail-cover.empty', { text: '📜' }),
                h('div.detail-title', {}, h('h2', { text: s ? `Session ${s.number}${s.title ? ` · ${plain(s.title)}` : ''}` : 'New session' }),
                    h('span.muted', { text: s ? `${formatDate(s.date)} · ${s.players.join(', ')}` : 'not saved yet' })),
                h('span.spacer'), state,
                s ? h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete') : null,
                saveBtn),
            h('div.detail-cols', {},
                form,
                h('aside.detail-side', {},
                    s ? linksBlock(`${s.title || ''} ${s.content || ''}`) : null,
                    s ? h('div.side-block.meta', {}, h('p.muted', { text: `Created ${formatDate(s.createdAt)} by ${s.createdBy} (${s.createdVia}) · changed ${formatDate(s.updatedAt)} by ${s.updatedBy} (${s.updatedVia}) · ${s.versions} earlier version${s.versions === 1 ? '' : 's'} kept` })) : null,
                    passwordBlock())));

        current = { key: s?.id || 'new', track, save };
        if (!s) number.focus();
    }

    // What the minutes link to: characters and places, as chips (missing ones marked)
    function linksBlock(text) {
        const names = [...new Set([...String(text || '').matchAll(/\[\[([^\[\]|\n]+?)(?:\|[^\[\]\n]+?)?\]\]/g)].map((m) => m[1].trim()))];
        const chip = (n) => {
            const c = characterByName(n);
            const l = !c && locationByName(n);
            if (c) return h('a.chip', { href: `#/characters/${encodeURIComponent(c.id)}` }, '👤 ', c.name);
            if (l) return h('a.chip', { href: `#/locations/${encodeURIComponent(l.properties.name)}` }, '📍 ', l.properties.name);
            return h('span.chip.missing', { title: 'No character or location of this name' }, n);
        };
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
        isDirty: () => !!current?.track.isDirty(),
        save: () => current?.save(),
        async reloadAll() { loaded = false; },
    };
}

// "Nach [[Tangoa|der Stadt]]" → "Nach der Stadt"
const plain = (text) => String(text || '').replace(/\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]/g, (_, t, l) => (l || t).trim());
const splitPlayers = (text) => [...new Set(String(text || '').split(',').map((p) => p.trim()).filter(Boolean))];
export const sessionFold = fold;
