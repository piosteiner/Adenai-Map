// location-system.js - Location Loading and Management
class LocationSystem {
    constructor() {
        this.geoFeatureLayers = [];
        this.locations = [];
        this.dotOrangeIcon = null;
        this.init();
    }

    init() {
        this.createLocationIcon();
        this.loadLocations();
    }

    createLocationIcon() {
        const isMobile = window.mapCore.getIsMobile();
        
        this.dotOrangeIcon = L.icon({
            iconUrl: 'icons/dot_orange.svg',
            iconSize: isMobile ? [48, 48] : [32, 32],
            iconAnchor: isMobile ? [24, 24] : [16, 16],
            popupAnchor: [0, -32]
        });
    }

    async loadLocations() {
        try {
            console.log('📍 Loading locations from GeoJSON...');
            
            const response = await fetch('data/places.geojson');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            await this.processGeoJSONData(data);
            
            console.log(`✅ Loaded ${this.geoFeatureLayers.length} locations`);
            
            // Notify other systems that locations are loaded
            document.dispatchEvent(new CustomEvent('locationsLoaded', { 
                detail: { 
                    locations: this.locations,
                    geoFeatureLayers: this.geoFeatureLayers 
                } 
            }));
            
        } catch (error) {
            console.error('❌ Error loading locations:', error);
        }
    }

    async processGeoJSONData(data) {
        const map = window.mapCore.getMap();
        
        const geoLayer = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                return L.marker(latlng, { icon: this.dotOrangeIcon });
            },
            onEachFeature: async (feature, layer) => {
                await this.processLocationFeature(feature, layer);
            }
        }).addTo(map);

        return geoLayer;
    }

    async processLocationFeature(feature, layer) {
        const name = feature.properties.name || '';
        const desc = feature.properties.description || '';
        const url = feature.properties.contentUrl;
        const latlng = layer.getLatLng();

        let finalDesc = desc;
        let popupContent = '';

        if (url) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const html = await response.text();
                    finalDesc = html.replace(/(<([^>]+)>)/gi, ''); // Remove HTML tags for search
                    popupContent = `<div class="popup-title">${name}</div><div class="popup-desc">${html}</div>`;
                } else {
                    throw new Error('Fetch failed');
                }
            } catch (error) {
                // Fallback to local description if external content fails
                popupContent = `<div class="popup-title">${name}</div><div class="popup-desc">${desc}</div>`;
                console.warn(`⚠️ Failed to load content for ${name}: ${error.message}`);
            }
        } else {
            // No contentUrl: use local description
            popupContent = `<div class="popup-title">${name}</div><div class="popup-desc">${desc}</div>`;
        }

        // Bind popup to the layer
        layer.bindPopup(popupContent);

        // Store location data
        const locationData = {
            feature: feature,
            layer: layer,
            desc: finalDesc,
            name: name,
            latlng: latlng
        };

        this.geoFeatureLayers.push(locationData);
        this.locations.push(locationData);
    }

    // Find location by name
    findLocationByName(name) {
        return this.geoFeatureLayers.find(location => 
            location.feature.properties.name.toLowerCase() === name.toLowerCase()
        );
    }

    // Focus on a location
    focusLocation(locationName) {
        const location = this.findLocationByName(locationName);
        if (location) {
            const map = window.mapCore.getMap();
            map.setView(location.layer.getLatLng(), Math.max(map.getZoom(), 1));
            location.layer.openPopup();
            return true;
        }
        console.warn(`⚠️ Location "${locationName}" not found`);
        return false;
    }

    // Get all locations
    getLocations() {
        return this.locations;
    }

    // Get all geo feature layers
    getGeoFeatureLayers() {
        return this.geoFeatureLayers;
    }

    // Get location names for dropdowns
    getLocationNames() {
        return this.locations.map(location => location.feature.properties.name).sort();
    }

    // Check if a location exists
    locationExists(name) {
        return this.locations.some(location => 
            location.feature.properties.name.toLowerCase() === name.toLowerCase()
        );
    }

    // Get coordinates for a location
    getLocationCoordinates(name) {
        const location = this.findLocationByName(name);
        if (location) {
            const latlng = location.layer.getLatLng();
            return [latlng.lng, latlng.lat]; // Return as [lng, lat] for consistency
        }
        return null;
    }

    // Add a new location programmatically (useful for admin interface)
    addLocation(locationData) {
        const map = window.mapCore.getMap();
        
        // Create marker
        const marker = L.marker([locationData.lat, locationData.lng], { 
            icon: this.dotOrangeIcon 
        });
        
        // Create popup content
        const popupContent = `
            <div class="popup-title">${locationData.name}</div>
            <div class="popup-desc">${locationData.description || ''}</div>
        `;
        marker.bindPopup(popupContent);
        
        // Add to map
        marker.addTo(map);
        
        // Create feature object
        const feature = {
            type: 'Feature',
            properties: {
                name: locationData.name,
                description: locationData.description || '',
                region: locationData.region || '',
                type: locationData.type || 'other'
            },
            geometry: {
                type: 'Point',
                coordinates: [locationData.lng, locationData.lat]
            }
        };
        
        // Store location data
        const newLocationData = {
            feature: feature,
            layer: marker,
            desc: locationData.description || '',
            name: locationData.name,
            latlng: { lat: locationData.lat, lng: locationData.lng }
        };
        
        this.geoFeatureLayers.push(newLocationData);
        this.locations.push(newLocationData);
        
        console.log(`✅ Added location "${locationData.name}" to map`);
        
        // Notify search system
        if (window.searchSystem) {
            window.searchSystem.addToIndex({
                name: locationData.name,
                desc: locationData.description || '',
                latlng: { lat: locationData.lat, lng: locationData.lng },
                type: 'location',
                feature: feature
            });
        }
        
        return newLocationData;
    }

    // Remove a location
    removeLocation(name) {
        const locationIndex = this.locations.findIndex(location => 
            location.feature.properties.name.toLowerCase() === name.toLowerCase()
        );
        
        if (locationIndex !== -1) {
            const location = this.locations[locationIndex];
            const map = window.mapCore.getMap();
            
            // Remove from map
            if (map.hasLayer(location.layer)) {
                map.removeLayer(location.layer);
            }
            
            // Remove from arrays
            this.locations.splice(locationIndex, 1);
            
            const geoLayerIndex = this.geoFeatureLayers.findIndex(geo => 
                geo.feature.properties.name === location.feature.properties.name
            );
            if (geoLayerIndex !== -1) {
                this.geoFeatureLayers.splice(geoLayerIndex, 1);
            }
            
            console.log(`✅ Removed location "${name}" from map`);
            return true;
        }
        
        console.warn(`⚠️ Location "${name}" not found for removal`);
        return false;
    }

    // Get location statistics
    getLocationStats() {
        const stats = {
            total: this.locations.length,
            byRegion: {},
            byType: {}
        };
        
        this.locations.forEach(location => {
            const region = location.feature.properties.region || 'Unknown';
            const type = location.feature.properties.type || 'other';
            
            stats.byRegion[region] = (stats.byRegion[region] || 0) + 1;
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        });
        
        return stats;
    }

    // Export locations data
    exportLocationsData() {
        return {
            type: 'FeatureCollection',
            features: this.locations.map(location => location.feature)
        };
    }
}

// Create global location system instance
window.locationsSystem = new LocationSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationSystem;
}