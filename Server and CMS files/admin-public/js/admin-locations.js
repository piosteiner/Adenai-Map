// Location Management Module
class AdminLocations {
    constructor() {
        this.locations = [];
        this.currentFilter = '';
        this.editingLocation = null;
        this.savedScrollPosition = null; // Add scroll position tracking
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
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

        // Location search functionality
        const locationSearch = document.getElementById('location-search');
        if (locationSearch) {
            locationSearch.addEventListener('input', this.ui.debounce((e) => {
                this.currentFilter = e.target.value;
                this.renderLocations();
            }, 300));
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
    }

    async loadLocations() {
        try {
            console.log('🗺️ Loading locations from GitHub...');
            this.ui.showLoading('locations-list', 'Loading locations...');
            
            const response = await fetch('/api/locations');
            const data = await response.json();
            
            this.locations = data.features || [];
            console.log(`✅ Loaded ${this.locations.length} locations`);
            
            this.renderLocations();
        } catch (error) {
            console.error('❌ Failed to load locations:', error);
            this.ui.showToast('Failed to load locations', 'error');
            this.locations = [];
            this.renderLocations();
        }
    }

    renderLocations() {
        const container = document.getElementById('locations-list');
        if (!container) return;
        
        if (this.locations.length === 0) {
            this.ui.showEmptyState('locations-list', 
                '🗺️ No locations yet', 
                'Add your first campaign location to get started!'
            );
            return;
        }

        // Filter locations based on search
        const filteredLocations = this.locations.filter(location => {
            const name = location.properties.name?.toLowerCase() || '';
            const description = location.properties.description?.toLowerCase() || '';
            const region = location.properties.region?.toLowerCase() || '';
            const searchTerm = this.currentFilter.toLowerCase();
            
            return name.includes(searchTerm) || 
                   description.includes(searchTerm) || 
                   region.includes(searchTerm);
        });

        if (filteredLocations.length === 0) {
            this.ui.showEmptyState('locations-list',
                '🔍 No matches found',
                'Try adjusting your search terms'
            );
            return;
        }

        container.innerHTML = '';
        
        filteredLocations.forEach(location => {
            const cardElement = document.createElement('div');
            cardElement.innerHTML = this.renderLocationCard(location);
            
            // Add history button to the card if ActivityModule is available
            if (window.ActivityModule && typeof window.ActivityModule.addHistoryButton === 'function') {
                setTimeout(() => {
                    window.ActivityModule.addHistoryButton(cardElement, 'locations', location.properties.name);
                }, 0);
            }
            
            container.appendChild(cardElement);
        });
    }

    renderLocationCard(location) {
        const props = location.properties;
        const coords = location.geometry.coordinates;
        
        // Only show edit/delete buttons if authenticated
        const actionButtons = this.auth.isAuthenticated ? `
            <div class="location-actions">
                <button class="btn-secondary location-edit-btn" data-location="${props.name}">✏️ Edit</button>
                <button class="btn-danger location-delete-btn" data-location="${props.name}">🗑️ Delete</button>
            </div>
        ` : '';
        
        return `
            <div class="location-card" data-id="${props.name}">
                <div class="location-header">
                    <h3>${props.name}</h3>
                    <span class="location-type">${this.formatType(props.type || 'unknown')}</span>
                </div>
                <div class="location-details">
                    <p><strong>🌍 Region:</strong> ${this.formatRegion(props.region || 'Unknown')}</p>
                    <p><strong>📍 Coordinates:</strong> ${coords[0]}, ${coords[1]}</p>
                    <p><strong>👥 Visited:</strong> ${props.visited ? '✅ Yes' : '❌ No'}</p>
                    ${props.description ? `<p><strong>📝 Description:</strong> ${props.description}</p>` : ''}
                </div>
                ${actionButtons}
            </div>
        `;
    }
    
    formatType(type) {
        const types = {
            city: '🏙️ City',
            town: '🏘️ Town', 
            village: '🏡 Village',
            landmark: '🗿 Landmark',
            dungeon: '🏴‍☠️ Dungeon',
            ruin: '🏛️ Ruin',
            camp: '⛺ Camp',
            unknown: '❓ Unknown'
        };
        return types[type] || `❓ ${type}`;
    }

    formatRegion(region) {
        const regions = {
            north_adenai: 'Nord-Adenai',
            eastern_adenai: 'Ost-Adenai',
            south_adenai: 'Süd-Adenai',
            western_adenai: 'West-Adenai',
            valaris_region: 'Valaris Region',
            upeto: 'Upeto',
            harak: 'Harak',
            tua_danar: 'Tua Danar',
            rena_region: 'Rena Region',
            arcane_heights: 'Arkane Höhen',
            sun_peaks: 'Sonnenspitzen',
            cinnabar_fields: 'Zinnober-Felder',
            ewige_donnerkluefte: 'Ewige Donnerklüfte',
            east_sea: 'Östliche See',
            west_sea: 'Westliche See',
            heaven: 'Himmel',
            unknown: 'Unbekannt',
            other: 'Andere'
        };
        return regions[region] || region;
    }

    openAddLocationModal() {
        if (!this.auth.requireAuth()) return;
        
        // Reset editing state and scroll position for new locations
        this.editingLocation = null;
        this.savedScrollPosition = null;
        
        // Update modal title and button text
        document.querySelector('#add-location-modal .modal-header h3').textContent = 'Add New Location';
        document.querySelector('#location-form button[type="submit"]').textContent = '💾 Save Location';
        
        this.ui.openModal('add-location-modal');
    }

    openEditLocationModal(locationName) {
        if (!this.auth.requireAuth()) return;
        
        // Save current scroll position before opening modal
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        console.log('📍 Saved scroll position:', this.savedScrollPosition);
        
        const location = this.locations.find(loc => loc.properties.name === locationName);
        if (!location) {
            this.ui.showToast('❌ Location not found', 'error');
            return;
        }
        
        // Set editing state
        this.editingLocation = locationName;
        
        // Update modal title and button text
        document.querySelector('#add-location-modal .modal-header h3').textContent = 'Edit Location';
        document.querySelector('#location-form button[type="submit"]').textContent = '💾 Update Location';
        
        // Pre-fill form with current data
        const props = location.properties;
        const coords = location.geometry.coordinates;
        
        this.ui.populateForm('location-form', {
            name: props.name || '',
            description: props.description || '',
            region: props.region || '',
            type: props.type || '',
            x: coords[0] || '',
            y: coords[1] || '',
            visited: !!props.visited
        });
        
        this.ui.openModal('add-location-modal');
    }

    closeModal() {
        this.ui.closeModal('add-location-modal');
        this.editingLocation = null;
        // Note: We don't clear savedScrollPosition here in case we need it for restoration
    }

    async saveLocation() {
        if (!this.auth.requireAuth()) return;

        const formData = this.ui.getFormData('location-form');
        if (!formData) return;

        // Validate form
        const isValid = this.ui.validateForm('location-form', {
            name: { required: true, label: 'Location Name' },
            x: { required: true, label: 'X Coordinate' },
            y: { required: true, label: 'Y Coordinate' }
        });

        if (!isValid) return;
        
        // Create GeoJSON feature
        const locationData = {
            type: "Feature",
            properties: {
                name: formData.name,
                description: formData.description || '',
                region: formData.region,
                type: formData.type,
                visited: !!formData.visited,
                contentUrl: null
            },
            geometry: {
                type: "Point",
                coordinates: [parseInt(formData.x), parseInt(formData.y)]
            }
        };

        try {
            const isEditing = !!this.editingLocation;
            const originalName = this.editingLocation;
            
            console.log(`💾 ${isEditing ? 'Updating' : 'Saving'} location:`, locationData.properties.name);
            
            const response = await this.auth.authenticatedFetch(
                `/api/locations${isEditing ? `/${encodeURIComponent(originalName)}` : ''}`, 
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(locationData)
                }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Location "${locationData.properties.name}" ${isEditing ? 'updated' : 'saved'} successfully!`, 'success');
                await this.loadLocations();
                this.closeModal();
                
                // Restore scroll position for edits (not for new locations)
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
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'locations' } }));
            } else {
                this.ui.showToast(`❌ Failed to ${isEditing ? 'update' : 'save'} location`, 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.ui.showToast(`❌ Failed to ${this.editingLocation ? 'update' : 'save'} location`, 'error');
        }
    }

    async deleteLocation(name) {
        if (!this.auth.requireAuth()) return;
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return;

        try {
            console.log('🗑️ Deleting location:', name);
            
            const response = await this.auth.authenticatedFetch(
                `/api/locations/${encodeURIComponent(name)}`, 
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Location "${name}" deleted successfully!`, 'success');
                await this.loadLocations();
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'locations' } }));
            } else {
                this.ui.showToast('❌ Failed to delete location', 'error');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('❌ Failed to delete location', 'error');
        }
    }

    editLocation(name) {
        this.openEditLocationModal(name);
    }

    onAuthStateChanged(isAuthenticated) {
        // Re-render locations to show/hide action buttons
        this.renderLocations();
    }

    // Get locations data for other modules
    getLocations() {
        return this.locations;
    }

    // Export locations data
    exportData() {
        const data = {
            type: "FeatureCollection",
            features: this.locations
        };
        this.ui.exportJson(data, 'adenai-locations');
    }

    // View raw JSON
    viewRawJson() {
        const data = {
            type: "FeatureCollection", 
            features: this.locations
        };
        this.ui.viewRawJson(data, 'adenai-locations');
    }
}

// Create global locations instance
window.adminLocations = new AdminLocations();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminLocations;
}