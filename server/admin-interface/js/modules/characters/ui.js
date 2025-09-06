// admin-public/js/modules/characters/ui.js - Character UI Module - DOM rendering and UI interactions

class CharacterUI {
    constructor(ui, auth, characterOps, characterMovements) {
        this.ui = ui;
        this.auth = auth;
        this.characterOps = characterOps;
        this.characterMovements = characterMovements;
        this.currentCharacterFilter = '';
        this.savedScrollPosition = null;
    }

    renderCharacters(characters = null, searchTerm = '', statusFilter = '', relationshipFilter = '') {
        const container = document.getElementById('characters-list');
        if (!container) return;
        
        const charactersToRender = characters || this.characterOps.getCharacters();

        if (charactersToRender.length === 0) {
            this.ui.showEmptyState('characters-list',
                '👥 No characters yet',
                'Add your first campaign character to get started!'
            );
            return;
        }

        // Apply all filters
        const filteredCharacters = searchTerm || statusFilter || relationshipFilter ? 
            this.filterCharactersLocal(charactersToRender, searchTerm, statusFilter, relationshipFilter) : 
            charactersToRender;

        if (filteredCharacters.length === 0) {
            this.ui.showEmptyState('characters-list',
                '🔍 No matches found',
                'Try adjusting your search terms or filters'
            );
            return;
        }

        // Sort characters alphabetically by name
        const sortedCharacters = [...filteredCharacters].sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        container.innerHTML = '';
        
        sortedCharacters.forEach(character => {
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
            <div class="character-card" data-id="${character.id}" data-character-relationship="${character.relationship}">
                <div class="character-header">
                    <div class="character-info">
                        ${character.image ? `<div class="character-image">
                            <img src="${character.image}" alt="${character.name}" />
                        </div>` : ''}
                        <div class="character-text">
                            <h3>${character.name}</h3>
                            ${character.title ? `<p class="character-title">${character.title}</p>` : ''}
                        </div>
                    </div>
                    <div class="character-status">
                        <span class="status-badge status-${character.status}">${this.formatStatus(character.status)}</span>
                        <span class="relationship-badge relationship-${character.relationship}">${this.formatRelationship(character.relationship)}</span>
                    </div>
                </div>
                <div class="character-details">
                    ${character.faction ? `<p><strong>🛡️ Faction:</strong> ${character.faction}</p>` : ''}
                    ${latestMovement ? `<p><strong>📍 Last Seen:</strong> ${latestMovement.location || 'Custom Location'} (${latestMovement.date})</p>` : '<p><strong>📍 Last Seen:</strong> <em style="color: orange;">Whereabouts unknown</em></p>'}
                    <p><strong>🏡 Place of Origin:</strong> ${character.placeOfOrigin || '<em style="color: orange;">Place of origin unknown</em>'}</p>
                    ${hasMovements ? `<p><strong>🛤️ Movement History:</strong> ${movementCount} locations</p>` : ''}
                    ${character.firstMet ? `<p><strong>📅 First Met:</strong> ${character.firstMet}</p>` : ''}
                    ${character.description ? `<p><strong>📝 Description:</strong> ${character.description}</p>` : ''}
                    ${character.notes ? `<p><strong>📋 Notes:</strong> ${character.notes}</p>` : ''}
                </div>
                ${actionButtons}
            </div>
        `;
    }

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
        
        // Get properly sequenced movements
        const { sequenceMap, chronologicalMovements } = this.characterMovements.createSequenceMap(movements);
        
        // Clear container for movement list
        container.innerHTML = '';
        
        // Use the new rendering method with reordering controls
        try {
            this.characterMovements.renderMovementListWithReordering(
                movements, 
                container, 
                (reorderedMovements) => {
                    // Callback for when movements are reordered
                    console.log('🔄 Movements reordered, updating backend...');
                    character.movementHistory = reorderedMovements;
                    
                    // Update the backend with new order
                    this.characterMovements.updateMovementOrder(character.id, reorderedMovements)
                        .then(success => {
                            if (success) {
                                this.ui.showToast('✅ Movement order updated!', 'success');
                                // Re-render to show updated journey numbers
                                this.renderMovementHistory(character);
                            }
                        });
                },
                sequenceMap
            );
        } catch (error) {
            console.error('❌ Failed to render reorderable movement list:', error);
            // Fallback to basic rendering
            container.innerHTML += `<div class="error-message">⚠️ Reordering controls temporarily unavailable. Please refresh the page.</div>`;
        }
    }

    populateLocationDropdown(selectId = 'character-location-select') {
        const select = document.getElementById(selectId);
        if (!select) {
            console.error(`❌ Element not found: ${selectId}`);
            return;
        }
        
        select.innerHTML = '<option value="">Select location...</option>';
        
        // Get locations from the locations module
        const locations = window.adminLocations?.getLocations() || [];
        
        // Sort locations alphabetically by name (case-insensitive)
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

    populateCharacterForm(character = null) {
        const isEditing = !!character;
        
        // Update modal title and button text
        document.querySelector('#add-character-modal .modal-header h3').textContent = 
            isEditing ? 'Edit Character' : 'Add New Character';
        document.querySelector('#character-form button[type="submit"]').textContent = 
            isEditing ? '💾 Update Character' : '💾 Save Character';
        
        // Populate place of origin dropdown
        this.populateLocationDropdown('character-origin-select');
        
        if (character) {
            // Pre-fill form with current data
            this.ui.populateForm('character-form', {
                name: character.name || '',
                title: character.title || '',
                placeOfOrigin: character.placeOfOrigin || '',
                description: character.description || '',
                image: character.image || '',
                status: character.status || 'alive',
                faction: character.faction || '',
                relationship: character.relationship || 'neutral',
                firstMet: character.firstMet || '',
                notes: character.notes || ''
            });
        } else {
            // Clear form
            this.ui.resetForm('character-form');
        }
    }

    populateMovementForm(movement = null) {
        if (movement) {
            // Determine if this is an existing location or custom coordinates
            const isCustomLocation = movement.isCustomLocation === true;
            
            // Populate form with date range support
            const formValues = {
                movementLocationType: isCustomLocation ? 'custom' : 'existing',
                movementDateStart: movement.dateStart || movement.date,
                movementDateEnd: movement.dateEnd || '',
                movementType: movement.type || 'travel',
                movementNotes: movement.notes || ''
            };
            
            if (isCustomLocation) {
                formValues.movementCustomName = movement.location || 'Custom Location';
                formValues.movementX = movement.coordinates ? movement.coordinates[0] : '';
                formValues.movementY = movement.coordinates ? movement.coordinates[1] : '';
            } else {
                formValues.movementLocation = movement.location || '';
            }
            
            this.ui.populateForm('movement-form', formValues);
            
            // Toggle inputs based on location type
            this.toggleMovementLocationInputs(isCustomLocation ? 'custom' : 'existing');
            
            // Update form title
            document.querySelector('#movement-form button[type="submit"]').textContent = '💾 Update Movement';
        } else {
            // Reset form and clear validation
            this.ui.resetForm('movement-form');
            this.characterMovements.clearDateValidationMessages();
            document.getElementById('duration-display').style.display = 'none';
            
            // Set default date to June 5663
            const defaultDate = '5663-06-01'; // June 1st, 5663
            document.getElementById('movement-date-start').value = defaultDate;
            
            // Reset form title
            document.querySelector('#movement-form button[type="submit"]').textContent = '💾 Add Movement';
        }
    }

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

    formatStatus(status) {
        return AdenaiConfig.getCharacterStatusLabel(status);
    }

    formatRelationship(relationship) {
        return AdenaiConfig.getCharacterRelationshipLabel(relationship);
    }

    saveScrollPosition() {
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        console.log('📍 Saved scroll position:', this.savedScrollPosition);
    }

    restoreScrollPosition() {
        if (this.savedScrollPosition !== null) {
            setTimeout(() => {
                console.log('📍 Restoring scroll position to:', this.savedScrollPosition);
                window.scrollTo({
                    top: this.savedScrollPosition,
                    behavior: 'smooth'
                });
                this.savedScrollPosition = null; // Clear after use
            }, 100); // Small delay to ensure content is rendered
        }
    }

    updateMovementModal(character) {
        if (!character) return;
        
        // Update modal title
        document.querySelector('#character-movement-modal .modal-header h3').textContent = 
            `🛤️ ${character.name} - Movement History`;
        
        // Populate location dropdown for movements
        this.populateLocationDropdown('movement-location-select');
        
        // Render movement history
        this.renderMovementHistory(character);
        
        // Reset form
        this.populateMovementForm();
        
        // Set default date to June 5663 when opening new movement
        const defaultDate = '5663-06-01'; // June 1st, 5663
        document.getElementById('movement-date-start').value = defaultDate;
        
        document.getElementById('movement-location-type').value = 'existing';
        this.toggleMovementLocationInputs('existing');
    }

    handleDateRangeChange() {
        const startDateInput = document.getElementById('movement-date-start');
        const endDateInput = document.getElementById('movement-date-end');
        
        if (!startDateInput || !endDateInput) return;
        
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const durationDisplay = document.getElementById('duration-display');
        const durationText = document.getElementById('duration-text');
        
        // Clear any previous validation messages
        this.characterMovements.clearDateValidationMessages();
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Validate end date is not before start date
            if (end < start) {
                this.characterMovements.showDateValidationError('End date cannot be before start date');
                durationDisplay.style.display = 'none';
                return;
            }
            
            // Calculate and display duration
            const duration = this.characterMovements.calculateDuration(start, end);
            durationText.textContent = duration;
            durationDisplay.style.display = 'flex';
            
        } else if (startDate && !endDate) {
            // Single day movement
            durationDisplay.style.display = 'none';
        } else {
            durationDisplay.style.display = 'none';
        }
    }

    populateFilterDropdowns() {
        this.populateStatusFilter();
        this.populateRelationshipFilter();
    }

    populateStatusFilter() {
        const statusSelect = document.getElementById('character-status-filter');
        if (!statusSelect) return;

        // Clear existing options except the first one
        statusSelect.innerHTML = '<option value="">All Status</option>';

        // Get all available status options from config
        const statusOptions = AdenaiConfig.getSelectOptionsArray('characterStatus');

        statusOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            statusSelect.appendChild(optionElement);
        });
    }

    populateRelationshipFilter() {
        const relationshipSelect = document.getElementById('character-relationship-filter');
        if (!relationshipSelect) return;

        // Clear existing options except the first one
        relationshipSelect.innerHTML = '<option value="">All Relationships</option>';

        // Get all available relationship options from config
        const relationshipOptions = AdenaiConfig.getSelectOptionsArray('characterRelationships');

        relationshipOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            relationshipSelect.appendChild(optionElement);
        });
    }

    filterCharactersLocal(characters, searchTerm, statusFilter = '', relationshipFilter = '') {
        let filteredCharacters = characters;
        
        // Apply status filter
        if (statusFilter) {
            filteredCharacters = filteredCharacters.filter(character => 
                character.status === statusFilter
            );
        }
        
        // Apply relationship filter
        if (relationshipFilter) {
            filteredCharacters = filteredCharacters.filter(character => 
                character.relationship === relationshipFilter
            );
        }
        
        // Apply search term filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredCharacters = filteredCharacters.filter(character => {
                const name = character.name?.toLowerCase() || '';
                const title = character.title?.toLowerCase() || '';
                const faction = character.faction?.toLowerCase() || '';
                const placeOfOrigin = (character.placeOfOrigin || '').toLowerCase();
                const description = character.description?.toLowerCase() || '';
                const notes = character.notes?.toLowerCase() || '';
                
                // Get last seen location from movement history
                const lastSeenLocation = character.movementHistory && character.movementHistory.length > 0 
                    ? (character.movementHistory[character.movementHistory.length - 1].location || '').toLowerCase()
                    : '';
                
                return name.includes(term) || 
                    title.includes(term) || 
                    faction.includes(term) ||
                    placeOfOrigin.includes(term) ||
                    description.includes(term) ||
                    notes.includes(term) ||
                    lastSeenLocation.includes(term);
            });
        }
        
        return filteredCharacters;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterUI;
}