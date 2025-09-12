// admin-public/js/modules/locations/operations.js - Location Operations Module - Core CRUD functionality

class LocationOperations {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.locations = [];
        this.locationGroups = {}; // NEW: Store character groups
        this.apiBaseUrl = '/api/locations';
    }

    async loadLocations() {
        try {
            console.log('📡 Loading locations from GitHub...');
            
            // Add cache busting parameter to ensure fresh data
            const cacheBuster = Date.now();
            const response = await fetch(`${this.apiBaseUrl}?_cb=${cacheBuster}`);
            const data = await response.json();
            
            this.locations = data.features || [];
            console.log(`📡 Loaded ${this.locations.length} locations from API`);
            
            return this.locations;
        } catch (error) {
            console.error('❌ Failed to load locations:', error);
            this.ui.showToast('Failed to load locations', 'error');
            this.locations = [];
            throw error;
        }
    }

    // NEW: Load locations with character data
    async loadLocationsWithCharacters() {
        try {
            console.log('📡 Loading locations and character data...');
            
            // Load locations
            await this.loadLocations();
            
            // Load character groups
            const response = await fetch('/api/characters');
            const characterData = await response.json();
            
            if (characterData.locationGroups) {
                this.locationGroups = characterData.locationGroups;
                console.log(`👥 Loaded character groups for ${Object.keys(this.locationGroups).length} locations`);
            }
            
            return { locations: this.locations, locationGroups: this.locationGroups };
        } catch (error) {
            console.error('❌ Failed to load locations with characters:', error);
            throw error;
        }
    }

    async saveLocation(locationData, editingLocationName = null) {
        if (!this.auth.requireAuth()) return null;

        try {
            const isEditing = !!editingLocationName;
            console.log(`${isEditing ? 'Updating' : 'Creating'} location:`, locationData.properties.name);
            
            const response = await this.auth.authenticatedFetch(
                `${this.apiBaseUrl}${isEditing ? `/${encodeURIComponent(editingLocationName)}` : ''}`, 
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(locationData)
                }
            );

            const result = await response.json();
            console.log('📡 Server response:', result);
            
            if (result.success) {
                this.ui.showToast(`Location "${locationData.properties.name}" ${isEditing ? 'updated' : 'saved'} successfully!`, 'success');
                
                // Add delay to allow GitHub to process the update (longer for creation)
                const delay = isEditing ? 2000 : 3000;
                console.log(`⏳ Waiting ${delay}ms for GitHub to process ${isEditing ? 'update' : 'creation'}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Notify client-side to reload locations (for integration with main map)
                console.log('🔄 Triggering client-side location reload...');
                document.dispatchEvent(new CustomEvent('locationsUpdated'));
                
                // Also trigger if admin is in iframe/popup
                if (window.parent && window.parent !== window) {
                    window.parent.document.dispatchEvent(new CustomEvent('locationsUpdated'));
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'locations' } }));
                
                // Return result with reload flag
                return { ...result, needsReload: true };
            } else {
                this.ui.showToast(`Failed to ${isEditing ? 'update' : 'save'} location`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.ui.showToast(`Failed to ${editingLocationName ? 'update' : 'save'} location`, 'error');
            return null;
        }
    }

    async deleteLocation(name) {
        if (!this.auth.requireAuth()) return false;
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return false;

        try {
            console.log('Deleting location:', name);
            
            const response = await this.auth.authenticatedFetch(
                `${this.apiBaseUrl}/${encodeURIComponent(name)}`, 
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`Location "${name}" deleted successfully!`, 'success');
                
                // Add delay to allow GitHub to process the update
                console.log('⏳ Waiting for GitHub to process deletion...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Notify client-side to reload locations (for integration with main map)
                console.log('🔄 Triggering client-side location reload after deletion...');
                document.dispatchEvent(new CustomEvent('locationsUpdated'));
                
                // Also trigger if admin is in iframe/popup
                if (window.parent && window.parent !== window) {
                    window.parent.document.dispatchEvent(new CustomEvent('locationsUpdated'));
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'locations' } }));
                
                return { success: true, needsReload: true };
            } else {
                this.ui.showToast('Failed to delete location', 'error');
                return false;
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('Failed to delete location', 'error');
            return false;
        }
    }

    getLocationByName(name) {
        return this.locations.find(loc => loc.properties.name === name);
    }

    getLocations() {
        return this.locations;
    }

    filterLocations(searchTerm) {
        if (!searchTerm) return this.locations;
        
        const term = searchTerm.toLowerCase();
        return this.locations.filter(location => {
            const name = location.properties.name?.toLowerCase() || '';
            const description = location.properties.description?.toLowerCase() || '';
            const region = location.properties.region?.toLowerCase() || '';
            const type = AdenaiConfig.getLocationTypeLabel(location.properties.type || '')?.toLowerCase() || '';
            
            return name.includes(term) || 
                   description.includes(term) || 
                   region.includes(term) ||
                   type.includes(term);
        });
    }

    // New method for advanced filtering
    filterLocationsByOptions(searchTerm = '', visitedOnly = false, typeFilter = '') {
        let filtered = this.locations;
        
        // Apply visited filter
        if (visitedOnly) {
            filtered = filtered.filter(location => location.properties.visited === true);
        }
        
        // Apply type filter
        if (typeFilter) {
            filtered = filtered.filter(location => location.properties.type === typeFilter);
        }
        
        // Apply search term filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(location => {
                const name = location.properties.name?.toLowerCase() || '';
                const description = location.properties.description?.toLowerCase() || '';
                const region = location.properties.region?.toLowerCase() || '';
                const type = AdenaiConfig.getLocationTypeLabel(location.properties.type || '')?.toLowerCase() || '';
                
                return name.includes(term) || 
                       description.includes(term) || 
                       region.includes(term) ||
                       type.includes(term);
            });
        }
        
        return filtered;
    }

    validateLocationData(formData) {
        const errors = [];
        
        if (!formData.name?.trim()) {
            errors.push('Location name is required');
        }
        
        if (formData.name && formData.name.length > 100) {
            errors.push('Location name must be less than 100 characters');
        }
        
        const trimmedX = formData.x?.toString().trim();
        const trimmedY = formData.y?.toString().trim();
        
        if (!trimmedX || isNaN(Number(trimmedX))) {
            errors.push('Valid X coordinate is required');
        }
        
        if (!trimmedY || isNaN(Number(trimmedY))) {
            errors.push('Valid Y coordinate is required');
        }
        
        const x = parseInt(trimmedX);
        const y = parseInt(trimmedY);
        
        if (x < -1200 || x > 3100) {
            errors.push('X coordinate must be between -1200 and 3100');
        }
        
        if (y < -1210 || y > 2700) {
            errors.push('Y coordinate must be between -1210 and 2700');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    createLocationData(formData) {
        return {
            type: "Feature",
            properties: {
                name: formData.name,
                description: formData.description || '',
                image: formData.image || '', // Add image URL support
                region: formData.region || '',
                type: formData.type || '',
                visited: !!formData.visited,
                contentUrl: null
            },
            geometry: {
                type: "Point",
                coordinates: [parseInt(formData.x), parseInt(formData.y)]
            }
        };
    }

    getLocationStats() {
        const total = this.locations.length;
        const visited = this.locations.filter(loc => loc.properties.visited).length;
        const unvisited = total - visited;
        
        // Group by type
        const typeStats = {};
        this.locations.forEach(location => {
            const type = location.properties.type || 'unknown';
            typeStats[type] = (typeStats[type] || 0) + 1;
        });
        
        // Group by region
        const regionStats = {};
        this.locations.forEach(location => {
            const region = location.properties.region || 'unknown';
            regionStats[region] = (regionStats[region] || 0) + 1;
        });
        
        return {
            total,
            visited,
            unvisited,
            typeStats,
            regionStats
        };
    }

    exportData() {
        const data = {
            type: "FeatureCollection",
            features: this.locations
        };
        this.ui.exportJson(data, 'adenai-locations');
    }

    // NEW: Get characters for specific location
    async getCharactersForLocation(locationName) {
        try {
            // First try cached data
            if (this.locationGroups[locationName]) {
                return {
                    success: true,
                    location: locationName,
                    characters: this.locationGroups[locationName],
                    totalCharacters: this.locationGroups[locationName].length,
                    cached: true
                };
            }
            
            // Fallback to API call
            const response = await fetch(`/api/characters/location/${encodeURIComponent(locationName)}`);
            const data = await response.json();
            
            // Update cache
            if (data.success && data.characters) {
                this.locationGroups[locationName] = data.characters;
            }
            
            return data;
        } catch (error) {
            console.error('❌ Failed to get characters for location:', error);
            return { success: false, error: error.message };
        }
    }

    // NEW: Get character count for location
    getCharacterCountForLocation(locationName) {
        return this.locationGroups[locationName] ? this.locationGroups[locationName].length : 0;
    }

    // NEW: Update character groups when character data changes
    updateLocationGroups(newLocationGroups) {
        this.locationGroups = newLocationGroups || {};
        console.log('🔄 Updated location groups cache');
    }

    viewRawJson() {
        const data = {
            type: "FeatureCollection", 
            features: this.locations
        };
        this.ui.viewRawJson(data, 'adenai-locations');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationOperations;
}