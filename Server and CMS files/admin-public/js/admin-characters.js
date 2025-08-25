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
        this.locationDropdown = null; // Store reference to searchable dropdown
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
        
        const startDateInput = document.getElementById('movement-date-start');
        const endDateInput = document.getElementById('movement-date-end');
        
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => this.handleDateRangeChange());
            endDateInput.addEventListener('change', () => this.handleDateRangeChange());
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
            console.log('Loading characters from GitHub...');
            this.ui.showLoading('characters-list', 'Loading characters...');
            
            const response = await fetch('/api/characters');
            const data = await response.json();
            
            this.characters = data.characters || [];
            console.log(`Loaded ${this.characters.length} characters`);
            
            // Populate location dropdown
            this.populateLocationDropdown();
            this.renderCharacters();
        } catch (error) {
            console.error('Failed to load characters:', error);
            this.ui.showToast('Failed to load characters', 'error');
            this.characters = [];
            this.renderCharacters();
        }
    }

    populateLocationDropdown(selectId = 'character-location-select') {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // Get locations from the locations module
        const locations = window.adminLocations?.getLocations() || [];
        
        // SORT LOCATIONS ALPHABETICALLY by name (case-insensitive)
        const sortedLocations = locations.sort((a, b) => {
            const nameA = a.properties.name.toLowerCase();
            const nameB = b.properties.name.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Convert to format expected by SearchableLocationDropdown
        const locationOptions = sortedLocations.map(location => ({
            id: location.properties.name,
            name: location.properties.name,
            description: location.properties.description || '',
            tags: location.properties.tags || []
        }));

        // Replace the select element with searchable dropdown container
        const container = document.createElement('div');
        container.id = `${selectId}-container`;
        select.parentNode.replaceChild(container, select);

        // Initialize searchable dropdown
        if (selectId === 'movement-location-select') {
            this.movementLocationDropdown = new SearchableLocationDropdown(
                `${selectId}-container`,
                locationOptions,
                (selectedLocation) => {
                    console.log('Movement location selected:', selectedLocation);
                }
            );
        } else {
            this.locationDropdown = new SearchableLocationDropdown(
                `${selectId}-container`,
                locationOptions,
                (selectedLocation) => {
                    console.log('Character location selected:', selectedLocation);
                }
            );
        }
        
        console.log(`Populated searchable dropdown "${selectId}" with ${sortedLocations.length} sorted locations`);
    }

    renderCharacters() {
        const container = document.getElementById('characters-list');
        if (!container) return;
        
        if (this.characters.length === 0) {
            this.ui.showEmptyState('characters-list',
                'No characters yet',
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
                'No matches found',
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

    // Handle date range changes and validation
    handleDateRangeChange() {
        const startDate = document.getElementById('movement-date-start').value;
        const endDate = document.getElementById('movement-date-end').value;
        const durationDisplay = document.getElementById('duration-display');
        const durationText = document.getElementById('duration-text');
        
        // Clear any previous validation messages
        this.clearDateValidationMessages();
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Validate end date is not before start date
            if (end < start) {
                this.showDateValidationError('End date cannot be before start date');
                durationDisplay.style.display = 'none';
                return;
            }
            
            // Calculate and display duration
            const duration = this.calculateDuration(start, end);
            durationText.textContent = duration;
            durationDisplay.style.display = 'flex';
            
        } else if (startDate && !endDate) {
            // Single day movement
            durationDisplay.style.display = 'none';
        } else {
            durationDisplay.style.display = 'none';
        }
    }

    // Calculate duration between two dates
    calculateDuration(startDate, endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) {
            return 'Same day';
        } else if (daysDiff === 1) {
            return '1 day stay';
        } else if (daysDiff <= 7) {
            return `${daysDiff} days stay`;
        } else if (daysDiff <= 30) {
            const weeks = Math.ceil(daysDiff / 7);
            return weeks === 1 ? '1 week stay' : `${weeks} weeks stay`;
        } else {
            const months = Math.ceil(daysDiff / 30);
            return months === 1 ? '1 month stay' : `${months} months stay`;
        }
    }

    // Show date validation error
    showDateValidationError(message) {
        this.clearDateValidationMessages();
        
        const endDateGroup = document.getElementById('movement-date-end').parentElement;
        const errorDiv = document.createElement('div');
        errorDiv.className = 'date-validation-message';
        errorDiv.innerHTML = `${message}`;
        
        endDateGroup.appendChild(errorDiv);
        document.getElementById('movement-date-end').classList.add('error');
    }

    // Clear date validation messages
    clearDateValidationMessages() {
        const errorMessages = document.querySelectorAll('.date-validation-message');
        errorMessages.forEach(msg => msg.remove());
        
        const errorInputs = document.querySelectorAll('input[type="date"].error');
        errorInputs.forEach(input => input.classList.remove('error'));
    }

    renderCharacterCard(character) {
        // Count movements
        const movementCount = character.movementHistory ? character.movementHistory.length : 0;
        const hasMovements = movementCount > 0;
        
        // Only show edit/delete buttons if authenticated
        const actionButtons = this.auth.isAuthenticated ? `
            <div class="character-actions">
                <button class="btn-secondary character-edit-btn" data-character="${character.id}">Edit</button>
                <button class="btn-secondary character-movements-btn" data-character="${character.id}">Movements (${movementCount})</button>
                <button class="btn-danger character-delete-btn" data-character="${character.id}">Delete</button>
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
                    ${character.location ? `<p><strong>Current Location:</strong> ${character.location}</p>` : ''}
                    ${character.coordinates ? `<p><strong>Coordinates:</strong> [${character.coordinates[0]}, ${character.coordinates[1]}]</p>` : '<p><strong>Coordinates:</strong> <em style="color: orange;">Not set</em></p>'}
                    ${character.faction ? `<p><strong>Faction:</strong> ${character.faction}</p>` : ''}
                    ${character.firstMet ? `<p><strong>First Met:</strong> ${character.firstMet}</p>` : ''}
                    ${hasMovements ? `<p><strong>Movement History:</strong> ${movementCount} locations</p>` : ''}
                    ${latestMovement ? `<p><strong>Last Seen:</strong> ${latestMovement.location || 'Custom Location'} (${latestMovement.date})</p>` : ''}
                    ${character.description ? `<p><strong>Description:</strong> ${character.description}</p>` : ''}
                    ${character.notes ? `<p><strong>Notes:</strong> ${character.notes}</p>` : ''}
                </div>
                ${actionButtons}
            </div>
        `;
    }

    formatStatus(status) {
        const statuses = {
            alive: 'Alive',
            dead: 'Dead',
            missing: 'Missing',
            unknown: 'Unknown'
        };
        return statuses[status] || status;
    }

    formatRelationship(relationship) {
        const relationships = {
            ally: 'Ally',
            friendly: 'Friendly',
            neutral: 'Neutral',
            suspicious: 'Suspicious',
            hostile: 'Hostile',
            enemy: 'Enemy',
            party: 'Party'
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
        document.querySelector('#character-form button[type="submit"]').textContent = 'Save Character';
        
        this.populateLocationDropdown(); // Refresh location options
        this.ui.openModal('add-character-modal');
    }

    openEditCharacterModal(characterId) {
        if (!this.auth.requireAuth()) return;
        
        // Save current scroll position before opening modal
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        console.log('Saved scroll position:', this.savedScrollPosition);
        
        const character = this.characters.find(char => char.id === characterId);
        if (!character) {
            this.ui.showToast('Character not found', 'error');
            return;
        }
        
        // Set editing state
        this.editingCharacter = characterId;
        
        // Update modal title and button text
        document.querySelector('#add-character-modal .modal-header h3').textContent = 'Edit Character';
        document.querySelector('#character-form button[type="submit"]').textContent = 'Update Character';
        
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

        // Set the location in the searchable dropdown
        if (this.locationDropdown && character.location) {
            this.locationDropdown.setSelectedLocation(character.location);
        }
        
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

        // Get location from searchable dropdown
        const selectedLocation = this.locationDropdown?.getSelectedLocation();

        // Validate form
        const isValid = this.ui.validateForm('character-form', {
            name: { required: true, label: 'Character Name' }
        });

        if (!isValid) return;
        
        // Create character data
        const characterData = {
            name: formData.name,
            title: formData.title || '',
            location: selectedLocation?.name || '',
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
            
            console.log(`${isEditing ? 'Updating' : 'Saving'} character:`, characterData.name);
            
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
                this.ui.showToast(`Character "${characterData.name}" ${isEditing ? 'updated' : 'saved'} successfully!`, 'success');
                await this.loadCharacters();
                this.closeCharacterModal();
                
                // Restore scroll position for edits (not for new characters)
                if (isEditing && this.savedScrollPosition !== null) {
                    setTimeout(() => {
                        console.log('Restoring scroll position to:', this.savedScrollPosition);
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
                this.ui.showToast(`Failed to ${isEditing ? 'update' : 'save'} character`, 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.ui.showToast(`Failed to ${this.editingCharacter ? 'update' : 'save'} character`, 'error');
        }
    }

    async deleteCharacter(id) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.characters.find(c => c.id === id);
        if (!character) {
            this.ui.showToast('Character not found', 'error');
            return;
        }
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete "${character.name}"?\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return;

        try {
            console.log('Deleting character:', character.name);
            
            const response = await this.auth.authenticatedFetch(
                `/api/characters/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`Character "${character.name}" deleted successfully!`, 'success');
                await this.loadCharacters();
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
            } else {
                this.ui.showToast('Failed to delete character', 'error');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('Failed to delete character', 'error');
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
            this.ui.showToast('Character not found', 'error');
            return;
        }
        
        this.editingCharacter = characterId;
        this.editingMovement = null;
        
        // Update modal title
        document.querySelector('#character-movement-modal .modal-header h3').textContent = `${character.name} - Movement History`;
        
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

    // FIXED: Sort by journey sequence numbers instead of dates
    renderMovementHistory(character) {
        const container = document.getElementById('movement-history-list');
        if (!container) return;
        
        const movements = character.movementHistory || [];
        
        if (movements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No movement history yet</p>
                    <p style="font-size: 0.9em; opacity: 0.7;">Add the first movement entry below</p>
                </div>
            `;
            return;
        }
        
        // Sort movements chronologically (oldest first) to get proper journey sequence
        const chronologicalMovements = [...movements].sort((a, b) => {
            const dateA = new Date(a.dateStart || a.date);
            const dateB = new Date(b.dateStart || b.date);
            return dateA - dateB;
        });
        
        // Create a map of movement ID to journey sequence number
        const sequenceMap = new Map();
        chronologicalMovements.forEach((movement, index) => {
            sequenceMap.set(movement.id, index + 1);
        });
        
        // FIXED: Sort movements by journey sequence number (newest sequence first for display)
        const sortedMovements = [...movements].sort((a, b) => {
            const sequenceA = sequenceMap.get(a.id);
            const sequenceB = sequenceMap.get(b.id);
            return sequenceB - sequenceA; // Newest journey numbers first
        });
        
        container.innerHTML = sortedMovements.map(movement => {
            const journeyNumber = sequenceMap.get(movement.id);
            const locationDisplay = movement.location || 'Custom Location';
            const isCustom = movement.isCustomLocation || (movement.coordinates && movement.location !== movement.coordinates);
            const locationIcon = isCustom ? 'Custom' : 'Location';
            
            // Enhanced date range display
            const hasDateRange = movement.dateEnd && movement.dateEnd !== (movement.dateStart || movement.date);
            const dateDisplay = this.formatMovementDateRange(movement);
            const durationInfo = hasDateRange ? this.calculateDuration(new Date(movement.dateStart || movement.date), new Date(movement.dateEnd)) : '';
            
            return `
                <div class="movement-entry" data-movement-id="${movement.id}">
                    <div class="movement-entry-header">
                        <div class="movement-info">
                            <div class="movement-title">
                                <span class="journey-number">${journeyNumber}</span>
                                <h4>${locationDisplay}</h4>
                                ${isCustom ? '<span class="custom-location-badge">Custom</span>' : ''}
                                ${hasDateRange ? '<span class="date-range-badge">Multi-day</span>' : ''}
                            </div>
                            <div class="movement-date-container">
                                <span class="movement-date ${hasDateRange ? 'has-range' : ''}">${dateDisplay}</span>
                                ${durationInfo ? `<span class="movement-duration">${durationInfo}</span>` : ''}
                            </div>
                        </div>
                        <div class="movement-actions">
                            <button class="btn-secondary movement-edit-btn" data-movement="${movement.id}" title="Edit movement">Edit</button>
                            <button class="btn-danger movement-delete-btn" data-movement="${movement.id}" title="Delete movement">Delete</button>
                        </div>
                    </div>
                    <div class="movement-details">
                        <div class="movement-detail-row">
                            <span><strong>Coordinates:</strong> [${movement.coordinates[0]}, ${movement.coordinates[1]}]</span>
                            <span><strong>Type:</strong> ${movement.type || 'travel'}</span>
                        </div>
                        ${movement.notes ? `<p><strong>Notes:</strong> ${movement.notes}</p>` : ''}
                        <p class="movement-metadata"><strong>Added:</strong> ${new Date(movement.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add journey summary at the top (enhanced for date ranges)
        const summaryHTML = this.generateJourneySummaryWithDateRanges(chronologicalMovements);
        container.insertAdjacentHTML('afterbegin', summaryHTML);
        
        // Add event listeners for movement actions
        this.addMovementActionListeners(container);
    }

    // Updated helper method to format movement date range for CMS display  
    formatMovementDateRange(movement) {
        const startDate = movement.dateStart || movement.date;
        const endDate = movement.dateEnd;
        
        if (!startDate) return 'No date';
        
        const formatDate = (dateStr) => {
            return new Date(dateStr).toLocaleDateString('de-DE');
        };
        
        if (endDate && endDate !== startDate) {
            return `${formatDate(startDate)} <span class="date-range-arrow">→</span> ${formatDate(endDate)}`;
        } else {
            return `${formatDate(startDate)}`;
        }
    }

    // Generate enhanced journey summary with date range info
    generateJourneySummaryWithDateRanges(chronologicalMovements) {
        const totalMovements = chronologicalMovements.length;
        const multiDayMovements = chronologicalMovements.filter(m => m.dateEnd && m.dateEnd !== (m.dateStart || m.date)).length;
        
        return `
            <div class="journey-summary">
                <div class="journey-stats">
                    <span class="stat-item">
                        <span class="stat-number">${totalMovements}</span>
                        <span class="stat-label">Total Movements</span>
                    </span>
                    <span class="stat-item">
                        <span class="stat-number">${this.getUniqueLocations(chronologicalMovements)}</span>
                        <span class="stat-label">Unique Locations</span>
                    </span>
                    <span class="stat-item">
                        <span class="stat-number">${multiDayMovements}</span>
                        <span class="stat-label">Multi-day Stays</span>
                    </span>
                    <span class="stat-item">
                        <span class="stat-number">${this.getDateRange(chronologicalMovements)}</span>
                        <span class="stat-label">Journey Span</span>
                    </span>
                </div>
                <div class="journey-path-preview">
                    <strong>Journey Path:</strong> ${this.generatePathPreview(chronologicalMovements)}
                </div>
            </div>
        `;
    }

    // Add movement action listeners (extracted for clarity)
    addMovementActionListeners(container) {
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

    // ENHANCED: Updated saveMovement method with date range support
    async saveMovement() {
        if (!this.auth.requireAuth()) return;

        const formData = this.ui.getFormData('movement-form');
        if (!formData) return;

        // Get location from searchable dropdown
        const selectedLocation = this.movementLocationDropdown?.getSelectedLocation();

        // Validate form based on location type
        const locationType = formData.movementLocationType;
        let isValid;
        
        if (locationType === 'existing') {
            isValid = selectedLocation && this.ui.validateForm('movement-form', {
                movementDateStart: { required: true, label: 'Start Date' }
            });
            
            if (!selectedLocation) {
                this.ui.showToast('Please select a location', 'error');
                return;
            }
        } else {
            isValid = this.ui.validateForm('movement-form', {
                movementCustomName: { required: true, label: 'Custom Location Name' },
                movementX: { required: true, label: 'X Coordinate' },
                movementY: { required: true, label: 'Y Coordinate' },
                movementDateStart: { required: true, label: 'Start Date' }
            });
        }

        // NEW: Additional date range validation
        if (isValid) {
            const startDate = formData.movementDateStart;
            const endDate = formData.movementDateEnd;
            
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                if (end < start) {
                    this.showDateValidationError('End date cannot be before start date');
                    return;
                }
            }
        }

        if (!isValid) return;
        
        // Create movement data with date range support
        const movementData = {
            dateStart: formData.movementDateStart,
            dateEnd: formData.movementDateEnd || null,
            type: formData.movementType || 'travel',
            notes: formData.movementNotes || ''
        };
        
        // ENHANCED: Include legacy date field for compatibility
        movementData.date = formData.movementDateStart;
        
        if (locationType === 'existing') {
            movementData.location = selectedLocation.name;
        } else {
            movementData.location = formData.movementCustomName;
            movementData.coordinates = [parseInt(formData.movementX), parseInt(formData.movementY)];
            movementData.isCustomLocation = true;
        }

        try {
            const isEditing = !!this.editingMovement;
            const characterId = this.editingCharacter;
            
            console.log(`${isEditing ? 'Updating' : 'Adding'} movement with date range for character:`, characterId);
            
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
                this.ui.showToast(`Movement ${isEditing ? 'updated' : 'added'} successfully!`, 'success');
                
                // Refresh character data
                await this.loadCharacters();
                
                // Update movement history display
                const character = this.characters.find(c => c.id === characterId);
                if (character) {
                    this.renderMovementHistory(character);
                }
                
                // Reset form and clear validation
                this.ui.resetForm('movement-form');
                this.clearDateValidationMessages();
                document.getElementById('duration-display').style.display = 'none';
                this.editingMovement = null;
                
                // Update main map if it's loaded
                if (window.addCharacterMovementPaths) {
                    window.addCharacterMovementPaths();
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
            } else {
                this.ui.showToast(`Failed to ${isEditing ? 'update' : 'add'} movement`, 'error');
            }
        } catch (error) {
            console.error('Movement save failed:', error);
            this.ui.showToast(`Failed to ${this.editingMovement ? 'update' : 'add'} movement`, 'error');
        }
    }

    // Helper method to count unique locations
    getUniqueLocations(movements) {
        const locations = new Set();
        movements.forEach(movement => {
            const locationKey = `${movement.coordinates[0]},${movement.coordinates[1]}`;
            locations.add(locationKey);
        });
        return locations.size;
    }

    // Helper method to get date range
    getDateRange(movements) {
        if (movements.length === 0) return 'N/A';
        
        const dates = movements.map(m => new Date(m.date)).sort((a, b) => a - b);
        const start = dates[0];
        const end = dates[dates.length - 1];
        
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) return 'Same day';
        if (daysDiff === 1) return '1 day';
        if (daysDiff < 30) return `${daysDiff} days`;
        if (daysDiff < 365) return `${Math.ceil(daysDiff / 30)} months`;
        return `${Math.ceil(daysDiff / 365)} years`;
    }

    // Helper method to generate path preview
    generatePathPreview(chronologicalMovements) {
        if (chronologicalMovements.length === 0) return 'No movements';
        
        // Show first few locations in the journey
        const preview = chronologicalMovements
            .slice(0, 4)
            .map((movement, index) => {
                const name = movement.location || 'Custom';
                const shortName = name.length > 15 ? name.substring(0, 12) + '...' : name;
                return `<span class="path-step">${index + 1}. ${shortName}</span>`;
            })
            .join(' → ');
        
        const remaining = chronologicalMovements.length - 4;
        const suffix = remaining > 0 ? ` → ... +${remaining} more` : '';
        
        return `<div class="path-preview">${preview}${suffix}</div>`;
    }

    // ENHANCED: Updated editMovement method with date range support
    editMovement(movementId) {
        const character = this.characters.find(c => c.id === this.editingCharacter);
        if (!character || !character.movementHistory) return;
        
        const movement = character.movementHistory.find(m => m.id === movementId);
        if (!movement) {
            this.ui.showToast('Movement not found', 'error');
            return;
        }
        
        this.editingMovement = movementId;
        
        // Determine if this is an existing location or custom coordinates
        const isCustomLocation = movement.isCustomLocation || (movement.coordinates && !movement.location);
        
        // Populate form with date range support
        const formValues = {
            movementLocationType: isCustomLocation ? 'custom' : 'existing',
            movementDateStart: movement.dateStart || movement.date, // Fallback to legacy date
            movementDateEnd: movement.dateEnd || '', // Optional end date
            movementType: movement.type || 'travel',
            movementNotes: movement.notes || ''
        };
        
        if (isCustomLocation) {
            formValues.movementCustomName = movement.location || 'Custom Location';
            formValues.movementX = movement.coordinates ? movement.coordinates[0] : '';
            formValues.movementY = movement.coordinates ? movement.coordinates[1] : '';
        } else {
            // Set the location in the searchable dropdown
            if (this.movementLocationDropdown && movement.location) {
                this.movementLocationDropdown.setSelectedLocation(movement.location);
            }
        }
        
        this.ui.populateForm('movement-form', formValues);
        
        // Toggle inputs based on location type
        this.toggleMovementLocationInputs(isCustomLocation ? 'custom' : 'existing');
        
        // Update duration display if end date exists
        setTimeout(() => this.handleDateRangeChange(), 100);
        
        // Update form title
        document.querySelector('#movement-form button[type="submit"]').textContent = 'Update Movement';
    }

    // Delete movement entry
    async deleteMovement(movementId) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.characters.find(c => c.id === this.editingCharacter);
        if (!character || !character.movementHistory) return;
        
        const movement = character.movementHistory.find(m => m.id === movementId);
        if (!movement) {
            this.ui.showToast('Movement not found', 'error');
            return;
        }
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete this movement?\n\n${movement.location || 'Custom Location'} (${movement.date})\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return;

        try {
            console.log('Deleting movement:', movementId);
            
            const response = await this.auth.authenticatedFetch(
                `/api/characters/${encodeURIComponent(this.editingCharacter)}/movements/${encodeURIComponent(movementId)}`,
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast('Movement deleted successfully!', 'success');
                
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
                this.ui.showToast('Failed to delete movement', 'error');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('Failed to delete movement', 'error');
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

// Searchable Location Dropdown Class
class SearchableLocationDropdown {
    constructor(containerId, locations, onSelectionCallback) {
        this.container = document.getElementById(containerId);
        this.locations = locations || [];
        this.filteredLocations = [...this.locations];
        this.onSelectionCallback = onSelectionCallback;
        this.selectedLocation = null;
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        this.createDropdownHTML();
        this.attachEventListeners();
    }
    
    createDropdownHTML() {
        this.container.innerHTML = `
            <div class="searchable-dropdown">
                <div class="dropdown-input-container">
                    <input 
                        type="text" 
                        class="location-search-input" 
                        placeholder="Type to search locations..."
                        autocomplete="off"
                    >
                    <button type="button" class="dropdown-toggle-btn">▼</button>
                </div>
                <ul class="dropdown-options" style="display: none;">
                    ${this.renderOptions()}
                </ul>
            </div>
        `;
        
        this.input = this.container.querySelector('.location-search-input');
        this.optionsList = this.container.querySelector('.dropdown-options');
        this.toggleBtn = this.container.querySelector('.dropdown-toggle-btn');
    }
    
    renderOptions() {
        if (this.filteredLocations.length === 0) {
            return '<li class="no-results">No locations found</li>';
        }
        
        return this.filteredLocations.map(location => `
            <li class="dropdown-option" data-location-id="${location.id}">
                <span class="location-icon">📍</span>
                <div class="location-info">
                    <div class="location-name">${location.name}</div>
                    ${location.description ? `<div class="location-description">${location.description}</div>` : ''}
                </div>
            </li>
        `).join('');
    }
    
    attachEventListeners() {
        // Search input
        this.input.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        this.input.addEventListener('focus', () => {
            this.openDropdown();
        });
        
        // Toggle button
        this.toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.isOpen ? this.closeDropdown() : this.openDropdown();
        });
        
        // Option selection
        this.optionsList.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option');
            if (option && !option.classList.contains('no-results')) {
                this.selectLocation(option);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });
    }
    
    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (term === '') {
            this.filteredLocations = [...this.locations];
        } else {
            this.filteredLocations = this.locations.filter(location => {
                return location.name.toLowerCase().includes(term) ||
                       (location.description && location.description.toLowerCase().includes(term)) ||
                       (location.tags && location.tags.some(tag => tag.toLowerCase().includes(term)));
            });
        }
        
        this.updateOptionsList();
        this.openDropdown();
    }
    
    updateOptionsList() {
        this.optionsList.innerHTML = this.renderOptions();
    }
    
    selectLocation(optionElement) {
        const locationId = optionElement.dataset.locationId;
        const location = this.locations.find(loc => loc.id === locationId);
        
        if (location) {
            this.selectedLocation = location;
            this.input.value = location.name;
            this.closeDropdown();
            
            if (this.onSelectionCallback) {
                this.onSelectionCallback(location);
            }
        }
    }
    
    openDropdown() {
        this.isOpen = true;
        this.optionsList.style.display = 'block';
        this.toggleBtn.textContent = '▲';
        this.container.classList.add('dropdown-open');
    }
    
    closeDropdown() {
        this.isOpen = false;
        this.optionsList.style.display = 'none';
        this.toggleBtn.textContent = '▼';
        this.container.classList.remove('dropdown-open');
    }
    
    handleKeyNavigation(e) {
        const options = this.optionsList.querySelectorAll('.dropdown-option:not(.no-results)');
        let currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('highlighted'));
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
                this.highlightOption(options, currentIndex);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
                this.highlightOption(options, currentIndex);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (currentIndex >= 0 && options[currentIndex]) {
                    this.selectLocation(options[currentIndex]);
                }
                break;
                
            case 'Escape':
                this.closeDropdown();
                break;
        }
    }
    
    highlightOption(options, index) {
        options.forEach(opt => opt.classList.remove('highlighted'));
        if (options[index]) {
            options[index].classList.add('highlighted');
            options[index].scrollIntoView({ block: 'nearest' });
        }
    }
    
    // Public method to update locations
    updateLocations(newLocations) {
        this.locations = newLocations;
        this.filteredLocations = [...newLocations];
        this.updateOptionsList();
    }
    
    // Public method to get selected location
    getSelectedLocation() {
        return this.selectedLocation;
    }
    
    // Public method to set selected location by name
    setSelectedLocation(locationName) {
        const location = this.locations.find(loc => loc.name === locationName);
        if (location) {
            this.selectedLocation = location;
            this.input.value = location.name;
        }
    }
    
    // Public method to clear selection
    clear() {
        this.selectedLocation = null;
        this.input.value = '';
        this.filteredLocations = [...this.locations];
        this.updateOptionsList();
        this.closeDropdown();
    }
}

// Create global characters instance
window.adminCharacters = new AdminCharacters();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminCharacters;
}