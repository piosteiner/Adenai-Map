// Characters: list (portrait, title, relationship, status) and the selected character — fields, description and
// notes with [[links]], images, movements (add / edit / delete inline), the path on the mini map, mentions.
import { h, toast, confirmDialog, formatDate, fold } from '../dom';
import { api } from '../api';
import { store, reload, canEdit, options, labelOf, imagesOf, characterById, characterByName, locationByName, backlinks } from '../store';
import { createList } from '../list';
import { createGallery } from '../gallery';
import { createMiniMap } from '../minimap';
import { field, input, select, markdown, tracker } from '../form';

const STATUS_ICON = { alive: '🙂', dead: '💀', undead: '🧟', missing: '❔', unknown: '🤷' };

export function charactersView(app) {
    let current = null;
    const detail = h('section.detail');
    const list = createList({
        noun: 'characters',
        newLabel: 'New character',
        keyOf: (c) => c.id,
        thumbOf: (c) => imagesOf(c)[0],
        titleOf: (c) => c.name,
        subtitleOf: (c) => [c.title, c.computedCurrentLocation ? `📍 ${c.computedCurrentLocation}` : ''].filter(Boolean).join(' · '),
        badgesOf: (c) => [
            h(`span.rel.rel-${c.relationship || 'unknown'}`, { title: labelOf('characterRelationships', c.relationship) }),
            h('span.pill', { title: labelOf('characterStatus', c.status) }, STATUS_ICON[c.status] || '·'),
        ],
        textOf: (c) => [c.name, c.title, c.faction, c.placeOfOrigin, c.computedCurrentLocation, labelOf('characterRelationships', c.relationship), labelOf('characterStatus', c.status), c.description, c.notes].join(' '),
        filters: [
            { id: 'rel', label: 'All relationships', options: () => options('characterRelationships'), test: (c, v) => c.relationship === v },
            { id: 'status', label: 'All status', options: () => options('characterStatus'), test: (c, v) => c.status === v },
            { id: 'faction', label: 'All factions', options: () => [...new Set(store.characters.map((c) => c.faction).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')).map((f) => ({ value: f, label: f })), test: (c, v) => c.faction === v },
        ],
        onSelect: (key) => app.go(`characters/${encodeURIComponent(key)}`),
        onNew: () => app.go('characters/new'),
    });
    const el = h('div.split', {}, list.el, detail);
    const sorted = () => [...store.characters].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const locationOptions = () => [...store.locations].map((f) => f.properties.name).sort((a, b) => a.localeCompare(b, 'de')).map((n) => ({ value: n, label: n }));

    function open(key) {
        current?.map?.destroy();
        const character = key === 'new' ? null : characterById(key);
        list.update(sorted(), character?.id || null);
        list.setNewVisible(canEdit());
        if (!key || (key !== 'new' && !character)) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: key ? `No character “${key}”.` : `${store.characters.length} characters. Pick one on the left, or press ＋ New.` })));
            current = null;
            return;
        }
        render(character);
    }

    function render(c) {
        const editable = canEdit();
        const ro = !editable;
        const d = c || { name: '', title: '', placeOfOrigin: '', status: 'alive', relationship: 'neutral', faction: '', firstMet: '', description: '', notes: '' };

        const name = input(d.name, { required: true, readOnly: ro });
        const title = input(d.title, { readOnly: ro, placeholder: 'e.g. Prinzessin von Basapo' });
        const origin = select(d.placeOfOrigin, locationOptions(), { disabled: ro, empty: '— unknown —' });
        const status = select(d.status, options('characterStatus'), { disabled: ro, empty: null });
        const relationship = select(d.relationship, options('characterRelationships'), { disabled: ro, empty: null });
        const faction = input(d.faction, { readOnly: ro, list: 'faction-list' });
        const factionList = h('datalist#faction-list', {}, [...new Set(store.characters.map((x) => x.faction).filter(Boolean))].map((f) => h('option', { value: f })));
        const firstMet = input(d.firstMet, { type: 'date', readOnly: ro });
        const description = markdown(d.description, { placeholder: 'Beschreibung… [[ verlinkt Charaktere und Orte', rows: 5 });
        const notes = markdown(d.notes, { placeholder: 'Notizen…', rows: 3 });
        description.readOnly = notes.readOnly = ro;
        const gallery = createGallery({ urls: imagesOf(d), editable, onChange: () => track.check() });

        const read = () => ({
            name: name.value.trim(), title: title.value.trim(), placeOfOrigin: origin.value, status: status.value,
            relationship: relationship.value, faction: faction.value.trim(), firstMet: firstMet.value,
            description: description.value, notes: notes.value, images: gallery.get(),
        });
        const state = h('span.save-state');
        const saveBtn = h('button.btn.primary', { type: 'button', disabled: true, title: 'Save (Ctrl+S)', on: { click: () => save() } }, 'Save');
        const track = tracker(read, (dirty) => { saveBtn.disabled = !dirty; state.textContent = dirty ? '● unsaved changes' : ''; });

        async function save() {
            const v = read();
            if (!v.name) return toast('A character needs a name', 'warn');
            const clash = characterByName(v.name);
            if (clash && clash.id !== c?.id) return toast(`There is already a character “${clash.name}”`, 'warn');
            const body = { ...v, image: v.images[0] || '' };
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const res = c
                    ? await api(`/api/characters/${encodeURIComponent(c.id)}`, { method: 'PUT', body })
                    : await api('/api/characters', { method: 'POST', body });
                const n = res.linksUpdated || {};
                await reload('characters', ...(n.locations ? ['locations'] : []));
                track.reset();
                toast(`Saved “${v.name}”${n.locations || n.characters ? ` · links updated in ${(n.locations || 0) + (n.characters || 0)} entries` : ''}`);
                if (res.linksWarning) toast(res.linksWarning, 'warn', 8000);
                app.go(`characters/${encodeURIComponent(res.character?.id || c?.id || '')}`, { force: true });
            } catch (err) {
                toast(`Not saved: ${err.message}`, 'bad', 7000);
                saveBtn.disabled = false;
            } finally {
                saveBtn.textContent = 'Save';
            }
        }

        async function remove() {
            if (!(await confirmDialog(`Delete the character “${d.name}” with all movements? Links to it will show as missing.`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/characters/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
                await reload('characters');
                track.reset();
                toast(`Deleted “${d.name}”`);
                app.go('characters', { force: true });
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        const path = c ? movementPath(c) : [];
        const map = createMiniMap({ point: path.length === 1 ? path[0] : (path.length ? null : originPoint(d)), path });
        const refs = c ? backlinks(d.name) : [];
        const refChip = (r) => h('a.chip', { href: r.kind === 'character' ? `#/characters/${encodeURIComponent(r.id)}` : `#/locations/${encodeURIComponent(r.name)}` }, r.kind === 'character' ? '👤 ' : '📍 ', r.name);
        const cover = imagesOf(d)[0];

        const form = h('form.detail-body', { on: { input: () => track.check(), change: () => track.check(), submit: (e) => { e.preventDefault(); save(); } } },
            h('div.grid', {},
                field('Name', name), field('Title / role', title),
                field('Relationship', relationship), field('Status', status),
                field('Faction', h('div', {}, faction, factionList)), field('Place of origin', origin),
                field('First met', firstMet)),
            field('Description', description, { wide: true }),
            field('Notes', notes, { wide: true }),
            h('div.field.wide', {}, h('span.field-label', { text: 'Images' }), gallery.el));

        detail.replaceChildren(
            h('header.detail-head', {},
                cover ? h('div.detail-cover', {}, h('img', { src: cover, alt: '' })) : h('div.detail-cover.empty', { text: '👤' }),
                h('div.detail-title', {}, h('h2', { text: d.name || 'New character' }),
                    h('span.muted', {}, c ? [h(`span.rel.rel-${d.relationship}`), ` ${labelOf('characterRelationships', d.relationship)} · ${labelOf('characterStatus', d.status)}${d.title ? ` · ${d.title}` : ''}`] : 'not saved yet')),
                h('span.spacer'), state,
                editable && c ? h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete') : null,
                editable ? saveBtn : h('span.muted', { text: 'Log in to edit' })),
            h('div.detail-cols', {},
                h('div.detail-main', {}, form, c ? movementsSection(c, editable) : h('p.muted.pad', { text: 'Movements can be added once the character is saved.' })),
                h('aside.detail-side', {},
                    h('div.side-block', {}, h('h3', { text: c?.computedCurrentLocation ? `Now: ${c.computedCurrentLocation}` : 'On the map' }), map.el),
                    c ? h('div.side-block', {}, h('h3', { text: `Mentioned in (${refs.length})` }),
                        refs.length ? h('p.side-row', {}, refs.map(refChip)) : h('p.muted', { text: 'No text links here yet.' })) : null,
                    c ? h('div.side-block.meta', {}, h('p.muted', { text: `ID ${c.id} · created ${formatDate(c.createdAt)} · updated ${formatDate(c.updatedAt)}` })) : null)));

        current = { key: c?.id || 'new', track, save, map };
        if (!c) name.focus();
    }

    // ---------- movements ----------

    function movementsSection(c, editable) {
        const box = h('section.movements');
        const sortedMoves = () => [...(characterById(c.id)?.movementHistory || [])].sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));

        function draw(editingId = null) {
            const moves = sortedMoves();
            const rows = moves.map((m, i) => (m.id === editingId ? editRow(m) : h('tr', {},
                h('td.num', { text: i + 1 }),
                h('td.nowrap', { text: [m.dateStart || m.date, m.dateEnd].filter(Boolean).join(' – ') }),
                h('td', {}, m.isCustomLocation || !m.location ? h('span.muted', { text: `(${(m.coordinates || []).join(', ')})` }) : h('a', { href: `#/locations/${encodeURIComponent(m.location)}` }, m.location)),
                h('td', { text: labelOf('movementTypes', m.type) }),
                h('td.notes', { text: m.notes || '' }),
                h('td.actions', {}, editable ? [
                    h('button.icon', { type: 'button', title: 'Edit', on: { click: () => draw(m.id) } }, '✎'),
                    h('button.icon.danger', { type: 'button', title: 'Delete', on: { click: () => removeMove(m) } }, '✕')] : null))));
            if (editingId === 'new') rows.push(editRow(null));
            box.replaceChildren(
                h('div.section-head', {}, h('h3', { text: `Movements (${moves.length})` }), h('span.spacer'),
                    editable && editingId === null ? h('button.btn.small', { type: 'button', on: { click: () => draw('new') } }, '＋ Movement') : null),
                moves.length || editingId ? h('table.table', {}, h('thead', {}, h('tr', {}, ['#', 'When', 'Where', 'Type', 'Notes', ''].map((t) => h('th', { text: t })))), h('tbody', {}, rows))
                    : h('p.muted', { text: 'No movements yet: the character stays at the place of origin.' }));
        }

        function editRow(m) {
            const start = input(m?.dateStart || m?.date || '', { type: 'date', required: true });
            const end = input(m?.dateEnd || '', { type: 'date' });
            const custom = !!(m?.isCustomLocation);
            const where = input(custom ? '' : (m?.location || ''), { list: 'location-list', placeholder: 'Location' });
            const cx = input(custom ? m.coordinates?.[0] : '', { type: 'number', placeholder: 'X' });
            const cy = input(custom ? m.coordinates?.[1] : '', { type: 'number', placeholder: 'Y' });
            const datalist = h('datalist#location-list', {}, locationOptions().map((o) => h('option', { value: o.value })));
            const type = select(m?.type || 'travel', options('movementTypes'), { empty: null });
            const notes = input(m?.notes || '', { placeholder: 'Notes' });
            const ok = h('button.btn.primary.small', { type: 'button' }, m ? 'Save' : 'Add');
            ok.addEventListener('click', async () => {
                const useCustom = !where.value.trim() && cx.value !== '' && cy.value !== '';
                if (!start.value) return toast('A movement needs a start date', 'warn');
                if (!useCustom && !locationByName(where.value)) return toast('Pick a known location — or leave it empty and enter X / Y', 'warn');
                const body = {
                    dateStart: start.value, dateEnd: end.value || null, type: type.value, notes: notes.value.trim(),
                    ...(useCustom ? { isCustomLocation: true, location: null, coordinates: [Number(cx.value), Number(cy.value)] }
                        : { isCustomLocation: false, location: locationByName(where.value).properties.name }),
                };
                ok.disabled = true;
                try {
                    await api(`/api/characters/${encodeURIComponent(c.id)}/movements${m ? `/${encodeURIComponent(m.id)}` : ''}`, { method: m ? 'PUT' : 'POST', body });
                    await reload('characters');
                    toast(m ? 'Movement saved' : 'Movement added');
                    afterMovementChange();
                } catch (err) { toast(`Not saved: ${err.message}`, 'bad', 7000); ok.disabled = false; }
            });
            return h('tr.editing', {},
                h('td.num', { text: '›' }),
                h('td.nowrap', {}, start, end),
                h('td', {}, where, datalist, h('div.pair', {}, cx, cy)),
                h('td', {}, type),
                h('td', {}, notes),
                h('td.actions', {}, ok, h('button.btn.small', { type: 'button', on: { click: () => draw() } }, 'Cancel')));
        }

        async function removeMove(m) {
            if (!(await confirmDialog(`Delete the movement on ${m.dateStart || m.date} (${m.location || 'custom position'})?`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/characters/${encodeURIComponent(c.id)}/movements/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
                await reload('characters');
                toast('Movement deleted');
                afterMovementChange();
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        // The main form may hold unsaved edits: then only the table is redrawn, otherwise the whole view (map, "now")
        function afterMovementChange() {
            if (current?.track.isDirty()) draw();
            else open(c.id);
        }

        draw();
        return box;
    }

    return {
        el,
        open,
        focusSearch: () => list.focusSearch(),
        isDirty: () => !!current?.track.isDirty(),
        save: () => current?.save(),
        refresh(key) { if (!current?.track.isDirty()) open(key); else list.update(sorted(), key); },
    };
}

// [x, y] points of a character's movements in time order (custom coordinates or the location's)
function movementPath(c) {
    return [...(c.movementHistory || [])]
        .sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date))
        .map((m) => (Array.isArray(m.coordinates) ? m.coordinates : locationByName(m.location)?.geometry?.coordinates))
        .filter((p) => Array.isArray(p));
}

function originPoint(c) {
    return locationByName(c.placeOfOrigin)?.geometry?.coordinates || null;
}

export const findCharacter = (name) => store.characters.find((c) => fold(c.name) === fold(name));
