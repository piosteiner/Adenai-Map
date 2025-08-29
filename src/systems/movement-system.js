class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        this.movementMarkers = []; // Track movement location markers
        
        // Initialize Character Path Manager for API integration
        this.pathManager = new CharacterPathManager();
        
        // Initialize Movement Markers system
        this.markersSystem = new MovementMarkers(this);
        
        this.init();
    }

    init() {
        // Listen for characters loaded event
        document.addEventListener('charactersLoaded', async (e) => {
            try {
                await this.loadAndDisplayPaths();
            } catch (error) {
                console.error('❌ Failed to load character paths:', error);
            }
        });
    }

    // API-only path loading and display
    async loadAndDisplayPaths() {
        try {
            console.log('🚀 Starting path loading process...');
            const apiData = await this.pathManager.loadCharacterPaths();
            console.log('✅ API data received, processing paths...');
            
            this.displayPaths(apiData.paths);
            console.log('✅ Paths displayed successfully');
            
            // Load character data for markers
            console.log('🎯 Loading character movement markers...');
            await this.loadCharacterMovementMarkers();
            console.log('✅ Movement markers loaded successfully');
            
        } catch (error) {
            console.error('❌ Error in loadAndDisplayPaths:', error);
            console.error('❌ Error stack:', error.stack);
            console.error('❌ Character Paths API unavailable');
            this.showError('Character movement data unavailable. Please contact developer through GitHub.');
        }
    }

    // Load character data and create movement markers
    async loadCharacterMovementMarkers() {
        try {
            // Load character data (adjust URL if needed)
            const response = await fetch('public/data/characters.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const characters = data.characters || [];
            
            // Create markers for each character
            characters.forEach(character => {
                const characterMarkers = this.markersSystem.createCharacterMovementMarkers(character);
                this.movementMarkers.push(...characterMarkers);
            });
            
            console.log(`✅ Created ${this.movementMarkers.length} movement markers`);
            
            // Emit event that movement markers are loaded
            document.dispatchEvent(new CustomEvent('movementMarkersLoaded', { 
                detail: { 
                    markers: this.movementMarkers 
                } 
            }));
            
        } catch (error) {
            console.error('❌ Failed to load character movement markers:', error);
        }
    }

    // Display paths on the map
    displayPaths(paths) {
        console.log('🗺️ Starting displayPaths with data:', paths);
        const map = window.mapCore.getMap();
        
        if (!map) {
            console.error('❌ Map not available for path display');
            return;
        }
        
        console.log('✅ Map available for path display');
        
        // Hide existing paths before loading new ones
        this.hideAllPaths();
        console.log('🧹 Existing paths hidden');
        
        try {
            Object.values(paths).forEach((pathInfo, index) => {
                console.log(`🛤️ Processing path ${index + 1}:`, pathInfo.name || pathInfo.id);
                
                if (pathInfo.type === 'movement' && pathInfo.coordinates.length >= 2) {
                    // Filter out null coordinates before creating polyline
                    const validCoordinates = pathInfo.coordinates.filter(coord => {
                        return coord && 
                               coord.length === 2 && 
                               coord[0] !== null && 
                               coord[1] !== null &&
                               typeof coord[0] === 'number' && 
                               typeof coord[1] === 'number';
                    });
                    
                    console.log(`🗺️ ${pathInfo.name}: ${pathInfo.coordinates.length} total coords, ${validCoordinates.length} valid coords`);
                    
                    // Only create polyline if we have at least 2 valid coordinates
                    if (validCoordinates.length >= 2) {
                        // Create path line using server-provided styling
                        const pathLine = L.polyline(validCoordinates, {
                            color: pathInfo.style.color,
                            weight: pathInfo.style.weight,
                            opacity: pathInfo.style.opacity,
                            dashArray: pathInfo.style.dashArray
                        });
                        
                        // Only add VsuzH path to map by default, keep others hidden
                        const isVsuzH = pathInfo.name?.toLowerCase().includes('vsuzh') || 
                                       pathInfo.id?.toLowerCase().includes('vsuzh');
                        
                        if (isVsuzH) {
                            pathLine.addTo(map);
                        }
                        
                        this.movementLayers.push(pathLine);
                        
                        // Add tooltip
                        pathLine.bindTooltip(pathInfo.name, {
                            permanent: false,
                            sticky: true,
                            direction: 'top'
                        });

                        // Store path data for character panel compatibility
                        this.characterPaths.push({
                            character: {
                                id: pathInfo.id,
                                name: pathInfo.name,
                                relationship: pathInfo.metadata?.relationship || 'unknown'
                            },
                            pathLine: pathLine,
                            coordinates: validCoordinates, // Use filtered coordinates
                            style: pathInfo.style,
                            isVisible: isVsuzH // Track initial visibility state
                        });
                    } else {
                        console.warn(`⚠️ Skipping ${pathInfo.name}: insufficient valid coordinates (${validCoordinates.length})`);
                    }
            }
        });
        
        console.log('✅ All paths processed successfully');
        
        } catch (pathError) {
            console.error('❌ Error in displayPaths:', pathError);
            throw pathError; // Re-throw to be caught by parent
        }
        
        // Show VsuzH markers by default (after markers are loaded)
        setTimeout(() => {
            this.showInitialVsuzHMarkers();
        }, 100);
        
        // Refresh character panel checkboxes after paths are loaded
        if (window.characterPanel) {
            window.characterPanel.refreshPanel();
        }
    }

    // Show VsuzH movement markers by default
    showInitialVsuzHMarkers() {
        const map = window.mapCore.getMap();
        if (!map) return;

        this.movementMarkers
            .filter(markerData => {
                const isVsuzH = markerData.characterId?.toLowerCase().includes('vsuzh');
                return isVsuzH;
            })
            .forEach(markerData => {
                if (!map.hasLayer(markerData.marker)) {
                    markerData.marker.addTo(map);
                    markerData.isVisible = true;
                }
            });
    }

    // Show all character paths
    showAllPaths() {
        const map = window.mapCore.getMap();
        if (!map) return;

        // Show all path layers
        this.movementLayers.forEach(layer => {
            if (!map.hasLayer(layer)) {
                layer.addTo(map);
            }
        });
        
        // Show all movement markers
        this.movementMarkers.forEach(markerData => {
            if (!map.hasLayer(markerData.marker)) {
                markerData.marker.addTo(map);
                markerData.isVisible = true;
            }
        });
        
        // Update visibility state for paths
        this.characterPaths.forEach(pathData => {
            pathData.isVisible = true;
        });
        
        // Emit event that character path visibility changed
        document.dispatchEvent(new CustomEvent('characterPathVisibilityChanged', { 
            detail: { 
                action: 'showAll',
                visiblePaths: this.characterPaths.filter(p => p.isVisible)
            } 
        }));
    }

    // Hide all character paths
    hideAllPaths() {
        const map = window.mapCore.getMap();
        if (!map) return;

        // Hide all path layers
        this.movementLayers.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        
        // Hide all movement markers
        this.movementMarkers.forEach(markerData => {
            if (map.hasLayer(markerData.marker)) {
                map.removeLayer(markerData.marker);
                markerData.isVisible = false;
            }
        });
        
        // Update visibility state for paths
        this.characterPaths.forEach(pathData => {
            pathData.isVisible = false;
        });
        
        // Emit event that character path visibility changed
        document.dispatchEvent(new CustomEvent('characterPathVisibilityChanged', { 
            detail: { 
                action: 'hideAll',
                visiblePaths: this.characterPaths.filter(p => p.isVisible)
            } 
        }));
    }

    // Show specific character path by ID
    showCharacterPath(characterId) {
        const map = window.mapCore.getMap();
        if (!map) return false;

        // Find and show the path layer for this character
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        if (pathData && pathData.pathLine && !map.hasLayer(pathData.pathLine)) {
            pathData.pathLine.addTo(map);
            pathData.isVisible = true; // Update visibility state
            
            // Also show movement markers for this character
            this.movementMarkers
                .filter(markerData => markerData.characterId === characterId)
                .forEach(markerData => {
                    if (!map.hasLayer(markerData.marker)) {
                        markerData.marker.addTo(map);
                        markerData.isVisible = true;
                    }
                });
            
            // Emit event that character path visibility changed
            document.dispatchEvent(new CustomEvent('characterPathVisibilityChanged', { 
                detail: { 
                    action: 'showCharacter',
                    characterId: characterId,
                    visiblePaths: this.characterPaths.filter(p => p.isVisible)
                } 
            }));
            
            return true;
        }
        return false;
    }

    // Hide specific character path by ID
    hideCharacterPath(characterId) {
        const map = window.mapCore.getMap();
        if (!map) return false;

        // Find and hide the path layer for this character
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        if (pathData && pathData.pathLine && map.hasLayer(pathData.pathLine)) {
            map.removeLayer(pathData.pathLine);
            pathData.isVisible = false; // Update visibility state
            
            // Also hide movement markers for this character
            this.movementMarkers
                .filter(markerData => markerData.characterId === characterId)
                .forEach(markerData => {
                    if (map.hasLayer(markerData.marker)) {
                        map.removeLayer(markerData.marker);
                        markerData.isVisible = false;
                        
                        // Clean up any fanned out markers for clusters
                        if (markerData.type === 'cluster' && markerData.marker._fanMarkers) {
                            this.markersSystem.fanInClusteredMarkers(markerData.marker);
                        }
                    }
                });
            
            // Emit event that character path visibility changed
            document.dispatchEvent(new CustomEvent('characterPathVisibilityChanged', { 
                detail: { 
                    action: 'hideCharacter',
                    characterId: characterId,
                    visiblePaths: this.characterPaths.filter(p => p.isVisible)
                } 
            }));
            
            return true;
        }
        return false;
    }

    // Check if a character path is currently visible
    isCharacterPathVisible(characterId) {
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        if (!pathData) return false;
        
        return pathData.isVisible || false;
    }

    // Show error message
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 500px;
            text-align: center;
        `;
        
        errorDiv.innerHTML = `
            <h3>⚠️ System Unavailable</h3>
            <p>${message}</p>
            <a href="https://github.com/piosteiner" target="_blank" style="color: #fff; text-decoration: underline;">
                🐙 Contact Developer on GitHub
            </a>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }

    // Required by main.js
    addIntegratedMovementControls() {
        // Update version info via GitHub checker if available
        if (window.gitHubVersionChecker) {
            window.gitHubVersionChecker.updateVersionDisplay();
        }
        
        return true;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.MovementSystem = MovementSystem;
    
    // Create and expose instance for global access
    window.movementSystem = new MovementSystem();
}
