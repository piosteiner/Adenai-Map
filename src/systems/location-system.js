// location-system.js - Location Loading and Management
class LocationSystem {
    constructor() {
        this.geoFeatureLayers = [];
        this.locations = [];
        this.dotOrangeIcon = null;
        this.mediaLibrary = null;
        this.currentOpenPopup = null; // Track currently open popup
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
        // Create the classic orange dot icon for fallback compatibility
        if (!this.dotOrangeIcon) {
            try {
                this.dotOrangeIcon = L.icon({
                    iconUrl: 'public/icons/dot_orange.svg',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    popupAnchor: [0, -12]
                });
                Logger.success('Orange dot icon created successfully');
            } catch (error) {
                Logger.error('Failed to create orange dot icon:', error);
            }
        }
    }

    createInteractiveLocationMarker(location) {
        const isMobile = window.mapCore && window.mapCore.getIsMobile ? window.mapCore.getIsMobile() : false;
        const size = isMobile ? 48 : 32;
        
        // Create SVG icon with interactive animations
        const svgIcon = L.divIcon({
            className: 'interactive-location-marker',
            html: this.createLocationMarkerSVG(size),
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
            popupAnchor: [0, -size/2]
        });

        // Create and return a proper Leaflet marker with the interactive icon
        const coordinates = location.geometry.coordinates;
        const marker = L.marker([coordinates[1], coordinates[0]], { icon: svgIcon });
        
        return marker;
    }

    createLocationMarkerSVG(size) {
        const radius = size * 0.35; // 35% of container size
        const strokeWidth = size * 0.08; // 8% of container size
        
        return `
            <svg class="location-marker-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <defs>
                    <radialGradient id="orangeGradient-${Date.now()}" cx="30%" cy="30%">
                        <stop offset="0%" style="stop-color:#ff8c42;stop-opacity:1" />
                        <stop offset="50%" style="stop-color:#ff6b1a;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e55a00;stop-opacity:1" />
                    </radialGradient>
                    <filter id="glow-${Date.now()}">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge> 
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                
                <!-- Pulse ring for hover effect -->
                <circle class="pulse-ring" 
                        cx="${size/2}" 
                        cy="${size/2}" 
                        r="${radius}" 
                        fill="none" 
                        stroke="#ff6b1a" 
                        stroke-width="2" 
                        opacity="0"/>
                
                <!-- Main location dot -->
                <circle class="location-dot" 
                        cx="${size/2}" 
                        cy="${size/2}" 
                        r="${radius}" 
                        fill="url(#orangeGradient-${Date.now()})" 
                        stroke="#ffffff" 
                        stroke-width="${strokeWidth}"
                        filter="url(#glow-${Date.now()})"/>
                
                <!-- Inner highlight -->
                <circle class="location-highlight" 
                        cx="${size/2 - radius*0.3}" 
                        cy="${size/2 - radius*0.3}" 
                        r="${radius*0.25}" 
                        fill="#ffb366" 
                        opacity="0.6"/>
            </svg>
        `;
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
                Logger.error('Failed to create location icon, using default marker');
                const geoLayer = L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => {
                        // Use interactive markers even in fallback case
                        return this.createInteractiveLocationMarker({
                            geometry: { coordinates: [latlng.lng, latlng.lat] },
                            properties: feature.properties
                        });
                    },
                    onEachFeature: async (feature, layer) => {
                        await this.processLocationFeature(feature, layer);
                        // Setup enhanced interactions after popup is bound
                        this.setupMarkerInteractions(layer);
                    }
                }).addTo(map);
                return geoLayer;
            }
            
            const geoLayer = L.geoJSON(data, {
                pointToLayer: (feature, latlng) => {
                    // Use the new interactive marker for all location points
                    return this.createInteractiveLocationMarker({
                        geometry: { coordinates: [latlng.lng, latlng.lat] },
                        properties: feature.properties
                    });
                },
                onEachFeature: async (feature, layer) => {
                    await this.processLocationFeature(feature, layer);
                    // Setup enhanced interactions after popup is bound
                    this.setupMarkerInteractions(layer);
                }
            }).addTo(map);

            return geoLayer;
        }, 'Cannot process GeoJSON data - map not available');
    }

    setupMarkerInteractions(marker) {
        let hoverTimeout;
        marker._isPopupSticky = false; // Store sticky state on the marker itself
        
        // Add interactive behaviors to the marker
        this.addMarkerAnimations(marker);
        
        // Disable default popup behavior
        marker.off('click');
        
        // Click event - toggles popup (opens/closes) and makes it sticky
        marker.on('click', () => {
            // Add click animation
            this.triggerClickAnimation(marker);
            
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
        
        // Hover events
        marker.on('mouseover', () => {
            // Clear any existing timeout
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            // Only open popup on hover if it's not already sticky
            if (!marker._isPopupSticky) {
                hoverTimeout = setTimeout(() => {
                    marker.openPopup();
                    Logger.info('Location popup opened by hover');
                }, 100); // 100ms delay
            }
        });
        
        marker.on('mouseout', () => {
            // Clear hover timeout if mouse leaves before 100ms
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            // Only close popup if it's not sticky
            if (!marker._isPopupSticky) {
                marker.closePopup();
                Logger.info('Location popup closed by mouseout');
            }
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

    addMarkerAnimations(marker) {
        const markerElement = marker.getElement();
        if (!markerElement) return;

        // Set up cursor proximity detection
        this.setupProximityDetection(marker);
        
        // Add mouse events for enhanced interactions
        markerElement.addEventListener('mouseenter', () => {
            this.startHoverEffects(marker);
        });

        markerElement.addEventListener('mouseleave', () => {
            this.stopHoverEffects(marker);
        });
    }

    setupProximityDetection(marker) {
        if (!window.mapCore || !window.mapCore.map) return;

        const map = window.mapCore.map;
        const markerElement = marker.getElement();
        if (!markerElement) return;

        // Mouse move handler for proximity detection
        const handleMouseMove = (e) => {
            const rect = markerElement.getBoundingClientRect();
            const markerCenterX = rect.left + rect.width / 2;
            const markerCenterY = rect.top + rect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(e.clientX - markerCenterX, 2) + 
                Math.pow(e.clientY - markerCenterY, 2)
            );

            // Proximity thresholds (in pixels)
            const closeThreshold = 60;
            const nearThreshold = 100;

            // Remove existing proximity classes
            markerElement.classList.remove('proximity-close', 'proximity-near');

            // Add appropriate proximity class
            if (distance < closeThreshold) {
                markerElement.classList.add('proximity-close');
            } else if (distance < nearThreshold) {
                markerElement.classList.add('proximity-near');
            }
        };

        // Add mouse move listener to map container
        const mapContainer = map.getContainer();
        mapContainer.addEventListener('mousemove', handleMouseMove);

        // Store cleanup function on marker
        marker._proximityCleanup = () => {
            mapContainer.removeEventListener('mousemove', handleMouseMove);
            markerElement.classList.remove('proximity-close', 'proximity-near');
        };
    }

    startHoverEffects(marker) {
        const markerElement = marker.getElement();
        if (!markerElement) return;

        // Find the pulse ring and start pulsing
        const pulseRing = markerElement.querySelector('.pulse-ring');
        if (pulseRing) {
            pulseRing.style.opacity = '0.6';
        }
    }

    stopHoverEffects(marker) {
        const markerElement = marker.getElement();
        if (!markerElement) return;

        // Stop pulsing
        const pulseRing = markerElement.querySelector('.pulse-ring');
        if (pulseRing) {
            pulseRing.style.opacity = '0';
        }
    }

    triggerClickAnimation(marker) {
        const markerElement = marker.getElement();
        if (!markerElement) return;

        // Add click animation class
        markerElement.classList.add('clicked');

        // Remove animation class after animation completes
        setTimeout(() => {
            markerElement.classList.remove('clicked');
        }, 600);
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
                popupContent = `<div class="popup-title">${name}</div><div class="popup-desc">${this.parseLinks(html)}</div>`;
            } catch (error) {
                // Fallback to local description if external content fails
                popupContent = this.createPopupFromProperties(name, desc, details);
                Logger.warning(`Failed to load content for ${name}: ${error.message}`);
            }
        } else {
            // No contentUrl: use local description and details
            popupContent = this.createPopupFromProperties(name, desc, details);
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

    // Cleanup methods for markers and proximity detection
    clearMarkers() {
        return this.withMap(map => {
            if (this.markersLayer) {
                // Clean up proximity detection for all markers
                this.markersLayer.eachLayer(layer => {
                    if (layer._proximityCleanup) {
                        layer._proximityCleanup();
                    }
                });
                
                this.markersLayer.clearLayers();
                Logger.info('All location markers cleared');
            }
        }, 'Cannot clear markers - map not available');
    }

    destroy() {
        // Clean up all proximity detection listeners
        if (this.markersLayer) {
            this.markersLayer.eachLayer(layer => {
                if (layer._proximityCleanup) {
                    layer._proximityCleanup();
                }
            });
        }
        
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