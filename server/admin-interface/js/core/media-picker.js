// Media Picker - choose images from the media library for a location or a character.
//
// Each form has a gallery of the chosen images, in order; the first is the cover. Two hidden inputs carry it:
// name="images" (JSON list of URLs) and name="image" (the cover, which older code reads). The server keeps them
// consistent (server/lib/images.js); the map shows the cover plus thumbnails of the rest (src/utils/entity-images.js).
// Hidden inputs are not cleared by form.reset(), so forms set their gallery explicitly with setImages().
window.mediaPicker = {
    currentCallback: null,
    multiple: false,
    selected: [],
    bound: false,

    galleries: {
        character: { list: 'character-images', cover: 'character-image-url', display: 'character-image-display', add: 'select-character-image', clear: 'clear-character-image' },
        location: { list: 'location-images', cover: 'location-image-url', display: 'location-image-display', add: 'select-location-image', clear: 'clear-location-image' },
    },

    // Empty both galleries
    reset() {
        this.setImages('character', []);
        this.setImages('location', []);
    },

    init() {
        this.setupEventListeners();
    },

    // Called when a form opens: listeners once, galleries drawn from their inputs
    reinitialize() {
        this.setupEventListeners();
        this.checkExistingImages();
    },

    checkExistingImages() {
        Object.keys(this.galleries).forEach((kind) => this.render(kind));
    },

    // ---------- the gallery in a form ----------

    getImages(kind) {
        const g = this.galleries[kind];
        const list = document.getElementById(g.list);
        try {
            const parsed = JSON.parse(list?.value || '[]');
            if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
        } catch { /* fall back to the cover */ }
        const cover = document.getElementById(g.cover)?.value;
        return cover ? [cover] : [];
    },

    setImages(kind, urls) {
        const g = this.galleries[kind];
        const list = [...new Set((urls || []).filter(Boolean))];
        const listInput = document.getElementById(g.list);
        const coverInput = document.getElementById(g.cover);
        if (listInput) listInput.value = JSON.stringify(list);
        if (coverInput) coverInput.value = list[0] || '';
        this.render(kind);
    },

    addImages(kind, items) {
        this.setImages(kind, [...this.getImages(kind), ...items.map((i) => i.url)]);
    },

    // Thumbnails with: make cover, move left/right, remove; and a tile to add more
    render(kind) {
        const g = this.galleries[kind];
        const display = document.getElementById(g.display);
        if (!display) return;
        const list = this.getImages(kind);
        const clearBtn = document.getElementById(g.clear);
        if (clearBtn) clearBtn.style.display = list.length ? 'inline-block' : 'none';
        const addBtn = document.getElementById(g.add);
        if (addBtn) addBtn.textContent = list.length ? '📂 Add images' : '📂 Select images';

        if (!list.length) {
            display.classList.remove('has-gallery');
            display.innerHTML = `
                <div class="media-picker-placeholder" data-action="add">
                    <span class="media-picker-icon">🖼️</span>
                    <span class="media-picker-text">Click to select from uploaded images (several possible)</span>
                </div>`;
            return;
        }
        display.classList.add('has-gallery');
        const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        display.innerHTML = `<div class="media-gallery">${list.map((url, i) => `
            <div class="media-gallery-item${i === 0 ? ' is-cover' : ''}" data-index="${i}">
                <img src="${esc(url)}" alt="" loading="lazy">
                ${i === 0 ? '<span class="media-gallery-badge" title="Shown first, e.g. as the portrait">★ Cover</span>' : ''}
                <div class="media-gallery-actions">
                    ${i > 0 ? '<button type="button" data-action="cover" title="Make cover">★</button>' : ''}
                    ${i > 0 ? '<button type="button" data-action="left" title="Move left">←</button>' : ''}
                    ${i < list.length - 1 ? '<button type="button" data-action="right" title="Move right">→</button>' : ''}
                    <button type="button" data-action="remove" title="Remove">✕</button>
                </div>
            </div>`).join('')}
            <button type="button" class="media-gallery-add" data-action="add" title="Add images">＋</button>
        </div>
        <div class="media-gallery-hint">${list.length} image${list.length === 1 ? '' : 's'} · the first is the cover</div>`;
    },

    onGalleryClick(kind, e) {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        e.preventDefault();
        e.stopPropagation();
        if (action === 'add') {
            this.openPicker((items) => this.addImages(kind, items), { multiple: true, already: this.getImages(kind) });
            return;
        }
        const i = Number(e.target.closest('[data-index]')?.dataset.index);
        const list = this.getImages(kind);
        if (!Number.isInteger(i) || i < 0 || i >= list.length) return;
        const [item] = list.splice(i, 1);
        if (action === 'cover') list.unshift(item);
        else if (action === 'left') list.splice(i - 1, 0, item);
        else if (action === 'right') list.splice(i + 1, 0, item);
        // 'remove': already taken out
        this.setImages(kind, list);
    },

    // Older names, still used here and there
    setCharacterImage(mediaItem) { this.setImages('character', [mediaItem.url]); },
    clearCharacterImage() { this.setImages('character', []); },
    setLocationImage(mediaItem) { this.setImages('location', [mediaItem.url]); },
    clearLocationImage() { this.setImages('location', []); },

    // ---------- listeners (once: forms call reinitialize() every time they open) ----------

    setupEventListeners() {
        if (this.bound) return;
        this.bound = true;

        for (const kind of Object.keys(this.galleries)) {
            const g = this.galleries[kind];
            document.getElementById(g.add)?.addEventListener('click', () =>
                this.openPicker((items) => this.addImages(kind, items), { multiple: true, already: this.getImages(kind) }));
            document.getElementById(g.clear)?.addEventListener('click', () => this.setImages(kind, []));
            document.getElementById(g.display)?.addEventListener('click', (e) => this.onGalleryClick(kind, e));
        }

        document.getElementById('picker-confirm')?.addEventListener('click', () => this.confirmSelection());
        this.setupModalEvents();
        this.setupFilterEvents();
    },

    setupModalEvents() {
        const modal = document.getElementById('media-picker-modal');
        modal?.querySelectorAll('.close-picker-btn').forEach((btn) => btn.addEventListener('click', () => this.closePicker()));
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closePicker();
        });
    },

    setupFilterEvents() {
        const categoryFilter = document.getElementById('picker-category-filter');
        const searchInput = document.getElementById('picker-search');

        categoryFilter?.addEventListener('change', () => this.loadMediaGrid());

        // Real-time search, debounced
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.filterDisplayedItems(e.target.value.toLowerCase().trim()), 200);
        });
    },

    // Filter displayed items locally (an empty search shows all again)
    filterDisplayedItems(searchTerm) {
        const grid = document.getElementById('media-picker-grid');
        const items = grid?.querySelectorAll('.picker-media-item');
        if (!items) return;

        let visibleCount = 0;
        items.forEach((item) => {
            const matches = !searchTerm || (item.dataset.searchText || '').includes(searchTerm);
            item.style.display = matches ? 'block' : 'none';
            if (matches) visibleCount++;
        });

        grid.querySelector('.empty-search')?.remove();
        if (visibleCount === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-search';
            emptyDiv.textContent = 'No images match your search';
            emptyDiv.style.cssText = 'text-align: center; padding: 2rem; color: var(--text-secondary); grid-column: 1 / -1;';
            grid.appendChild(emptyDiv);
        }
    },

    // ---------- the picker dialog ----------

    // multiple: click several, then "Add"; already: URLs that are in the gallery (marked, not added twice)
    openPicker(callback, { multiple = false, already = [] } = {}) {
        this.currentCallback = callback;
        this.multiple = multiple;
        this.already = new Set(already);
        this.selected = [];

        const modal = document.getElementById('media-picker-modal');
        if (modal) {
            modal.querySelector('.modal-header h3').textContent = multiple ? '📂 Select images' : '📂 Select image';
            this.updateConfirm();
            modal.style.display = 'block';
            this.loadMediaGrid();
        }
    },

    closePicker() {
        const modal = document.getElementById('media-picker-modal');
        if (modal) modal.style.display = 'none';
        this.currentCallback = null;
        this.selected = [];
    },

    updateConfirm() {
        const btn = document.getElementById('picker-confirm');
        if (!btn) return;
        btn.hidden = !this.multiple;
        btn.disabled = this.selected.length === 0;
        btn.textContent = this.selected.length ? `Add ${this.selected.length} image${this.selected.length === 1 ? '' : 's'}` : 'Add';
    },

    confirmSelection() {
        if (this.currentCallback && this.selected.length) this.currentCallback(this.selected);
        this.closePicker();
    },

    async loadMediaGrid() {
        const grid = document.getElementById('media-picker-grid');
        const categoryFilter = document.getElementById('picker-category-filter');
        const searchInput = document.getElementById('picker-search');
        if (!grid) return;

        try {
            grid.innerHTML = '<div class="loading">Loading images...</div>';

            // All media, for client-side filtering (as the main media tab)
            const params = new URLSearchParams({ page: '1', limit: '10000' });
            if (categoryFilter?.value) params.append('category', categoryFilter.value);

            const response = await fetch(`/api/media?${params}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load media');

            const data = await response.json();
            this.renderMediaGrid(Object.entries(data.media || {}));

            const currentSearch = searchInput?.value?.toLowerCase().trim();
            if (currentSearch) this.filterDisplayedItems(currentSearch);
        } catch (error) {
            console.error('Error loading media:', error);
            grid.innerHTML = '<div class="error">Failed to load images</div>';
        }
    },

    renderMediaGrid(mediaArray) {
        const grid = document.getElementById('media-picker-grid');
        if (!grid) return;

        if (mediaArray.length === 0) {
            grid.innerHTML = '<div class="empty">No images found</div>';
            return;
        }

        grid.innerHTML = mediaArray.map(([id, item]) => {
            const imageUrl = item.sizes?.small?.url || item.sizes?.medium?.url || item.sizes?.original?.url;
            const displayName = item.title || 'Unnamed';
            const credits = item.credits ? `Credits: ${item.credits}` : '';
            const caption = item.caption || '';
            const tags = item.tags?.length > 0 ? `🏷️ ${item.tags.join(', ')}` : '';
            const inGallery = this.already?.has(imageUrl);

            return `
                <div class="picker-media-item${inGallery ? ' in-gallery' : ''}" data-media-id="${id}" data-media-url="${imageUrl}"
                     data-search-text="${this.buildSearchText(item)}">
                    ${inGallery ? '<span class="picker-in-gallery">✓ already added</span>' : ''}
                    <img src="${imageUrl}" alt="${item.title}" class="picker-media-image" loading="lazy">
                    <div class="picker-media-info">
                        <div class="picker-media-name">${displayName}</div>
                        <div class="picker-media-category">${this.getCategoryEmoji(item.category)} ${item.category}</div>
                        ${credits ? `<div class="picker-media-credits">${credits}</div>` : ''}
                        ${caption ? `<div class="picker-media-caption">${caption}</div>` : ''}
                        ${tags ? `<div class="picker-media-tags">${tags}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.picker-media-item').forEach((item) => {
            item.addEventListener('click', () => this.selectMediaItem(item));
        });
    },

    buildSearchText(item) {
        return [item.title || '', item.caption || '', item.credits || '', item.category || '', ...(item.tags || [])].join(' ').toLowerCase();
    },

    selectMediaItem(itemElement) {
        const media = {
            id: itemElement.dataset.mediaId,
            url: itemElement.dataset.mediaUrl,
            name: itemElement.querySelector('.picker-media-name')?.textContent,
        };

        if (this.multiple) {
            if (itemElement.classList.contains('in-gallery')) return; // already in the gallery
            const at = this.selected.findIndex((m) => m.url === media.url);
            if (at >= 0) this.selected.splice(at, 1); else this.selected.push(media);
            itemElement.classList.toggle('selected', at < 0);
            this.updateConfirm();
            return;
        }

        // Single choice: select and apply after a short moment
        document.getElementById('media-picker-grid')?.querySelectorAll('.picker-media-item').forEach((item) => item.classList.remove('selected'));
        itemElement.classList.add('selected');
        this.selected = [media];
        setTimeout(() => {
            if (this.currentCallback && this.selected.length) {
                this.currentCallback(this.selected);
                this.closePicker();
            }
        }, 300);
    },

    getCategoryEmoji(category) {
        const emojis = {
            characters: '👥',
            locations: '📍',
            maps: '🗺️',
            items: '⚔️',
            creatures: '🐲',
            sessions: '🎲',
            general: '📁'
        };
        return emojis[category] || '📁';
    }
};

// Hover preview: the thumbnails in a form's gallery and in the picker are small — hovering one shows the 600 px
// version beside it (the URL's -thumb/-small part swapped for -medium; the shown image stays if that doesn't exist).
(function hoverPreview() {
    const SELECTOR = '.media-gallery-item img, .picker-media-image';
    let box = null;
    let current = null;
    const larger = (url) => String(url).replace(/-(thumb|small)\.webp$/, '-medium.webp');

    function place(target) {
        const r = target.getBoundingClientRect();
        const w = box.offsetWidth;
        const h = box.offsetHeight;
        const right = r.right + 12 + w <= window.innerWidth;
        const left = right ? r.right + 12 : Math.max(8, r.left - 12 - w);
        const top = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), window.innerHeight - h - 8);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
    }

    document.addEventListener('mouseover', (e) => {
        const img = e.target.closest?.(SELECTOR);
        if (!img || img === current) return;
        current = img;
        if (!box) {
            box = document.createElement('div');
            box.className = 'media-hover-preview';
            box.hidden = true;
            box.append(document.createElement('img'));
            document.body.append(box);
        }
        const big = box.firstChild;
        big.onload = () => { if (current === img) { box.hidden = false; place(img); } };
        big.onerror = () => { if (current === img && big.src !== img.src) big.src = img.src; };
        big.src = larger(img.currentSrc || img.src);
    });
    document.addEventListener('mouseout', (e) => {
        if (!current || e.target !== current || current.contains(e.relatedTarget)) return;
        current = null;
        if (box) box.hidden = true;
    });
    // a click (e.g. remove, or picking in the picker) or scrolling ends the preview
    ['click', 'scroll'].forEach((ev) => document.addEventListener(ev, () => { current = null; if (box) box.hidden = true; }, true));
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaPicker.init();
});
