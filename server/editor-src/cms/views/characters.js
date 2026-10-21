// Characters: list (portrait, title, relationship, status) and the selected character — fields, description and
// notes with [[links]], images, movements (add / edit / delete inline), the path on the mini map, mentions.
import { h, toast, confirmDialog, formatDate, fold } from '../dom';
import { api } from '../api';
import { store, reload, canEdit, options, labelOf, imagesOf, characterById, characterByName, locationByName, backlinks } from '../store';
import { createList } from '../list';
import { createGallery } from '../gallery';
import { createMiniMap } from '../minimap';
import { field, input, select, markdown, tracker, autosaver, searchPicker } from '../form';

// In-game calendar: the campaign starts on 3 June 5663. Date pickers open in 5663 (min), never at today's real date.
export const CAMPAIGN_START = '5663-06-03';
const CAMPAIGN_MIN = '5663-01-01';

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
        searchDoc: (c) => ({ name: c.name, fields: [
            { label: 'Title', text: c.title, weight: 3 }, { label: 'Faction', text: c.faction, weight: 2 },
            { label: 'Location', text: [c.computedCurrentLocation, c.placeOfOrigin].filter(Boolean).join(' · '), weight: 2 },
            { label: 'Relationship', text: labelOf('characterRelationships', c.relationship), weight: 1.5 }, { label: 'Status', text: labelOf('characterStatus', c.status), weight: 1.5 },
            { label: 'Description', text: c.description, weight: 1 }, { label: 'Notes', text: c.notes, weight: 1 }] }),
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
        // the place of origin: typed and found (the site's search), chosen from the locations
        const origin = searchPicker(d.placeOfOrigin, () => store.locations.map((f) => ({ name: f.properties.name,
            detail: [labelOf('locationTypes', f.properties.type), labelOf('locationRegions', f.properties.region)].filter(Boolean).join(' · ') }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de')), { readOnly: ro, placeholder: 'Search a place…' });
        const status = select(d.status, options('characterStatus'), { disabled: ro, empty: null });
        const relationship = select(d.relationship, options('characterRelationships'), { disabled: ro, empty: null });
        const faction = input(d.faction, { readOnly: ro, list: 'faction-list' });
        const factionList = h('datalist#faction-list', {}, [...new Set(store.characters.map((x) => x.faction).filter(Boolean))].map((f) => h('option', { value: f })));
        const firstMet = input(d.firstMet, { type: 'date', readOnly: ro, min: CAMPAIGN_MIN });
        const description = markdown(d.description, { placeholder: 'Beschreibung… [[ verlinkt Charaktere und Orte', rows: 5 });
        const notes = markdown(d.notes, { placeholder: 'Notizen…', rows: 3 });
        description.readOnly = notes.readOnly = ro;
        // the cover, large beside the form (as big as the map below it) — follows the gallery: a new cover, a removed one
        const portrait = h('div.side-block.portrait');
        const drawPortrait = (urls) => {
            const url = urls[0];
            portrait.replaceChildren(url
                ? h('a.portrait-link', { href: url, target: '_blank', rel: 'noopener', title: 'Open the image' }, h('img', { src: url, alt: d.name ? `Portrait of ${d.name}` : '' }))
                : h('div.portrait-empty', {}, h('span', { text: '👤' }), h('span.muted', { text: editable ? 'No image yet — add one under Images.' : 'No image yet.' })));
        };
        drawPortrait(imagesOf(d));
        const gallery = createGallery({ urls: imagesOf(d), editable, onChange: (list) => { drawPortrait(list); if (auto) auto.changed(); else track.check(); } });

        const read = () => ({
            name: name.value.trim(), title: title.value.trim(), placeOfOrigin: origin.value, status: status.value,
            relationship: relationship.value, faction: faction.value.trim(), firstMet: firstMet.value,
            description: description.value, notes: notes.value, images: gallery.get(),
        });
        const state = h('span.save-state');
        // a new character is created on purpose (Create); an existing one saves itself (autosaver, form.js)
        const saveBtn = h('button.btn.primary', { type: 'button', disabled: true, title: 'Create (Ctrl+S)', on: { click: () => save() } }, 'Create');
        const track = tracker(read, (dirty) => { saveBtn.disabled = !dirty; if (!auto) state.textContent = dirty ? '● unsaved changes' : ''; });
        let auto = null;
        const headTitle = h('h2', { text: d.name || 'New character' });
        const headSub = h('span.muted');
        const drawHead = (v) => {
            headTitle.textContent = v.name || 'New character';
            headSub.replaceChildren(...(c ? [h(`span.rel.rel-${v.relationship}`), ` ${labelOf('characterRelationships', v.relationship)} · ${labelOf('characterStatus', v.status)}${v.title ? ` · ${v.title}` : ''}`] : ['not saved yet']));
        };
        drawHead(d);

        // an existing character: saved as it is edited (a renamed one moves to its new address: links follow)
        async function persist(v) {
            if (!v.name) throw new Error('a character needs a name');
            const clash = characterByName(v.name);
            if (clash && clash.id !== c.id) throw new Error(`there is already a character “${clash.name}”`);
            const res = await api(`/api/characters/${encodeURIComponent(c.id)}`, { method: 'PUT', body: { ...v, image: v.images[0] || '' } });
            const n = res.linksUpdated || {};
            await reload('characters', ...(n.locations ? ['locations'] : []));
            if (n.locations || n.characters) toast(`“${v.name}”: links updated in ${(n.locations || 0) + (n.characters || 0)} entries`);
            if (res.linksWarning) toast(res.linksWarning, 'warn', 8000);
            const id = res.character?.id || c.id;
            if (id !== c.id) { track.reset(v); app.go(`characters/${encodeURIComponent(id)}`, { force: true }); return; }
            drawHead(v);
            list.update(sorted(), c.id);
        }
        if (c && editable) {
            auto = autosaver({ read, track, persist, state });
            // a new name renames: with links to it, asked first (they all follow the new name)
            name.addEventListener('change', async (e) => {
                const v = name.value.trim();
                const linked = backlinks(d.name).length;
                if (!v || v === d.name || !linked) return;
                e.stopImmediatePropagation();
                if (await confirmDialog(`Rename “${d.name}” to “${v}”? The links in ${linked} entr${linked === 1 ? 'y' : 'ies'} follow the new name.`, { ok: 'Rename' })) auto.changed(0);
                else { name.value = d.name; track.check(); }
            });
        }

        async function save() {
            if (auto) return auto.flush(); // an existing character: save now what is waiting (Ctrl+S, Enter)
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
        const refChip = (r) => h('a.chip', { href: r.kind === 'character' ? `#/characters/${encodeURIComponent(r.id)}` : r.kind === 'term' ? `#/glossary/${encodeURIComponent(r.id)}` : `#/locations/${encodeURIComponent(r.name)}` }, { character: '👤 ', term: '📖 ', location: '📍 ' }[r.kind], r.name);
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
                h('div.detail-title', {}, headTitle, headSub),
                h('span.spacer'), state,
                editable && c ? h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete') : null,
                editable ? (c ? null : saveBtn) : h('span.muted', { text: 'Log in to edit' })),
            h('div.detail-cols', {},
                h('div.detail-main', {}, form, c ? movementsSection(c, editable) : h('p.muted.pad', { text: 'Movements can be added once the character is saved.' })),
                h('aside.detail-side', {},
                    portrait,
                    h('div.side-block', {}, h('h3', { text: c?.computedCurrentLocation ? `Now: ${c.computedCurrentLocation}` : 'On the map' }), map.el),
                    c ? h('div.side-block', {}, h('h3', { text: `Mentioned in (${refs.length})` }),
                        refs.length ? h('p.side-row', {}, refs.map(refChip)) : h('p.muted', { text: 'No text links here yet.' })) : null,
                    c ? h('div.side-block.meta', {}, h('p.muted', { text: `ID ${c.id} · created ${formatDate(c.createdAt)} · updated ${formatDate(c.updatedAt)}` })) : null)));

        if (auto) auto.attach(form);
        current = { key: c?.id || 'new', track, save, map, flush: () => (auto ? auto.flush() : Promise.resolve(!track.isDirty())) };
        if (!c) name.focus();
    }

    // ---------- movements ----------

    function movementsSection(c, editable) {
        const box = h('section.movements');
        // The stored order (drag & drop changes it; the map follows it among movements of the same date)
        const sortedMoves = () => [...(characterById(c.id)?.movementHistory || [])];
        let dragFrom = null;

        async function reorder(from, to) {
            const moves = sortedMoves();
            const [m] = moves.splice(from, 1);
            moves.splice(to, 0, m);
            try {
                await api(`/api/characters/${encodeURIComponent(c.id)}/movements/reorder`, { method: 'PUT', body: { movements: moves.map((x) => ({ id: x.id })) } });
                await reload('characters');
                const t = (x) => new Date(x.dateStart || x.date).getTime();
                const outOfDateOrder = moves.some((x, i) => i > 0 && t(x) < t(moves[i - 1]));
                toast(outOfDateOrder ? 'Order saved — but the dates now run backwards: the map follows the dates, so adjust them too' : 'Order saved', outOfDateOrder ? 'warn' : 'ok', outOfDateOrder ? 7000 : 2500);
                afterMovementChange();
            } catch (err) { toast(`Order not saved: ${err.message}`, 'bad', 7000); draw(); }
        }

        // Rows can be dragged by their number cell (the handle); drop above or below another row
        function dragProps(i) {
            if (!editable) return {};
            return {
                draggable: 'true',
                on: {
                    dragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); e.currentTarget.classList.add('dragging'); },
                    dragend: (e) => { e.currentTarget.classList.remove('dragging'); box.querySelectorAll('.drop-before, .drop-after').forEach((r) => r.classList.remove('drop-before', 'drop-after')); },
                    dragover: (e) => {
                        if (dragFrom === null) return;
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > r.top + r.height / 2;
                        e.currentTarget.classList.toggle('drop-after', after);
                        e.currentTarget.classList.toggle('drop-before', !after);
                    },
                    dragleave: (e) => e.currentTarget.classList.remove('drop-before', 'drop-after'),
                    drop: (e) => {
                        e.preventDefault();
                        const after = e.currentTarget.classList.contains('drop-after');
                        e.currentTarget.classList.remove('drop-before', 'drop-after');
                        const from = dragFrom;
                        dragFrom = null;
                        let to = i + (after ? 1 : 0);
                        if (from < to) to -= 1;
                        if (from !== null && to !== from) reorder(from, to);
                    },
                },
            };
        }

        function draw(editingId = null) {
            const moves = sortedMoves();
            const rows = moves.map((m, i) => (m.id === editingId ? editRow(m) : h('tr', editingId === null ? dragProps(i) : {},
                h('td.num', { title: editable ? 'Drag to reorder' : null }, editable && editingId === null ? h('span.grip', { text: '⋮⋮' }) : null, i + 1),
                h('td.nowrap', { text: [m.dateStart || m.date, m.dateEnd].filter(Boolean).join(' – ') }),
                h('td', {}, m.isCustomLocation || !m.location ? [m.location || '', ' ', h('span.muted', { text: `(${(m.coordinates || []).join(', ')})` })] : h('a', { href: `#/locations/${encodeURIComponent(m.location)}` }, m.location)),
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
            // a new movement starts where the last one ended (or started); the first one on the campaign start
            const last = sortedMoves().at(-1);
            const start = input(m?.dateStart || m?.date || last?.dateEnd || last?.dateStart || last?.date || CAMPAIGN_START, { type: 'date', required: true, min: CAMPAIGN_MIN });
            const end = input(m?.dateEnd || '', { type: 'date', min: start.value || CAMPAIGN_MIN, title: 'Optional: until when' });
            start.addEventListener('change', () => { end.min = start.value || CAMPAIGN_MIN; });
            // A known location, or with X / Y a custom position, then the field is its name
            const custom = !!(m?.isCustomLocation);
            const where = input(m?.location || '', { list: 'location-list', placeholder: 'Location, or a name for X / Y' });
            const cx = input(custom ? m.coordinates?.[0] : '', { type: 'number', placeholder: 'X' });
            const cy = input(custom ? m.coordinates?.[1] : '', { type: 'number', placeholder: 'Y' });
            where.addEventListener('change', () => { if (locationByName(where.value)) cx.value = cy.value = ''; });
            const datalist = h('datalist#location-list', {}, locationOptions().map((o) => h('option', { value: o.value })));
            const type = select(m?.type || 'travel', options('movementTypes'), { empty: null });
            const notes = input(m?.notes || '', { placeholder: 'Notes' });
            const ok = h('button.btn.primary.small', { type: 'button' }, m ? 'Save' : 'Add');
            ok.addEventListener('click', async () => {
                const useCustom = cx.value !== '' && cy.value !== '';
                if (!start.value) return toast('A movement needs a start date', 'warn');
                if (useCustom && !where.value.trim()) return toast('A custom position needs a name', 'warn');
                if (!useCustom && !locationByName(where.value)) return toast('Pick a known location — or enter X / Y for a custom position', 'warn');
                const body = {
                    dateStart: start.value, dateEnd: end.value || null, type: type.value, notes: notes.value.trim(),
                    ...(useCustom ? { isCustomLocation: true, location: where.value.trim(), coordinates: [Number(cx.value), Number(cy.value)] }
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
        // before leaving: save what is waiting (true: nothing left unsaved)
        flush: () => current?.flush() ?? Promise.resolve(true),
        refresh(key) { if (!current?.track.isDirty()) open(key); else list.update(sorted(), key); },
    };
}

// [x, y] points of a character's movements in time order (custom coordinates or the location's)
// Each point carries .teleport when it was reached by a teleport (the mini map draws that leg dotted)
function movementPath(c) {
    return [...(c.movementHistory || [])]
        .sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date))
        .map((m) => {
            const p = Array.isArray(m.coordinates) ? m.coordinates : locationByName(m.location)?.geometry?.coordinates;
            return Array.isArray(p) ? Object.assign([...p], { teleport: m.type === 'teleport' }) : null;
        })
        .filter(Boolean);
}

function originPoint(c) {
    return locationByName(c.placeOfOrigin)?.geometry?.coordinates || null;
}

export const findCharacter = (name) => store.characters.find((c) => fold(c.name) === fold(name));
