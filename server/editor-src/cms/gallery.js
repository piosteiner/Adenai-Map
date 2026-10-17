// Images of a location or character: a gallery field (first = cover; reorder, remove, add), the picker dialog
// (multi-select from the media library, upload right there) and a hover preview for every small image.
import { h, toast, fold } from './dom';
import { store, reload, mediumOf } from './store';
import { api } from './api';

export function createGallery({ urls = [], onChange, editable = true }) {
    let list = [...urls];
    const el = h('div.gallery');

    function set(next, notify = true) {
        list = [...new Set(next.filter(Boolean))];
        render();
        if (notify) onChange?.(list);
    }

    function move(i, to) {
        const next = [...list];
        const [item] = next.splice(i, 1);
        if (to !== null) next.splice(to, 0, item);
        set(next);
    }

    function render() {
        el.replaceChildren(...list.map((url, i) => h(`figure.gallery-item${i === 0 ? '.cover' : ''}`, {},
            h('img', { src: url, alt: '', loading: 'lazy', dataset: { preview: 'gallery' } }),
            i === 0 ? h('span.badge', { title: 'Shown first: portrait / popup image' }, '★ Cover') : null,
            editable ? h('div.gallery-actions', {},
                i > 0 ? h('button', { type: 'button', title: 'Make cover', on: { click: () => move(i, 0) } }, '★') : null,
                i > 0 ? h('button', { type: 'button', title: 'Move left', on: { click: () => move(i, i - 1) } }, '←') : null,
                i < list.length - 1 ? h('button', { type: 'button', title: 'Move right', on: { click: () => move(i, i + 1) } }, '→') : null,
                h('button', { type: 'button', title: 'Remove', on: { click: () => move(i, null) } }, '✕')) : null)));
        if (editable) {
            el.append(h('button.gallery-add', { type: 'button', title: 'Add images', on: { click: async () => {
                const picked = await pickImages({ already: list });
                if (picked.length) set([...list, ...picked]);
            } } }, '＋'));
        }
        if (!list.length && !editable) el.append(h('span.muted', { text: 'No images' }));
    }

    render();
    return { el, get: () => [...list], set: (next) => set(next, false) };
}

// ---------- picker ----------

// Promise<string[]> of image URLs (the small size, as stored on entries)
export function pickImages({ already = [] } = {}) {
    return new Promise((resolve) => {
        const inGallery = new Set(already);
        const chosen = [];
        const urlOf = (m) => m.sizes?.small?.url || m.sizes?.medium?.url || m.sizes?.original?.url;

        const search = h('input.search', { type: 'search', placeholder: 'Search title, caption, credits, tags…' });
        const category = h('select', {}, h('option', { value: '' }, 'All categories'),
            ...['characters', 'locations', 'maps', 'items', 'creatures', 'sessions', 'general'].map((c) => h('option', { value: c }, c)));
        const addBtn = h('button.btn.primary', { type: 'button', disabled: true, on: { click: () => close(chosen) } }, 'Add');
        const grid = h('div.picker-grid');
        const uploadBox = uploadForm(async (uploaded) => {
            await reload('media');
            uploaded.forEach((m) => { const u = urlOf(m); if (u && !chosen.includes(u)) chosen.push(u); });
            render();
        });

        function render() {
            const q = fold(search.value);
            const items = Object.values(store.media)
                .filter((m) => urlOf(m))
                .filter((m) => !category.value || m.category === category.value)
                .filter((m) => !q || fold([m.title, m.caption, m.credits, m.category, ...(m.tags || [])].join(' ')).includes(q))
                .sort((a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || '')));
            grid.replaceChildren(...items.map((m) => {
                const url = urlOf(m);
                const there = inGallery.has(url);
                const picked = chosen.includes(url);
                return h(`button.picker-item${there ? '.there' : ''}${picked ? '.picked' : ''}`, {
                    type: 'button', disabled: there, title: [m.title, m.caption, m.credits].filter(Boolean).join('\n'),
                    on: { click: () => {
                        const i = chosen.indexOf(url);
                        if (i >= 0) chosen.splice(i, 1); else chosen.push(url);
                        render();
                    } },
                }, h('img', { src: url, alt: '', loading: 'lazy', dataset: { preview: 'picker' } }),
                h('span.picker-caption', { text: m.title || m.caption || m.id }),
                there ? h('span.picker-flag', { text: '✓ in gallery' }) : picked ? h('span.picker-flag.on', { text: `#${chosen.indexOf(url) + 1}` }) : null);
            }));
            if (!items.length) grid.append(h('p.empty-note', { text: 'No images match.' }));
            addBtn.disabled = !chosen.length;
            addBtn.textContent = chosen.length ? `Add ${chosen.length} image${chosen.length === 1 ? '' : 's'}` : 'Add';
        }

        const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); close([]); } };
        const overlay = h('div.overlay', { on: { mousedown: (e) => { if (e.target === overlay) close([]); } } },
            h('div.dialog.picker', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Select images' },
                h('div.dialog-head', {}, h('strong', { text: 'Select images' }), search, category,
                    h('span.spacer'), h('button.btn', { type: 'button', on: { click: () => close([]) } }, 'Cancel'), addBtn),
                uploadBox, grid));
        function close(result) {
            overlay.remove();
            document.removeEventListener('keydown', key, true);
            resolve(result);
        }
        search.addEventListener('input', render);
        category.addEventListener('change', render);
        document.addEventListener('keydown', key, true);
        document.body.append(overlay);
        render();
        search.focus();
    });
}

// "Upload new" inside the picker: files + credits (required by the server) + category
function uploadForm(onUploaded) {
    const files = h('input', { type: 'file', accept: 'image/*', multiple: true });
    const credits = h('input', { type: 'text', placeholder: 'Credits (required), e.g. "AI generated – GPT5"' });
    const category = h('select', {}, ...['locations', 'characters', 'maps', 'items', 'creatures', 'sessions', 'general'].map((c) => h('option', { value: c }, c)));
    const go = h('button.btn.small', { type: 'button' }, 'Upload');
    go.addEventListener('click', async () => {
        if (!files.files.length) return toast('Choose one or more image files first', 'warn');
        if (!credits.value.trim()) return toast('Credits are required', 'warn');
        const form = new FormData();
        [...files.files].forEach((f) => form.append('images', f));
        form.append('credits', credits.value.trim());
        form.append('category', category.value);
        go.disabled = true;
        go.textContent = 'Uploading…';
        try {
            const res = await api('/api/media/upload', { method: 'POST', form });
            toast(`Uploaded ${res.totalProcessed} image(s)`);
            files.value = '';
            await onUploaded(res.media || []);
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'bad');
        } finally {
            go.disabled = false;
            go.textContent = 'Upload';
        }
    });
    return h('details.upload', {}, h('summary', { text: 'Upload new images' }), h('div.upload-row', {}, files, credits, category, go));
}

// ---------- hover preview ----------

// Any image with data-preview, or a list thumbnail, shows its 600 px version beside it while hovered.
export function installHoverPreview() {
    const box = h('div.hover-preview', { hidden: true }, h('img', { alt: '' }));
    document.body.append(box);
    const big = box.firstChild;
    let current = null;
    const SELECTOR = 'img[data-preview], .row img.thumb, .detail-cover img';

    function place(target) {
        const r = target.getBoundingClientRect();
        const w = box.offsetWidth;
        const hgt = box.offsetHeight;
        const left = r.right + 12 + w <= window.innerWidth ? r.right + 12 : Math.max(8, r.left - 12 - w);
        const top = Math.min(Math.max(8, r.top + r.height / 2 - hgt / 2), window.innerHeight - hgt - 8);
        Object.assign(box.style, { left: `${left}px`, top: `${top}px` });
    }
    document.addEventListener('mouseover', (e) => {
        const img = e.target.closest?.(SELECTOR);
        if (!img || img === current) return;
        current = img;
        big.onload = () => { if (current === img) { box.hidden = false; place(img); } };
        big.onerror = () => { if (current === img && big.src !== img.src) big.src = img.src; };
        big.src = mediumOf(img.currentSrc || img.src).replace(/-thumb\.webp$/, '-medium.webp');
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target === current && !current.contains(e.relatedTarget)) { current = null; box.hidden = true; }
    });
    ['click', 'scroll', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { current = null; box.hidden = true; }, true));
}
