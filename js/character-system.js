// character-system.js - Character Loading, Rendering, and Management
class CharacterSystem {
    constructor() {
        this.characterData = [];
        this.characterLayers = [];
        this.relationshipIcons = {};
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
        this.createIcons();
    }

    createIcons() {
        const isMobile = window.mapCore.getIsMobile();
        const iconSize = isMobile ? [40, 40] : [28, 28];
        const iconAnchor = isMobile ? [20, 20] : [14, 14];

        // Enhanced icons for different character relationships
        this.relationshipIcons = {
            ally: L.icon({
                iconUrl: 'icons/character_ally.svg',
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, -20],
                className: 'character-marker'
            }),
            friendly: L.icon({
                iconUrl: 'icons/character_ally.svg',
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, -20],
                className: 'character-marker'
            }),
            enemy: L.icon({
                iconUrl: 'icons/character_enemy.svg',
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, -20],
                className: 'character-marker'
            }),
            hostile: L.icon({
                iconUrl: 'icons/character_enemy.svg',
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, -20],
                className: 'character-marker'
            }),
            neutral: L.icon({
                iconUrl: 'icons/character_neutral.svg',
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, -20],
                className: 'character-marker'
            }),
            suspicious: L.icon({
                iconUrl: 'icons/character_neutral.svg',
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, -20],
                className: 'character-marker'
            })
        };

        // Default character icon
        this.defaultIcon = L.icon({
            iconUrl: 'icons/character.svg',
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: [0, -20]
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
            
            this.addCharactersToMap();
            
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

    addCharactersToMap() {
        const map = window.mapCore.getMap();
        
        // Clear existing character layers first
        this.characterLayers.forEach(({ marker }) => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        this.characterLayers = [];
        
        this.characterData.forEach(character => {
            // Skip characters without coordinates
            if (!character.coordinates || !Array.isArray(character.coordinates)) {
                console.warn(`⚠️ Character "${character.name}" has no valid coordinates`, character);
                return;
            }
            
            // Use stored coordinates directly
            const [lng, lat] = character.coordinates;
            
            // Add small random offset so multiple characters at same location don't overlap exactly
            const offsetLat = lat + (Math.random() - 0.5) * 20;
            const offsetLng = lng + (Math.random() - 0.5) * 20;
            
            // Choose icon based on relationship
            const icon = this.relationshipIcons[character.relationship] || this.defaultIcon;
            
            // Create character marker
            const marker = L.marker([offsetLat, offsetLng], { icon })
                .bindPopup(this.createCharacterPopup(character))
                .addTo(map);
            
            this.characterLayers.push({ marker, character });
            
            console.log(`✅ Added character "${character.name}" at coordinates [${lng}, ${lat}]`);
        });
        
        console.log(`🗺️ Successfully placed ${this.characterLayers.length} characters on map`);
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
                        ${character.relationship || 'unknown'}
                    </span>
                    <span style="margin-left: 8px;">
                        ${this.statusEmojis[character.status] || '❓'} ${character.status || 'unknown'}
                    </span>
                </div>
                ${character.faction ? `<div><strong>🛡️ Faction:</strong> ${character.faction}</div>` : ''}
                ${character.firstMet ? `<div><strong>📅 First Met:</strong> ${character.firstMet}</div>` : ''}
                ${movementInfo}
                ${character.description ? `<div style="margin-top: 8px;"><strong>📝 Description:</strong><br>${character.description}</div>` : ''}
                ${character.notes ? `<div style="margin-top: 8px;"><strong>📋 Notes:</strong><br>${character.notes}</div>` : ''}
            </div>
        `;
    }

    // Get character by name
    getCharacterByName(name) {
        return this.characterData.find(char => char.name === name);
    }

    // Get character layer by name
    getCharacterLayerByName(name) {
        return this.characterLayers.find(cl => cl.character.name === name);
    }

    // Get all characters
    getCharacters() {
        return this.characterData;
    }

    // Get all character layers
    getCharacterLayers() {
        return this.characterLayers;
    }

    // Focus on character
    focusCharacter(characterName) {
        const characterLayer = this.getCharacterLayerByName(characterName);
        if (characterLayer) {
            const map = window.mapCore.getMap();
            map.setView(characterLayer.marker.getLatLng(), Math.max(map.getZoom(), 1));
            characterLayer.marker.openPopup();
            return true;
        }
        return false;
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