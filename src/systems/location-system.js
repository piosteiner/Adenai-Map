// location-system.js - Location Loading and Management
class LocationSystem {
    constructor() {
        this.geoFeatureLayers = [];
        this.locations = [];
        this.dotOrangeIcon = null;
        this.mediaLibrary = null;
        this.init();
    }

    init() {
        // Wait for map to be ready before creating icon
        if (window.mapCore && window.mapCore.map) {
            this.createLocationIcon();
        } else {
            // Wait for map initialization
            document.addEventListener('adenaiMapInitialized', () => {
                this.createLocationIcon();
            });
        }
        this.loadMediaLibrary();
    }

    async loadMediaLibrary() {
        try {
            const response = await fetch('public/data/media-library.json');
            if (response.ok) {
                this.mediaLibrary = await response.json();
                console.log('📚 Media library loaded');
            }
        } catch (error) {
            console.warn('⚠️ Could not load media library:', error);
        }
    }

    createLocationIcon() {
        const isMobile = window.mapCore && window.mapCore.getIsMobile ? window.mapCore.getIsMobile() : false;
        
        this.dotOrangeIcon = L.icon({
            iconUrl: 'public/icons/dot_orange.svg',
            iconSize: isMobile ? [48, 48] : [32, 32],
            iconAnchor: isMobile ? [24, 24] : [16, 16],
            popupAnchor: [0, -32]
        });
        
        console.log('📍 Location icon created');
    }

    // Parse link syntax [text:type:id] and convert to clickable elements
    parseLinks(text) {
        if (!text || !this.mediaLibrary) return text;
        
        const linkRegex = /\[([^\]]+):([^:]+):([^\]]+)\]/g;
        
        return text.replace(linkRegex, (match, displayText, type, id) => {
            const onClick = `window.locationSystem.showMediaModal('${type}', '${id}')`;
            return `<span class="media-link" onclick="${onClick}" title="Click to view ${type}">${displayText}</span>`;
        });
    }

    // Show media modal based on type and id
    showMediaModal(type, id) {
        if (!this.mediaLibrary) return;
        
        let content = '';
        let title = '';
        
        switch (type) {
            case 'character':
                const character = this.mediaLibrary.characters[id];
                if (character) {
                    title = character.name;
                    content = `
                        <div class="character-modal">
                            <img src="${character.image}" alt="${character.name}" class="character-image">
                            <p><strong>Status:</strong> ${character.status}</p>
                            <p><strong>Beziehung:</strong> ${character.relationship}</p>
                            <p>${character.description}</p>
                        </div>
                    `;
                }
                break;
                
            case 'gallery':
                const gallery = this.mediaLibrary.galleries[id];
                if (gallery) {
                    title = gallery.title;
                    content = `
                        <div class="gallery-modal">
                            <p>${gallery.description}</p>
                            <div class="gallery-grid">
                                ${gallery.images.map(img => 
                                    `<img src="${img.src}" alt="${img.alt}" class="gallery-image" onclick="window.locationSystem.showFullImage('${img.src}', '${img.alt}')">`
                                ).join('')}
                            </div>
                        </div>
                    `;
                }
                break;
                
            case 'event':
                const event = this.mediaLibrary.events[id];
                if (event) {
                    title = event.title;
                    content = `
                        <div class="event-modal">
                            <p><strong>Datum:</strong> ${event.date}</p>
                            <p>${event.description}</p>
                            ${event.image ? `<img src="${event.image}" alt="${event.title}" class="event-image">` : ''}
                        </div>
                    `;
                }
                break;
                
            case 'image':
                const image = this.mediaLibrary.images[id];
                if (image) {
                    title = image.title;
                    content = `
                        <div class="image-modal">
                            <img src="${image.src}" alt="${image.alt}" class="modal-image">
                            <p>${image.description}</p>
                        </div>
                    `;
                }
                break;
        }
        
        if (content) {
            this.showModal(title, content);
        }
    }

    // Show modal popup
    showModal(title, content) {
        // Remove existing modal
        const existingModal = document.querySelector('.media-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'media-modal';
        modal.innerHTML = `
            <div class="media-modal-content">
                <div class="media-modal-header">
                    <h3>${title}</h3>
                    <span class="media-modal-close">&times;</span>
                </div>
                <div class="media-modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.media-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Show full image in modal
    showFullImage(src, alt) {
        this.showModal(alt, `<img src="${src}" alt="${alt}" class="full-image">`);
    }

    async loadLocations() {
        try {
            console.log('📍 Loading locations from GeoJSON...');
            
            // 🔥 CLEAR EXISTING DATA FIRST
            this.clearExistingLocations();
            
            const response = await fetch(`public/data/places.geojson?t=${Date.now()}`);
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

    // Clear existing location data before loading new data
    clearExistingLocations() {
        console.log('🧹 Clearing existing location data...');
        
        // Remove existing markers from map
        this.geoFeatureLayers.forEach(locationData => {
            if (locationData.layer && window.mapCore?.getMap()) {
                window.mapCore.getMap().removeLayer(locationData.layer);
            }
        });
        
        // Clear arrays
        this.geoFeatureLayers = [];
        this.locations = [];
        
        console.log(`🗑️ Removed ${this.geoFeatureLayers.length} existing location markers`);
    }

    // Add proper reload method for admin interface integration
    async reloadLocations() {
        console.log('🔄 Reloading locations from admin update...');
        await this.loadLocations();
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
        const details = feature.properties.details || [];
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
                    popupContent = `<div class="popup-title">${name}</div><div class="popup-desc">${this.parseLinks(html)}</div>`;
                } else {
                    throw new Error('Fetch failed');
                }
            } catch (error) {
                // Fallback to local description if external content fails
                popupContent = this.createPopupFromProperties(name, desc, details);
                console.warn(`⚠️ Failed to load content for ${name}: ${error.message}`);
            }
        } else {
            // No contentUrl: use local description and details
            popupContent = this.createPopupFromProperties(name, desc, details);
        }

        // Bind popup to the layer
        layer.bindPopup(popupContent, { maxWidth: 400, className: 'custom-popup' });

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

    // Create popup content from properties
    createPopupFromProperties(name, description, details) {
        let content = `<div class="popup-title">${name}</div>`;
        
        if (description) {
            content += `<div class="popup-desc">${this.parseLinks(description)}</div>`;
        }
        
        if (details && details.length > 0) {
            content += '<div class="popup-details">';
            details.forEach(detail => {
                content += `<div class="popup-detail">• ${this.parseLinks(detail)}</div>`;
            });
            content += '</div>';
        }
        
        return content;
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
window.locationSystem = new LocationSystem();
window.locationsSystem = window.locationSystem; // Backward compatibility

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationSystem;
}