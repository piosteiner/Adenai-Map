// Media: the image library (public/data/media-library.json, files in server/uploads/optimized). A grid of all images
// with search and category; dropping files anywhere on the grid (or "Upload") uploads them with a progress bar; the
// selected image shows its sizes and where it is used, and its title, caption, credits, category and tags can be
// edited. Deleting asks first — and says if characters, locations or glossary terms still show the image.
import { h, toast, confirmDialog, formatDate } from '../dom';
import { tracker, autosaver } from '../form';
import { store, reload, canEdit } from '../store';
import { api } from '../api';

const CATEGORIES = ['characters', 'locations', 'items', 'creatures', 'maps', 'sessions', 'general'];
const SIZE_ORDER = ['thumbnail', 'small', 'medium', 'large', 'original'];
const OFTEN = 16; // "Often used": at most this many

// "Tag lists…": the groups of tags to click (server: routes/tag-groups.js, public/data/media-tag-groups.json) — a name,
// the image categories it is offered for, its tags (comma separated); reordered with ↑ ↓. Saved as a whole.
async function editTagLists() {
    const lists = (store.config.mediaTagGroups || []).map((g) => ({ ...g }));
    const body = h('div.tag-lists');
    const row = (g, i) => {
        const name = h('input', { type: 'text', value: g.label, placeholder: 'Name, e.g. Ancestry', 'aria-label': 'Name of the list', on: { input: (e) => { g.label = e.target.value; } } });
        const cats = CATEGORIES.map((c) => h('label.tag-list-cat', {}, h('input', { type: 'checkbox', checked: g.categories.includes(c), on: { change: (e) => { g.categories = e.target.checked ? [...g.categories, c] : g.categories.filter((x) => x !== c); } } }), c));
        const tags = h('textarea', { rows: 2, placeholder: 'tags, comma separated', 'aria-label': `Tags of ${g.label || 'the list'}`, on: { input: (e) => { g.tags = e.target.value.split(','); } } }, g.tags.join(', '));
        const move = (d) => { const j = i + d; if (j < 0 || j >= lists.length) return; [lists[i], lists[j]] = [lists[j], lists[i]]; draw(); };
        return h('div.tag-list', {},
            h('div.tag-list-head', {}, name,
                h('button.icon', { type: 'button', title: 'Up', disabled: i === 0, on: { click: () => move(-1) } }, '↑'),
                h('button.icon', { type: 'button', title: 'Down', disabled: i === lists.length - 1, on: { click: () => move(1) } }, '↓'),
                h('button.icon', { type: 'button', title: 'Remove the list', on: { click: () => { lists.splice(i, 1); draw(); } } }, '✕')),
            h('div.tag-list-cats', {}, h('span.muted', { text: 'for ' }), cats),
            tags);
    };
    const draw = () => body.replaceChildren(...lists.map(row), lists.length ? '' : h('p.muted', { text: 'No lists — add one.' }));
    draw();
    return new Promise((resolve) => {
        const close = (v) => { overlay.remove(); resolve(v); };
        async function save() {
            try {
                const res = await api('/api/media-tag-groups', { method: 'PUT', body: { groups: lists.map((g) => ({ ...g, tags: g.tags })) } });
                store.config.mediaTagGroups = res.groups;
                toast('Tag lists saved');
                close(true);
            } catch (err) { toast(err.message, 'warn', 6000); }
        }
        const overlay = h('div.overlay', {}, h('div.dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tag lists' },
            h('h3', { text: 'Tag lists' }),
            h('p.muted', { text: 'The tags to click beside an image’s tags, for the categories ticked. Tags are saved in lower case. Tags used twice or more show under “Often used” anyway.' }),
            h('div.tag-lists-scroll', {}, body),
            h('div.dialog-actions', {},
                h('button.btn', { type: 'button', on: { click: () => { lists.push({ label: '', categories: ['characters'], tags: [] }); draw(); body.lastElementChild?.querySelector('input')?.focus(); } } }, '＋ Add list'),
                h('span', { style: { flex: '1' } }),
                h('button.btn', { type: 'button', on: { click: () => close(false) } }, 'Cancel'),
                h('button.btn.primary', { type: 'button', on: { click: save } }, 'Save'))));
        document.body.append(overlay);
    });
}

// Tags to click beside the tags field: the groups of the category (server config mediaTagGroups: gender, age, ancestry)
// and the tags used most often on images of that category. A click sets or removes the tag in the field (whatever its
// case: "Human" counts as "human") and fires "change", so the autosaver saves it as if typed. Follows the field and
// the category as they change.
function tagPicks(input, categoryOf) {
    const el = h('div.tag-picks');
    const fold = (t) => t.trim().toLowerCase();
    const current = () => input.value.split(',').map((t) => t.trim()).filter(Boolean);
    function toggle(tag) {
        const list = current();
        const has = list.some((t) => fold(t) === fold(tag));
        input.value = (has ? list.filter((t) => fold(t) !== fold(tag)) : [...list, tag]).join(', ');
        input.dispatchEvent(new Event('change', { bubbles: true }));
        draw();
    }
    // the tags of this category's images, most used first, in their most used spelling
    function often(category, skip) {
        const counts = new Map();
        for (const m of Object.values(store.media || {})) {
            if ((m.category || 'general') !== category) continue;
            for (const t of m.tags || []) {
                const k = fold(t);
                if (!k || skip.has(k)) continue;
                const c = counts.get(k) || { n: 0, forms: new Map() };
                c.n += 1;
                c.forms.set(t.trim(), (c.forms.get(t.trim()) || 0) + 1);
                counts.set(k, c);
            }
        }
        return [...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, OFTEN)
            .map((c) => [...c.forms].sort((a, b) => b[1] - a[1])[0][0]);
    }
    function draw() {
        const category = categoryOf();
        const set = new Set(current().map(fold));
        const groups = (store.config.mediaTagGroups || []).filter((g) => (g.categories || []).includes(category));
        const inGroups = new Set(groups.flatMap((g) => g.tags.map(fold)));
        const row = (label, tags) => h('div.tag-pick-row', {}, h('span.tag-pick-label', { text: label }),
            tags.map((t) => h(`button.tag-pick${set.has(fold(t)) ? '.on' : ''}`, { type: 'button', 'aria-pressed': String(set.has(fold(t))), on: { click: () => toggle(t) } }, t)));
        const more = often(category, inGroups);
        el.replaceChildren(...groups.map((g) => row(g.label, g.tags)), more.length ? row('Often used', more) : '');
    }
    input.addEventListener('input', draw);
    // tags are lower case, each once (as the server writes them): the field shows it once it is left — before the
    // autosaver reads it (the form's "change" comes after the field's own). No redraw: which tags are on doesn't
    // change, and a click on a tag (which is what left the field) needs its button to stay.
    input.addEventListener('change', () => {
        const tidy = [...new Set(current().map(fold))].join(', ');
        if (tidy !== input.value) input.value = tidy;
    });
    draw();
    return { el, draw };
}

const baseOf = (m) => {
    const f = Object.values(m.sizes || {})[0]?.filename || '';
    return f.replace(/-(thumb|small|medium|large|original)\.\w+$/, '');
};
const urlOf = (m, size = 'small') => m.sizes?.[size]?.url || m.sizes?.medium?.url || Object.values(m.sizes || {})[0]?.url || '';

// characters, locations and glossary terms that show the image (in their image list or in a text)
function usageOf(m) {
    const base = baseOf(m);
    if (!base) return [];
    const uses = (entity, texts = []) => [...(entity.images || []), entity.image, ...texts].some((x) => typeof x === 'string' && x.includes(`/media/${base}-`));
    return [
        ...store.characters.filter((c) => uses(c, [c.description, c.notes])).map((c) => ({ kind: 'character', name: c.name, href: `#/characters/${encodeURIComponent(c.id)}` })),
        ...store.locations.filter((f) => uses(f.properties || {}, [f.properties?.description])).map((f) => ({ kind: 'location', name: f.properties.name, href: `#/locations/${encodeURIComponent(f.properties.name)}` })),
        ...store.terms.filter((t) => uses(t, [t.description])).map((t) => ({ kind: 'term', name: t.name, href: `#/glossary/${encodeURIComponent(t.id)}` })),
    ];
}

// multipart upload with progress (fetch has none)
function upload(files, fields, onProgress) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        [...files].forEach((f) => form.append('images', f));
        Object.entries(fields).forEach(([k, v]) => form.append(k, v));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/media/upload');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onload = () => {
            let data = null;
            try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
            if (xhr.status >= 200 && xhr.status < 300 && data?.success !== false) resolve(data);
            else reject(new Error(data?.error || `Server answered ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
    });
}

export function mediaView(app) {
    let selected = null;
    let current = null; // the open image: { track, save, flush }
    let query = '';
    let category = '';
    const search = h('input.search', { type: 'search', placeholder: 'Search title, caption, credits, tags…  ( / )', 'aria-label': 'Search media', on: { input: (e) => { query = e.target.value; draw(); } } });
    const catSelect = h('select', { 'aria-label': 'Category', on: { change: (e) => { category = e.target.value; draw(); } } },
        h('option', { value: '' }, 'All categories'), ...CATEGORIES.map((c) => h('option', { value: c }, c)));
    // "No tags yet": the images still to tag, with the category above; the open one stays in the grid while it gets
    // its tags, so the grid doesn't jump under the hand (it goes when another is opened)
    let untaggedOnly = false;
    const untaggedOpt = h('option', { value: 'untagged' }, 'No tags yet');
    const tagSelect = h('select', { 'aria-label': 'Tag filter', on: { change: (e) => { untaggedOnly = e.target.value === 'untagged'; draw(); } } },
        h('option', { value: '' }, 'Any tags'), untaggedOpt);
    const count = h('span.count');
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, on: { change: () => { const files = [...fileInput.files]; fileInput.value = ''; if (files.length) startUpload(files); } } });
    const uploadBtn = h('button.btn.primary.small', { type: 'button', on: { click: () => fileInput.click() } }, '＋ Upload');
    const listsBtn = h('button.btn.small', { type: 'button', title: 'The tags to click beside an image’s tags',
        on: { click: async () => { if (!canEdit()) return toast('Log in to change the tag lists', 'warn'); if (await editTagLists()) current?.redrawPicks?.(); } } }, 'Tag lists…');
    const progress = h('div.media-progress', { hidden: true }, h('div.media-progress-bar'), h('span.media-progress-text'));
    const grid = h('div.media-grid', { role: 'listbox', 'aria-label': 'Images' });
    const detail = h('section.detail.media-detail');
    const listCol = h('div.media-col', {}, h('div.media-toolbar', {}, search, catSelect, tagSelect, uploadBtn, listsBtn, fileInput), progress, h('div.media-sub', {}, count, h('span.muted', { text: ' · drop image files here to upload' })), grid);
    const el = h('div.split.media-split', {}, listCol, detail);

    // dropping files on the library uploads them
    listCol.addEventListener('dragover', (e) => { if (canEdit() && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); listCol.classList.add('dropping'); } });
    listCol.addEventListener('dragleave', (e) => { if (!listCol.contains(e.relatedTarget)) listCol.classList.remove('dropping'); });
    listCol.addEventListener('drop', (e) => {
        listCol.classList.remove('dropping');
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        startUpload([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
    });

    const items = () => {
        const all = Object.values(store.media || {})
            .filter((m) => !category || m.category === category)
            .filter((m) => !untaggedOnly || !(m.tags || []).length || m.id === selected)
            .sort((a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || '')));
        if (!query.trim()) return all;
        return window.AdenaiSearch.rank(all, query, (m) => ({ name: m.title || m.id, aliases: m.tags || [], fields: [
            { label: 'Caption', text: m.caption, weight: 2 }, { label: 'Credits', text: m.credits, weight: 1 }, { label: 'Category', text: m.category, weight: 1 }, { label: 'Id', text: m.id, weight: 1 },
            // where it is used: "Petrel" finds his portrait
            { label: 'Used by', text: usageOf(m).map((u) => u.name).join(', '), weight: 2 }] })).map((r) => r.item);
    };

    function draw() {
        const list = items();
        // how many are still to tag, in the category chosen
        untaggedOpt.textContent = `No tags yet (${Object.values(store.media || {}).filter((m) => (!category || m.category === category) && !(m.tags || []).length).length})`;
        count.textContent = `${list.length} image${list.length === 1 ? '' : 's'}`;
        grid.replaceChildren(...list.map((m) => h('button.media-card', {
            type: 'button', role: 'option', 'aria-selected': String(m.id === selected), title: m.title || m.caption || m.id,
            dataset: { id: m.id }, on: { click: () => app.go(`media/${encodeURIComponent(m.id)}`) },
        }, h('img', { src: urlOf(m, 'thumbnail'), alt: '', loading: 'lazy' }),
            // no tags yet: a dot in the corner, so they can be found without opening each (gone once it has one)
            (m.tags || []).length ? null : h('span.media-card-untagged', { role: 'img', title: 'No tags yet', 'aria-label': 'No tags yet' }),
            h('span.media-card-title', { text: m.title || m.caption || m.id }), h('span.media-card-cat', { text: m.category || '' }))));
        if (!list.length) grid.append(h('p.empty-note', { text: Object.keys(store.media || {}).length ? 'Nothing matches.' : 'No images yet.' }));
    }

    async function startUpload(files) {
        if (!canEdit()) return toast('Log in to upload', 'warn');
        if (!files.length) return;
        // credits are required by the server; title and category for all files of this upload
        const credits = h('input', { type: 'text', placeholder: 'e.g. "AI generated – GPT5" or the artist', required: true, value: localStorage.getItem('adenai-cms-credits') || '' });
        const cat = h('select', {}, ...CATEGORIES.map((c) => h('option', { value: c }, c)));
        cat.value = category || 'general';
        const tags = h('input', { type: 'text', placeholder: 'comma separated (optional)' });
        const picks = tagPicks(tags, () => cat.value);
        cat.addEventListener('change', picks.draw);
        const ok = await new Promise((resolve) => {
            const close = (v) => { overlay.remove(); resolve(v); };
            const go = h('button.btn.primary', { type: 'button', on: { click: () => { if (!credits.value.trim()) { credits.focus(); return toast('Credits are required', 'warn'); } close(true); } } }, `Upload ${files.length} image${files.length === 1 ? '' : 's'}`);
            const overlay = h('div.overlay', {}, h('div.dialog', { role: 'dialog', 'aria-modal': 'true' },
                h('h3', { text: 'Upload images' }),
                h('p.muted', { text: [...files].map((f) => f.name).join(', ') }),
                h('label.field', {}, h('span.field-label', { text: 'Credits *' }), credits),
                h('div.grid', {}, h('label.field', {}, h('span.field-label', { text: 'Category' }), cat), h('label.field', {}, h('span.field-label', { text: 'Tags' }), tags)),
                picks.el,
                h('div.dialog-actions', {}, h('button.btn', { type: 'button', on: { click: () => close(false) } }, 'Cancel'), go)));
            document.body.append(overlay);
            credits.focus();
        });
        if (!ok) return;
        try { localStorage.setItem('adenai-cms-credits', credits.value.trim()); } catch { /* private mode */ }
        progress.hidden = false;
        const bar = progress.querySelector('.media-progress-bar');
        const text = progress.querySelector('.media-progress-text');
        const set = (f, label) => { bar.style.width = `${Math.round(f * 100)}%`; text.textContent = label; };
        set(0, `Uploading ${files.length} image${files.length === 1 ? '' : 's'}… 0%`);
        try {
            const res = await upload(files, { credits: credits.value.trim(), category: cat.value, tags: tags.value }, (f) => set(f * 0.9, f < 1 ? `Uploading… ${Math.round(f * 100)}%` : 'Optimising and saving…'));
            set(1, 'Done');
            await reload('media');
            toast(`Uploaded ${res.totalProcessed} image${res.totalProcessed === 1 ? '' : 's'}`);
            const first = res.media?.[0]?.id;
            if (first) app.go(`media/${encodeURIComponent(first)}`, { force: true });
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'bad', 8000);
        } finally {
            setTimeout(() => { progress.hidden = true; }, 1200);
        }
    }

    function render(m) {
        const ro = !canEdit();
        const title = h('input', { type: 'text', value: m.title || '', readOnly: ro });
        const caption = h('textarea', { rows: 3, readOnly: ro }, m.caption || '');
        const credits = h('input', { type: 'text', value: m.credits || '', readOnly: ro, required: true });
        const cat = h('select', { disabled: ro }, ...CATEGORIES.map((c) => h('option', { value: c }, c)));
        cat.value = m.category || 'general';
        const tags = h('input', { type: 'text', value: (m.tags || []).join(', '), readOnly: ro, placeholder: 'comma separated' });
        const picks = tagPicks(tags, () => cat.value);
        cat.addEventListener('change', picks.draw);
        const used = usageOf(m);
        const sizes = SIZE_ORDER.filter((s) => m.sizes?.[s]).map((s) => {
            const z = m.sizes[s];
            return h('span.media-size', {}, h('a', { href: z.url, target: '_blank', rel: 'noopener' }, `${s} ${z.width || '?'}×${z.height || '?'}`),
                h('button.icon', { type: 'button', title: 'Copy the address', on: { click: () => navigator.clipboard?.writeText(z.url).then(() => toast('Address copied')) } }, '⧉'));
        });

        // saved as it is edited (autosaver, form.js): a field once it is left, the caption after a pause in typing
        const read = () => ({ title: title.value.trim(), caption: caption.value.trim(), credits: credits.value.trim(), category: cat.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean) });
        const state = h('span.save-state');
        const headTitle = h('h2', { text: m.title || m.id });
        const track = tracker(read, () => {});
        async function persist(v) {
            if (!v.credits) throw new Error('credits are required');
            await api(`/api/media/${encodeURIComponent(m.id)}`, { method: 'PUT', body: v });
            await reload('media');
            headTitle.textContent = v.title || m.id;
            draw();
        }
        const auto = ro ? null : autosaver({ read, track, persist, state });
        const save = () => auto?.flush();
        const form = h('form.detail-body', { on: { submit: (e) => { e.preventDefault(); save(); } } },
            h('label.field', {}, h('span.field-label', { text: 'Title' }), title),
            h('label.field', {}, h('span.field-label', { text: 'Caption' }), caption),
            h('label.field', {}, h('span.field-label', { text: 'Credits *' }), credits),
            h('div.grid', {}, h('label.field', {}, h('span.field-label', { text: 'Category' }), cat), h('label.field', {}, h('span.field-label', { text: 'Tags' }), tags)),
            ro ? null : picks.el);
        auto?.attach(form);
        current = { track, save, flush: () => (auto ? auto.flush() : Promise.resolve(true)), redrawPicks: picks.draw };
        async function remove() {
            const warn = used.length ? ` It is still shown by ${used.map((u) => u.name).join(', ')} — they would show a broken image.` : '';
            if (!(await confirmDialog(`Delete “${m.title || m.id}” and its files?${warn}`, { ok: 'Delete', danger: true }))) return;
            try {
                await api(`/api/media/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
                await reload('media');
                toast('Deleted');
                app.go('media', { force: true });
            } catch (err) { toast(`Not deleted: ${err.message}`, 'bad', 7000); }
        }

        detail.replaceChildren(
            h('header.detail-head', {},
                h('div.detail-title', {}, headTitle, h('span.muted', { text: `${m.category || ''} · uploaded ${formatDate(m.uploadDate)}${m.fileSize ? ` · ${Math.round(m.fileSize / 1024)} KB original` : ''}` })),
                h('span.spacer'), state,
                ro ? null : h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete')),
            h('div.media-detail-body', {},
                h('a.media-preview', { href: urlOf(m, 'large'), target: '_blank', rel: 'noopener', title: 'Open the large version' }, h('img', { src: urlOf(m, 'medium'), alt: m.title || '' })),
                h('div.media-sizes', {}, sizes),
                form,
                h('div.side-block', {}, h('h3', { text: `Used by (${used.length})` }),
                    used.length ? h('p.side-row', {}, used.map((u) => h('a.chip', { href: u.href }, `${{ character: '👤', location: '📍', term: '📖' }[u.kind]} ${u.name}`))) : h('p.muted', { text: 'Not used by any character, location or glossary term.' }))));
    }

    function open(key) {
        selected = key || null;
        current = null;
        draw();
        const m = key ? store.media?.[key] : null;
        if (m) {
            render(m);
            grid.querySelector(`[data-id="${CSS.escape(m.id)}"]`)?.scrollIntoView({ block: 'nearest' });
        } else {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: key ? 'No such image.' : `${Object.keys(store.media || {}).length} images. Pick one, or drop image files on the list to upload them.` })));
        }
    }

    return {
        el, open, focusSearch: () => search.focus(),
        isDirty: () => !!current?.track.isDirty(),
        save: () => current?.save(),
        // before leaving: save what is waiting (true: nothing left unsaved)
        flush: () => current?.flush() ?? Promise.resolve(true),
        async reloadAll() { await reload('media'); },
    };
}
