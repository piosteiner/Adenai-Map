// character-system.js - Character Loading, Rendering, and Management
class CharacterSystem {
    constructor() {
        this.characterData = [];
        this.currentCharacterPopup = null; // Track current popup
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
            enemy: '#F44336'
        };
        this.init();
    }

    init() {
        // Remove createIcons() call since we won't need icons anymore
        console.log('🎯 Character system initialized without visual markers');
        
        // Listen for locations loaded to set up location marker click handlers
        document.addEventListener('locationsLoaded', (e) => {
            this.setupLocationMarkerListeners(e.detail.geoFeatureLayers);
        });
    }

    async loadCharacters() {
        try {
            console.log('👥 Loading characters from server...');
            const response = await fetch('data/characters.json');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.characterData = data.characters || [];
            
            console.log(`✅ Loaded ${this.characterData.length} characters`);
            
            // Log coordinate status for debugging
            const withCoords = this.characterData.filter(c => c.coordinates).length;
            const withoutCoords = this.characterData.length - withCoords;
            const withMovements = this.characterData.filter(c => c.movementHistory && c.movementHistory.length > 0).length;
            
            console.log(`🗺️ Characters with coordinates: ${withCoords}`);
            console.log(`🛤️ Characters with movement history: ${withMovements}`);
            if (withoutCoords > 0) {
                console.warn(`⚠️ Characters without coordinates: ${withoutCoords}`);
            }
            
            // Don't add any visual markers to the map
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

    // Enhanced focus character method with proper centering
    focusCharacter(characterName) {
        const character = this.getCharacterByName(characterName);
        if (!character || !character.coordinates) {
            console.warn(`⚠️ Character "${characterName}" not found or has no coordinates`);
            return false;
        }

        const map = window.mapCore.getMap();
        if (!map) {
            console.warn('⚠️ Map not available');
            return false;
        }

        // Use the EXACT same coordinate logic as the original addCharactersToMap method
        const [lng, lat] = character.coordinates;
        
        // Add small random offset so multiple characters at same location don't overlap exactly
        const offsetLat = lat + (Math.random() - 0.5) * 20;
        const offsetLng = lng + (Math.random() - 0.5) * 20;
        
        const latlng = L.latLng(offsetLat, offsetLng);

        // Calculate the actual center of the visible area (accounting for panel)
        const size = map.getSize();
        
        // Check if character panel is open and adjust for it
        const characterPanel = document.getElementById('character-panel');
        const panelIsOpen = characterPanel?.classList?.contains('open');
        
        let leftOverlay = 0, rightOverlay = 0;
        if (panelIsOpen && characterPanel) {
            const panelWidth = characterPanel.getBoundingClientRect?.().width || 0;
            rightOverlay = panelWidth; // Character panel is on the right
        }

        const visibleWidth = Math.max(0, size.x - leftOverlay - rightOverlay);
        const visibleHeight = size.y;

        // Calculate the center point of the visible area
        const centerX = leftOverlay + (visibleWidth / 2);
        const centerY = visibleHeight / 2;

        // Get current map bounds and center
        const mapCenter = map.getCenter();
        const mapCenterPixel = map.latLngToContainerPoint(mapCenter);
        
        // Calculate offset needed to center the character
        const targetPixel = map.latLngToContainerPoint(latlng);
        const offsetX = centerX - targetPixel.x;
        const offsetY = centerY - targetPixel.y;
        
        // Apply the offset to move the character to center
        const newCenterPixel = L.point(mapCenterPixel.x + offsetX, mapCenterPixel.y + offsetY);
        const newCenter = map.containerPointToLatLng(newCenterPixel);

        // Ensure a minimum zoom level for better character visibility
        const currentZoom = map.getZoom();
        const minZoomForCharacters = 0.5; // Adjust this value as needed
        
        if (currentZoom < minZoomForCharacters) {
            // Zoom and center in one smooth motion
            map.setView(newCenter, minZoomForCharacters, { animate: true, duration: 0.8 });
        } else {
            // Just center the character
            map.panTo(newCenter, { animate: true, duration: 0.8 });
        }

        // Create and show a temporary popup for the character
        this.showCharacterPopup(character, latlng);

        console.log(`🎯 Focused on character "${characterName}" at [${lng}, ${lat}] - positioned in inner 30% of screen`);
        return true;
    }

    // Create and show a temporary popup for the focused character
    showCharacterPopup(character, latlng) {
        const map = window.mapCore.getMap();
        
        // Remove any existing character focus popup
        if (this.currentCharacterPopup) {
            map.removeLayer(this.currentCharacterPopup);
        }

        // Create popup content
        const popupContent = this.createCharacterPopup(character);

        // Create a persistent popup that stays open
        this.currentCharacterPopup = L.popup({
            closeButton: true,      // Keep the X button for manual closing
            autoClose: false,       // Don't auto-close when other popups open
            closeOnClick: false,    // Don't close when clicking on map
            closeOnEscapeKey: true, // Allow ESC key to close
            className: 'character-focus-popup'
        })
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(map);

        // Set up event listeners for controlled closing
        this.setupPopupCloseListeners();

        console.log(`🎯 Character popup opened for "${character.name}" - stays open until closed manually, another character selected, or location clicked`);
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
                    🎯 ${character.name}
                </div>
                ${character.title ? `<div style="font-style: italic; margin-bottom: 8px;">${character.title}</div>` : ''}
                <div style="margin-bottom: 8px;">
                    <span style="background: ${this.relationshipColors[character.relationship] || '#ccc'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
                        ${character.relationship || 'unknown'}
                    </span>
                    <span style="margin-left: 8px;">
                        ${this.statusEmojis[character.status] || '❓'} ${character.status || 'unknown'}
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

    // Add characters to search index
    addToSearchIndex(searchIndex) {
        this.characterData.forEach(character => {
            if (character.coordinates && Array.isArray(character.coordinates)) {
                const [lng, lat] = character.coordinates;
                
                searchIndex.push({
                    name: character.name,
                    desc: `${character.title || ''} ${character.description || ''} ${character.notes || ''}`.trim(),
                    latlng: { lat, lng },
                    type: 'character',
                    character: character
                });
            } else {
                console.warn(`⚠️ Character "${character.name}" excluded from search - no coordinates`);
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
                    <span>${this.statusEmojis[character.status] || '❓'} ${character.relationship || 'Unknown'} • ${character.location || 'Unknown location'}</span>
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