// admin-public/js/modules/characters/operations.js - Character Operations Module - Core CRUD functionality

class CharacterOperations {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.characters = [];
        this.apiBaseUrl = '/api/characters';
    }

    async loadCharacters() {
        try {
            console.log('👥 Loading characters from GitHub...');
            
            const response = await fetch(this.apiBaseUrl);
            const data = await response.json();
            
            this.characters = data.characters || [];
            console.log(`✅ Loaded ${this.characters.length} characters`);
            
            return this.characters;
        } catch (error) {
            console.error('❌ Failed to load characters:', error);
            this.ui.showToast('Failed to load characters', 'error');
            this.characters = [];
            throw error;
        }
    }

    async saveCharacter(characterData, editingCharacterId = null) {
        if (!this.auth.requireAuth()) return null;

        try {
            const isEditing = !!editingCharacterId;
            console.log(`💾 ${isEditing ? 'Updating' : 'Saving'} character:`, characterData.name);
            
            const response = await this.auth.authenticatedFetch(
                `${this.apiBaseUrl}${isEditing ? `/${encodeURIComponent(editingCharacterId)}` : ''}`,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(characterData)
                }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Character "${characterData.name}" ${isEditing ? 'updated' : 'saved'} successfully!`, 'success');
                
                // Refresh local data
                await this.loadCharacters();
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
                
                return result;
            } else {
                this.ui.showToast(`❌ Failed to ${isEditing ? 'update' : 'save'} character`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.ui.showToast(`❌ Failed to ${editingCharacterId ? 'update' : 'save'} character`, 'error');
            return null;
        }
    }

    async deleteCharacter(id) {
        if (!this.auth.requireAuth()) return false;
        
        const character = this.getCharacterById(id);
        if (!character) {
            this.ui.showToast('❌ Character not found', 'error');
            return false;
        }
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete "${character.name}"?\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return false;

        try {
            console.log('🗑️ Deleting character:', character.name);
            
            const response = await this.auth.authenticatedFetch(
                `${this.apiBaseUrl}/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Character "${character.name}" deleted successfully!`, 'success');
                
                // Refresh local data
                await this.loadCharacters();
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
                
                return true;
            } else {
                this.ui.showToast('❌ Failed to delete character', 'error');
                return false;
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('❌ Failed to delete character', 'error');
            return false;
        }
    }

    getCharacterById(id) {
        return this.characters.find(char => char.id === id);
    }

    getCharacters() {
        return this.characters;
    }

    filterCharacters(searchTerm, statusFilter = '', relationshipFilter = '') {
        let filteredCharacters = this.characters;
        
        // Apply status filter
        if (statusFilter && statusFilter !== '') {
            filteredCharacters = filteredCharacters.filter(character => 
                character.status === statusFilter
            );
        }
        
        // Apply relationship filter
        if (relationshipFilter && relationshipFilter !== '') {
            filteredCharacters = filteredCharacters.filter(character => 
                character.relationship === relationshipFilter
            );
        }
        
        // Apply search term filter
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filteredCharacters = filteredCharacters.filter(character => {
                const name = (character.name || '').toLowerCase();
                const title = (character.title || '').toLowerCase();
                const description = (character.description || '').toLowerCase();
                const notes = (character.notes || '').toLowerCase();
                const faction = (character.faction || '').toLowerCase();
                const placeOfOrigin = (character.placeOfOrigin || '').toLowerCase();
                
                // Use the new getCurrentLocation method for consistent search
                const currentLocation = this.getCurrentLocation(character).toLowerCase();
                
                return name.includes(term) ||
                    title.includes(term) ||
                    faction.includes(term) ||
                    placeOfOrigin.includes(term) ||
                    description.includes(term) ||
                    notes.includes(term) ||
                    currentLocation.includes(term);
            });
        }
        
        return filteredCharacters;
    }

    validateCharacterData(formData) {
        const errors = [];
        
        if (!formData.name?.trim()) {
            errors.push('Character name is required');
        }
        
        if (formData.name && formData.name.length > 100) {
            errors.push('Character name must be less than 100 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Get current location text based on priority: 1) currentLocation 2) location 3) latest movement 4) place of origin
    getCurrentLocation(character) {
        // Priority 1: currentLocation object
        if (character.currentLocation && character.currentLocation.location) {
            return character.currentLocation.location;
        }
        
        // Priority 2: location field (legacy)
        if (character.location) {
            return character.location;
        }
        
        // Priority 3: Latest movement from movementHistory
        if (character.movementHistory && character.movementHistory.length > 0) {
            // Find the movement with the highest movement_nr
            const latestMovement = character.movementHistory.reduce((latest, current) => {
                const currentNr = current.movement_nr || 0;
                const latestNr = latest.movement_nr || 0;
                return currentNr > latestNr ? current : latest;
            });
            
            if (latestMovement.location) {
                return latestMovement.location;
            }
        }
        
        // Priority 4: Place of origin
        if (character.placeOfOrigin) {
            return character.placeOfOrigin;
        }
        
        // Fallback: Unknown
        return '❓ Unbekannt';
    }

    exportData() {
        const data = {
            version: "1.0",
            characters: this.characters,
            lastUpdated: new Date().toISOString()
        };
        this.ui.exportJson(data, 'adenai-characters');
    }

    viewRawJson() {
        const data = {
            version: "1.0",
            characters: this.characters,
            lastUpdated: new Date().toISOString()
        };
        this.ui.viewRawJson(data, 'Adenai Characters - Raw JSON');
    }

    async migrateCharacterData() {
        if (!this.auth.requireAuth()) return null;

        try {
            console.log('🔄 Starting character data migration...');
            this.ui.showToast('Starting character data migration...', 'info');
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/migrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            // Check if response is ok before trying to parse
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(result.message, 'success');
                
                if (result.migratedCount > 0) {
                    // Show detailed changes
                    console.log('Migration changes:', result.changes);
                    
                    // Reload character data
                    await this.loadCharacters();
                    
                    // Show detailed results
                    const changesList = result.changes.join('\n• ');
                    const detailMessage = `Migration completed!\n\n${result.migratedCount} characters updated:\n• ${changesList}`;
                    this.ui.showToast(detailMessage, 'success', 10000); // Show for 10 seconds
                }
                
                return result;
            } else {
                this.ui.showToast('Migration failed', 'error');
                return null;
            }
        } catch (error) {
            console.error('Migration failed:', error);
            
            // Show more detailed error information
            let errorMessage = 'Migration failed';
            if (error.message.includes('Authentication required')) {
                errorMessage = 'Please log in first to perform migration';
            } else if (error.message.includes('Session expired')) {
                errorMessage = 'Session expired, please log in again';
            } else if (error.message.includes('HTTP')) {
                errorMessage = `Migration failed: ${error.message}`;
            } else {
                errorMessage = `Migration failed: ${error.message}`;
            }
            
            this.ui.showToast(errorMessage, 'error');
            return null;
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterOperations;
}