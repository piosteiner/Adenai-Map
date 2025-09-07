// Media Picker - Reusable component for selecting media items
window.mediaPicker = {
    currentCallback: null,
    selectedMedia: null,

    // Initialize the media picker
    init() {
        this.setupEventListeners();
    },

    // Setup event listeners
    setupEventListeners() {
        // Character image selection
        const selectCharacterImageBtn = document.getElementById('select-character-image');
        if (selectCharacterImageBtn) {
            selectCharacterImageBtn.addEventListener('click', () => {
                this.openPicker((mediaItem) => {
                    this.setCharacterImage(mediaItem);
                });
            });
        }

        // Clear character image
        const clearCharacterImageBtn = document.getElementById('clear-character-image');
        if (clearCharacterImageBtn) {
            clearCharacterImageBtn.addEventListener('click', () => {
                this.clearCharacterImage();
            });
        }

        // Character image display click
        const characterImageDisplay = document.getElementById('character-image-display');
        if (characterImageDisplay) {
            characterImageDisplay.addEventListener('click', () => {
                this.openPicker((mediaItem) => {
                    this.setCharacterImage(mediaItem);
                });
            });
        }

        // Location image selection
        const selectLocationImageBtn = document.getElementById('select-location-image');
        if (selectLocationImageBtn) {
            selectLocationImageBtn.addEventListener('click', () => {
                this.openPicker((mediaItem) => {
                    this.setLocationImage(mediaItem);
                });
            });
        }

        // Clear location image
        const clearLocationImageBtn = document.getElementById('clear-location-image');
        if (clearLocationImageBtn) {
            clearLocationImageBtn.addEventListener('click', () => {
                this.clearLocationImage();
            });
        }

        // Location image display click
        const locationImageDisplay = document.getElementById('location-image-display');
        if (locationImageDisplay) {
            locationImageDisplay.addEventListener('click', () => {
                this.openPicker((mediaItem) => {
                    this.setLocationImage(mediaItem);
                });
            });
        }

        // Modal close events
        this.setupModalEvents();

        // Filter events
        this.setupFilterEvents();
    },

    // Setup modal events
    setupModalEvents() {
        const modal = document.getElementById('media-picker-modal');
        const closeBtns = modal?.querySelectorAll('.close-picker-btn');

        closeBtns?.forEach(btn => {
            btn.addEventListener('click', () => this.closePicker());
        });

        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePicker();
            }
        });
    },

    // Setup filter events
    setupFilterEvents() {
        const categoryFilter = document.getElementById('picker-category-filter');
        const searchInput = document.getElementById('picker-search');

        categoryFilter?.addEventListener('change', () => {
            this.loadMediaGrid();
        });

        // Add real-time search with debouncing
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase().trim();
                if (searchTerm.length > 0) {
                    this.filterDisplayedItems(searchTerm);
                } else {
                    this.loadMediaGrid(); // Reload to show all items
                }
            }, 300);
        });
    },

    // Filter displayed items locally for real-time search
    filterDisplayedItems(searchTerm) {
        const grid = document.getElementById('media-picker-grid');
        const items = grid?.querySelectorAll('.picker-media-item');
        
        if (!items) return;

        let visibleCount = 0;
        items.forEach(item => {
            const searchText = item.dataset.searchText || '';
            const matches = searchText.includes(searchTerm);
            item.style.display = matches ? 'block' : 'none';
            if (matches) visibleCount++;
        });

        // Show "no results" message if nothing matches
        if (visibleCount === 0) {
            grid.innerHTML = '<div class="empty">No images match your search</div>';
        }
    },

    // Open the picker modal
    openPicker(callback) {
        this.currentCallback = callback;
        this.selectedMedia = null;
        
        const modal = document.getElementById('media-picker-modal');
        if (modal) {
            modal.style.display = 'block';
            this.loadMediaGrid();
        }
    },

    // Close the picker modal
    closePicker() {
        const modal = document.getElementById('media-picker-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentCallback = null;
        this.selectedMedia = null;
    },

    // Load media grid
    async loadMediaGrid() {
        const grid = document.getElementById('media-picker-grid');
        const categoryFilter = document.getElementById('picker-category-filter');
        const searchInput = document.getElementById('picker-search');

        if (!grid) return;

        try {
            grid.innerHTML = '<div class="loading">Loading images...</div>';

            // Build query parameters
            const params = new URLSearchParams();
            if (categoryFilter?.value) {
                params.append('category', categoryFilter.value);
            }
            if (searchInput?.value) {
                params.append('search', searchInput.value);
            }
            params.append('limit', '50'); // Load more items for picker

            const response = await fetch(`/api/media?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load media');
            }

            const data = await response.json();
            this.renderMediaGrid(Object.entries(data.media || {}));

        } catch (error) {
            console.error('Error loading media:', error);
            grid.innerHTML = '<div class="error">Failed to load images</div>';
        }
    },

    // Render media grid
    renderMediaGrid(mediaArray) {
        const grid = document.getElementById('media-picker-grid');
        if (!grid) return;

        if (mediaArray.length === 0) {
            grid.innerHTML = '<div class="empty">No images found</div>';
            return;
        }

        grid.innerHTML = mediaArray.map(([id, item]) => {
            const imageUrl = item.sizes?.small?.url || item.sizes?.thumbnail?.url || item.sizes?.original?.url;
            const displayName = item.title || 'Unnamed';
            const credits = item.credits ? `📸 ${item.credits}` : '';
            const caption = item.caption || '';
            const tags = item.tags?.length > 0 ? `🏷️ ${item.tags.join(', ')}` : '';
            
            return `
                <div class="picker-media-item" data-media-id="${id}" data-media-url="${imageUrl}" 
                     data-search-text="${this.buildSearchText(item)}">
                    <img src="${imageUrl}" alt="${item.title}" class="picker-media-image">
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

        // Add click listeners to media items
        grid.querySelectorAll('.picker-media-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectMediaItem(item);
            });
        });
    },

    // Build searchable text from all metadata
    buildSearchText(item) {
        const searchFields = [
            item.title || '',
            item.caption || '',
            item.credits || '',
            item.category || '',
            ...(item.tags || [])
        ];
        return searchFields.join(' ').toLowerCase();
    },

    // Select a media item
    selectMediaItem(itemElement) {
        // Remove previous selection
        const grid = document.getElementById('media-picker-grid');
        grid?.querySelectorAll('.picker-media-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Select current item
        itemElement.classList.add('selected');

        const mediaId = itemElement.dataset.mediaId;
        const mediaUrl = itemElement.dataset.mediaUrl;
        const mediaName = itemElement.querySelector('.picker-media-name')?.textContent;

        this.selectedMedia = {
            id: mediaId,
            url: mediaUrl,
            name: mediaName
        };

        // Auto-close and apply selection after a short delay
        setTimeout(() => {
            if (this.currentCallback && this.selectedMedia) {
                this.currentCallback(this.selectedMedia);
                this.closePicker();
            }
        }, 300);
    },

    // Set character image
    setCharacterImage(mediaItem) {
        const imageUrlInput = document.getElementById('character-image-url');
        const imageDisplay = document.getElementById('character-image-display');
        const clearBtn = document.getElementById('clear-character-image');

        if (imageUrlInput) {
            imageUrlInput.value = mediaItem.url;
        }

        if (imageDisplay) {
            imageDisplay.innerHTML = `
                <img src="${mediaItem.url}" alt="${mediaItem.name}" class="media-picker-image">
            `;
        }

        if (clearBtn) {
            clearBtn.style.display = 'inline-block';
        }
    },

    // Clear character image
    clearCharacterImage() {
        const imageUrlInput = document.getElementById('character-image-url');
        const imageDisplay = document.getElementById('character-image-display');
        const clearBtn = document.getElementById('clear-character-image');

        if (imageUrlInput) {
            imageUrlInput.value = '';
        }

        if (imageDisplay) {
            imageDisplay.innerHTML = `
                <div class="media-picker-placeholder">
                    <span class="media-picker-icon">🖼️</span>
                    <span class="media-picker-text">Click to select from uploaded images</span>
                </div>
            `;
        }

        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
    },

    // Set location image
    setLocationImage(mediaItem) {
        const imageUrlInput = document.getElementById('location-image-url');
        const imageDisplay = document.getElementById('location-image-display');
        const clearBtn = document.getElementById('clear-location-image');

        if (imageUrlInput) {
            imageUrlInput.value = mediaItem.url;
        }

        if (imageDisplay) {
            imageDisplay.innerHTML = `
                <img src="${mediaItem.url}" alt="${mediaItem.name}" class="media-picker-image">
            `;
        }

        if (clearBtn) {
            clearBtn.style.display = 'inline-block';
        }
    },

    // Clear location image
    clearLocationImage() {
        const imageUrlInput = document.getElementById('location-image-url');
        const imageDisplay = document.getElementById('location-image-display');
        const clearBtn = document.getElementById('clear-location-image');

        if (imageUrlInput) {
            imageUrlInput.value = '';
        }

        if (imageDisplay) {
            imageDisplay.innerHTML = `
                <div class="media-picker-placeholder">
                    <span class="media-picker-icon">🖼️</span>
                    <span class="media-picker-text">Click to select from uploaded images</span>
                </div>
            `;
        }

        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
    },

    // Get category emoji
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaPicker.init();
});
