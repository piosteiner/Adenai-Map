// Character Management Module
class AdminCharacters {
    constructor() {
        this.characters = [];
        this.currentCharacterFilter = '';
        this.editingCharacter = null;
        this.editingMovement = null;
        this.savedScrollPosition = null; // Add scroll position tracking
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

        // Character movements button
        this.ui.addDelegatedListener('characters-list', '.character-movements-btn', 'click', (e) => {
            const characterId = e.target.dataset.character;
            this.openMovementModal(characterId);
        });

        // Movement form submission
        const movementForm = document.getElementById('movement-form');
        if (movementForm) {
            movementForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMovement();
            });
        }

        // Close movement modal
        const closeMovementBtn = document.querySelector('.close-movement-btn');
        if (closeMovementBtn) {
            closeMovementBtn.addEventListener('click', () => {
                this.closeMovementModal();
            });
        }

        // Movement modal backdrop click
        const movementModal = document.getElementById('character-movement-modal');
        if (movementModal) {
            movementModal.addEventListener('click', (e) => {
                if (e.target.id === 'character-movement-modal') {
                    this.closeMovementModal();
                }
            });
        }

        // Location type selection change
        const locationTypeSelect = document.getElementById('movement-location-type');
        if (locationTypeSelect) {
            locationTypeSelect.addEventListener('change', (e) => {
                this.toggleMovementLocationInputs(e.target.value);
            });
        }
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

    populateLocationDropdown(selectId = 'character-location-select') {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = '<option value="">Select location...</option>';
        
        // Get locations from the locations module
        const locations = window.adminLocations?.getLocations() || [];
        
        // 🔤 SORT LOCATIONS ALPHABETICALLY by name (case-insensitive)
        const sortedLocations = locations.sort((a, b) => {
            const nameA = a.properties.name.toLowerCase();
            const nameB = b.properties.name.toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        // Add sorted locations to dropdown
        sortedLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.properties.name;
            option.textContent = location.properties.name;
            select.appendChild(option);
        });
        
        console.log(`📍 Populated dropdown "${selectId}" with ${sortedLocations.length} sorted locations`);
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

        container.innerHTML = '';
        
        filteredCharacters.forEach(character => {
            const cardElement = document.createElement('div');
            cardElement.innerHTML = this.renderCharacterCard(character);
            
            // Add history button to the card if ActivityModule is available
            if (window.ActivityModule && typeof window.ActivityModule.addHistoryButton === 'function') {
                setTimeout(() => {
                    window.ActivityModule.addHistoryButton(cardElement, 'characters', character.name);
                }, 0);
            }
            
            container.appendChild(cardElement);
        });
    }

    renderCharacterCard(character) {
        // Count movements
        const movementCount = character.movementHistory ? character.movementHistory.length : 0;
        const hasMovements = movementCount > 0;
        
        // Only show edit/delete buttons if authenticated
        const actionButtons = this.auth.isAuthenticated ? `
            <div class="character-actions">
                <button class="btn-secondary character-edit-btn" data-character="${character.id}">✏️ Edit</button>
                <button class="btn-secondary character-movements-btn" data-character="${character.id}">🛤️ Movements (${movementCount})</button>
                <button class="btn-danger character-delete-btn" data-character="${character.id}">🗑️ Delete</button>
            </div>
        ` : '';
        
        // Show latest movement info
        const latestMovement = hasMovements ? 
            character.movementHistory[character.movementHistory.length - 1] : null;
        
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
                    ${character.location ? `<p><strong>📍 Current Location:</strong> ${character.location}</p>` : ''}
                    ${character.coordinates ? `<p><strong>🗺️ Coordinates:</strong> [${character.coordinates[0]}, ${character.coordinates[1]}]</p>` : '<p><strong>⚠️ Coordinates:</strong> <em style="color: orange;">Not set</em></p>'}
                    ${character.faction ? `<p><strong>🛡️ Faction:</strong> ${character.faction}</p>` : ''}
                    ${character.firstMet ? `<p><strong>📅 First Met:</strong> ${character.firstMet}</p>` : ''}
                    ${hasMovements ? `<p><strong>🛤️ Movement History:</strong> ${movementCount} locations</p>` : ''}
                    ${latestMovement ? `<p><strong>📍 Last Seen:</strong> ${latestMovement.location || 'Custom Location'} (${latestMovement.date})</p>` : ''}
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
        
        // Reset editing state and scroll position for new characters
        this.editingCharacter = null;
        this.savedScrollPosition = null;
        
        // Update modal title and button text
        document.querySelector('#add-character-modal .modal-header h3').textContent = 'Add New Character';
        document.querySelector('#character-form button[type="submit"]').textContent = '💾 Save Character';
        
        this.populateLocationDropdown(); // Refresh location options
        this.ui.openModal('add-character-modal');
    }

    openEditCharacterModal(characterId) {
        if (!this.auth.requireAuth()) return;
        
        // Save current scroll position before opening modal
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        console.log('📍 Saved scroll position:', this.savedScrollPosition);
        
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
        // Note: We don't clear savedScrollPosition here in case we need it for restoration
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
                
                // Restore scroll position for edits (not for new characters)
                if (isEditing && this.savedScrollPosition !== null) {
                    setTimeout(() => {
                        console.log('📍 Restoring scroll position to:', this.savedScrollPosition);
                        window.scrollTo({
                            top: this.savedScrollPosition,
                            behavior: 'smooth'
                        });
                        this.savedScrollPosition = null; // Clear after use
                    }, 100); // Small delay to ensure content is rendered
                }
                
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

    // Open movement management modal
    openMovementModal(characterId) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.characters.find(char => char.id === characterId);
        if (!character) {
            this.ui.showToast('❌ Character not found', 'error');
            return;
        }
        
        this.editingCharacter = characterId;
        this.editingMovement = null;
        
        // Update modal title
        document.querySelector('#character-movement-modal .modal-header h3').textContent = `🛤️ ${character.name} - Movement History`;
        
        // Populate location dropdown for movements
        this.populateLocationDropdown('movement-location-select');
        
        // Render movement history
        this.renderMovementHistory(character);
        
        // Reset form
        const form = document.getElementById('movement-form');
        if (form) form.reset();
        document.getElementById('movement-location-type').value = 'existing';
        this.toggleMovementLocationInputs('existing');
        
        this.ui.openModal('character-movement-modal');
    }

    // Render movement history in modal
    renderMovementHistory(character) {
        const container = document.getElementById('movement-history-list');
        if (!container) return;
        
        const movements = character.movementHistory || [];
        
        if (movements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>🛤️ No movement history yet</p>
                    <p style="font-size: 0.9em; opacity: 0.7;">Add the first movement entry below</p>
                </div>
            `;
            return;
        }
        
        // Sort movements by date (newest first for display)
        const sortedMovements = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        container.innerHTML = sortedMovements.map(movement => `
            <div class="movement-entry" data-movement-id="${movement.id}">
                <div class="movement-entry-header">
                    <div class="movement-info">
                        <h4>${movement.location || 'Custom Location'}</h4>
                        <span class="movement-date">📅 ${movement.date}</span>
                    </div>
                    <div class="movement-actions">
                        <button class="btn-secondary movement-edit-btn" data-movement="${movement.id}">✏️</button>
                        <button class="btn-danger movement-delete-btn" data-movement="${movement.id}">🗑️</button>
                    </div>
                </div>
                <div class="movement-details">
                    <p><strong>🗺️ Coordinates:</strong> [${movement.coordinates[0]}, ${movement.coordinates[1]}]</p>
                    <p><strong>📝 Type:</strong> ${movement.type || 'travel'}</p>
                    ${movement.notes ? `<p><strong>📋 Notes:</strong> ${movement.notes}</p>` : ''}
                    <p><strong>📝 Added:</strong> ${new Date(movement.createdAt).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for movement actions
        container.querySelectorAll('.movement-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const movementId = e.target.dataset.movement;
                this.editMovement(movementId);
            });
        });
        
        container.querySelectorAll('.movement-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const movementId = e.target.dataset.movement;
                this.deleteMovement(movementId);
            });
        });
    }

    // Toggle between existing location and custom coordinates
    toggleMovementLocationInputs(type) {
        const existingLocationDiv = document.getElementById('existing-location-input');
        const customCoordsDiv = document.getElementById('custom-coordinates-input');
        
        if (type === 'existing') {
            existingLocationDiv.style.display = 'block';
            customCoordsDiv.style.display = 'none';
        } else {
            existingLocationDiv.style.display = 'none';
            customCoordsDiv.style.display = 'block';
        }
    }

    // Save movement entry
    async saveMovement() {
        if (!this.auth.requireAuth()) return;

        const formData = this.ui.getFormData('movement-form');
        if (!formData) return;

        // Validate form based on location type
        const locationType = formData.movementLocationType;
        let isValid;
        
        if (locationType === 'existing') {
            isValid = this.ui.validateForm('movement-form', {
                movementLocation: { required: true, label: 'Location' },
                movementDate: { required: true, label: 'Date' }
            });
        } else {
            isValid = this.ui.validateForm('movement-form', {
                movementX: { required: true, label: 'X Coordinate' },
                movementY: { required: true, label: 'Y Coordinate' },
                movementDate: { required: true, label: 'Date' }
            });
        }

        if (!isValid) return;
        
        // Create movement data
        const movementData = {
            date: formData.movementDate,
            type: formData.movementType || 'travel',
            notes: formData.movementNotes || ''
        };
        
        if (locationType === 'existing') {
            movementData.location = formData.movementLocation;
        } else {
            movementData.coordinates = [parseInt(formData.movementX), parseInt(formData.movementY)];
        }

        try {
            const isEditing = !!this.editingMovement;
            const characterId = this.editingCharacter;
            
            console.log(`🛤️ ${isEditing ? 'Updating' : 'Adding'} movement for character:`, characterId);
            
            const url = isEditing ? 
                `/api/characters/${encodeURIComponent(characterId)}/movements/${encodeURIComponent(this.editingMovement)}` :
                `/api/characters/${encodeURIComponent(characterId)}/movements`;
            
            const response = await this.auth.authenticatedFetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movementData)
            });

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Movement ${isEditing ? 'updated' : 'added'} successfully!`, 'success');
                
                // Refresh character data
                await this.loadCharacters();
                
                // Update movement history display
                const character = this.characters.find(c => c.id === characterId);
                if (character) {
                    this.renderMovementHistory(character);
                }
                
                // Reset form
                this.ui.resetForm('movement-form');
                this.editingMovement = null;
                
                // Update main map if it's loaded
                if (window.addCharacterMovementPaths) {
                    window.addCharacterMovementPaths();
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
            } else {
                this.ui.showToast(`❌ Failed to ${isEditing ? 'update' : 'add'} movement`, 'error');
            }
        } catch (error) {
            console.error('Movement save failed:', error);
            this.ui.showToast(`❌ Failed to ${this.editingMovement ? 'update' : 'add'} movement`, 'error');
        }
    }

    // Edit movement entry
    editMovement(movementId) {
        const character = this.characters.find(c => c.id === this.editingCharacter);
        if (!character || !character.movementHistory) return;
        
        const movement = character.movementHistory.find(m => m.id === movementId);
        if (!movement) {
            this.ui.showToast('❌ Movement not found', 'error');
            return;
        }
        
        this.editingMovement = movementId;
        
        // Determine if this is an existing location or custom coordinates
        const isExistingLocation = !!movement.location;
        
        // Populate form
        this.ui.populateForm('movement-form', {
            movementLocationType: isExistingLocation ? 'existing' : 'custom',
            movementLocation: movement.location || '',
            movementX: isExistingLocation ? '' : movement.coordinates[0],
            movementY: isExistingLocation ? '' : movement.coordinates[1],
            movementDate: movement.date,
            movementType: movement.type || 'travel',
            movementNotes: movement.notes || ''
        });
        
        // Toggle inputs based on location type
        this.toggleMovementLocationInputs(isExistingLocation ? 'existing' : 'custom');
        
        // Update form title
        document.querySelector('#movement-form button[type="submit"]').textContent = '💾 Update Movement';
    }

    // Delete movement entry
    async deleteMovement(movementId) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.characters.find(c => c.id === this.editingCharacter);
        if (!character || !character.movementHistory) return;
        
        const movement = character.movementHistory.find(m => m.id === movementId);
        if (!movement) {
            this.ui.showToast('❌ Movement not found', 'error');
            return;
        }
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete this movement?\n\n📍 ${movement.location || 'Custom Location'} (${movement.date})\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return;

        try {
            console.log('🗑️ Deleting movement:', movementId);
            
            const response = await this.auth.authenticatedFetch(
                `/api/characters/${encodeURIComponent(this.editingCharacter)}/movements/${encodeURIComponent(movementId)}`,
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast('✅ Movement deleted successfully!', 'success');
                
                // Refresh character data
                await this.loadCharacters();
                
                // Update movement history display
                const updatedCharacter = this.characters.find(c => c.id === this.editingCharacter);
                if (updatedCharacter) {
                    this.renderMovementHistory(updatedCharacter);
                }
                
                // Update main map if it's loaded
                if (window.addCharacterMovementPaths) {
                    window.addCharacterMovementPaths();
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
            } else {
                this.ui.showToast('❌ Failed to delete movement', 'error');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('❌ Failed to delete movement', 'error');
        }
    }

    // Close movement modal
    closeMovementModal() {
        this.ui.closeModal('character-movement-modal');
        this.editingCharacter = null;
        this.editingMovement = null;
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