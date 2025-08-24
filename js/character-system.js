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

    // Enhanced focus character method with robust centering for custom CRS
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

        const [lng, lat] = character.coordinates;
        const targetLatLng = L.latLng(lat, lng);
        
        console.log(`🎯 Focusing on "${characterName}" at coordinates [${lng}, ${lat}]`);

        // SOLUTION: Multi-step centering approach that works with custom CRS
        this.performRobustCentering(map, targetLatLng, characterName, character);
        
        return true;
    }

    // New robust centering method
    performRobustCentering(map, targetLatLng, characterName, character) {
        // Step 1: Calculate appropriate zoom level for character panel
        const isCharacterPanelOpen = window.characterPanel?.isOpen() || false;
        const isMobile = window.innerWidth <= 768;
        
        // Dynamic zoom based on current zoom, but with bounds
        let targetZoom = map.getZoom();
        
        // Ensure minimum useful zoom level
        if (targetZoom < 0.5) {
            targetZoom = 1.2;
        } else if (targetZoom > 2.5) {
            targetZoom = 2.0; // Prevent being too zoomed in
        } else {
            targetZoom = Math.max(targetZoom, 1.0);
        }

        console.log(`📍 Current zoom: ${map.getZoom().toFixed(2)}, Target zoom: ${targetZoom.toFixed(2)}`);

        // Step 2: Account for character panel offset (pan slightly left when panel open)
        let adjustedTarget = targetLatLng;
        if (isCharacterPanelOpen && !isMobile) {
            // Calculate offset to center character in visible area (left of panel)
            const containerSize = map.getSize();
            const panelWidth = 350; // Character panel width
            const visibleWidth = containerSize.x - panelWidth;
            
            // Calculate how much to shift left (in pixels)
            const offsetPixels = panelWidth / 2; // Half panel width
            
            // Convert pixel offset to map coordinates
            const currentCenter = map.getCenter();
            const pixelCenter = map.latLngToContainerPoint(currentCenter);
            const offsetPoint = L.point(pixelCenter.x - offsetPixels, pixelCenter.y);
            const offsetLatLng = map.containerPointToLatLng(offsetPoint);
            
            // Calculate the difference and apply it to target
            const lngOffset = offsetLatLng.lng - currentCenter.lng;
            adjustedTarget = L.latLng(targetLatLng.lat, targetLatLng.lng + lngOffset);
            
            console.log(`📱 Panel open: adjusting target by ${lngOffset.toFixed(2)} lng units`);
        }

        // Step 3: Robust centering approach
        this.executeCenteringStrategy(map, adjustedTarget, targetZoom, characterName, character);
    }

    // Execute centering with multiple fallback strategies
    executeCenteringStrategy(map, targetLatLng, targetZoom, characterName, character) {
        // Strategy 1: Standard setView (works most of the time)
        try {
            map.setView(targetLatLng, targetZoom, { 
                animate: true, 
                duration: 0.8,
                easeLinearity: 0.1
            });
            
            // Wait for animation to completely finish before verification
            this.waitForAnimationComplete(map, () => {
                this.verifyCentering(map, targetLatLng, characterName, character, 'standard');
            });
            
        } catch (error) {
            console.warn(`⚠️ Standard setView failed: ${error.message}`);
            this.fallbackCenteringStrategy(map, targetLatLng, targetZoom, characterName, character);
        }
    }

    // Fallback centering strategies
    fallbackCenteringStrategy(map, targetLatLng, targetZoom, characterName, character) {
        console.log(`🔄 Using fallback centering for "${characterName}"`);
        
        // Strategy 2: Two-step approach (pan then zoom)
        try {
            // First, pan without changing zoom
            map.panTo(targetLatLng, { 
                animate: true, 
                duration: 0.6,
                easeLinearity: 0.1
            });
            
            // Wait for pan to complete, then adjust zoom
            this.waitForAnimationComplete(map, () => {
                map.setZoom(targetZoom, {
                    animate: true,
                    duration: 0.4
                });
                
                // Wait for zoom to complete before verification
                this.waitForAnimationComplete(map, () => {
                    this.verifyCentering(map, targetLatLng, characterName, character, 'two-step');
                });
            });
            
        } catch (error) {
            console.warn(`⚠️ Two-step centering failed: ${error.message}`);
            this.emergencyCenteringStrategy(map, targetLatLng, targetZoom, characterName, character);
        }
    }

    // Emergency centering strategy
    emergencyCenteringStrategy(map, targetLatLng, targetZoom, characterName, character) {
        console.log(`🚨 Using emergency centering for "${characterName}"`);
        
        // Strategy 3: Force refresh map state then center
        try {
            // Force map to recalculate its state
            map.invalidateSize();
            
            // Wait a bit, then try bounds-based approach
            setTimeout(() => {
                // Create tight bounds around character location
                const bounds = L.latLngBounds(
                    [targetLatLng.lat - 50, targetLatLng.lng - 50],
                    [targetLatLng.lat + 50, targetLatLng.lng + 50]
                );
                
                map.fitBounds(bounds, {
                    animate: true,
                    duration: 0.8,
                    maxZoom: targetZoom
                });
                
                // Wait for bounds animation to complete
                this.waitForAnimationComplete(map, () => {
                    this.verifyCentering(map, targetLatLng, characterName, character, 'emergency');
                });
                
            }, 100);
            
        } catch (error) {
            console.error(`❌ All centering strategies failed for "${characterName}": ${error.message}`);
            // Still show popup even if centering fails
            this.showCharacterPopup(character, targetLatLng);
        }
    }

    // Smart animation completion detection
    waitForAnimationComplete(map, callback) {
        let animationEndTimeout;
        let moveEndFired = false;
        
        // Method 1: Listen for moveend event (most reliable)
        const onMoveEnd = () => {
            if (!moveEndFired) {
                moveEndFired = true;
                map.off('moveend', onMoveEnd);
                clearTimeout(animationEndTimeout);
                
                // Small additional delay to ensure everything is settled
                setTimeout(callback, 100);
            }
        };
        
        map.on('moveend', onMoveEnd);
        
        // Method 2: Fallback timeout in case moveend doesn't fire
        animationEndTimeout = setTimeout(() => {
            if (!moveEndFired) {
                console.log('📍 Using timeout fallback for animation completion');
                map.off('moveend', onMoveEnd);
                onMoveEnd();
            }
        }, 1200); // Slightly longer than expected animation duration
    }

    // Improved verification with less aggressive corrections
    verifyCentering(map, targetLatLng, characterName, character, strategy) {
        const currentCenter = map.getCenter();
        const distance = currentCenter.distanceTo(targetLatLng);
        
        // Get current viewport dimensions for validation
        const bounds = map.getBounds();
        const boundsWidth = bounds.getEast() - bounds.getWest();
        const boundsHeight = bounds.getNorth() - bounds.getSouth();
        
        // More lenient tolerance - only correct if significantly off-center
        const centerTolerance = Math.min(boundsWidth, boundsHeight) * 0.25; // 25% tolerance (was 15%)
        
        if (distance <= centerTolerance) {
            console.log(`✅ Centering SUCCESS (${strategy}): "${characterName}" distance ${distance.toFixed(2)} <= tolerance ${centerTolerance.toFixed(2)}`);
            
            // Show popup immediately on success
            this.showCharacterPopup(character, targetLatLng);
            
        } else {
            console.warn(`⚠️ Centering IMPERFECT (${strategy}): "${characterName}" distance ${distance.toFixed(2)} > tolerance ${centerTolerance.toFixed(2)}`);
            
            // Only try correction if significantly off-center AND not already a final adjustment
            const significantlyOff = distance > centerTolerance * 2; // Must be really far off
            
            if (significantlyOff && strategy !== 'final-adjustment') {
                console.log(`🔧 Distance ${distance.toFixed(2)} is significantly off, attempting gentle correction...`);
                
                // Gentle correction with shorter, smoother animation
                setTimeout(() => {
                    map.panTo(targetLatLng, { 
                        animate: true, 
                        duration: 0.3, // Shorter duration
                        easeLinearity: 0.25 // Smoother easing
                    });
                    
                    // Wait for correction to complete
                    this.waitForAnimationComplete(map, () => {
                        this.verifyCentering(map, targetLatLng, characterName, character, 'final-adjustment');
                    });
                }, 100); // Shorter delay
                
            } else {
                // Accept "good enough" centering and show popup
                console.log(`✓ Centering acceptable for "${characterName}" - showing popup`);
                this.showCharacterPopup(character, targetLatLng);
            }
        }
        
        // Log final viewport state
        console.log(`📊 Final viewport - Center: [${currentCenter.lat.toFixed(2)}, ${currentCenter.lng.toFixed(2)}], Zoom: ${map.getZoom().toFixed(2)}`);
    }

    // Enhanced popup positioning that accounts for viewport
    showCharacterPopup(character, latlng) {
        const map = window.mapCore.getMap();
        
        // Remove any existing character focus popup
        if (this.currentCharacterPopup) {
            map.removeLayer(this.currentCharacterPopup);
        }

        // Create popup content
        const popupContent = this.createCharacterPopup(character);

        // Create popup with enhanced options
        this.currentCharacterPopup = L.popup({
            closeButton: true,
            autoClose: false,
            closeOnClick: false,
            closeOnEscapeKey: true,
            className: 'character-focus-popup',
            autoPan: true,           // Automatically pan to keep popup in view
            autoPanPadding: [50, 50], // Padding from edges
            keepInView: true         // Keep popup in view when map is panned
        })
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(map);

        // Set up event listeners for controlled closing
        this.setupPopupCloseListeners();

        console.log(`🎯 Character popup opened for "${character.name}" with enhanced positioning`);
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