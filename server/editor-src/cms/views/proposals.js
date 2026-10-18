// Proposals: entries the players created on the map while writing the minutes (server/lib/pending-store.js) — a person,
// a place or a thing. They already work on the map; here the DM confirms one as a character, location or glossary term
// (the name can be changed — the [[links]] in the minutes follow) or rejects it, optionally turning its links in the
// minutes back into plain text.
import { h, toast, confirmDialog, formatDate } from '../dom';
import { store, reload, canEdit, options, characterByName, locationByName, termByName } from '../store';
import { api } from '../api';
import { createList } from '../list';
import { field, input, select, markdown } from '../form';
import { createMiniMap } from '../minimap';

const KINDS = { character: '👤 Person', location: '📍 Place', term: '📖 Thing / term' };

export async function loadPending() {
    try { store.pending = (await api('/api/pending')).entries || []; } catch { store.pending = []; }
    return store.pending;
}

export function proposalsView(app) {
    let current = null;
    const detail = h('section.detail');
    const list = createList({
        noun: 'proposals',
        keyOf: (p) => p.id,
        thumbOf: () => null,
        initialOf: (p) => ({ character: '👤', location: '📍', term: '📖' }[p.kind] || '?'),
        titleOf: (p) => p.name,
        subtitleOf: (p) => `${KINDS[p.kind] || ''} · by ${p.createdBy} · ${formatDate(p.createdAt)}`,
        textOf: (p) => [p.name, p.description, p.createdBy].join(' '),
        filters: [{ id: 'kind', label: 'All kinds', options: () => Object.entries(KINDS).map(([value, label]) => ({ value, label })), test: (p, v) => p.kind === v }],
        onSelect: (key) => app.go(`proposals/${encodeURIComponent(key)}`),
    });
    const el = h('div.split', {}, list.el, detail);

    async function open(key) {
        if (!canEdit()) {
            list.update([], null);
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Log in to confirm the players’ proposals.' })));
            return;
        }
        await loadPending();
        app.drawTabs?.();
        const p = key ? store.pending.find((x) => x.id === key) : null;
        list.update(store.pending, p?.id || null);
        if (!p) {
            detail.replaceChildren(h('div.placeholder.pad', {}, h('p', { text: store.pending.length
                ? `${store.pending.length} proposal${store.pending.length === 1 ? '' : 's'} from the players. They already work on the map; pick one to confirm or reject it.`
                : 'No proposals. When players type [[ and a name that has no entry yet in the minutes on the map, they can propose one — it shows up here.' })));
            return;
        }
        // the sessions whose minutes link to it
        let sessions = [];
        try {
            const fold = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const all = (await api('/api/protocols')).sessions || [];
            sessions = all.filter((s) => [...`${s.title || ''} ${s.content || ''} ${s.draft?.values?.content || ''}`.matchAll(/\[\[([^\]|]+)/g)].some((m) => fold(m[1]) === fold(p.name)));
        } catch { /* minutes unavailable: no list */ }
        if (current?.id !== p.id && key !== p.id) return;
        render(p, sessions);
    }

    function render(p, sessions = []) {
        current = p;
        const name = input(p.name, { required: true });
        const kind = select(p.kind, Object.entries(KINDS).map(([value, label]) => ({ value, label })), { empty: null });
        const description = markdown(p.description, { rows: 8 });
        // per kind: what the new entry needs
        const title = input('', { placeholder: 'e.g. Händlerin aus Rena' });
        const relationship = select('unknown', options('characterRelationships'), { empty: null });
        const category = input(p.category || '', { placeholder: 'e.g. Gegenstand, Organisation, Ort' });
        const type = select('', options('locationTypes'));
        const region = select('', options('locationRegions'));
        const x = input('', { type: 'number', step: '1', placeholder: 'X' });
        const y = input('', { type: 'number', step: '1', placeholder: 'Y' });
        const map = createMiniMap({ editable: true, onPick: ([px, py]) => { x.value = px; y.value = py; } });
        [x, y].forEach((i) => i.addEventListener('change', () => map.setPoint([x.value, y.value])));
        const perKind = {
            character: h('div.grid', {}, field('Title / role', title), field('Relationship', relationship)),
            term: h('div.grid', {}, field('Category', category)),
            location: h('div', {}, h('div.grid', {}, field('Type', type), field('Region', region), field('X', x), field('Y', y)), field('Position — click the map', map.el, { wide: true })),
        };
        const kindBox = h('div');
        const drawKind = () => kindBox.replaceChildren(perKind[kind.value]);
        kind.addEventListener('change', drawKind);
        drawKind();

        const confirmBtn = h('button.btn.primary', { type: 'button', on: { click: () => confirm() } }, 'Confirm');
        const rejectBtn = h('button.btn.ghost.danger', { type: 'button', on: { click: () => reject() } }, 'Reject');

        async function confirm() {
            const n = name.value.trim();
            if (!n) return toast('A name is required', 'warn');
            const clash = characterByName(n) || locationByName(n) || termByName(n);
            if (clash) return toast(`There is already an entry “${n}”`, 'warn');
            const k = kind.value;
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Creating…';
            try {
                if (k === 'character') {
                    await api('/api/characters', { method: 'POST', body: { name: n, title: title.value.trim(), description: description.value, relationship: relationship.value || 'unknown', status: 'alive', placeOfOrigin: '' } });
                } else if (k === 'term') {
                    await api('/api/glossary', { method: 'POST', body: { name: n, aliases: [], category: category.value.trim(), description: description.value, images: [] } });
                } else {
                    if (!Number.isFinite(parseInt(x.value, 10)) || !Number.isFinite(parseInt(y.value, 10))) throw new Error('Set the position: click the map or enter X and Y');
                    await api('/api/locations', { method: 'POST', body: { type: 'Feature', properties: { name: n, type: type.value, region: region.value, visited: true, description: description.value, images: [], image: '' }, geometry: { type: 'Point', coordinates: [parseInt(x.value, 10), parseInt(y.value, 10)] } } });
                }
                // the proposal goes; if the name changed, its [[links]] in the minutes follow
                await api(`/api/pending/${encodeURIComponent(p.id)}?confirmedAs=${encodeURIComponent(n)}`, { method: 'DELETE' });
                await reload(k === 'character' ? 'characters' : k === 'term' ? 'terms' : 'locations');
                await loadPending();
                toast(`Confirmed “${n}” as ${KINDS[k].replace(/^\S+ /, '').toLowerCase()}`);
                if (k === 'character') app.go(`characters/${encodeURIComponent(characterByName(n)?.id || '')}`, { force: true });
                else if (k === 'term') app.go(`glossary/${encodeURIComponent(termByName(n)?.id || '')}`, { force: true });
                else app.go(`locations/${encodeURIComponent(n)}`, { force: true });
            } catch (err) {
                toast(`Not confirmed: ${err.message}`, 'bad', 7000);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm';
            }
        }

        async function reject() {
            const ok = await confirmDialog(`Reject the proposal “${p.name}”? It disappears from the map.`, { ok: 'Reject', danger: true });
            if (!ok) return;
            const plain = await confirmDialog(`Also turn the [[${p.name}]] links in the minutes back into plain text? (Otherwise they stay as links to nothing.)`, { ok: 'Yes, unlink' });
            try {
                const r = await api(`/api/pending/${encodeURIComponent(p.id)}${plain ? '?unlink=1' : ''}`, { method: 'DELETE' });
                await loadPending();
                toast(`Rejected “${p.name}”${r.unlinked ? ` · links removed in ${r.unlinked} session${r.unlinked === 1 ? '' : 's'}` : ''}`);
                app.go('proposals', { force: true });
            } catch (err) { toast(`Not rejected: ${err.message}`, 'bad', 7000); }
        }

        // the players' changes to name/kind/description are kept on "Save proposal" without confirming
        async function saveProposal() {
            try {
                await api(`/api/pending/${encodeURIComponent(p.id)}`, { method: 'PUT', body: { name: name.value.trim(), kind: kind.value, description: description.value, category: category.value.trim() } });
                await loadPending();
                toast('Proposal saved');
                open(p.id);
            } catch (err) { toast(`Not saved: ${err.message}`, 'bad', 7000); }
        }

        detail.replaceChildren(
            h('header.detail-head', {},
                h('div.detail-cover.empty', { text: '⏳' }),
                h('div.detail-title', {}, h('h2', { text: p.name }), h('span.muted', { text: `${KINDS[p.kind] || ''} · proposed by ${p.createdBy} on ${formatDate(p.createdAt)}${p.updatedAt !== p.createdAt ? ` · changed by ${p.updatedBy}` : ''}` })),
                h('span.spacer'),
                rejectBtn,
                h('button.btn.ghost', { type: 'button', on: { click: saveProposal } }, 'Save proposal'),
                confirmBtn),
            h('div.detail-cols', {},
                h('form.detail-body', { on: { submit: (e) => { e.preventDefault(); confirm(); } } },
                    h('div.grid', {}, field('Name', name), field('Confirm as', kind)),
                    kindBox,
                    field('Description', description, { wide: true, hint: 'Links in the minutes follow if you change the name.' })),
                h('aside.detail-side', {},
                    h('div.side-block', {}, h('h3', { text: 'What happens' }), h('p.muted', { text: 'Confirm creates the character, location or glossary term with this name and description and removes the proposal. On the map nothing changes for the players, except that the entry is no longer marked ⏳.' })),
                    sessions.length ? h('div.side-block', {}, h('h3', { text: `In the minutes (${sessions.length})` }), h('p.side-row', {}, sessions.map((s) => h('a.chip', { href: `#/protocols/${encodeURIComponent(s.id)}` }, `📜 ${s.number}`)))) : null)));
    }

    return {
        el,
        open,
        focusSearch: () => list.focusSearch(),
        isDirty: () => false,
        save: () => {},
        async reloadAll() { await loadPending(); },
    };
}
