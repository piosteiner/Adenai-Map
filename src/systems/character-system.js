// character-system.js - Character Loading, Rendering, and Management
class CharacterSystem {
    constructor() {
        console.log('🎯 CHARACTER SYSTEM LOADED - VERSION 1.2.0 - UPDATED WITH ENHANCED POPUPS');
        this.characterData = [];
        this.currentCharacterPopup = null; // Track current popup
        this.currentPanelPopup = null; // Track panel-anchored popup
        this.locationClickListener = null; // Track location click listener
        this.statusEmojis = {
            alive: '😊',
            dead: '💀',
            missing: '❓',
            unknown: '🤷'
        };
        this.relationshipColors = {
            ally: '#4CAF50',
            friendly: '#8BC34A',
            neutral: '#FFC107',
            suspicious: '#FF9800',
            hostile: '#FF5722',
            enemy: '#F44336',
            party: '#584cffff'
        };
        this.init();
    }

    init() {
        console.log('🎯 Character system initialized without visual markers');
        
        // Listen for locations loaded to set up location marker click handlers
        document.addEventListener('locationsLoaded', (e) => {
            this.setupLocationMarkerListeners(e.detail.geoFeatureLayers);
        });
    }

    // Set up listeners on location markers to close character popups when clicked
    setupLocationMarkerListeners(geoFeatureLayers) {
        if (!geoFeatureLayers) return;
        
        geoFeatureLayers.forEach(locationData => {
            if (locationData.layer) {
                // Add click listener to each location marker
                locationData.layer.on('click', () => {
                    this.closeCurrentCharacterPopup();
                    console.log('🎯 Character popup closed due to location marker click');
                });
            }
        });
        
        console.log(`🎯 Set up close listeners on ${geoFeatureLayers.length} location markers`);
    }

    async loadCharacters() {
        try {
            console.log('👥 Loading characters from server...');
            // Try different potential URLs in case of server routing issues
            let response;
            const urls = [
                `/data/characters.json?t=${Date.now()}`,
                `public/data/characters.json?t=${Date.now()}`,
                `./public/data/characters.json?t=${Date.now()}`
            ];
            
            for (const url of urls) {
                try {
                    console.log(`🔄 Trying URL: ${url}`);
                    response = await fetch(url);
                    if (response.ok) {
                        console.log(`✅ Successfully loaded from: ${url}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Failed URL: ${url} - ${e.message}`);
                }
            }
            
            if (!response || !response.ok) {
                throw new Error(`HTTP ${response?.status || 'No response'}: ${response?.statusText || 'Failed all URLs'}`);
            }
            
            const data = await response.json();
            this.characterData = data.characters || [];
            
            console.log(`✅ Loaded ${this.characterData.length} characters`);
            
            // Debug: Log a sample character to verify all fields are present
            if (this.characterData.length > 0) {
                const sampleChar = this.characterData.find(c => c.id === 'test') || this.characterData[0];
                console.log('🔍 Sample character data:', {
                    id: sampleChar.id,
                    name: sampleChar.name,
                    title: sampleChar.title,
                    placeOfOrigin: sampleChar.placeOfOrigin,
                    status: sampleChar.status,
                    faction: sampleChar.faction,
                    relationship: sampleChar.relationship,
                    firstMet: sampleChar.firstMet,
                    description: sampleChar.description,
                    notes: sampleChar.notes,
                    currentLocation: sampleChar.currentLocation,
                    movementHistory: sampleChar.movementHistory?.length || 0
                });
            }
            
            // Log coordinate status for debugging
            const withCoords = this.characterData.filter(c => c.coordinates).length;
            const withoutCoords = this.characterData.length - withCoords;
            const withMovements = this.characterData.filter(c => c.movementHistory && c.movementHistory.length > 0).length;
            
            console.log(`🗺️ Characters with coordinates: ${withCoords}`);
            console.log(`🛤️ Characters with movement history: ${withMovements}`);
            if (withoutCoords > 0) {
                console.warn(`⚠️ Characters without coordinates: ${withoutCoords}`);
            }
            
            console.log('🎯 Character data loaded - no visual markers created');
            
            // Notify other systems that characters are loaded
            document.dispatchEvent(new CustomEvent('charactersLoaded', { 
                detail: { characters: this.characterData } 
            }));
            
        } catch (error) {
            console.error('❌ Error loading characters:', error);
            
            // Show user-friendly error message
            const errorMsg = error.message.includes('404') 
                ? 'Character data not found. The characters file may not exist yet.'
                : 'Failed to load character data. Please check your connection and try again.';
            
            // If there's a way to show error messages to the user, do it here
            if (typeof showErrorMessage === 'function') {
                showErrorMessage(errorMsg);
            }
        }
    }

    // Get character by name
    getCharacterByName(name) {
        return this.characterData.find(char => char.name === name);
    }

    // Get all characters
    getCharacters() {
        return this.characterData;
    }

    // FIXED: Use same coordinate system as locations - no transformation needed
    convertImageCoordinatesToMapCoordinates(imageCoords, characterName) {
        const [x, y] = imageCoords;
        
        // Characters should use the SAME coordinate system as locations
        // Locations work correctly, so characters should too
        // No transformation needed - use coordinates as-is
        
        const mapLng = x;  // lng = x coordinate
        const mapLat = y;  // lat = y coordinate
        
        console.log(`📍 Coordinate conversion for "${characterName}": Using coordinates as-is [lng=${mapLng}, lat=${mapLat}]`);
        
        return [mapLng, mapLat];  // Return as [lng, lat] for L.latLng(lat, lng)
    }

    // Get character position based on priority: 1) Last travel point 2) Place of origin 3) No coordinates
    getCharacterPosition(character) {
        // Priority 1: Last travel point from movementHistory (highest movement_nr)
        if (character.movementHistory && character.movementHistory.length > 0) {
            // Find the movement with the highest movement_nr
            const latestMovement = character.movementHistory.reduce((latest, current) => {
                const currentNr = current.movement_nr || 0;
                const latestNr = latest.movement_nr || 0;
                return currentNr > latestNr ? current : latest;
            });
            
            if (latestMovement.coordinates && Array.isArray(latestMovement.coordinates) && latestMovement.coordinates.length === 2) {
                console.log(`🛤️ Using latest travel point (movement_nr: ${latestMovement.movement_nr}) for ${character.name}:`, latestMovement.coordinates);
                return latestMovement.coordinates;
            }
        }
        
        // Priority 2: Place of origin (character.coordinates)
        if (character.coordinates && Array.isArray(character.coordinates) && character.coordinates.length === 2) {
            console.log(`🏠 Using place of origin for ${character.name}:`, character.coordinates);
            return character.coordinates;
        }
        
        // Priority 3: No coordinates available
        console.log(`📋 No coordinates available for ${character.name}, will show panel popup`);
        return null;
    }

    // Enhanced focus character method with coordinate fix
    focusCharacter(characterName) {
        const character = this.getCharacterByName(characterName);
        if (!character) {
            console.warn(`⚠️ Character "${characterName}" not found`);
            return false;
        }

        // Get position based on priority rules
        const coordinates = this.getCharacterPosition(character);
        
        // If character has no coordinates, show panel-anchored popup
        if (!coordinates) {
            console.log(`📋 Showing panel popup for "${characterName}" (no coordinates)`);
            this.showPanelAnchoredPopup(character);
            return true;
        }

        const map = window.mapCore.getMap();
        if (!map) {
            console.warn('⚠️ Map not available');
            return false;
        }

        // FIXED: Properly convert coordinates
        const [mapLng, mapLat] = this.convertImageCoordinatesToMapCoordinates(coordinates, characterName);
        const targetLatLng = L.latLng(mapLat, mapLng);
        
        console.log(`🎯 Focusing on "${characterName}" at image coords ${coordinates} → map coords [${mapLng}, ${mapLat}]`);

        // Single, smooth centering approach
        this.performSmoothCentering(map, targetLatLng, characterName, character);
        
        return true;
    }

    // Show popup anchored to character panel for characters without locations
    showPanelAnchoredPopup(character) {
        // Close any existing panel popup
        this.closePanelAnchoredPopup();

        const panel = document.getElementById('character-panel');
        if (!panel) {
            console.warn('⚠️ Character panel not found');
            return;
        }

        // Create popup content
        const popupContent = this.createCharacterPopupContent(character);

        // Create popup element
        const popup = document.createElement('div');
        popup.id = 'panel-anchored-popup';
        popup.className = 'panel-anchored-popup';
        popup.innerHTML = `
            <div class="panel-popup-header">
                <h3>${character.name}</h3>
                <button class="panel-popup-close" onclick="window.characterSystem.closePanelAnchoredPopup()">×</button>
            </div>
            <div class="panel-popup-content">
                ${popupContent}
            </div>
        `;

        // Position popup to the left of panel with 20px spacing, near top
        popup.style.position = 'fixed'; // Use fixed positioning for better control
        popup.style.right = (panel.offsetWidth + 20) + 'px'; // 20px to the left of panel
        popup.style.top = '30px'; // 30px from top of screen
        popup.style.zIndex = '10001';

        // Append to body instead of panel for fixed positioning
        document.body.appendChild(popup);

        // Track current popup
        this.currentPanelPopup = popup;

        console.log(`📋 Panel popup opened for "${character.name}"`);
    }

    // Close panel-anchored popup
    closePanelAnchoredPopup() {
        if (this.currentPanelPopup) {
            this.currentPanelPopup.remove();
            this.currentPanelPopup = null;
            console.log('📋 Panel popup closed');
        }
    }

    // Create character popup content
    createCharacterPopupContent(character) {
        console.log('🔍 Creating popup for character:', character.name, 'with data:', {
            placeOfOrigin: character.placeOfOrigin,
            currentLocation: character.currentLocation,
            location: character.location,
            movementHistory: character.movementHistory?.length || 0,
            faction: character.faction,
            firstMet: character.firstMet,
            description: character.description,
            notes: character.notes
        });
        
        const statusEmoji = this.statusEmojis[character.status] || '🤷';
        const statusLabel = character.status || 'unknown';
        const relationship = character.relationship || 'neutral';
        
        // Image
        const image = character.image ? `<img src="${character.image}" alt="${character.name}" class="character-popup-avatar">` : '';
        
        // Title
        const title = character.title ? `<div class="character-popup-title">${character.title}</div>` : '';
        
        // Last seen location (from currentLocation, location, or latest movement)
        let lastSeenContent = '';
        if (character.currentLocation && character.currentLocation.location) {
            const date = character.currentLocation.date || character.currentLocation.dateStart || '';
            lastSeenContent = `📍 <strong>Last Seen:</strong> ${character.currentLocation.location}${date ? ` (${date})` : ''}`;
            console.log('✅ Using currentLocation for last seen:', character.currentLocation.location);
        } else if (character.location) {
            lastSeenContent = `📍 <strong>Last Seen:</strong> ${character.location}`;
            console.log('✅ Using location field for last seen:', character.location);
        } else if (character.movementHistory && character.movementHistory.length > 0) {
            // Get the most recent movement entry
            const latestMovement = character.movementHistory[character.movementHistory.length - 1];
            if (latestMovement && latestMovement.location) {
                const date = latestMovement.date || latestMovement.dateStart || '';
                lastSeenContent = `📍 <strong>Last Seen:</strong> ${latestMovement.location}${date ? ` (${date})` : ''}`;
                console.log('✅ Using movement history for last seen:', latestMovement.location, 'from', latestMovement.date);
            } else {
                lastSeenContent = `📍 <strong>Last Seen:</strong> <span class="location-unknown">Unknown</span>`;
                console.log('❌ No location found in movement history');
            }
        } else {
            lastSeenContent = `📍 <strong>Last Seen:</strong> <span class="location-unknown">Unknown</span>`;
            console.log('❌ No location data found anywhere');
        }
        
        // Build content sections
        const contentSections = [];
        
        // Faction
        if (character.faction) {
            contentSections.push(`<div class="character-popup-faction">🏛️ <strong>Faction:</strong> ${character.faction}</div>`);
            console.log('✅ Adding faction:', character.faction);
        }
        
        // Place of Origin
        if (character.placeOfOrigin) {
            contentSections.push(`<div class="character-popup-origin">🏠 <strong>Place of Origin:</strong> ${character.placeOfOrigin}</div>`);
            console.log('✅ Adding place of origin:', character.placeOfOrigin);
        } else {
            console.log('❌ No placeOfOrigin found');
        }
        
        // Movement History count
        if (character.movementHistory && character.movementHistory.length > 0) {
            const historyCount = character.movementHistory.length;
            const historyText = historyCount === 1 ? '1 location' : `${historyCount} locations`;
            contentSections.push(`<div class="character-popup-movement">🗺️ <strong>Movement History:</strong> ${historyText}</div>`);
        }
        
        // First Met
        if (character.firstMet) {
            contentSections.push(`<div class="character-popup-met">🗓️ <strong>First Met:</strong> ${character.firstMet}</div>`);
        }
        
        // Description
        if (character.description) {
            contentSections.push(`<div class="character-popup-description">📖 <strong>Description:</strong> ${character.description}</div>`);
        }
        
        // Notes
        if (character.notes) {
            contentSections.push(`<div class="character-popup-notes">📝 <strong>Notes:</strong> ${character.notes}</div>`);
        }
        
        // Created/Updated dates (for reference, like in CMS)
        if (character.createdAt || character.updatedAt) {
            const createdDate = character.createdAt ? new Date(character.createdAt).toLocaleDateString() : '';
            const updatedDate = character.updatedAt ? new Date(character.updatedAt).toLocaleDateString() : '';
            
            if (updatedDate && updatedDate !== createdDate) {
                contentSections.push(`<div class="character-popup-dates">📅 <strong>Last Updated:</strong> ${updatedDate}</div>`);
            } else if (createdDate) {
                contentSections.push(`<div class="character-popup-dates">📅 <strong>Created:</strong> ${createdDate}</div>`);
            }
        }

        return `
            <div class="character-popup-header-info">
                ${image}
                <div class="character-popup-details">
                    ${title}
                    <div class="character-popup-status">
                        ${statusEmoji} <strong>Status:</strong> ${statusLabel}
                    </div>
                    <div class="character-popup-relationship relationship-${relationship}">
                        <strong>Relationship:</strong> ${relationship}
                    </div>
                    <div class="character-popup-location">
                        ${lastSeenContent}
                    </div>
                </div>
            </div>
            ${contentSections.join('')}
        `;
    }

    // Simple, reliable centering with panel awareness
    performSmoothCentering(map, targetLatLng, characterName, character) {
        // Calculate panel-aware target position
        const adjustedTarget = this.calculatePanelAwareTarget(map, targetLatLng);
        
        // Calculate appropriate zoom level
        const targetZoom = this.calculateOptimalZoom(map);
        
        console.log(`📍 Zoom: ${map.getZoom().toFixed(2)} → ${targetZoom.toFixed(2)}`);
        
        // Use fitBounds for reliable centering (always works)
        const padding = this.calculateViewportPadding();
        const bounds = this.createCenteringBounds(adjustedTarget, padding);
        
        map.fitBounds(bounds, {
            animate: true,
            duration: 0.8,
            easeLinearity: 0.2,
            maxZoom: targetZoom,
            paddingTopLeft: [0, 0],
            paddingBottomRight: [padding.right, 0]
        });
        
        // Show popup after a reasonable delay (no verification needed)
        setTimeout(() => {
            this.showCharacterPopup(character, targetLatLng);
            console.log(`✅ Character "${characterName}" centered smoothly`);
        }, 900);
    }

    // Calculate target position accounting for character panel
    calculatePanelAwareTarget(map, originalTarget) {
        const isCharacterPanelOpen = window.characterPanel?.isOpen() || false;
        const isMobile = window.innerWidth <= 768;
        
        if (!isCharacterPanelOpen || isMobile) {
            return originalTarget; // No adjustment needed
        }
        
        // For desktop with open panel, shift target slightly left
        const containerSize = map.getSize();
        const panelWidth = 350; // Character panel width
        
        // Convert the shift to map coordinates
        const currentCenter = map.getCenter();
        const centerPoint = map.latLngToContainerPoint(currentCenter);
        const shiftedPoint = L.point(centerPoint.x - (panelWidth * 0.25), centerPoint.y);
        const shiftedLatLng = map.containerPointToLatLng(shiftedPoint);
        
        // Apply the same shift to our target
        const lngOffset = shiftedLatLng.lng - currentCenter.lng;
        const adjustedTarget = L.latLng(originalTarget.lat, originalTarget.lng + lngOffset);
        
        console.log(`📱 Panel open: adjusting target by ${lngOffset.toFixed(2)} lng units`);
        return adjustedTarget;
    }

    // Calculate optimal zoom level
    calculateOptimalZoom(map) {
        let currentZoom = map.getZoom();
        
        // Ensure we're in a reasonable zoom range
        if (currentZoom < 0.8) {
            return 1.2; // Zoom in if too far out
        } else if (currentZoom > 2.2) {
            return 1.8; // Zoom out if too far in
        } else {
            return Math.max(currentZoom, 1.0); // Use current zoom if reasonable
        }
    }

    // Calculate padding for fitBounds
    calculateViewportPadding() {
        const isCharacterPanelOpen = window.characterPanel?.isOpen() || false;
        const isMobile = window.innerWidth <= 768;
        
        if (isCharacterPanelOpen && !isMobile) {
            return {
                top: 50,
                bottom: 50,
                left: 50,
                right: 380 // Panel width + some margin
            };
        } else {
            return {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            };
        }
    }

    // Create bounds that will center the character properly
    createCenteringBounds(targetLatLng, padding) {
        // Create tight bounds around the character
        const offset = 80; // Small offset to create minimal bounds
        
        return L.latLngBounds(
            [targetLatLng.lat - offset, targetLatLng.lng - offset],
            [targetLatLng.lat + offset, targetLatLng.lng + offset]
        );
    }

    // Simplified popup showing with offset positioning
    showCharacterPopup(character, latlng) {
        const map = window.mapCore.getMap();
        
        // Remove any existing character focus popup
        if (this.currentCharacterPopup) {
            map.removeLayer(this.currentCharacterPopup);
        }

        // Create popup content
        const popupContent = this.createCharacterPopup(character);

        // Create popup with enhanced options and offset
        this.currentCharacterPopup = L.popup({
            closeButton: true,
            autoClose: false,
            closeOnClick: false,
            closeOnEscapeKey: true,
            className: 'character-focus-popup',
            autoPan: false,           // Disable auto-pan since we already centered properly
            keepInView: true,         // Keep popup in view when map is panned
            offset: [0, -25]          // Position popup directly above the coordinate point, like location popups
        })
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(map);

        // Set up event listeners for controlled closing
        this.setupPopupCloseListeners();

        console.log(`🎯 Character popup opened for "${character.name}" with offset positioning`);
    }

    // Set up listeners to close character popup when needed
    setupPopupCloseListeners() {
        // Listen for popup close events to clean up references
        if (this.currentCharacterPopup) {
            this.currentCharacterPopup.on('remove', () => {
                this.currentCharacterPopup = null;
                console.log('🎯 Character popup reference cleaned up');
            });
        }
    }

    // Public method to close current character popup (can be called by other systems)
    closeCharacterPopup() {
        this.closeCurrentCharacterPopup();
    }

    // Close the current character popup
    closeCurrentCharacterPopup() {
        const map = window.mapCore.getMap();
        if (this.currentCharacterPopup && map.hasLayer(this.currentCharacterPopup)) {
            map.removeLayer(this.currentCharacterPopup);
            this.currentCharacterPopup = null;
            console.log('🎯 Character popup closed');
        }
    }

    createCharacterPopup(character) {
        const imageHtml = character.image ? 
            `<img src="${character.image}" alt="${character.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; float: right; margin-left: 10px;">` : '';
        
        // Show movement count if available
        const movementCount = character.movementHistory ? character.movementHistory.length : 0;
        const movementInfo = movementCount > 0 ? `<div><strong>🛤️ Movement History:</strong> ${movementCount} locations</div>` : '';
        
        return `
            <div class="character-popup">
                ${imageHtml}
                <div class="popup-title" style="color: ${this.relationshipColors[character.relationship] || '#333'}">
                    ${character.name}
                </div>
                ${character.title ? `<div style="font-style: italic; margin-bottom: 8px;">${character.title}</div>` : ''}
                <div style="margin-bottom: 8px;">
                    <span style="background: ${this.relationshipColors[character.relationship] || '#ccc'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
                        ${AdenaiConfig.getCharacterRelationshipLabel(character.relationship) || 'unknown'}
                    </span>
                    <span style="margin-left: 8px;">
                        ${AdenaiConfig.getCharacterStatusLabel(character.status) || '❓ Unbekannt'}
                    </span>
                </div>
                ${character.faction ? `<div><strong>🛡️ Faction:</strong> ${character.faction}</div>` : ''}
                ${character.firstMet ? `<div><strong>📅 First Met:</strong> ${character.firstMet}</div>` : ''}
                <div><strong>📍 Location:</strong> ${character.location || 'Unknown'}</div>
                ${movementInfo}
                ${character.description ? `<div style="margin-top: 8px;"><strong>📝 Description:</strong><br>${character.description}</div>` : ''}
                ${character.notes ? `<div style="margin-top: 8px;"><strong>📋 Notes:</strong><br>${character.notes}</div>` : ''}
            </div>
        `;
    }

    // Reload characters (for admin updates)
    async reloadCharacters() {
        console.log('🔄 Reloading characters...');
        await this.loadCharacters();
    }

    // FIXED: Add all characters to search index, including those without coordinates
    addToSearchIndex(searchIndex) {
        this.characterData.forEach(character => {
            if (character.coordinates && Array.isArray(character.coordinates)) {
                // Convert image coordinates to map coordinates for search
                const [mapLng, mapLat] = this.convertImageCoordinatesToMapCoordinates(character.coordinates, character.name);
                
                searchIndex.push({
                    name: character.name,
                    desc: `${character.title || ''} ${character.description || ''} ${character.notes || ''}`.trim(),
                    latlng: { lat: mapLat, lng: mapLng },
                    type: 'character',
                    character: character
                });
            } else {
                // Include characters without coordinates for panel popup
                searchIndex.push({
                    name: character.name,
                    desc: `${character.title || ''} ${character.description || ''} ${character.notes || ''}`.trim(),
                    latlng: null, // No map coordinates
                    type: 'character',
                    character: character
                });
                console.log(`📋 Character "${character.name}" added to search (no coordinates - will show panel popup)`);
            }
        });
    }

    // Render search result for character
    renderSearchResult(character) {
        return `
            <div class="dropdown-item character-result">
                ${character.image ? `<img src="${character.image}" alt="${character.name}" />` : '<div class="character-placeholder">👤</div>'}
                <div class="dropdown-text">
                    <strong>${character.name}</strong>
                    ${character.title ? `<em> - ${character.title}</em>` : ''}
                    <br>
                    <span>${AdenaiConfig.getCharacterStatusLabel(character.status)} ${AdenaiConfig.getCharacterRelationshipLabel(character.relationship)} • ${character.location || 'Unknown location'}</span>
                </div>
            </div>
        `;
    }

    // Legacy compatibility - these methods now do nothing
    getCharacterLayers() {
        return []; // No layers anymore
    }

    getCharacterLayerByName(name) {
        return null; // No layers anymore
    }
}

// Create global character system instance
window.characterSystem = new CharacterSystem();

// Listen for when the map is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for map core to be initialized
    setTimeout(() => {
        if (window.mapCore && window.mapCore.getMap()) {
            // Map is ready, characters will be loaded by the main initialization
        }
    }, 100);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterSystem;
}