// Glossary: terms that are neither characters nor locations — factions, spells, objects, customs, events …
// List (image, category) and the selected term: name, aliases (other names that link to it), category, description
// with [[links]], images, and which texts mention it (also by an alias). Stored in public/data/glossary.json.
import { h, toast, confirmDialog, formatDate } from '../dom';
import { api } from '../api';
import { store, reload, canEdit, imagesOf, termById, termByName, backlinks, characterByName, locationByName } from '../store';
import { createList } from '../list';
import { createGallery } from '../gallery';
import { field, input, markdown, tracker } from '../form';

export function glossaryView(app) {
    let current = null;
    const detail = h('section.detail');
    const categories = () => [...new Set(store.terms.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const list = createList({
        noun: 'terms',
        newLabel: 'New term',
        keyOf: (t) => t.id,
        thumbOf: (t) => imagesOf(t)[0],
        titleOf: (t) => t.name,
        subtitleOf: (t) => [t.category, (t.aliases || []).length ? `auch: ${t.aliases.join(', ')}` : ''].filter(Boolean).join(' · '),
        badgesOf: () => [],
        textOf: (t) => [t.name, ...(t.aliases || []), t.category, t.description].join(' '),
        filters: [{ id: 'cat', label: 'All categories', options: () => categories().map((c) => ({ value: c, label: c })), test: (t, v) => t.category === v }],
        onSelect: (key) => app.go(`glossary/${encodeURIComponent(key)}`),
        onNew: () => app.go('glossary/new'),
    });
    const el = h('div.split', {}, list.el, detail);

    function open(key) {
        current = null;
        const term = key && key !== 'new' ? termById(key) : null;
        list.update(store.terms, term?.id || null);
        list.setNewVisible(canEdit());
        if (!key || (key !== 'new' && !term)) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: key ? 'No such term.' : `${store.terms.length} terms. Factions, spells, objects, customs … — anything that is neither a character nor a place.` })));
            return;
        }
        render(term);
    }

    function render(t) {
        const editable = canEdit();
        const ro = !editable;
        const d = t || { name: '', aliases: [], category: '', description: '' };
        const name = input(d.name, { required: true, readOnly: ro });
        const aliases = input((d.aliases || []).join(', '), { readOnly: ro, placeholder: 'Other names, comma-separated — [[alias]] links here too' });
        const category = input(d.category, { readOnly: ro, list: 'term-categories', placeholder: 'e.g. Fraktion, Zauber, Gegenstand' });
        const catList = h('datalist#term-categories', {}, categories().map((c) => h('option', { value: c })));
        const description = markdown(d.description, { placeholder: 'Beschreibung… [[ verlinkt Charaktere, Orte und Begriffe', rows: 8 });
        description.readOnly = ro;
        const gallery = createGallery({ urls: imagesOf(d), editable, onChange: () => track.check() });

        const read = () => ({
            name: name.value.trim(),
            aliases: aliases.value.split(',').map((a) => a.trim()).filter(Boolean),
            category: category.value.trim(),
            description: description.value,
            images: gallery.get(),
        });
        const state = h('span.save-state');
        const saveBtn = h('button.btn.primary', { type: 'button', disabled: true, title: 'Save (Ctrl+S)', on: { click: () => save() } }, 'Save');
        const track = tracker(read, (dirty) => { saveBtn.disabled = !dirty; state.textContent = dirty ? '● unsaved changes' : ''; });

        async function save() {
            const v = read();
            if (!v.name) return toast('A term needs a name', 'warn');
            const clash = [v.name, ...v.aliases].map((n) => characterByName(n) || locationByName(n)).find(Boolean);
            if (clash && !(await confirmDialog(`“${clash.name || clash.properties?.name}” is also a character or location: [[links]] of that name would go there. Save anyway?`, { ok: 'Save' }))) return;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const res = t ? await api(`/api/glossary/${encodeURIComponent(t.id)}`, { method: 'PUT', body: { ...v, image: v.images[0] || '' } })
                    : await api('/api/glossary', { method: 'POST', body: { ...v, image: v.images[0] || '' } });
                const n = res.linksUpdated || {};
                const others = (n.locations || 0) + (n.characters || 0) + (n.terms || 0) + (n.protocols || 0);
                await reload('terms', ...(n.locations ? ['locations'] : []), ...(n.characters ? ['characters'] : []));
                track.reset();
                toast(`Saved “${v.name}”${others ? ` · links updated in ${others} entries` : ''}`);
                if (res.linksWarning) toast(res.linksWarning, 'warn', 8000);
                app.go(`glossary/${encodeURIComponent(res.term.id)}`, { force: true });
            } catch (err) {
                toast(`Not saved: ${err.message}`, 'bad', 7000);
                saveBtn.disabled = false;
            } finally {
                saveBtn.textContent = 'Save';
            }
        }

        async function remove() {
            if (!(await confirmDialog(`Delete the term “${d.name}”? Links to it will show as missing.`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/glossary/${encodeURIComponent(t.id)}`, { method: 'DELETE' });
                await reload('terms');
                track.reset();
                toast(`Deleted “${d.name}”`);
                app.go('glossary', { force: true });
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        // mentions under the name or any alias
        const refs = t ? [...new Map([t.name, ...(t.aliases || [])].flatMap((n) => backlinks(n)).filter((r) => r.id !== t.id).map((r) => [`${r.kind}:${r.name}`, r])).values()] : [];
        const href = (r) => ({ character: `#/characters/${encodeURIComponent(r.id)}`, location: `#/locations/${encodeURIComponent(r.name)}`, term: `#/glossary/${encodeURIComponent(r.id)}` })[r.kind];
        const icon = { character: '👤 ', location: '📍 ', term: '📖 ' };
        const cover = imagesOf(d)[0];

        const form = h('form.detail-body', { on: { input: () => track.check(), change: () => track.check(), submit: (e) => { e.preventDefault(); save(); } } },
            h('div.grid', {}, field('Name', name), field('Category', h('div', {}, category, catList))),
            field('Aliases', aliases, { wide: true }),
            field('Description', description, { wide: true }),
            h('div.field.wide', {}, h('span.field-label', { text: 'Images' }), gallery.el));

        detail.replaceChildren(
            h('header.detail-head', {},
                cover ? h('div.detail-cover', {}, h('img', { src: cover, alt: '' })) : h('div.detail-cover.empty', { text: '📖' }),
                h('div.detail-title', {}, h('h2', { text: d.name || 'New term' }), h('span.muted', { text: t ? d.category || 'Glossary' : 'not saved yet' })),
                h('span.spacer'), state,
                editable && t ? h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete') : null,
                editable ? saveBtn : h('span.muted', { text: 'Log in to edit' })),
            h('div.detail-cols', {},
                form,
                h('aside.detail-side', {},
                    t ? h('div.side-block', {}, h('h3', { text: `Mentioned in (${refs.length})` }),
                        refs.length ? h('p.side-row', {}, refs.map((r) => h('a.chip', { href: href(r) }, icon[r.kind], r.name))) : h('p.muted', { text: 'No text links here yet.' })) : null,
                    t ? h('div.side-block.meta', {}, h('p.muted', { text: `Created ${formatDate(t.createdAt)} by ${t.createdBy || '?'} · updated ${formatDate(t.updatedAt)} by ${t.updatedBy || '?'}` })) : null)));

        current = { key: t?.id || 'new', track, save };
        if (!t) name.focus();
    }

    return {
        el,
        open,
        focusSearch: () => list.focusSearch(),
        isDirty: () => !!current?.track.isDirty(),
        save: () => current?.save(),
    };
}

export { termByName };
