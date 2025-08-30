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
                Logger.error('Failed to load character paths:', error);
            }
        });
    }

    // API-only path loading and display
    async loadAndDisplayPaths() {
        try {
            Logger.movement('Starting path loading process...');
            const apiData = await this.pathManager.loadCharacterPaths();
            Logger.movement('API data received, processing paths...');
            
            this.displayPaths(apiData.paths);
            Logger.movement('Paths displayed successfully');
            
            // Load character data for markers
            Logger.movement('Loading character movement markers...');
            await this.loadCharacterMovementMarkers();
            Logger.movement('Movement markers loaded successfully');
            
        } catch (error) {
            Logger.error('Error in loadAndDisplayPaths:', error);
            Logger.error('Error stack:', error.stack);
            Logger.error('Character Paths API unavailable');
            NotificationUtils.showError('Character movement data unavailable. Please contact developer through GitHub.');
        }
    }

    // Load character data and create movement markers
    async loadCharacterMovementMarkers() {
        try {
            // Load character data using HttpUtils
            const data = await HttpUtils.fetchLocalData('public/data/characters.json');
            const characters = data.characters || [];
            
            // Create markers for each character
            characters.forEach(character => {
                const characterMarkers = this.markersSystem.createCharacterMovementMarkers(character);
                this.movementMarkers.push(...characterMarkers);
            });
            
            Logger.movement(`Created ${this.movementMarkers.length} movement markers`);
            
            // Dispatch event that movement markers are ready
            Logger.movement('🚀 Dispatching movementMarkersLoaded event...');
            document.dispatchEvent(new CustomEvent('movementMarkersLoaded', {
                detail: { 
                    markersCount: this.movementMarkers.length,
                    characters: data.characters 
                }
            }));
            Logger.movement('✅ Movement markers loading complete');
            
        } catch (error) {
            Logger.error('Failed to load character movement markers:', error);
        }
    }

    // Display paths on the map
    displayPaths(paths) {
        Logger.movement('Starting displayPaths with data:', paths);
        
        if (!MapUtils.isMapAvailable()) {
            Logger.error('Map not available for path display');
            return;
        }
        
        Logger.success('Map available for path display');
        
        // Hide existing paths before loading new ones
        this.hideAllPaths();
        Logger.cleanup('Existing paths hidden');
        
        try {
            Object.values(paths).forEach((pathInfo, index) => {
                Logger.movement(`Processing path ${index + 1}:`, pathInfo.name || pathInfo.id);
                
                if (pathInfo.type === 'movement' && pathInfo.coordinates.length >= 2) {
                    // Use centralized coordinate validation
                    const coordValidation = DataUtils.validateCoordinatePath(pathInfo.coordinates);
                    
                    Logger.movement(`${pathInfo.name}: ${coordValidation.originalCount} total coords, ${coordValidation.validCount} valid coords`);
                    
                    // Only create polyline if we have at least 2 valid coordinates
                    if (coordValidation.valid) {
                        // Create path line using server-provided styling
                        const pathLine = L.polyline(coordValidation.coordinates, {
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
                            coordinates: coordValidation.coordinates, // Use filtered coordinates
                            style: pathInfo.style,
                            isVisible: isVsuzH // Track initial visibility state
                        });
                    } else {
                        Logger.warning(`Skipping ${pathInfo.name}: insufficient valid coordinates (${coordValidation.validCount})`);
                    }
            }
        });
        
        Logger.movement('All paths processed successfully');
        
        } catch (pathError) {
            Logger.error('Error in displayPaths:', pathError);
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
        MapUtils.withMap(map => {
            this.movementMarkers
                .filter(markerData => {
                    const isVsuzH = markerData.characterId?.toLowerCase().includes('vsuzh');
                    return isVsuzH;
                })
                .forEach(markerData => {
                    if (!map.hasLayer(markerData.marker)) {
                        MapUtils.addToMap(markerData.marker);
                        markerData.isVisible = true;
                    }
                });
        }, 'Cannot show initial VsuzH markers - map not available');
    }

    // Show all character paths
    showAllPaths() {
        return MapUtils.withMap(map => {
            // Show all path layers
            this.movementLayers.forEach(layer => {
                MapUtils.addToMap(layer);
            });
            
            // Show all movement markers
            this.movementMarkers.forEach(markerData => {
                if (MapUtils.addToMap(markerData.marker)) {
                    markerData.isVisible = true;
                }
            });
            
            // Update visibility state for paths
            this.characterPaths.forEach(pathData => {
                pathData.isVisible = true;
            });
            
            return true;
        }, 'Cannot show paths - map not available');
    }

    // Hide all character paths
    hideAllPaths() {
        return MapUtils.withMap(map => {
            // Hide all path layers
            this.movementLayers.forEach(layer => {
                MapUtils.removeFromMap(layer);
            });
            
            // Hide all movement markers
            this.movementMarkers.forEach(markerData => {
                if (MapUtils.removeFromMap(markerData.marker)) {
                    markerData.isVisible = false;
                }
            });
            
            // Update visibility state for paths
            this.characterPaths.forEach(pathData => {
                pathData.isVisible = false;
            });
            
            return true;
        }, 'Cannot hide paths - map not available');
    }

    // Show specific character path by ID
    showCharacterPath(characterId) {
        return MapUtils.withMap(map => {
            // Find and show the path layer for this character
            const pathData = this.characterPaths.find(path => path.character?.id === characterId);
            if (pathData && pathData.pathLine) {
                if (MapUtils.addToMap(pathData.pathLine)) {
                    pathData.isVisible = true; // Update visibility state
                }
                
                // Also show movement markers for this character
                this.movementMarkers
                    .filter(markerData => markerData.characterId === characterId)
                    .forEach(markerData => {
                        if (MapUtils.addToMap(markerData.marker)) {
                            markerData.isVisible = true;
                        }
                    });
                
                return true;
            }
            return false;
        }, 'Cannot show character path - map not available');
    }

    // Hide specific character path by ID
    hideCharacterPath(characterId) {
        Logger.movement(`Hiding paths for character ${characterId}...`);
        
        return MapUtils.withMap(map => {
            // Find and hide the path layer for this character
            const pathData = this.characterPaths.find(path => path.character?.id === characterId);
            if (pathData && pathData.pathLine && map.hasLayer(pathData.pathLine)) {
                MapUtils.removeFromMap(pathData.pathLine);
                pathData.isVisible = false; // Update visibility state
                
                // Also hide movement markers for this character
                this.movementMarkers
                    .filter(markerData => markerData.characterId === characterId)
                    .forEach(markerData => {
                        if (map.hasLayer(markerData.marker)) {
                            MapUtils.removeFromMap(markerData.marker);
                            markerData.isVisible = false;
                            
                            // Clean up any fanned out markers for clusters
                            if (markerData.type === 'cluster' && markerData.marker._fanMarkers) {
                                this.markersSystem.fanInClusteredMarkers(markerData.marker);
                            }
                        }
                    });
                
                return true;
            }
            return false;
        }, 'Cannot hide character path - map not available');
    }

    // Check if a character path is currently visible
    isCharacterPathVisible(characterId) {
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        if (!pathData) return false;
        
        return pathData.isVisible || false;
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
