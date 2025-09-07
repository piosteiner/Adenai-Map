// admin-public/js/modules/locations/index.js - Location Management Module - Main Coordinator (Refactored)

class AdminLocations {
    constructor() {
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.editingLocation = null;
        
        // Initialize sub-modules
        this.operations = new LocationOperations(this.auth, this.ui);
        this.uiManager = new LocationUI(this.ui, this.auth, this.operations);
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadLocations();
        
        // Listen for auth state changes
        document.addEventListener('authStateChanged', (e) => {
            this.onAuthStateChanged(e.detail.isAuthenticated);
        });
    }

    setupEventListeners() {
        // Add location button
        const addLocationBtn = document.getElementById('add-location-btn');
        if (addLocationBtn) {
            addLocationBtn.addEventListener('click', () => {
                this.openAddLocationModal();
            });
        }

        // Location form submission
        const locationForm = document.getElementById('location-form');
        if (locationForm) {
            locationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveLocation();
            });
        }

        // Location modal close
        const closeBtn = document.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Close modal on backdrop click
        const locationModal = document.getElementById('add-location-modal');
        if (locationModal) {
            locationModal.addEventListener('click', (e) => {
                if (e.target.id === 'add-location-modal') {
                    this.closeModal();
                }
            });
        }

        // Delegate location action buttons
        this.ui.addDelegatedListener('locations-list', '.location-edit-btn', 'click', (e) => {
            const locationName = e.target.dataset.location;
            this.editLocation(locationName);
        });

        this.ui.addDelegatedListener('locations-list', '.location-delete-btn', 'click', (e) => {
            const locationName = e.target.dataset.location;
            this.deleteLocation(locationName);
        });

        // Location image hover popup functionality
        this.setupLocationImagePopup();
    }

    setupLocationImagePopup() {
        // Create popup element for locations
        const popup = document.createElement('div');
        popup.className = 'location-image-popup';
        popup.innerHTML = '<img src="" alt="Location Image">';
        document.body.appendChild(popup);

        // Event delegation for location image hover
        document.addEventListener('mouseenter', (e) => {
            if (e.target.matches('.location-image img')) {
                this.showLocationImagePopup(e, popup);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (e.target.matches('.location-image img')) {
                this.hideLocationImagePopup(popup);
            }
        }, true);

        document.addEventListener('mousemove', (e) => {
            if (e.target.matches('.location-image img') && popup.classList.contains('show')) {
                this.updateLocationPopupPosition(e, popup);
            }
        });
    }

    showLocationImagePopup(event, popup) {
        const img = event.target;
        const popupImg = popup.querySelector('img');
        
        // Set the image source
        popupImg.src = img.src;
        popupImg.alt = img.alt;
        
        // Position and show popup
        this.updateLocationPopupPosition(event, popup);
        popup.classList.add('show');
    }

    hideLocationImagePopup(popup) {
        popup.classList.remove('show');
    }

    updateLocationPopupPosition(event, popup) {
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

    async loadLocations() {
        try {
            console.log('🔄 Starting location reload...');
            this.ui.showLoading('locations-list', 'Loading locations...');
            
            const locations = await this.operations.loadLocations();
            console.log(`🔄 Received ${locations.length} locations, rendering...`);
            this.uiManager.renderLocations(locations);
            console.log('✅ Location rendering complete');
            
        } catch (error) {
            console.error('❌ Failed to load locations:', error);
            this.uiManager.renderLocations([]);
        }
    }

    openAddLocationModal() {
        if (!this.auth.requireAuth()) return;
        
        this.editingLocation = null;
        this.uiManager.populateLocationForm();
        this.ui.openModal('add-location-modal');
        
        // Reinitialize media picker for this modal
        if (window.mediaPicker) {
            window.mediaPicker.reinitialize();
        }
    }

    editLocation(locationName) {
        if (!this.auth.requireAuth()) return;
        
        this.uiManager.saveScrollPosition();
        
        const location = this.operations.getLocationByName(locationName);
        if (!location) {
            this.ui.showToast('Location not found', 'error');
            return;
        }
        
        this.editingLocation = locationName;
        this.uiManager.populateLocationForm(location);
        this.ui.openModal('add-location-modal');
        
        // Reinitialize media picker for this modal
        if (window.mediaPicker) {
            window.mediaPicker.reinitialize();
        }
    }

    closeModal() {
        this.ui.closeModal('add-location-modal');
        this.editingLocation = null;
    }

    async saveLocation() {
        const formData = this.ui.getFormData('location-form');
        if (!formData) return;

        // Validate form
        const validation = this.operations.validateLocationData(formData);
        if (!validation.isValid) {
            validation.errors.forEach(error => this.ui.showToast(error, 'error'));
            return;
        }

        // Create location data
        const locationData = this.operations.createLocationData(formData);
        
        const result = await this.operations.saveLocation(locationData, this.editingLocation);
        console.log('🔍 Save result:', result, 'isEditing:', !!this.editingLocation);
        
        if (result && result.success) {
            // Refresh the UI to show the new/updated location
            console.log('🔄 Refreshing location UI after save...');
            await this.loadLocations();
            
            this.closeModal();
            
            // Reset media picker to clear any selections
            if (window.mediaPicker) {
                window.mediaPicker.reset();
            }
            
            // Restore scroll position for edits
            if (this.editingLocation) {
                this.uiManager.restoreScrollPosition();
            }
        } else {
            console.log('❌ Save failed or returned invalid result:', result);
        }
    }

    async deleteLocation(name) {
        const result = await this.operations.deleteLocation(name);
        if (result && result.success) {
            console.log('🔄 Refreshing location UI after deletion...');
            await this.loadLocations();
        }
    }

    onAuthStateChanged(isAuthenticated) {
        this.uiManager.renderLocations();
    }

    // Public API methods
    getLocations() {
        return this.operations.getLocations();
    }

    getLocationByName(name) {
        return this.operations.getLocationByName(name);
    }

    getLocationStats() {
        return this.operations.getLocationStats();
    }

    // Filter methods
    filterByRegion(region) {
        return this.uiManager.filterLocationsByRegion(region);
    }

    filterByType(type) {
        return this.uiManager.filterLocationsByType(type);
    }

    filterByVisited(visited) {
        return this.uiManager.filterLocationsByVisited(visited);
    }

    // Sort methods
    sortByName(ascending = true) {
        return this.uiManager.sortLocationsByName(ascending);
    }

    // Map integration
    showLocationOnMap(locationName) {
        this.uiManager.showLocationOnMap(locationName);
    }

    // Export functions
    exportData() {
        this.operations.exportData();
    }

    viewRawJson() {
        this.operations.viewRawJson();
    }

    // Search functionality
    getSearchSuggestions(query) {
        return this.uiManager.getLocationSearchSuggestions(query);
    }

    // Statistics
    showLocationStats() {
        const stats = this.operations.getLocationStats();
        const statsHtml = this.uiManager.renderLocationStats(stats);
        
        // Could display in modal or dedicated view
        console.log('Location stats:', stats);
        return { stats, html: statsHtml };
    }
}

// Create global locations instance
window.adminLocations = new AdminLocations();

// Global function for manual testing - triggers client-side location reload
window.triggerLocationReload = function() {
    console.log('🔄 Manual trigger: Dispatching locationsUpdated event...');
    document.dispatchEvent(new CustomEvent('locationsUpdated'));
    
    // Also trigger if admin is in iframe/popup
    if (window.parent && window.parent !== window) {
        window.parent.document.dispatchEvent(new CustomEvent('locationsUpdated'));
    }
    
    console.log('✅ Manual location reload event triggered');
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminLocations;
}