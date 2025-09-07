// admin-public/js/modules/characters/index.js - Character Management Module - Main Coordinator

class AdminCharacters {
    constructor() {
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.editingCharacter = null;
        this.editingMovement = null;
        
        // Initialize sub-modules
        this.operations = new CharacterOperations(this.auth, this.ui);
        this.movements = new CharacterMovements(this.auth, this.ui);
        this.uiManager = new CharacterUI(this.ui, this.auth, this.operations, this.movements);
        
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
        
        // Date range change listeners
        const startDateInput = document.getElementById('movement-date-start');
        const endDateInput = document.getElementById('movement-date-end');
        
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => this.uiManager.handleDateRangeChange());
            endDateInput.addEventListener('change', () => this.uiManager.handleDateRangeChange());
        }

        // Character search and filter functionality
        const characterSearch = document.getElementById('character-search');
        const statusFilter = document.getElementById('character-status-filter');
        const relationshipFilter = document.getElementById('character-relationship-filter');
        
        const performFilter = () => {
            const searchTerm = characterSearch ? characterSearch.value : '';
            const status = statusFilter ? statusFilter.value : '';
            const relationship = relationshipFilter ? relationshipFilter.value : '';
            this.uiManager.renderCharacters(null, searchTerm, status, relationship);
        };
        
        if (characterSearch) {
            characterSearch.addEventListener('input', this.ui.debounce(performFilter, 300));
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', performFilter);
        }
        
        if (relationshipFilter) {
            relationshipFilter.addEventListener('change', performFilter);
        }

        // Modal close handlers
        const closeCharacterBtn = document.querySelector('.close-character-btn');
        if (closeCharacterBtn) {
            closeCharacterBtn.addEventListener('click', () => this.closeCharacterModal());
        }

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

        this.ui.addDelegatedListener('characters-list', '.character-movements-btn', 'click', (e) => {
            const characterId = e.target.dataset.character;
            this.openMovementModal(characterId);
        });

        // Movement form and modal handlers
        this.setupMovementEventListeners();

        // Location type selection change
        const locationTypeSelect = document.getElementById('movement-location-type');
        if (locationTypeSelect) {
            locationTypeSelect.addEventListener('change', (e) => {
                this.uiManager.toggleMovementLocationInputs(e.target.value);
            });
        }
    }

    setupMovementEventListeners() {
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
            closeMovementBtn.addEventListener('click', () => this.closeMovementModal());
        }

        const movementModal = document.getElementById('character-movement-modal');
        if (movementModal) {
            movementModal.addEventListener('click', (e) => {
                if (e.target.id === 'character-movement-modal') {
                    this.closeMovementModal();
                }
            });
        }

        // Movement action buttons (delegated)
        document.addEventListener('click', (e) => {
            if (e.target.matches('.movement-edit-btn')) {
                const movementId = e.target.dataset.movement;
                this.editMovement(movementId);
            }
            
            if (e.target.matches('.movement-delete-btn')) {
                const movementId = e.target.dataset.movement;
                this.deleteMovement(movementId);
            }
        });

        // Character image hover popup functionality
        this.setupImagePopup();
    }

    setupImagePopup() {
        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'character-image-popup';
        popup.innerHTML = '<img src="" alt="Character Image">';
        document.body.appendChild(popup);

        // Event delegation for character image hover
        document.addEventListener('mouseenter', (e) => {
            if (e.target.matches('.character-image img')) {
                this.showImagePopup(e, popup);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (e.target.matches('.character-image img')) {
                this.hideImagePopup(popup);
            }
        }, true);

        document.addEventListener('mousemove', (e) => {
            if (e.target.matches('.character-image img') && popup.classList.contains('show')) {
                this.updatePopupPosition(e, popup);
            }
        });
    }

    showImagePopup(event, popup) {
        const img = event.target;
        const popupImg = popup.querySelector('img');
        
        // Set the image source
        popupImg.src = img.src;
        popupImg.alt = img.alt;
        
        // Position and show popup
        this.updatePopupPosition(event, popup);
        popup.classList.add('show');
    }

    hideImagePopup(popup) {
        popup.classList.remove('show');
    }

    updatePopupPosition(event, popup) {
        const margin = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Get popup dimensions (approximate)
        const popupWidth = 300; // max-width from CSS
        const popupHeight = 400; // max-height from CSS
        
        let left = event.clientX + margin;
        let top = event.clientY + margin;
        
        // Check if popup would go off the right edge
        if (left + popupWidth > viewportWidth) {
            left = event.clientX - popupWidth - margin;
        }
        
        // Check if popup would go off the bottom edge  
        if (top + popupHeight > viewportHeight) {
            top = event.clientY - popupHeight - margin;
        }
        
        // Ensure popup doesn't go off the left or top edges
        left = Math.max(margin, left);
        top = Math.max(margin, top);
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    async loadCharacters() {
        try {
            this.ui.showLoading('characters-list', 'Loading characters...');
            
            const characters = await this.operations.loadCharacters();
            this.uiManager.populateLocationDropdown();
            this.uiManager.populateFilterDropdowns();
            this.uiManager.renderCharacters(characters);
            
        } catch (error) {
            console.error('Failed to load characters:', error);
            this.uiManager.renderCharacters([]);
        }
    }

    openAddCharacterModal() {
        if (!this.auth.requireAuth()) return;
        
        this.editingCharacter = null;
        this.uiManager.populateCharacterForm();
        this.ui.openModal('add-character-modal');
        
        // Reinitialize media picker for this modal
        if (window.mediaPicker) {
            window.mediaPicker.reinitialize();
        }
    }

    editCharacter(characterId) {
        if (!this.auth.requireAuth()) return;
        
        this.uiManager.saveScrollPosition();
        
        const character = this.operations.getCharacterById(characterId);
        if (!character) {
            this.ui.showToast('Character not found', 'error');
            return;
        }
        
        this.editingCharacter = characterId;
        this.uiManager.populateCharacterForm(character);
        this.ui.openModal('add-character-modal');
        
        // Reinitialize media picker for this modal
        if (window.mediaPicker) {
            window.mediaPicker.reinitialize();
        }
    }

    closeCharacterModal() {
        this.ui.closeModal('add-character-modal');
        this.editingCharacter = null;
    }

    async saveCharacter() {
        const formData = this.ui.getFormData('character-form');
        if (!formData) return;

        // Validate form
        const validation = this.operations.validateCharacterData(formData);
        if (!validation.isValid) {
            validation.errors.forEach(error => this.ui.showToast(error, 'error'));
            return;
        }
        
        const result = await this.operations.saveCharacter(formData, this.editingCharacter);
        if (result) {
            await this.loadCharacters();
            this.closeCharacterModal();
            
            // Reset media picker to clear any selections
            if (window.mediaPicker) {
                window.mediaPicker.reset();
            }
            
            // Restore scroll position for edits
            if (this.editingCharacter) {
                this.uiManager.restoreScrollPosition();
            }
        }
    }

    async deleteCharacter(id) {
        const success = await this.operations.deleteCharacter(id);
        if (success) {
            await this.loadCharacters();
        }
    }

    // Movement Management
    openMovementModal(characterId) {
        if (!this.auth.requireAuth()) return;
        
        const character = this.operations.getCharacterById(characterId);
        if (!character) {
            this.ui.showToast('Character not found', 'error');
            return;
        }
        
        this.editingCharacter = characterId;
        this.editingMovement = null;
        this.uiManager.updateMovementModal(character);
        this.ui.openModal('character-movement-modal');
    }

    async saveMovement() {
        if (!this.editingCharacter) return;

        const formData = this.ui.getFormData('movement-form');
        if (!formData) return;

        // Process form data into movement format
        const movementData = this.prepareMovementData(formData);
        
        const result = await this.movements.saveMovement(
            this.editingCharacter, 
            movementData, 
            this.editingMovement
        );
        
        if (result) {
            await this.loadCharacters();
            
            // Update movement history display
            const character = this.operations.getCharacterById(this.editingCharacter);
            if (character) {
                this.uiManager.renderMovementHistory(character);
            }
            
            this.uiManager.populateMovementForm();
            this.editingMovement = null;
        }
    }

    prepareMovementData(formData) {
        const movementData = {
            dateStart: formData.movementDateStart,
            dateEnd: formData.movementDateEnd || null,
            date: formData.movementDateStart, // Legacy compatibility
            type: formData.movementType || 'travel',
            notes: formData.movementNotes || ''
        };

        if (formData.movementLocationType === 'existing') {
            movementData.location = formData.movementLocation;
            // Look up coordinates for the selected location
            const locations = window.adminLocations?.getLocations?.() || [];
            const selected = locations.find(loc => loc.properties.name === formData.movementLocation);
            if (selected && Array.isArray(selected.geometry?.coordinates)) {
                movementData.coordinates = selected.geometry.coordinates;
            }
        } else {
            movementData.location = formData.movementCustomName;
            movementData.coordinates = [
                parseInt(formData.movementX?.toString().trim()), 
                parseInt(formData.movementY?.toString().trim())
            ];
            movementData.isCustomLocation = true;
        }

        return movementData;
    }

    editMovement(movementId) {
        const character = this.operations.getCharacterById(this.editingCharacter);
        if (!character?.movementHistory) return;
        
        const movement = character.movementHistory.find(m => m.id === movementId);
        if (!movement) {
            this.ui.showToast('Movement not found', 'error');
            return;
        }
        
        this.editingMovement = movementId;
        this.uiManager.populateMovementForm(movement);
    }

    async deleteMovement(movementId) {
        if (!this.editingCharacter) return;
        
        const character = this.operations.getCharacterById(this.editingCharacter);
        const movement = character?.movementHistory?.find(m => m.id === movementId);
        
        if (!movement) {
            this.ui.showToast('Movement not found', 'error');
            return;
        }
        
        const movementDescription = `${movement.location || 'Custom Location'} (${movement.date})`;
        
        const success = await this.movements.deleteMovement(
            this.editingCharacter, 
            movementId, 
            movementDescription
        );
        
        if (success) {
            await this.loadCharacters();
            
            const updatedCharacter = this.operations.getCharacterById(this.editingCharacter);
            if (updatedCharacter) {
                this.uiManager.renderMovementHistory(updatedCharacter);
            }
        }
    }

    closeMovementModal() {
        this.ui.closeModal('character-movement-modal');
        this.editingCharacter = null;
        this.editingMovement = null;
    }

    onAuthStateChanged(isAuthenticated) {
        this.uiManager.renderCharacters();
    }

    // Public API
    getCharacters() {
        return this.operations.getCharacters();
    }

    exportData() {
        this.operations.exportData();
    }

    viewRawJson() {
        this.operations.viewRawJson();
    }
}

// Create global characters instance
window.adminCharacters = new AdminCharacters();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminCharacters;
}