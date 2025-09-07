// Media Operations - API interaction for media management
window.mediaOperations = {
    // Current state
    currentPage: 1,
    itemsPerPage: 20,
    currentCategory: '',
    currentSearch: '',
    
    // Upload media files
    async uploadMedia(formData, progressCallback) {
        try {
            const xhr = new XMLHttpRequest();
            
            // Return promise for the upload
            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && progressCallback) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        progressCallback(percentComplete);
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            reject(new Error('Invalid response format'));
                        }
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}`));
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });
                
                xhr.open('POST', '/api/media/upload');
                xhr.send(formData);
            });
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    },
    
    // Fetch media library with pagination and filtering
    async fetchMedia(page = 1, category = '', search = '') {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.itemsPerPage.toString()
            });
            
            if (category) params.append('category', category);
            if (search) params.append('search', search);
            
            const response = await fetch(`/api/media?${params}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch media: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update current state
            this.currentPage = page;
            this.currentCategory = category;
            this.currentSearch = search;
            
            return data;
        } catch (error) {
            console.error('Error fetching media:', error);
            throw error;
        }
    },
    
    // Delete media item
    async deleteMedia(mediaId) {
        try {
            const response = await fetch(`/api/media/${mediaId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete media: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error deleting media:', error);
            throw error;
        }
    },
    
    // Get available categories
    async getCategories() {
        try {
            const response = await fetch('/api/media/categories');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch categories: ${response.status}`);
            }
            
            const data = await response.json();
            return data.categories || [];
        } catch (error) {
            console.error('Error fetching categories:', error);
            return ['characters', 'locations', 'maps', 'items', 'creatures', 'sessions', 'general'];
        }
    },
    
    // Helper to format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Helper to format date
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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
