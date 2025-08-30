// location-system.js - Location Loading and Management
class LocationSystem {
    constructor() {
        this.geoFeatureLayers = [];
        this.locations = [];
        this.dotOrangeIcon = null;
        this.mediaLibrary = null;
        this.currentOpenPopup = null; // Track currently open popup
        
        // Location type definitions with icons and German labels
        this.locationTypes = {
            city: { value: 'city', label: '🏙️ Stadt' },
            town: { value: 'town', label: '🏘️ Dorf' },
            village: { value: 'village', label: '🏡 Weiler' },
            camp: { value: 'camp', label: '⛺ Lager' },
            landmark: { value: 'landmark', label: '🗿 Orientierungspunkt' },
            ruin: { value: 'ruin', label: '🏛️ Ruine' },
            dungeon: { value: 'dungeon', label: '☠️ Dungeon' },
            monster: { value: 'monster', label: '🐉 Monster' },
            environment: { value: 'environment', label: '🌳 Umgebung' },
            mountain: { value: 'mountain', label: '⛰️ Berg/Gebirge' },
            lake: { value: 'lake', label: '💧 Gewässer' },
            island: { value: 'island', label: '🏝️ Insel' },
            unknown: { value: 'unknown', label: '❓ Unbekannt' }
        };
        
        // Location region definitions with German labels
        this.locationRegions = {
            // English keys (keeping for backward compatibility)
            north_adenai: { value: 'north_adenai', label: 'Nord-Adenai' },
            eastern_adenai: { value: 'eastern_adenai', label: 'Ost-Adenai' },
            south_adenai: { value: 'south_adenai', label: 'Süd-Adenai' },
            western_adenai: { value: 'western_adenai', label: 'West-Adenai' },
            valaris_region: { value: 'valaris_region', label: 'Valaris Region' },
            upeto: { value: 'upeto', label: 'Upeto' },
            harak: { value: 'harak', label: 'Harak' },
            tua_danar: { value: 'tua_danar', label: 'Tua Danar' },
            rena_region: { value: 'rena_region', label: 'Rena Region' },
            arcane_heights: { value: 'arcane_heights', label: 'Arkane Höhen' },
            sun_peaks: { value: 'sun_peaks', label: 'Sonnenspitzen' },
            cinnabar_fields: { value: 'cinnabar_fields', label: 'Zinnober Felder' },
            ewige_donnerkluefte: { value: 'ewige_donnerkluefte', label: 'Ewige Donnerklüfte' },
            east_sea: { value: 'east_sea', label: 'Östliche See' },
            west_sea: { value: 'west_sea', label: 'Westliche See' },
            heaven: { value: 'heaven', label: 'Himmel' },
            underdark: { value: 'underdark', label: 'Underdark' },
            feywild: { value: 'feywild', label: 'Feywild' },
            
            // German keys to match GeoJSON data
            'Nord-Adenai': { value: 'nord_adenai', label: 'Nord-Adenai' },
            'Ost-Adenai': { value: 'ost_adenai', label: 'Ost-Adenai' },
            'Süd-Adenai': { value: 'sued_adenai', label: 'Süd-Adenai' },
            'West-Adenai': { value: 'west_adenai', label: 'West-Adenai' },
            'Valaris Region': { value: 'valaris_region', label: 'Valaris Region' },
            'Upeto': { value: 'upeto', label: 'Upeto' },
            'Harak': { value: 'harak', label: 'Harak' },
            'Tua Danar': { value: 'tua_danar', label: 'Tua Danar' },
            'Rena Region': { value: 'rena_region', label: 'Rena Region' },
            'Arkane Höhen': { value: 'arcane_heights', label: 'Arkane Höhen' },
            'Sonnenspitzen': { value: 'sun_peaks', label: 'Sonnenspitzen' },
            'Zinnober Felder': { value: 'cinnabar_fields', label: 'Zinnober Felder' },
            'Ewige Donnerklüfte': { value: 'ewige_donnerkluefte', label: 'Ewige Donnerklüfte' },
            'Östliche See': { value: 'east_sea', label: 'Östliche See' },
            'Westliche See': { value: 'west_sea', label: 'Westliche See' },
            'Himmel': { value: 'heaven', label: 'Himmel' },
            'Underdark': { value: 'underdark', label: 'Underdark' },
            'Feywild': { value: 'feywild', label: 'Feywild' },
            
            unknown: { value: 'unknown', label: '❗ Error contact the owner' },
            other: { value: 'other', label: 'Andere' }
        };
        
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
        this.setupKeyboardHandlers();
        this.addLocationMarkerStyles();
    }

    addLocationMarkerStyles() {
        const style = document.createElement('style');
        style.id = 'interactive-location-markers-style';
        style.textContent = `
            .interactive-location-marker {
                cursor: pointer;
                transition: transform 0.3s ease;
            }

            .location-marker-svg {
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                transform-origin: center;
            }

            .location-dot {
                transition: all 0.3s ease;
                transform-origin: center;
            }

            .pulse-ring {
                transition: all 0.4s ease;
                transform-origin: center;
            }

            /* Proximity scaling effect */
            .interactive-location-marker.proximity-close {
                transform: scale(1.2);
            }

            .interactive-location-marker.proximity-near {
                transform: scale(1.1);
            }

            /* Hover effects */
            .interactive-location-marker:hover .location-marker-svg {
                transform: scale(1.3);
            }

            .interactive-location-marker:hover .pulse-ring {
                opacity: 0.6 !important;
                animation: pulse-animation 1.5s infinite ease-in-out;
            }

            .interactive-location-marker:hover .location-dot {
                filter: brightness(1.2) saturate(1.3);
            }

            /* Click effect */
            .interactive-location-marker.clicked {
                animation: click-bounce 0.6s ease-out;
            }

            .interactive-location-marker.clicked .location-dot {
                animation: click-flash 0.6s ease-out;
            }

            /* Pulse animation */
            @keyframes pulse-animation {
                0% {
                    transform: scale(1);
                    opacity: 0.6;
                }
                50% {
                    transform: scale(1.4);
                    opacity: 0.3;
                }
                100% {
                    transform: scale(1.8);
                    opacity: 0;
                }
            }

            /* Click bounce animation */
            @keyframes click-bounce {
                0% { transform: scale(1); }
                30% { transform: scale(1.4); }
                50% { transform: scale(1.2); }
                70% { transform: scale(1.35); }
                100% { transform: scale(1.3); }
            }

            /* Click flash animation */
            @keyframes click-flash {
                0% { fill: #ff6b1a; filter: brightness(1); }
                30% { fill: #ffdb4d; filter: brightness(1.8) saturate(1.5); }
                100% { fill: #ff6b1a; filter: brightness(1.2) saturate(1.3); }
            }

            /* Dark theme adjustments */
            [data-theme="dark"] .location-dot {
                stroke: #1a1a1a;
            }

            [data-theme="dark"] .pulse-ring {
                stroke: #ff8c42;
            }
        `;

        // Remove existing styles if any
        const existing = document.getElementById('interactive-location-markers-style');
        if (existing) {
            existing.remove();
        }

        document.head.appendChild(style);
        Logger.debug('🎨 Interactive location marker styles added');
    }

    setupKeyboardHandlers() {
        // Add escape key handler for closing popups
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentOpenPopup) {
                this.closeCurrentPopup();
            }
        });
    }

    closeCurrentPopup() {
        if (this.currentOpenPopup) {
            this.currentOpenPopup._isPopupSticky = false;
            this.currentOpenPopup.closePopup();
            this.currentOpenPopup = null;
            Logger.info('Location popup closed by escape key');
        }
    }

    async loadMediaLibrary() {
        try {
            this.mediaLibrary = await HttpUtils.fetchLocalData('public/data/media-library.json');
            Logger.media('Media library loaded');
        } catch (error) {
            Logger.warning('Could not load media library:', error);
        }
    }

    createLocationIcon() {
        // Create the classic orange dot icon (smaller size like original)
        if (!this.dotOrangeIcon) {
            // Use pure CSS/HTML divIcon to prevent ANY image hover enlargement
            this.dotOrangeIcon = L.divIcon({
                className: 'location-dot-icon',
                html: '<div class="location-dot-inner"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                popupAnchor: [0, -10]
            });
            
            // Add CSS for the icon (only once)
            if (!document.getElementById('location-dot-styles')) {
                const style = document.createElement('style');
                style.id = 'location-dot-styles';
                style.textContent = `
                    .location-dot-icon {
                        background: transparent !important;
                        border: none !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                    
                    .location-dot-inner {
                        width: 12px;
                        height: 12px;
                        background: #ff6b24;
                        border: 1px solid #ffffff;
                        border-radius: 50%;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                        transition: transform 0.2s ease;
                    }
                    
                    .location-dot-icon:hover .location-dot-inner {
                        transform: scale(1.3);
                    }
                `;
                document.head.appendChild(style);
            }
            
            Logger.success('Orange dot icon created with pure CSS (smaller size like original - NO images)');
        }
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

    async loadLocations(preloadedData = null) {
        try {
            Logger.info('Loading locations from GeoJSON...');
            
            // Ensure icon is ready before loading locations
            if (!this.dotOrangeIcon) {
                Logger.info('Creating location icon before loading...');
                this.createLocationIcon();
            }
            
            // 🔥 CLEAR EXISTING DATA FIRST
            this.clearExistingLocations();
            
            // Use preloaded data if available, otherwise fetch
            const data = preloadedData || await HttpUtils.fetchLocalData('public/data/places.geojson');
            await this.processGeoJSONData(data);
            
            Logger.success(`Loaded ${this.geoFeatureLayers.length} locations`);
            
            // Notify other systems that locations are loaded
            document.dispatchEvent(new CustomEvent('locationsLoaded', { 
                detail: { 
                    locations: this.locations,
                    geoFeatureLayers: this.geoFeatureLayers 
                } 
            }));
            
        } catch (error) {
            Logger.error('Error loading locations:', error);
        }
    }

    // Clear existing location data before loading new data
    clearExistingLocations() {
        Logger.cleanup('Clearing existing location data...');
        
        // Remove existing markers from map
        this.geoFeatureLayers.forEach(locationData => {
            if (locationData.layer) {
                MapUtils.removeFromMap(locationData.layer);
            }
        });
        
        // Clear arrays
        this.geoFeatureLayers = [];
        this.locations = [];
        
        Logger.cleanup(`Removed ${this.geoFeatureLayers.length} existing location markers`);
    }

    // Add proper reload method for admin interface integration
    async reloadLocations() {
        Logger.info('Reloading locations from admin update...');
        await this.loadLocations();
    }

    async processGeoJSONData(data) {
        return MapUtils.withMap(map => {
            // Ensure icon is created before using it
            if (!this.dotOrangeIcon) {
                Logger.warning('Location icon not ready, creating it now...');
                this.createLocationIcon();
            }
            
            // Double-check that icon was created successfully
            if (!this.dotOrangeIcon) {
                Logger.warning('Location icon not ready, creating it now...');
                this.createLocationIcon();
            }
            
            const geoLayer = L.geoJSON(data, {
                pointToLayer: (feature, latlng) => {
                    // Use the pure CSS divIcon (NO images - prevents hover enlargement)
                    return L.marker(latlng, { icon: this.dotOrangeIcon });
                },
                onEachFeature: async (feature, layer) => {
                    await this.processLocationFeature(feature, layer);
                    // Setup simple click-only interactions
                    this.setupMarkerInteractions(layer);
                }
            }).addTo(map);

            return geoLayer;
        }, 'Cannot process GeoJSON data - map not available');
    }

    setupMarkerInteractions(marker) {
        marker._isPopupSticky = false; // Store sticky state on the marker itself
        
        // Disable default popup behavior
        marker.off('click');
        
        // Click event - toggles popup (opens/closes) and makes it sticky
        marker.on('click', () => {
            // If this marker's popup is already open, close it (toggle behavior)
            if (this.currentOpenPopup === marker && marker._isPopupSticky) {
                marker._isPopupSticky = false;
                marker.closePopup();
                this.currentOpenPopup = null;
                Logger.info('Location popup toggled closed');
                return;
            }
            
            // Close any previously open popup and reset its sticky state
            if (this.currentOpenPopup && this.currentOpenPopup !== marker) {
                this.currentOpenPopup._isPopupSticky = false;
                this.currentOpenPopup.closePopup();
                Logger.info('Previous location popup closed automatically');
            }
            
            marker._isPopupSticky = true;
            marker.openPopup();
            this.currentOpenPopup = marker; // Track this as the current open popup
            Logger.info('Location popup opened by click (sticky)');
        });
        
        // Reset sticky state when popup is manually closed
        marker.on('popupclose', () => {
            marker._isPopupSticky = false;
            // Clear current open popup tracking if this marker's popup is closing
            if (this.currentOpenPopup === marker) {
                this.currentOpenPopup = null;
            }
            Logger.info('Location popup closed, sticky state reset');
        });
    }

    // Close all open location popups
    closeAllPopups() {
        if (this.currentOpenPopup) {
            this.currentOpenPopup._isPopupSticky = false;
            this.currentOpenPopup.closePopup();
            this.currentOpenPopup = null;
            Logger.info('All location popups closed');
        }
    }

    async processLocationFeature(feature, layer) {
        const name = feature.properties.name || '';
        const desc = feature.properties.description || '';
        const details = feature.properties.details || [];
        const url = feature.properties.contentUrl;
        const type = feature.properties.type || '';
        const region = feature.properties.region || '';
        const imageUrl = feature.properties.image || '';
        
        // Ensure we have a valid layer with getLatLng method
        let latlng;
        if (layer && typeof layer.getLatLng === 'function') {
            latlng = layer.getLatLng();
        } else if (feature.geometry && feature.geometry.coordinates) {
            // Fallback: extract coordinates from feature
            latlng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
        } else {
            Logger.error('Cannot determine location coordinates for feature:', feature);
            return;
        }

        let finalDesc = desc;
        let popupContent = '';

        if (url) {
            try {
                const response = await HttpUtils.fetch(url);
                const html = await response.text();
                finalDesc = html.replace(/(<([^>]+)>)/gi, ''); // Remove HTML tags for search
                
                // Create popup with external content but add type/region meta info
                popupContent = `<div class="popup-title">${name}</div>`;
                
                // Add type and region information
                if (type || region) {
                    popupContent += '<div class="popup-meta">';
                    
                    if (type) {
                        const typeInfo = this.locationTypes[type] || this.locationTypes.unknown;
                        popupContent += `<span class="popup-type">${typeInfo.label}</span>`;
                    }
                    
                    if (region) {
                        const regionInfo = this.locationRegions[region] || this.locationRegions.unknown;
                        if (type) popupContent += ' • '; // Add separator if both type and region
                        popupContent += `<span class="popup-region">Region: ${regionInfo.label}</span>`;
                    }
                    
                    popupContent += '</div>';
                }
                
                popupContent += `<div class="popup-desc">${this.parseLinks(html)}</div>`;
            } catch (error) {
                // Fallback to local description if external content fails
                popupContent = this.createPopupFromProperties(name, desc, details, type, region, imageUrl);
                Logger.warning(`Failed to load content for ${name}: ${error.message}`);
            }
        } else {
            // No contentUrl: use local description and details
            popupContent = this.createPopupFromProperties(name, desc, details, type, region, imageUrl);
        }

        // Add character lists to popup content
        popupContent = this.addCharacterListsToPopup(popupContent, name);

        // Bind popup to the layer (with enhanced interaction behavior)
        layer.bindPopup(popupContent, { 
            maxWidth: 400, 
            className: 'custom-popup',
            autoClose: false, // Don't auto-close when clicking elsewhere
            closeOnClick: false // Don't close when clicking the map
        });

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

    // Helper method to normalize region values from GeoJSON to standardized keys
    // Create popup content from properties
    createPopupFromProperties(name, description, details, type, region, imageUrl = null) {
        // Use the imageUrl from GeoJSON data directly
        const hasImage = imageUrl && imageUrl.trim() !== '';
        
        // Create title with optional image on the right
        let content = '<div class="popup-header">';
        if (hasImage) {
            content += `
                <div class="popup-title-with-image">
                    <div class="popup-title">${name}</div>
                    <div class="popup-image-container">
                        <img class="popup-location-image" src="${imageUrl}" alt="${name}" 
                             title="Hover to enlarge • Click to open full size">
                    </div>
                </div>`;
        } else {
            content += `<div class="popup-title">${name}</div>`;
        }
        content += '</div>';
        
        // Add type and region information
        if (type || region) {
            content += '<div class="popup-meta">';
            
            if (type) {
                const typeInfo = this.locationTypes[type] || this.locationTypes.unknown;
                content += `<span class="popup-type">${typeInfo.label}</span>`;
            }
            
            if (region) {
                const regionInfo = this.locationRegions[region] || this.locationRegions.unknown;
                if (type) content += ' • '; // Add separator if both type and region
                content += `<span class="popup-region">📍 ${regionInfo.label}</span>`;
            }
            
            content += '</div>';
        }
        
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

    // Add character lists to popup content
    addCharacterListsToPopup(popupContent, locationName) {
        const characterStats = this.getCharactersByLocation(locationName);
        
        if (characterStats.originCharacters.length === 0 && characterStats.lastSeenCharacters.length === 0) {
            return popupContent; // No characters to show
        }

        let characterSection = '<div class="popup-characters">';
        characterSection += '<hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">';
        
        // Characters from this location
        if (characterStats.originCharacters.length > 0) {
            characterSection += `
                <div class="character-list-section">
                    <button class="character-list-button" onclick="window.locationSystem.showCharacterModal('${locationName}', 'origin')">
                        <span class="character-list-icon">🏠</span>
                        <span class="character-list-text">Characters from here (${characterStats.originCharacters.length})</span>
                        <span class="character-list-arrow">→</span>
                    </button>
                </div>
            `;
        }

        // Characters last seen here
        if (characterStats.lastSeenCharacters.length > 0) {
            characterSection += `
                <div class="character-list-section">
                    <button class="character-list-button" onclick="window.locationSystem.showCharacterModal('${locationName}', 'lastSeen')">
                        <span class="character-list-icon">👁️</span>
                        <span class="character-list-text">Last seen here (${characterStats.lastSeenCharacters.length})</span>
                        <span class="character-list-arrow">→</span>
                    </button>
                </div>
            `;
        }

        characterSection += '</div>';
        return popupContent + characterSection;
    }

    // Get characters associated with a location
    getCharactersByLocation(locationName) {
        const originCharacters = [];
        const lastSeenCharacters = [];

        if (!window.characterSystem) {
            return { originCharacters, lastSeenCharacters };
        }

        const characters = window.characterSystem.getCharacters();
        
        characters.forEach(character => {
            // Check if this is their place of origin (first movement entry or if they have no movement, their current location)
            let originLocation = null;
            if (character.movementHistory && character.movementHistory.length > 0) {
                // Sort movement history by date to find the earliest
                const sortedHistory = [...character.movementHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
                originLocation = sortedHistory[0].location;
            } else if (character.currentLocation) {
                // If no movement history, consider current location as origin
                originLocation = character.currentLocation.location;
            }

            if (originLocation === locationName) {
                originCharacters.push(character);
            }

            // Check if this is their last seen location
            if (character.currentLocation && character.currentLocation.location === locationName) {
                // Only add if not already in origin list (avoid duplicates)
                if (!originCharacters.find(c => c.id === character.id)) {
                    lastSeenCharacters.push(character);
                }
            }
        });

        return { originCharacters, lastSeenCharacters };
    }

    // Show character modal
    showCharacterModal(locationName, type) {
        const characterStats = this.getCharactersByLocation(locationName);
        const characters = type === 'origin' ? characterStats.originCharacters : characterStats.lastSeenCharacters;
        
        const modalTitle = type === 'origin' 
            ? `Characters from ${locationName}` 
            : `Characters last seen in ${locationName}`;

        const modalContent = this.createCharacterModalContent(characters, modalTitle);
        this.openModal(modalContent);
    }

    // Create character modal content
    createCharacterModalContent(characters, title) {
        let content = `
            <div class="character-modal">
                <div class="character-modal-header">
                    <h3>${title}</h3>
                    <button class="character-modal-close" onclick="window.locationSystem.closeModal()">×</button>
                </div>
                <div class="character-modal-body">
        `;

        if (characters.length === 0) {
            content += '<p>No characters found.</p>';
        } else {
            characters.forEach(character => {
                const image = character.image ? `<img src="${character.image}" alt="${character.name}" class="character-avatar">` : '';
                const title = character.title ? ` <span class="character-title">${character.title}</span>` : '';
                const faction = character.faction ? `<div class="character-faction">${character.faction}</div>` : '';
                const relationship = character.relationship ? `<span class="character-relationship ${character.relationship}">${character.relationship}</span>` : '';
                
                content += `
                    <div class="character-card" onclick="window.characterSystem.focusCharacter('${character.name}'); window.locationSystem.closeModal();">
                        <div class="character-card-content">
                            ${image}
                            <div class="character-info">
                                <div class="character-name">${character.name}${title}</div>
                                ${faction}
                                ${relationship ? `<div class="character-meta">${relationship}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        content += `
                </div>
            </div>
        `;

        return content;
    }

    // Open modal
    openModal(content) {
        // Remove existing modal if any
        this.closeModal();

        const modal = document.createElement('div');
        modal.id = 'character-location-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = content;
        
        document.body.appendChild(modal);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('character-location-modal');
        if (modal) {
            modal.remove();
        }
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
            MapUtils.withMap((map) => {
                map.setView(location.layer.getLatLng(), Math.max(map.getZoom(), 1));
                location.layer.openPopup();
            });
            return true;
        }
        Logger.warning(`Location "${locationName}" not found`);
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
        MapUtils.withMap((map) => {
            // Ensure icon is created
            if (!this.dotOrangeIcon) {
                this.createLocationIcon();
            }
            
            // Create marker with pure CSS divIcon (NO images - prevents hover enlargement)
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
            
            Logger.success(`Added location "${locationData.name}" to map`);
            
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
        });
    }

    // Remove a location
    removeLocation(name) {
        const locationIndex = this.locations.findIndex(location => 
            location.feature.properties.name.toLowerCase() === name.toLowerCase()
        );
        
        if (locationIndex !== -1) {
            const location = this.locations[locationIndex];
            
            MapUtils.withMap((map) => {
                // Remove from map
                if (map.hasLayer(location.layer)) {
                    map.removeLayer(location.layer);
                }
            });
            
            // Remove from arrays
            this.locations.splice(locationIndex, 1);
            
            const geoLayerIndex = this.geoFeatureLayers.findIndex(geo => 
                geo.feature.properties.name === location.feature.properties.name
            );
            if (geoLayerIndex !== -1) {
                this.geoFeatureLayers.splice(geoLayerIndex, 1);
            }
            
            Logger.success(`Removed location "${name}" from map`);
            return true;
        }
        
        Logger.warning(`Location "${name}" not found for removal`);
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

    // Cleanup methods for markers
    clearMarkers() {
        return this.withMap(map => {
            if (this.markersLayer) {
                this.markersLayer.clearLayers();
                Logger.info('All location markers cleared');
            }
        }, 'Cannot clear markers - map not available');
    }

    destroy() {
        if (this.loadingIndicator) {
            this.loadingIndicator.destroy();
        }
        
        Logger.info('LocationSystem destroyed');
    }
}

// Create global location system instance  
window.locationSystem = new LocationSystem();
window.locationsSystem = window.locationSystem; // Backward compatibility

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationSystem;
}