// Media: the image library (public/data/media-library.json, files in server/uploads/optimized). A grid of all images
// with search and category; dropping files anywhere on the grid (or "Upload") uploads them with a progress bar; the
// selected image shows its sizes and where it is used, and its title, caption, credits, category and tags can be
// edited. Deleting asks first — and says if characters, locations or glossary terms still show the image.
import { h, toast, confirmDialog, formatDate, fold } from '../dom';
import { store, reload, canEdit } from '../store';
import { api } from '../api';

const CATEGORIES = ['characters', 'locations', 'items', 'creatures', 'maps', 'sessions', 'general'];
const SIZE_ORDER = ['thumbnail', 'small', 'medium', 'large', 'original'];

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
    let query = '';
    let category = '';
    const search = h('input.search', { type: 'search', placeholder: 'Search title, caption, credits, tags…  ( / )', 'aria-label': 'Search media', on: { input: (e) => { query = e.target.value; draw(); } } });
    const catSelect = h('select', { 'aria-label': 'Category', on: { change: (e) => { category = e.target.value; draw(); } } },
        h('option', { value: '' }, 'All categories'), ...CATEGORIES.map((c) => h('option', { value: c }, c)));
    const count = h('span.count');
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, on: { change: () => { const files = [...fileInput.files]; fileInput.value = ''; if (files.length) startUpload(files); } } });
    const uploadBtn = h('button.btn.primary.small', { type: 'button', on: { click: () => fileInput.click() } }, '＋ Upload');
    const progress = h('div.media-progress', { hidden: true }, h('div.media-progress-bar'), h('span.media-progress-text'));
    const grid = h('div.media-grid', { role: 'listbox', 'aria-label': 'Images' });
    const detail = h('section.detail.media-detail');
    const listCol = h('div.media-col', {}, h('div.media-toolbar', {}, search, catSelect, uploadBtn, fileInput), progress, h('div.media-sub', {}, count, h('span.muted', { text: ' · drop image files here to upload' })), grid);
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

    const items = () => Object.values(store.media || {})
        .filter((m) => !category || m.category === category)
        .filter((m) => !query || fold([m.title, m.caption, m.credits, m.category, ...(m.tags || []), m.id].join(' ')).includes(fold(query)))
        .sort((a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || '')));

    function draw() {
        const list = items();
        count.textContent = `${list.length} image${list.length === 1 ? '' : 's'}`;
        grid.replaceChildren(...list.map((m) => h('button.media-card', {
            type: 'button', role: 'option', 'aria-selected': String(m.id === selected), title: m.title || m.caption || m.id,
            dataset: { id: m.id }, on: { click: () => app.go(`media/${encodeURIComponent(m.id)}`) },
        }, h('img', { src: urlOf(m, 'thumbnail'), alt: '', loading: 'lazy' }), h('span.media-card-title', { text: m.title || m.caption || m.id }), h('span.media-card-cat', { text: m.category || '' }))));
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
        const ok = await new Promise((resolve) => {
            const close = (v) => { overlay.remove(); resolve(v); };
            const go = h('button.btn.primary', { type: 'button', on: { click: () => { if (!credits.value.trim()) { credits.focus(); return toast('Credits are required', 'warn'); } close(true); } } }, `Upload ${files.length} image${files.length === 1 ? '' : 's'}`);
            const overlay = h('div.overlay', {}, h('div.dialog', { role: 'dialog', 'aria-modal': 'true' },
                h('h3', { text: 'Upload images' }),
                h('p.muted', { text: [...files].map((f) => f.name).join(', ') }),
                h('label.field', {}, h('span.field-label', { text: 'Credits *' }), credits),
                h('div.grid', {}, h('label.field', {}, h('span.field-label', { text: 'Category' }), cat), h('label.field', {}, h('span.field-label', { text: 'Tags' }), tags)),
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
        const used = usageOf(m);
        const sizes = SIZE_ORDER.filter((s) => m.sizes?.[s]).map((s) => {
            const z = m.sizes[s];
            return h('span.media-size', {}, h('a', { href: z.url, target: '_blank', rel: 'noopener' }, `${s} ${z.width || '?'}×${z.height || '?'}`),
                h('button.icon', { type: 'button', title: 'Copy the address', on: { click: () => navigator.clipboard?.writeText(z.url).then(() => toast('Address copied')) } }, '⧉'));
        });

        async function save() {
            if (!credits.value.trim()) return toast('Credits are required', 'warn');
            try {
                await api(`/api/media/${encodeURIComponent(m.id)}`, { method: 'PUT', body: { title: title.value.trim(), caption: caption.value.trim(), credits: credits.value.trim(), category: cat.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean) } });
                await reload('media');
                toast('Saved');
                app.go(`media/${encodeURIComponent(m.id)}`, { force: true });
            } catch (err) { toast(`Not saved: ${err.message}`, 'bad', 7000); }
        }
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
                h('div.detail-title', {}, h('h2', { text: m.title || m.id }), h('span.muted', { text: `${m.category || ''} · uploaded ${formatDate(m.uploadDate)}${m.fileSize ? ` · ${Math.round(m.fileSize / 1024)} KB original` : ''}` })),
                h('span.spacer'),
                ro ? null : h('button.btn.ghost.danger', { type: 'button', on: { click: remove } }, 'Delete'),
                ro ? null : h('button.btn.primary', { type: 'button', on: { click: save } }, 'Save')),
            h('div.media-detail-body', {},
                h('a.media-preview', { href: urlOf(m, 'large'), target: '_blank', rel: 'noopener', title: 'Open the large version' }, h('img', { src: urlOf(m, 'medium'), alt: m.title || '' })),
                h('div.media-sizes', {}, sizes),
                h('form.detail-body', { on: { submit: (e) => { e.preventDefault(); save(); } } },
                    h('label.field', {}, h('span.field-label', { text: 'Title' }), title),
                    h('label.field', {}, h('span.field-label', { text: 'Caption' }), caption),
                    h('label.field', {}, h('span.field-label', { text: 'Credits *' }), credits),
                    h('div.grid', {}, h('label.field', {}, h('span.field-label', { text: 'Category' }), cat), h('label.field', {}, h('span.field-label', { text: 'Tags' }), tags))),
                h('div.side-block', {}, h('h3', { text: `Used by (${used.length})` }),
                    used.length ? h('p.side-row', {}, used.map((u) => h('a.chip', { href: u.href }, `${{ character: '👤', location: '📍', term: '📖' }[u.kind]} ${u.name}`))) : h('p.muted', { text: 'Not used by any character, location or glossary term.' }))));
    }

    function open(key) {
        selected = key || null;
        draw();
        const m = key ? store.media?.[key] : null;
        if (m) {
            render(m);
            grid.querySelector(`[data-id="${CSS.escape(m.id)}"]`)?.scrollIntoView({ block: 'nearest' });
        } else {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: key ? 'No such image.' : `${Object.keys(store.media || {}).length} images. Pick one, or drop image files on the list to upload them.` })));
        }
    }

    return { el, open, focusSearch: () => search.focus(), isDirty: () => false, save: () => {}, async reloadAll() { await reload('media'); } };
}
