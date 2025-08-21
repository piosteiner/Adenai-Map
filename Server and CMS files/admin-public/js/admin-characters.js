// Character Management Module
class AdminCharacters {
    constructor() {
        this.characters = [];
        this.currentCharacterFilter = '';
        this.editingCharacter = null;
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCharacters();
        
        // Listen for auth state changes
        document.addEventListener('authStateChanged', (e) => {
            this.onAuthStateChanged(e.detail.isAuthenticated);
        });
    }

    setupEventListeners() {
        // Add character button
        const addCharacterBtn = document.getElementById('add-character-btn');
        if (addCharacterBtn) {
            addCharacterBtn.addEventListener('click', () => {
                this.openAddCharacterModal();
            });
        }

        // Character form submission
        const characterForm = document.getElementById('character-form');
        if (characterForm) {
            characterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCharacter();
            });
        }

        // Character search functionality
        const characterSearch = document.getElementById('character-search');
        if (characterSearch) {
            characterSearch.addEventListener('input', this.ui.debounce((e) => {
                this.currentCharacterFilter = e.target.value;
                this.renderCharacters();
            }, 300));
        }

        // Character modal close
        const closeCharacterBtn = document.querySelector('.close-character-btn');
        if (closeCharacterBtn) {
            closeCharacterBtn.addEventListener('click', () => {
                this.closeCharacterModal();
            });
        }

        // Close character modal on backdrop click
        const characterModal = document.getElementById('add-character-modal');
        if (characterModal) {
            characterModal.addEventListener('click', (e) => {
                if (e.target.id === 'add-character-modal') {
                    this.closeCharacterModal();
                }
            });
        }

        // Delegate character action buttons
        this.ui.addDelegatedListener('characters-list', '.character-edit-btn', 'click', (e) => {
            const characterId = e.target.dataset.character;
            this.editCharacter(characterId);
        });

        this.ui.addDelegatedListener('characters-list', '.character-delete-btn', 'click', (e) => {
            const characterId = e.target.dataset.character;
            this.deleteCharacter(characterId);
        });
    }

    async loadCharacters() {
        try {
            console.log('👥 Loading characters from GitHub...');
            this.ui.showLoading('characters-list', 'Loading characters...');
            
            const response = await fetch('/api/characters');
            const data = await response.json();
            
            this.characters = data.characters || [];
            console.log(`✅ Loaded ${this.characters.length} characters`);
            
            // Populate location dropdown
            this.populateLocationDropdown();
            this.renderCharacters();
        } catch (error) {
            console.error('❌ Failed to load characters:', error);
            this.ui.showToast('Failed to load characters', 'error');
            this.characters = [];
            this.renderCharacters();
        }
    }

    populateLocationDropdown() {
        const select = document.getElementById('character-location-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select location...</option>';
        
        // Get locations from the locations module
        const locations = window.adminLocations?.getLocations() || [];
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.properties.name;
            option.textContent = location.properties.name;
            select.appendChild(option);
        });
    }

    renderCharacters() {
        const container = document.getElementById('characters-list');
        if (!container) return;
        
        if (this.characters.length === 0) {
            this.ui.showEmptyState('characters-list',
                '👥 No characters yet',
                'Add your first campaign character to get started!'
            );
            return;
        }

        // Filter characters based on search
        const filteredCharacters = this.characters.filter(character => {
            const name = character.name?.toLowerCase() || '';
            const description = character.description?.toLowerCase() || '';
            const location = character.location?.toLowerCase() || '';
            const title = character.title?.toLowerCase() || '';
            const searchTerm = this.currentCharacterFilter.toLowerCase();
            
            return name.includes(searchTerm) || 
                description.includes(searchTerm) || 
                location.includes(searchTerm) ||
                title.includes(searchTerm);
        });

        if (filteredCharacters.length === 0) {
            this.ui.showEmptyState('characters-list',
                '🔍 No matches found',
                'Try adjusting your search terms'
            );
            return;
        }

        container.innerHTML = filteredCharacters.map(character => {
            return this.renderCharacterCard(character);
        }).join('');
    }

    renderCharacterCard(character) {
        // Only show edit/delete buttons if authenticated
        const actionButtons = this.auth.isAuthenticated ? `
            <div class="character-actions">
                <button class="btn-secondary character-edit-btn" data-character="${character.id}">✏️ Edit</button>
                <button class="btn-danger character-delete-btn" data-character="${character.id}">🗑️ Delete</button>
            </div>
        ` : '';
        
        return `
            <div class="character-card" data-id="${character.id}">
                <div class="character-header">
                    <div class="character-info">
                        <h3>${character.name}</h3>
                        ${character.title ? `<p class="character-title">${character.title}</p>` : ''}
                    </div>
                    <div class="character-status">
                        <span class="status-badge status-${character.status}">${this.formatStatus(character.status)}</span>
                        <span class="relationship-badge relationship-${character.relationship}">${this.formatRelationship(character.relationship)}</span>
                    </div>
                </div>
                <div class="character-details">
                    ${character.location ? `<p><strong>📍 Location:</strong> ${character.location}</p>` : ''}
                    ${character.faction ? `<p><strong>🏛️ Faction:</strong> ${character.faction}</p>` : ''}
                    ${character.firstMet ? `<p><strong>📅 First Met:</strong> ${character.firstMet}</p>` : ''}
                    ${character.description ? `<p><strong>📝 Description:</strong> ${character.description}</p>` : ''}
                    ${character.notes ? `<p><strong>📋 Notes:</strong> ${character.notes}</p>` : ''}
                </div>
                ${actionButtons}
            </div>
        `;
    }

    formatStatus(status) {
        const statuses = {
            alive: '😊 Alive',
            dead: '💀 Dead',
            missing: '❓ Missing',
            unknown: '🤷 Unknown'
        };
        return statuses[status] || status;
    }

    formatRelationship(relationship) {
        const relationships = {
            ally: '😊 Ally',
            friendly: '🙂 Friendly',
            neutral: '😐 Neutral',
            suspicious: '🤨 Suspicious',
            hostile: '😠 Hostile',
            enemy: '⚔️ Enemy'
        };
        return relationships[relationship] || relationship;
    }

    openAddCharacterModal() {
        if (!this.auth.requireAuth()) return;
        
        // Reset editing state
        this.editingCharacter = null;
        
        // Update modal title and button text
        document.querySelector('#add-character-modal .modal-header h3').textContent = 'Add New Character';
        document.querySelector('#character-form button[type="submit"]').textContent = '💾 Save Character';
        
        this.populateLocationDropdown(); // Refresh location options
        this.ui.openModal('add-character-modal');
    }

    openEditCharacterModal(characterId) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.characters.find(char => char.id === characterId);
        if (!character) {
            this.ui.showToast('❌ Character not found', 'error');
            return;
        }
        
        // Set editing state
        this.editingCharacter = characterId;
        
        // Update modal title and button text
        document.querySelector('#add-character-modal .modal-header h3').textContent = 'Edit Character';
        document.querySelector('#character-form button[type="submit"]').textContent = '💾 Update Character';
        
        // Populate and set location dropdown
        this.populateLocationDropdown();
        
        // Pre-fill form with current data
        this.ui.populateForm('character-form', {
            name: character.name || '',
            title: character.title || '',
            location: character.location || '',
            description: character.description || '',
            image: character.image || '',
            status: character.status || 'alive',
            faction: character.faction || '',
            relationship: character.relationship || 'neutral',
            firstMet: character.firstMet || '',
            notes: character.notes || ''
        });
        
        this.ui.openModal('add-character-modal');
    }

    closeCharacterModal() {
        this.ui.closeModal('add-character-modal');
        this.editingCharacter = null;
    }

    async saveCharacter() {
        if (!this.auth.requireAuth()) return;

        const formData = this.ui.getFormData('character-form');
        if (!formData) return;

        // Validate form
        const isValid = this.ui.validateForm('character-form', {
            name: { required: true, label: 'Character Name' }
        });

        if (!isValid) return;
        
        // Create character data
        const characterData = {
            name: formData.name,
            title: formData.title || '',
            location: formData.location || '',
            description: formData.description || '',
            image: formData.image || '',
            status: formData.status || 'alive',
            faction: formData.faction || '',
            relationship: formData.relationship || 'neutral',
            firstMet: formData.firstMet || '',
            notes: formData.notes || ''
        };

        try {
            const isEditing = !!this.editingCharacter;
            const originalId = this.editingCharacter;
            
            console.log(`💾 ${isEditing ? 'Updating' : 'Saving'} character:`, characterData.name);
            
            const response = await this.auth.authenticatedFetch(
                `/api/characters${isEditing ? `/${encodeURIComponent(originalId)}` : ''}`,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(characterData)
                }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Character "${characterData.name}" ${isEditing ? 'updated' : 'saved'} successfully!`, 'success');
                await this.loadCharacters();
                this.closeCharacterModal();
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
            } else {
                this.ui.showToast(`❌ Failed to ${isEditing ? 'update' : 'save'} character`, 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.ui.showToast(`❌ Failed to ${this.editingCharacter ? 'update' : 'save'} character`, 'error');
        }
    }

    async deleteCharacter(id) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.characters.find(c => c.id === id);
        if (!character) {
            this.ui.showToast('❌ Character not found', 'error');
            return;
        }
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete "${character.name}"?\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return;

        try {
            console.log('🗑️ Deleting character:', character.name);
            
            const response = await this.auth.authenticatedFetch(
                `/api/characters/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Character "${character.name}" deleted successfully!`, 'success');
                await this.loadCharacters();
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
            } else {
                this.ui.showToast('❌ Failed to delete character', 'error');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('❌ Failed to delete character', 'error');
        }
    }

    editCharacter(id) {
        this.openEditCharacterModal(id);
    }

    onAuthStateChanged(isAuthenticated) {
        // Re-render characters to show/hide action buttons
        this.renderCharacters();
    }

    // Get characters data for other modules
    getCharacters() {
        return this.characters;
    }

    // Export characters data
    exportData() {
        const data = {
            version: "1.0",
            characters: this.characters,
            lastUpdated: new Date().toISOString()
        };
        this.ui.exportJson(data, 'adenai-characters');
    }

    // View raw JSON
    viewRawJson() {
        const data = {
            version: "1.0",
            characters: this.characters,
            lastUpdated: new Date().toISOString()
        };
        this.ui.viewRawJson(data, 'Adenai Characters - Raw JSON');
    }
}

// Create global characters instance
window.adminCharacters = new AdminCharacters();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminCharacters;
}