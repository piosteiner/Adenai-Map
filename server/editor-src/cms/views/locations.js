// Locations: list (cover, type, region, visited) and the selected location — fields, description with [[links]],
// images, position on the mini map, characters from / at the place, and which texts mention it.
import { h, toast, confirmDialog, fold } from '../dom';
import { api } from '../api';
import { store, reload, canEdit, options, labelOf, imagesOf, locationByName, charactersAt, backlinks } from '../store';
import { createList } from '../list';
import { createGallery } from '../gallery';
import { createMiniMap } from '../minimap';
import { field, input, select, checkbox, markdown, tracker, autosaver } from '../form';

export function locationsView(app) {
    let current = null; // { key, track, save, map }
    const detail = h('section.detail');
    const list = createList({
        noun: 'locations',
        newLabel: 'New location',
        keyOf: (f) => f.properties.name,
        thumbOf: (f) => imagesOf(f.properties)[0],
        titleOf: (f) => f.properties.name,
        subtitleOf: (f) => [labelOf('locationTypes', f.properties.type), labelOf('locationRegions', f.properties.region)].filter(Boolean).join(' · '),
        badgesOf: (f) => [
            f.properties.visited ? h('span.pill.ok', { title: 'Visited by the party' }, '✓') : null,
            imagesOf(f.properties).length > 1 ? h('span.pill', { title: 'Images' }, `🖼 ${imagesOf(f.properties).length}`) : null,
        ],
        searchDoc: (f) => ({ name: f.properties.name, fields: [
            { label: 'Type', text: labelOf('locationTypes', f.properties.type), weight: 2 }, { label: 'Region', text: labelOf('locationRegions', f.properties.region), weight: 2 },
            { label: 'Description', text: f.properties.description, weight: 1 }] }),
        textOf: (f) => [f.properties.name, f.properties.type, labelOf('locationTypes', f.properties.type), f.properties.region, labelOf('locationRegions', f.properties.region), f.properties.description].join(' '),
        filters: [
            { id: 'type', label: 'All types', options: () => options('locationTypes'), test: (f, v) => f.properties.type === v },
            { id: 'region', label: 'All regions', options: () => options('locationRegions'), test: (f, v) => f.properties.region === v },
            { id: 'visited', label: 'Visited or not', options: () => [{ value: 'yes', label: '✓ visited' }, { value: 'no', label: 'not visited' }], test: (f, v) => !!f.properties.visited === (v === 'yes') },
        ],
        onSelect: (key) => app.go(`locations/${encodeURIComponent(key)}`),
        onNew: () => app.go('locations/new'),
    });
    const el = h('div.split', {}, list.el, detail);

    function sorted() {
        return [...store.locations].sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'de'));
    }

    function open(key) {
        current?.map?.destroy();
        const feature = key === 'new' ? null : locationByName(key);
        list.update(sorted(), feature?.properties.name || null);
        list.setNewVisible(canEdit());
        if (key && key !== 'new' && !feature) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: `No location “${key}”.` })));
            current = null;
            return;
        }
        if (!key) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: `${store.locations.length} locations. Pick one on the left, or press ＋ New.` })));
            current = null;
            return;
        }
        render(feature);
    }

    function render(feature) {
        const p = feature?.properties || { name: '', type: '', region: '', visited: false, description: '' };
        const [x0, y0] = feature?.geometry?.coordinates || ['', ''];
        const editable = canEdit();
        const ro = !editable;

        const name = input(p.name, { required: true, readOnly: ro, placeholder: 'Name' });
        const type = select(p.type, options('locationTypes'), { disabled: ro });
        const region = select(p.region, options('locationRegions'), { disabled: ro });
        const x = input(x0, { type: 'number', readOnly: ro, step: '1' });
        const y = input(y0, { type: 'number', readOnly: ro, step: '1' });
        const visited = checkbox(p.visited, 'visited by the party');
        visited.box.disabled = ro;
        const description = markdown(p.description, { placeholder: 'Description… [[ links to characters and places', rows: 6 });
        description.readOnly = ro;
        const gallery = createGallery({ urls: imagesOf(p), editable, onChange: () => (auto ? auto.changed() : track.check()) });
        const map = createMiniMap({
            point: Number.isFinite(+x0) && x0 !== '' ? [x0, y0] : null,
            editable,
            onPick: ([px, py]) => { x.value = px; y.value = py; if (auto) auto.changed(); else track.check(); },
        });
        [x, y].forEach((i) => i.addEventListener('change', () => map.setPoint([x.value, y.value])));

        const read = () => ({
            name: name.value.trim(), type: type.value, region: region.value, visited: visited.box.checked,
            description: description.value, images: gallery.get(), x: x.value, y: y.value,
        });
        const status = h('span.save-state');
        // a new location is created on purpose (Create); an existing one saves itself (autosaver, form.js)
        const saveBtn = h('button.btn.primary', { type: 'button', disabled: true, title: 'Create (Ctrl+S)', on: { click: () => save() } }, 'Create');
        const track = tracker(read, (dirty) => {
            saveBtn.disabled = !dirty;
            if (!auto) status.textContent = dirty ? '● unsaved changes' : '';
        });
        let auto = null;
        const headTitle = h('h2', { text: p.name || 'New location' });
        const headSub = h('span.muted', { text: feature ? [labelOf('locationTypes', p.type), labelOf('locationRegions', p.region)].filter(Boolean).join(' · ') : 'not saved yet' });

        // an existing location: saved as it is edited (the name is its address: a renamed one moves, references follow)
        async function persist(v) {
            if (!v.name) throw new Error('a location needs a name');
            if (!Number.isFinite(parseInt(v.x, 10)) || !Number.isFinite(parseInt(v.y, 10))) throw new Error('set the position: click the map or enter X and Y');
            const clash = locationByName(v.name);
            if (clash && clash !== feature) throw new Error(`there is already a location “${clash.properties.name}”`);
            const before = feature.properties.name;
            const body = {
                type: 'Feature',
                properties: { ...(feature.properties || {}), name: v.name, type: v.type, region: v.region, visited: v.visited, description: v.description, images: v.images, image: v.images[0] || '' },
                geometry: { type: 'Point', coordinates: [parseInt(v.x, 10), parseInt(v.y, 10)] },
            };
            const res = await api(`/api/locations/${encodeURIComponent(before)}`, { method: 'PUT', body });
            const n = res.linksUpdated || {};
            await reload('locations', ...(n.characters ? ['characters'] : []));
            if (n.locations || n.characters) toast(`“${v.name}”: references updated in ${(n.locations || 0) + (n.characters || 0)} entries`);
            if (res.linksWarning) toast(res.linksWarning, 'warn', 8000);
            if (v.name !== before) { track.reset(v); app.go(`locations/${encodeURIComponent(v.name)}`, { force: true }); return; }
            feature = locationByName(v.name) || feature;   // the reloaded entry: the next save builds on it
            headTitle.textContent = v.name;
            headSub.textContent = [labelOf('locationTypes', v.type), labelOf('locationRegions', v.region)].filter(Boolean).join(' · ');
            list.update(sorted(), v.name);
        }
        if (feature && editable) {
            auto = autosaver({ read, track, persist, state: status });
            name.addEventListener('change', async (e) => {
                const v = name.value.trim();
                const linked = backlinks(p.name).length;
                if (!v || v === p.name || !linked) return;
                e.stopImmediatePropagation();
                if (await confirmDialog(`Rename “${p.name}” to “${v}”? The references in ${linked} entr${linked === 1 ? 'y' : 'ies'} follow the new name.`, { ok: 'Rename' })) auto.changed(0);
                else { name.value = p.name; track.check(); }
            });
        }
        const form = h('form.detail-body', { on: { input: () => track.check(), change: () => track.check(), submit: (e) => { e.preventDefault(); save(); } } });

        async function save() {
            if (auto) return auto.flush(); // an existing location: save now what is waiting (Ctrl+S, Enter)
            const v = read();
            if (!v.name) return toast('A location needs a name', 'warn');
            if (!Number.isFinite(parseInt(v.x, 10)) || !Number.isFinite(parseInt(v.y, 10))) return toast('Set the position: click the map or enter X and Y', 'warn');
            const clash = locationByName(v.name);
            if (clash && clash !== feature) return toast(`There is already a location “${clash.properties.name}”`, 'warn');
            const body = {
                type: 'Feature',
                properties: { ...(feature?.properties || {}), name: v.name, type: v.type, region: v.region, visited: v.visited, description: v.description, images: v.images, image: v.images[0] || '' },
                geometry: { type: 'Point', coordinates: [parseInt(v.x, 10), parseInt(v.y, 10)] },
            };
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const res = feature
                    ? await api(`/api/locations/${encodeURIComponent(feature.properties.name)}`, { method: 'PUT', body })
                    : await api('/api/locations', { method: 'POST', body });
                const n = res.linksUpdated || {};
                await reload('locations', ...(n.characters ? ['characters'] : []));
                track.reset();
                toast(`Saved “${v.name}”${n.locations || n.characters ? ` · references updated in ${(n.locations || 0) + (n.characters || 0)} entries` : ''}`);
                if (res.linksWarning) toast(res.linksWarning, 'warn', 8000);
                app.go(`locations/${encodeURIComponent(v.name)}`, { force: true });
            } catch (err) {
                toast(`Not saved: ${err.message}`, 'bad', 7000);
                saveBtn.disabled = false;
            } finally {
                saveBtn.textContent = 'Save';
            }
        }

        async function remove() {
            if (!(await confirmDialog(`Delete the location “${p.name}”? Links to it will show as missing.`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/locations/${encodeURIComponent(p.name)}`, { method: 'DELETE' });
                await reload('locations');
                track.reset();
                toast(`Deleted “${p.name}”`);
                app.go('locations', { force: true });
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        const here = feature ? charactersAt(p.name) : { origin: [], current: [] };
        const refs = feature ? backlinks(p.name) : [];
        const chip = (c) => h('a.chip', { href: `#/characters/${encodeURIComponent(c.id)}` }, c.name);
        const refChip = (r) => h('a.chip', { href: r.kind === 'character' ? `#/characters/${encodeURIComponent(r.id)}` : r.kind === 'term' ? `#/glossary/${encodeURIComponent(r.id)}` : `#/locations/${encodeURIComponent(r.name)}` }, { character: '👤 ', term: '📖 ', location: '📍 ' }[r.kind], r.name);
        const cover = imagesOf(p)[0];

        form.append(
            h('div.grid', {},
                field('Name', name),
                field('Type', type),
                field('Region', region),
                field('Position', h('div.pair', {}, x, y), { hint: 'X / Y — or click the map' }),
                h('div.field', {}, h('span.field-label', { text: 'Status' }), visited.el)),
            field('Description', description, { wide: true }),
            h('div.field.wide', {}, h('span.field-label', { text: 'Images' }), gallery.el));

        detail.replaceChildren(
            h('header.detail-head', {},
                cover ? h('div.detail-cover', {}, h('img', { src: cover, alt: '' })) : h('div.detail-cover.empty', { text: '📍' }),
                h('div.detail-title', {}, headTitle, headSub),
                h('span.spacer'), status,
                feature ? h('a.btn.ghost', { href: `https://adenai.piogino.ch/`, target: '_blank', rel: 'noopener', title: 'Open the public map' }, 'Map ↗') : null,
                editable && feature ? h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete') : null,
                editable ? (feature ? null : saveBtn) : h('span.muted', { text: 'Log in to edit' })),
            h('div.detail-cols', {},
                form,
                h('aside.detail-side', {},
                    h('div.side-block', {}, h('h3', { text: 'On the map' }), map.el),
                    feature ? h('div.side-block', {}, h('h3', { text: `Characters (${new Set([...here.origin, ...here.current]).size})` }),
                        here.current.length ? h('p.side-row', {}, h('span.muted', { text: 'Here now: ' }), here.current.map(chip)) : null,
                        here.origin.length ? h('p.side-row', {}, h('span.muted', { text: 'From here: ' }), here.origin.map(chip)) : null,
                        !here.current.length && !here.origin.length ? h('p.muted', { text: 'None.' }) : null) : null,
                    feature ? h('div.side-block', {}, h('h3', { text: `Mentioned in (${refs.length})` }),
                        refs.length ? h('p.side-row', {}, refs.map(refChip)) : h('p.muted', { text: 'No text links here yet.' })) : null)));

        if (auto) auto.attach(form);
        current = { key: feature?.properties.name || 'new', track, save, map, flush: () => (auto ? auto.flush() : Promise.resolve(!track.isDirty())) };
        if (!feature) name.focus();
    }

    return {
        el,
        open,
        focusSearch: () => list.focusSearch(),
        isDirty: () => !!current?.track.isDirty(),
        // before leaving: save what is waiting (true: nothing left unsaved)
        flush: () => current?.flush() ?? Promise.resolve(true),
        save: () => current?.save(),
        refresh(key) { if (!current?.track.isDirty()) open(key); else list.update(sorted(), key); },
    };
}

export const findLocation = (name) => store.locations.find((f) => fold(f.properties.name) === fold(name));
