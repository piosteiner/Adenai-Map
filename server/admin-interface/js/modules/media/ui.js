// Media UI - User interface components for media management
window.mediaUI = {
    // Initialize event listeners
    init() {
        this.setupEventListeners();
        this.loadMedia();
    },
    
    // Setup all event listeners
    setupEventListeners() {
        // Upload button
        const uploadBtn = document.getElementById('upload-media-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.openUploadModal());
        }
        
        // Upload modal
        this.setupUploadModal();
        
        // Filter controls
        this.setupFilters();
        
        // Pagination
        this.setupPagination();
    },
    
    // Setup upload modal
    setupUploadModal() {
        const modal = document.getElementById('media-upload-modal');
        const closeBtn = modal?.querySelector('.close-media-btn');
        const form = document.getElementById('media-upload-form');
        const fileInput = document.getElementById('media-files');
        
        // Close modal
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeUploadModal());
        }
        
        // Click outside to close
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeUploadModal();
                }
            });
        }
        
        // File input preview
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }
        
        // Form submission
        if (form) {
            form.addEventListener('submit', (e) => this.handleUploadSubmit(e));
        }
        
        // Drag and drop
        this.setupDragAndDrop();
    },
    
    // Setup drag and drop functionality
    setupDragAndDrop() {
        const fileWrapper = document.querySelector('.file-input-wrapper');
        if (!fileWrapper) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileWrapper.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            fileWrapper.addEventListener(eventName, () => {
                fileWrapper.classList.add('drag-active');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            fileWrapper.addEventListener(eventName, () => {
                fileWrapper.classList.remove('drag-active');
            });
        });
        
        fileWrapper.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            const fileInput = document.getElementById('media-files');
            if (fileInput && files.length > 0) {
                fileInput.files = files;
                this.handleFileSelection({ target: fileInput });
            }
        });
    },
    
    // Setup filter controls
    setupFilters() {
        const categoryFilter = document.getElementById('media-category-filter');
        const searchInput = document.getElementById('media-search');
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.applyFilters(), 300);
            });
        }
    },
    
    // Setup pagination controls
    setupPagination() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousPage());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
    },
    
    // Open upload modal
    openUploadModal() {
        const modal = document.getElementById('media-upload-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Reset form
            const form = document.getElementById('media-upload-form');
            if (form) form.reset();
            this.clearFilePreview();
        }
    },
    
    // Close upload modal
    closeUploadModal() {
        const modal = document.getElementById('media-upload-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.hideUploadProgress();
    },
    
    // Handle file selection
    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        const preview = document.getElementById('file-preview');
        const placeholder = document.querySelector('.file-input-placeholder');
        
        if (files.length > 0) {
            this.showFilePreview(files);
            if (placeholder) placeholder.style.display = 'none';
            if (preview) preview.style.display = 'grid';
        } else {
            this.clearFilePreview();
        }
    },
    
    // Show file preview
    showFilePreview(files) {
        const preview = document.getElementById('file-preview');
        if (!preview) return;
        
        preview.innerHTML = '';
        
        files.forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const item = document.createElement('div');
                    item.className = 'file-preview-item';
                    item.innerHTML = `
                        <img src="${e.target.result}" alt="${file.name}" class="file-preview-image">
                        <div class="file-preview-name">${file.name}</div>
                    `;
                    preview.appendChild(item);
                };
                reader.readAsDataURL(file);
            }
        });
    },
    
    // Clear file preview
    clearFilePreview() {
        const preview = document.getElementById('file-preview');
        const placeholder = document.querySelector('.file-input-placeholder');
        
        if (preview) {
            preview.innerHTML = '';
            preview.style.display = 'none';
        }
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
    },
    
    // Handle form submission
    async handleUploadSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const files = document.getElementById('media-files').files;
        
        if (files.length === 0) {
            admin.showToast('Please select at least one image', 'error');
            return;
        }
        
        this.showUploadProgress(files.length);
        
        try {
            const result = await window.mediaOperations.uploadMedia(formData, (progress) => {
                this.updateUploadProgress(progress);
            });
            
            if (result.success) {
                admin.showToast(`Successfully uploaded ${result.totalProcessed} images!`, 'success');
                this.closeUploadModal();
                this.loadMedia(); // Refresh the media grid
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            admin.showToast(`Upload failed: ${error.message}`, 'error');
        } finally {
            this.hideUploadProgress();
        }
    },
    
    // Show upload progress
    showUploadProgress(fileCount) {
        const progress = document.getElementById('upload-progress');
        const count = document.getElementById('upload-count');
        const status = document.getElementById('upload-status');
        
        if (progress) progress.style.display = 'block';
        if (count) count.textContent = `0 / ${fileCount}`;
        if (status) status.textContent = 'Starting upload...';
        
        this.updateUploadProgress(0);
    },
    
    // Update upload progress
    updateUploadProgress(percentage) {
        const fill = document.getElementById('progress-fill');
        const status = document.getElementById('upload-status');
        
        if (fill) fill.style.width = `${percentage}%`;
        if (status) {
            if (percentage < 100) {
                status.textContent = `Uploading... ${Math.round(percentage)}%`;
            } else {
                status.textContent = 'Processing images...';
            }
        }
    },
    
    // Hide upload progress
    hideUploadProgress() {
        const progress = document.getElementById('upload-progress');
        if (progress) progress.style.display = 'none';
    },
    
    // Load and display media
    async loadMedia(showUpdatingMessage = false) {
        const mediaGrid = document.getElementById('media-grid');
        if (!mediaGrid) return;
        
        try {
            if (showUpdatingMessage) {
                mediaGrid.innerHTML = '<div class="loading">✨ Updating media library...</div>';
            } else {
                mediaGrid.innerHTML = '<div class="loading">Loading media library... 🔄</div>';
            }
            
            const category = document.getElementById('media-category-filter')?.value || '';
            const search = document.getElementById('media-search')?.value || '';
            
            const result = await window.mediaOperations.fetchMedia(
                window.mediaOperations.currentPage,
                category,
                search
            );
            
            if (result.success) {
                this.renderMediaGrid(result.media);
                this.updatePagination(result.pagination);
            } else {
                throw new Error(result.error || 'Failed to load media');
            }
        } catch (error) {
            console.error('Error loading media:', error);
            mediaGrid.innerHTML = `
                <div class="media-empty">
                    <div class="media-empty-icon">❌</div>
                    <div class="media-empty-text">Failed to load media</div>
                    <div class="media-empty-subtext">${error.message}</div>
                </div>
            `;
        }
    },
    
    // Render media grid
    renderMediaGrid(media) {
        const mediaGrid = document.getElementById('media-grid');
        if (!mediaGrid) return;
        
        const mediaArray = Object.entries(media);
        
        if (mediaArray.length === 0) {
            mediaGrid.innerHTML = `
                <div class="media-empty">
                    <div class="media-empty-icon">🖼️</div>
                    <div class="media-empty-text">No images found</div>
                    <div class="media-empty-subtext">Upload some images to get started!</div>
                </div>
            `;
            return;
        }
        
        mediaGrid.innerHTML = mediaArray.map(([id, item]) => this.createMediaItem(id, item)).join('');
        
        // Add event listeners for media items
        this.setupMediaItemListeners();
    },
    
    // Create media item HTML
    createMediaItem(id, item) {
        const categoryEmoji = window.mediaOperations.getCategoryEmoji(item.category);
        const uploadDate = window.mediaOperations.formatDate(item.uploadDate);
        const tagsHtml = item.tags?.length > 0 
            ? `<div class="media-tags">${item.tags.map(tag => `<span class="media-tag">${tag}</span>`).join('')}</div>`
            : '';
        
        // Use medium size for grid display
        const imageUrl = item.sizes?.medium?.url || item.sizes?.small?.url || item.sizes?.original?.url;
        
        return `
            <div class="media-item" data-media-id="${id}">
                <div class="media-image-container">
                    <img src="${imageUrl}" alt="${item.title}" class="media-image" data-full-image="${item.sizes?.original?.url || imageUrl}">
                </div>
                <div class="media-info">
                    <div class="media-title">${item.title || 'Untitled'}</div>
                    <div class="media-meta">
                        <span class="media-category">${categoryEmoji} ${item.category}</span>
                        <span class="media-date">${uploadDate}</span>
                    </div>
                    ${item.caption ? `<div class="media-caption">${item.caption}</div>` : ''}
                    ${item.credits ? `<div class="media-credits">📸 ${item.credits}</div>` : ''}
                    ${tagsHtml}
                    <div class="media-actions">
                        <button class="media-action-btn view" data-action="view">👁️ View</button>
                        <button class="media-action-btn edit" data-action="edit">✏️ Edit</button>
                        <button class="media-action-btn delete" data-action="delete">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Setup event listeners for media items
    setupMediaItemListeners() {
        // Image clicks for full view
        document.querySelectorAll('.media-image').forEach(img => {
            img.addEventListener('click', (e) => {
                const fullImageUrl = e.target.dataset.fullImage;
                const mediaId = e.target.closest('.media-item').dataset.mediaId;
                const mediaData = this.getMediaDataFromElement(e.target.closest('.media-item'));
                this.showImagePopup(fullImageUrl, mediaData);
            });
        });
        
        // Action buttons
        document.querySelectorAll('.media-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.target.dataset.action;
                const mediaId = e.target.closest('.media-item').dataset.mediaId;
                
                if (action === 'view') {
                    const img = e.target.closest('.media-item').querySelector('.media-image');
                    const mediaData = this.getMediaDataFromElement(e.target.closest('.media-item'));
                    this.showImagePopup(img.dataset.fullImage, mediaData);
                } else if (action === 'edit') {
                    this.openEditModal(mediaId);
                } else if (action === 'delete') {
                    this.confirmDeleteMedia(mediaId);
                }
            });
        });
    },
    
    // Extract media data from DOM element
    getMediaDataFromElement(mediaElement) {
        const title = mediaElement.querySelector('.media-title')?.textContent || 'Untitled';
        const captionElement = mediaElement.querySelector('.media-caption');
        const creditsElement = mediaElement.querySelector('.media-credits');
        
        return {
            title: title,
            caption: captionElement ? captionElement.textContent : null,
            credits: creditsElement ? creditsElement.textContent.replace('📸 ', '') : null
        };
    },
    
    // Show image in popup
    showImagePopup(imageUrl, mediaData) {
        // Remove existing popup
        const existingPopup = document.querySelector('.media-popup-overlay');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // Create popup
        const popup = document.createElement('div');
        popup.className = 'media-popup-overlay';
        
        // Build info content
        const title = mediaData.title || 'Untitled';
        const caption = mediaData.caption ? `<div class="media-popup-caption">📝 ${mediaData.caption}</div>` : '';
        const credits = mediaData.credits ? `<div class="media-popup-credits">📸 ${mediaData.credits}</div>` : '';
        
        popup.innerHTML = `
            <div class="media-popup-content">
                <button class="media-popup-close">&times;</button>
                <img src="${imageUrl}" alt="${title}" class="media-popup-image">
                <div class="media-popup-info">
                    <div class="media-popup-title">${title}</div>
                    ${caption}
                    ${credits}
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Animate in
        setTimeout(() => popup.classList.add('active'), 10);
        
        // Close handlers
        popup.querySelector('.media-popup-close').addEventListener('click', () => {
            this.closeImagePopup(popup);
        });
        
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                this.closeImagePopup(popup);
            }
        });
        
        // ESC key to close
        const closeOnEsc = (e) => {
            if (e.key === 'Escape') {
                this.closeImagePopup(popup);
                document.removeEventListener('keydown', closeOnEsc);
            }
        };
        document.addEventListener('keydown', closeOnEsc);
    },
    
    // Close image popup
    closeImagePopup(popup) {
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 300);
    },
    
    // Confirm and delete media
    async confirmDeleteMedia(mediaId) {
        if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
            return;
        }
        
        try {
            const result = await window.mediaOperations.deleteMedia(mediaId);
            
            if (result.success) {
                admin.showToast('Image deleted successfully', 'success');
                this.loadMedia(); // Refresh the grid
            } else {
                throw new Error(result.error || 'Delete failed');
            }
        } catch (error) {
            console.error('Delete error:', error);
            admin.showToast(`Failed to delete image: ${error.message}`, 'error');
        }
    },
    
    // Apply filters
    applyFilters() {
        window.mediaOperations.currentPage = 1; // Reset to first page
        this.loadMedia();
    },
    
    // Update pagination
    updatePagination(pagination) {
        const paginationEl = document.getElementById('media-pagination');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        
        if (!paginationEl) return;
        
        if (pagination.totalPages > 1) {
            paginationEl.style.display = 'flex';
            
            if (prevBtn) {
                prevBtn.disabled = pagination.page <= 1;
            }
            
            if (nextBtn) {
                nextBtn.disabled = pagination.page >= pagination.totalPages;
            }
            
            if (pageInfo) {
                pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
            }
        } else {
            paginationEl.style.display = 'none';
        }
    },
    
    // Previous page
    previousPage() {
        if (window.mediaOperations.currentPage > 1) {
            window.mediaOperations.currentPage--;
            this.loadMedia();
        }
    },
    
    // Next page
    nextPage() {
        window.mediaOperations.currentPage++;
        this.loadMedia();
    },

    // Open edit modal
    openEditModal(mediaId) {
        // Get media data
        window.mediaOperations.getMediaItem(mediaId)
            .then(mediaData => {
                if (mediaData) {
                    this.populateEditForm(mediaId, mediaData);
                    this.showEditModal();
                }
            })
            .catch(error => {
                console.error('Error loading media data:', error);
                window.ui.showToast('Failed to load media data', 'error');
            });
    },

    // Populate edit form with current data
    populateEditForm(mediaId, mediaData) {
        document.getElementById('edit-media-id').value = mediaId;
        document.getElementById('edit-title').value = mediaData.title || '';
        document.getElementById('edit-caption').value = mediaData.caption || '';
        document.getElementById('edit-credits').value = mediaData.credits || '';
        document.getElementById('edit-category').value = mediaData.category || 'general';
        document.getElementById('edit-tags').value = mediaData.tags ? mediaData.tags.join(', ') : '';
    },

    // Show edit modal
    showEditModal() {
        const modal = document.getElementById('media-edit-modal');
        if (modal) {
            modal.style.display = 'block';
            this.setupEditModalEvents();
        }
    },

    // Hide edit modal
    closeEditModal() {
        const modal = document.getElementById('media-edit-modal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('media-edit-form').reset();
        }
    },

    // Setup edit modal events
    setupEditModalEvents() {
        const modal = document.getElementById('media-edit-modal');
        const closeBtns = modal.querySelectorAll('.close-edit-btn');
        const form = document.getElementById('media-edit-form');

        // Close buttons
        closeBtns.forEach(btn => {
            btn.onclick = () => this.closeEditModal();
        });

        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeEditModal();
            }
        };

        // Form submission
        form.onsubmit = (e) => this.handleEditSubmit(e);
    },

    // Handle edit form submission
    async handleEditSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const mediaId = formData.get('mediaId');
        
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '💾 Saving...';
        submitBtn.disabled = true;
        
        // Prepare update data
        const updateData = {
            title: formData.get('title'),
            caption: formData.get('caption'),
            credits: formData.get('credits'),
            category: formData.get('category'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };

        try {
            const response = await window.mediaOperations.updateMediaMetadata(mediaId, updateData);
            
            if (response && response.success) {
                // Show success message
                if (window.ui && window.ui.showToast) {
                    window.ui.showToast('✅ Media metadata updated successfully!', 'success');
                } else {
                    console.log('Success: Media metadata updated successfully!');
                }
                
                // Close modal
                this.closeEditModal();
                
                // Refresh the media grid
                await this.loadMedia(true);
                
                // Dispatch a custom event to notify other components
                document.dispatchEvent(new CustomEvent('mediaUpdated', {
                    detail: { mediaId, updateData }
                }));
                
                // Also refresh the main media grid if we're on the media tab
                if (window.mediaUI && window.mediaUI.loadMedia) {
                    window.mediaUI.loadMedia(true);
                }
                
                // Refresh media picker if it's open
                if (window.mediaPicker && document.getElementById('media-picker-modal')?.style.display === 'block') {
                    window.mediaPicker.loadMediaGrid();
                }
                
            } else {
                throw new Error(response?.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error updating media:', error);
            
            // Show error message
            if (window.ui && window.ui.showToast) {
                window.ui.showToast(`❌ Error: ${error.message || 'Failed to update media metadata'}`, 'error');
            } else {
                alert(`Error: ${error.message || 'Failed to update media metadata'}`);
            }
        } finally {
            // Restore button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
};
