// Emotes: ":name:" in any text shows an image, as in a Twitch chat (src/utils/rich-text.js); typing ":" in an editor
// lists them. Where they come from: 7TV emote sets — a 7TV or Twitch name follows that channel's active set, a set
// link or id that set, plus 7TV's global emotes — and our own images from the media library. Saved in
// public/data/emotes.json (routes/emotes.js); every save fetches the 7TV sets again.
import { h, toast, formatDate } from '../dom';
import { api } from '../api';
import { store, reload, canEdit } from '../store';
import { pickImages } from '../gallery';

const sourceLabel = (s) => (s.type === 'user' ? `👤 ${s.name}` : s.type === 'global' ? '🌐 7TV global' : `🗂 Set ${s.setName || s.setId}`);
const plain = (s) => (s.type === 'user' ? { type: 'user', name: s.name } : s.type === 'set' ? { type: 'set', setId: s.setId } : { type: 'global' });

export function emotesView() {
    const el = h('div.overview.emotes');
    let draft = null; // { sources, custom } as edited
    let saved = '';
    let filter = '';
    const snapshot = () => JSON.stringify({ sources: draft.sources.map(plain), custom: draft.custom.map(({ name, url }) => ({ name, url })) });
    const isDirty = () => !!draft && snapshot() !== saved;

    function open() {
        const e = store.emotes;
        draft = { sources: (e.sources || []).map((s) => ({ ...s })), custom: (e.custom || []).map((c) => ({ ...c })) };
        saved = snapshot();
        draw();
    }

    function draw() {
        const editable = canEdit();
        const all = Object.entries(store.emotes.emotes || {});
        const state = h('span.save-state', { text: isDirty() ? '● unsaved changes' : '' });
        const saveBtn = h('button.btn.primary', { type: 'button', on: { click: save }, title: 'Save (Ctrl+S) — also fetches the 7TV sets again' }, isDirty() ? 'Save' : '↻ Refresh from 7TV');
        const changed = () => draw();

        // ---- 7TV sources ----
        const sourceRows = draft.sources.map((s, i) => h('div.emote-source', {},
            h('strong', { text: sourceLabel(s) }),
            h('span.muted', { text: s.error ? '' : [s.type === 'user' && s.setName ? `set “${s.setName}”` : '', s.count != null ? `${s.count} emotes` : 'new — saved on Save'].filter(Boolean).join(' · ') }),
            s.error ? h('span.error', { text: `⚠ ${s.error}` }) : null,
            h('span.spacer'),
            editable && i > 0 ? h('button.btn.ghost.small', { type: 'button', title: 'Up: wins when two sets have the same name', on: { click: () => { draft.sources.splice(i - 1, 0, ...draft.sources.splice(i, 1)); changed(); } } }, '↑') : null,
            editable ? h('button.btn.ghost.small.danger', { type: 'button', title: 'Remove', on: { click: () => { draft.sources.splice(i, 1); changed(); } } }, '✕') : null));
        const addInput = h('input', { type: 'text', placeholder: '7TV or Twitch name, 7TV link or set id', on: { keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addSource(); } } } });
        const addBtn = h('button.btn', { type: 'button', on: { click: addSource } }, 'Add');
        async function addSource() {
            const input = addInput.value.trim();
            if (!input) return addInput.focus();
            addBtn.disabled = true;
            addBtn.textContent = 'Looking up…';
            try {
                const { source } = await api('/api/emotes/lookup', { method: 'POST', body: { input } });
                if (draft.sources.some((s) => JSON.stringify(plain(s)) === JSON.stringify(plain(source)))) toast(`${sourceLabel(source)} is already there`, 'warn');
                else { draft.sources.push(source); changed(); toast(`${sourceLabel(source)}: ${source.count} emotes — save to use them`); }
            } catch (err) { toast(err.message, 'bad', 6000); addBtn.disabled = false; addBtn.textContent = 'Add'; }
        }
        const hasGlobal = draft.sources.some((s) => s.type === 'global');

        // ---- own emotes ----
        const customRows = draft.custom.map((c, i) => {
            const name = h('input', { type: 'text', value: c.name, readOnly: !editable, placeholder: 'name', on: { change: () => { c.name = name.value.trim(); changed(); } } });
            return h('div.emote-source', {},
                h('img.emote-img', { src: c.url, alt: '' }),
                h('span.muted', { text: ':' }), name, h('span.muted', { text: ':' }),
                h('span.spacer'),
                editable ? h('button.btn.ghost.small', { type: 'button', on: { click: async () => { const [url] = await pickImages(); if (url) { c.url = url; changed(); } } } }, 'Image…') : null,
                editable ? h('button.btn.ghost.small.danger', { type: 'button', title: 'Remove', on: { click: () => { draft.custom.splice(i, 1); changed(); } } }, '✕') : null);
        });
        async function addCustom() {
            const [url] = await pickImages();
            if (!url) return;
            draft.custom.push({ name: '', url });
            draw();
            [...el.querySelectorAll('.emote-source input')].at(-1)?.focus();
        }

        // ---- all emotes ----
        const search = h('input', { type: 'search', placeholder: `Search ${all.length} emotes…`, value: filter, on: { input: () => { filter = search.value; drawGrid(); } } });
        const grid = h('div.emote-grid');
        const drawGrid = () => {
            const q = filter.trim().toLowerCase();
            const shown = all.filter(([n]) => !q || n.toLowerCase().includes(q)).sort((a, b) => a[0].localeCompare(b[0]));
            grid.replaceChildren(...shown.slice(0, 400).map(([n, e]) => h('button.emote-tile', {
                type: 'button',
                title: `:${n}: — ${e.from === 'custom' ? 'own' : e.from} · click to copy`,
                on: { click: () => navigator.clipboard?.writeText(`:${n}:`).then(() => toast(`:${n}: copied`), () => {}) },
            }, h('img', { src: e.url, alt: '', loading: 'lazy' }), h('span', { text: n }))),
            ...(shown.length > 400 ? [h('p.muted', { text: `… and ${shown.length - 400} more — search to narrow down` })] : []));
        };
        drawGrid();

        el.replaceChildren(
            h('section.overview-block', {},
                h('div.emote-head', {},
                    h('h2', { text: 'Emotes' }),
                    h('span.muted', { text: `${all.length} emotes${store.emotes.lastUpdated ? ` · fetched ${formatDate(store.emotes.lastUpdated)}` : ''}` }),
                    h('span.spacer'), state, editable ? saveBtn : h('span.muted', { text: 'Log in to edit' })),
                h('p.muted', { text: 'Write :name: in any text (descriptions, minutes …) and the map shows the emote. In the editor, type : and a few letters to pick one. Names are case-sensitive, as on Twitch; :catjam: finds catJAM when nothing else fits.' })),
            h('section.overview-block', {}, h('h2', { text: '7TV' }),
                h('p.muted', { text: 'A 7TV or Twitch name follows the emote set active on that channel: change it on 7TV, then press Refresh here. The first source wins when two have an emote of the same name; own emotes win over all.' }),
                h('div.emote-list', {}, sourceRows.length ? sourceRows : h('p.muted', { text: 'No 7TV sets yet.' })),
                editable ? h('div.emote-add', {}, addInput, addBtn,
                    hasGlobal ? null : h('button.btn.ghost', { type: 'button', on: { click: () => { draft.sources.push({ type: 'global' }); changed(); } } }, '+ 7TV global emotes')) : null),
            h('section.overview-block', {}, h('h2', { text: 'Own emotes' }),
                h('p.muted', { text: 'Any image from the media library (or uploaded there), under a name of your choice — no spaces or colons.' }),
                h('div.emote-list', {}, customRows.length ? customRows : h('p.muted', { text: 'None yet.' })),
                editable ? h('div.emote-add', {}, h('button.btn', { type: 'button', on: { click: addCustom } }, '+ Own emote…')) : null),
            h('section.overview-block', {}, h('h2', { text: 'All emotes' }), search, grid));
    }

    async function save() {
        if (!canEdit() || !draft) return;
        const bad = draft.custom.find((c) => !/^[^\s:]{1,64}$/.test(c.name));
        if (bad) return toast(bad.name ? `“${bad.name}”: no spaces or colons in a name` : 'An own emote needs a name', 'warn');
        const btn = el.querySelector('.emote-head .btn.primary');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        try {
            const res = await api('/api/emotes', { method: 'PUT', body: { sources: draft.sources.map(plain), custom: draft.custom.map(({ name, url }) => ({ name, url })) } });
            await reload('emotes');
            const errors = (res.sources || []).filter((s) => s.error);
            toast(`Saved · ${Object.keys(res.emotes || {}).length} emotes`);
            if (errors.length) toast(`Not fetched: ${errors.map((s) => `${sourceLabel(s)} (${s.error})`).join('; ')} — kept the emotes from before`, 'warn', 9000);
            open();
        } catch (err) {
            toast(`Not saved: ${err.message}`, 'bad', 7000);
            draw();
        }
    }

    return {
        el,
        open,
        focusSearch: () => el.querySelector('input[type="search"]')?.focus(),
        isDirty,
        save,
    };
}
