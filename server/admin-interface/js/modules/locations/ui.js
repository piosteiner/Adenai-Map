// admin-public/js/modules/locations/ui.js - Location UI Module - DOM rendering and UI interactions

class LocationUI {
    constructor(ui, auth, locationOps) {
        this.ui = ui;
        this.auth = auth;
        this.locationOps = locationOps;
        this.currentFilter = '';
        this.savedScrollPosition = null;
        this.initializeFilters();
    }

    initializeFilters() {
        // Populate the type filter dropdown
        this.populateTypeFilter();
        
        // Set up filter event listeners
        this.setupFilterListeners();
    }

    populateTypeFilter() {
        const typeFilter = document.getElementById('type-filter');
        if (!typeFilter) return;
        
        // Clear existing options except "All Types"
        typeFilter.innerHTML = '<option value="">All Types</option>';
        
        // Add options for each location type
        const locationTypes = AdenaiConfig.locationTypes;
        Object.values(locationTypes).forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            typeFilter.appendChild(option);
        });
    }

    setupFilterListeners() {
        const searchInput = document.getElementById('location-search');
        const visitedFilter = document.getElementById('visited-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', this.ui.debounce(() => {
                this.applyFilters();
            }, 300));
        }
        
        if (visitedFilter) {
            visitedFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
    }

    applyFilters() {
        const searchTerm = document.getElementById('location-search')?.value || '';
        const visitedOnly = document.getElementById('visited-filter')?.checked || false;
        const typeFilter = document.getElementById('type-filter')?.value || '';
        
        const filteredLocations = this.locationOps.filterLocationsByOptions(searchTerm, visitedOnly, typeFilter);
        this.renderLocations(filteredLocations, searchTerm);
    }

    renderLocations(locations = null, filter = '') {
        const container = document.getElementById('locations-list');
        if (!container) return;
        
        const locationsToRender = locations || this.locationOps.getLocations();
        this.currentFilter = filter;

        if (locationsToRender.length === 0) {
            this.ui.showEmptyState('locations-list', 
                'No locations yet', 
                'Add your first campaign location to get started!'
            );
            return;
        }

        // Filter locations if needed
        const filteredLocations = filter ? 
            this.locationOps.filterLocations(filter) : locationsToRender;

        if (filteredLocations.length === 0) {
            this.ui.showEmptyState('locations-list',
                'No matches found',
                'Try adjusting your search terms'
            );
            return;
        }

        // Sort locations alphabetically by name
        const sortedLocations = [...filteredLocations].sort((a, b) => {
            const nameA = a.properties.name.toLowerCase();
            const nameB = b.properties.name.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        container.innerHTML = '';
        
        sortedLocations.forEach(location => {
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
        const locationType = props.type || 'unknown';
        
        // Only show edit/delete buttons if authenticated
        const actionButtons = this.auth.isAuthenticated ? `
            <div class="location-actions">
                <button class="btn-secondary location-edit-btn" data-location="${props.name}">Edit</button>
                <button class="btn-danger location-delete-btn" data-location="${props.name}">Delete</button>
            </div>
        ` : '';
        
        return `
            <div class="location-card" data-id="${props.name}" data-location-type="${locationType}">
                <div class="location-header">
                    <div class="location-info">
                        ${props.image ? `
                            <div class="location-image">
                                <img src="${props.image}" alt="${props.name}">
                            </div>
                        ` : ''}
                        <div class="location-text">
                            <h3>${props.name}</h3>
                            <span class="location-type">${this.formatType(locationType)}</span>
                        </div>
                    </div>
                </div>
                <div class="location-details">
                    <p><strong>Region:</strong> ${this.formatRegion(props.region || 'Unknown')}</p>
                    <p><strong>Coordinates:</strong> ${coords[0]}, ${coords[1]}</p>
                    <p><strong>Visited:</strong> ${props.visited ? 'Yes' : 'No'}</p>
                    ${props.description ? `<p><strong>Description:</strong> ${props.description}</p>` : ''}
                </div>
                ${actionButtons}
            </div>
        `;
    }

    formatType(type) {
        return AdenaiConfig.getLocationTypeLabel(type);
    }

    formatRegion(region) {
        return AdenaiConfig.getLocationRegionLabel(region);
    }

    populateLocationForm(location = null) {
        const isEditing = !!location;
        
        // Update modal title and button text
        document.querySelector('#add-location-modal .modal-header h3').textContent = 
            isEditing ? 'Edit Location' : 'Add New Location';
        document.querySelector('#location-form button[type="submit"]').textContent = 
            isEditing ? 'Update Location' : 'Save Location';
        
        if (location) {
            // Pre-fill form with current data
            const props = location.properties;
            const coords = location.geometry.coordinates;
            
            this.ui.populateForm('location-form', {
                name: props.name || '',
                description: props.description || '',
                image: props.image || '', // Include image field when editing
                region: props.region || '',
                type: props.type || '',
                x: coords[0] || '',
                y: coords[1] || '',
                visited: !!props.visited
            });

            // If there's an image, set up the media picker display
            if (props.image && window.mediaPicker) {
                setTimeout(() => {
                    const mediaItem = { url: props.image, name: props.name || 'Selected Image' };
                    window.mediaPicker.setLocationImage(mediaItem);
                }, 100);
            }
        } else {
            // Clear form for new location
            this.ui.resetForm('location-form');
        }
    }

    renderLocationStats(stats) {
        return `
            <div class="location-stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-number">${stats.total}</span>
                        <span class="stat-label">Total Locations</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.visited}</span>
                        <span class="stat-label">Visited</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.unvisited}</span>
                        <span class="stat-label">Unvisited</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${Object.keys(stats.regionStats).length}</span>
                        <span class="stat-label">Regions</span>
                    </div>
                </div>
                
                <div class="stats-breakdown">
                    <div class="stat-section">
                        <h4>By Type</h4>
                        ${Object.entries(stats.typeStats)
                            .sort(([,a], [,b]) => b - a)
                            .map(([type, count]) => `
                                <div class="stat-row">
                                    <span>${this.formatType(type)}</span>
                                    <span>${count}</span>
                                </div>
                            `).join('')}
                    </div>
                    
                    <div class="stat-section">
                        <h4>By Region</h4>
                        ${Object.entries(stats.regionStats)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5) // Top 5 regions
                            .map(([region, count]) => `
                                <div class="stat-row">
                                    <span>${this.formatRegion(region)}</span>
                                    <span>${count}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    showLocationDetail(locationName) {
        const location = this.locationOps.getLocationByName(locationName);
        if (!location) {
            this.ui.showToast('Location not found', 'error');
            return;
        }

        const props = location.properties;
        const coords = location.geometry.coordinates;
        
        const detailHtml = `
            <div class="location-detail-modal">
                <div class="modal-header">
                    <h3>${props.name}</h3>
                    <span class="location-type-badge">${this.formatType(props.type)}</span>
                </div>
                <div class="modal-body">
                    <div class="location-info-grid">
                        <div class="info-item">
                            <label>Region:</label>
                            <span>${this.formatRegion(props.region)}</span>
                        </div>
                        <div class="info-item">
                            <label>Coordinates:</label>
                            <span>${coords[0]}, ${coords[1]}</span>
                        </div>
                        <div class="info-item">
                            <label>Status:</label>
                            <span class="status-badge ${props.visited ? 'visited' : 'unvisited'}">
                                ${props.visited ? 'Visited' : 'Unvisited'}
                            </span>
                        </div>
                    </div>
                    ${props.description ? `
                        <div class="description-section">
                            <label>Description:</label>
                            <p>${props.description}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Could show this in a modal or dedicated view
        return detailHtml;
    }

    saveScrollPosition() {
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        console.log('Saved scroll position:', this.savedScrollPosition);
    }

    restoreScrollPosition() {
        if (this.savedScrollPosition !== null) {
            setTimeout(() => {
                console.log('Restoring scroll position to:', this.savedScrollPosition);
                window.scrollTo({
                    top: this.savedScrollPosition,
                    behavior: 'smooth'
                });
                this.savedScrollPosition = null; // Clear after use
            }, 100); // Small delay to ensure content is rendered
        }
    }

    showLocationOnMap(locationName) {
        const location = this.locationOps.getLocationByName(locationName);
        if (!location) return;

        const coords = location.geometry.coordinates;
        
        // Could integrate with map system to highlight location
        console.log(`Show location ${locationName} at coordinates [${coords[0]}, ${coords[1]}]`);
        
        // Example: emit event for map system to handle
        document.dispatchEvent(new CustomEvent('highlightLocation', {
            detail: { location, coords }
        }));
    }

    filterLocationsByRegion(region) {
        const filtered = this.locationOps.getLocations().filter(loc => 
            loc.properties.region === region
        );
        this.renderLocations(filtered);
        return filtered;
    }

    filterLocationsByType(type) {
        const filtered = this.locationOps.getLocations().filter(loc => 
            loc.properties.type === type
        );
        this.renderLocations(filtered);
        return filtered;
    }

    filterLocationsByVisited(visited) {
        const filtered = this.locationOps.getLocations().filter(loc => 
            !!loc.properties.visited === visited
        );
        this.renderLocations(filtered);
        return filtered;
    }

    sortLocationsByName(ascending = true) {
        const sorted = [...this.locationOps.getLocations()].sort((a, b) => {
            const nameA = a.properties.name.toLowerCase();
            const nameB = b.properties.name.toLowerCase();
            return ascending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        this.renderLocations(sorted);
        return sorted;
    }

    getLocationSearchSuggestions(query) {
        if (!query || query.length < 2) return [];
        
        const term = query.toLowerCase();
        return this.locationOps.getLocations()
            .filter(location => {
                const name = location.properties.name.toLowerCase();
                return name.includes(term);
            })
            .map(location => ({
                name: location.properties.name,
                type: location.properties.type,
                region: location.properties.region
            }))
            .slice(0, 5); // Limit to 5 suggestions
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationUI;
}