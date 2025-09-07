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
    },

    // Get single media item
    async getMediaItem(mediaId) {
        try {
            const response = await fetch(`/api/media/${mediaId}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                return data.media;
            } else {
                throw new Error(`Failed to get media: ${response.status}`);
            }
        } catch (error) {
            console.error('Error getting media item:', error);
            throw error;
        }
    },

    // Update media metadata
    async updateMediaMetadata(mediaId, updateData) {
        try {
            console.log('Updating media metadata for:', mediaId, updateData);
            
            const response = await fetch(`/api/media/${mediaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            console.log('Update response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                console.log('Update result:', result);
                return result;
            } else {
                const errorText = await response.text();
                console.error('Update failed with status:', response.status, 'Response:', errorText);
                
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If we can't parse JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error updating media metadata:', error);
            
            // Provide user-friendly error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error - please check your connection');
            } else if (error.message.includes('401')) {
                throw new Error('Authentication required - please log in again');
            } else if (error.message.includes('403')) {
                throw new Error('Permission denied - you are not authorized to edit media');
            } else if (error.message.includes('404')) {
                throw new Error('Media item not found');
            } else {
                throw error;
            }
        }
    }
};
