class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        this.movementMarkers = []; // Track movement location markers
        this.markersVisible = true; // Global toggle state for all movement markers
        
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

        // Listen for map ready event to ensure VsuzH markers are visible
        document.addEventListener('adenaiMapReady', () => {
            // Ensure VsuzH movement markers are visible after map is fully initialized
            setTimeout(() => {
                if (this.movementMarkers.length > 0) {
                    Logger.movement('🔄 Ensuring VsuzH markers are visible after map ready...');
                    this.showInitialVsuzHMarkers();
                }
            }, 500);
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
            
            // Show markers immediately after creation (only VsuzH by default)
            setTimeout(() => {
                this.showInitialVsuzHMarkers();
                
                // Refresh character panel to sync checkbox states
                if (window.characterPanel && window.characterPanel.refreshPanel) {
                    Logger.movement('🔄 Refreshing character panel to sync checkbox states...');
                    window.characterPanel.refreshPanel();
                }
            }, 50);
            
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
                        // The path: walked stretches as lines, teleports as dotted arcs (buildPathLayer)
                        const pathLine = this.buildPathLayer(pathInfo, coordValidation.coordinates, {
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
                            info: pathInfo, // incl. metadata.movementHistory with dates, for the timeline
                            isVisible: isVsuzH // Track initial visibility state
                        });
                    } else {
                        Logger.warning(`Skipping ${pathInfo.name}: insufficient valid coordinates (${coordValidation.validCount})`);
                    }
            }
        });
        
        Logger.movement('All paths processed successfully');
        document.dispatchEvent(new CustomEvent('characterPathsReady', { detail: { count: this.characterPaths.length } }));
        
        } catch (pathError) {
            Logger.error('Error in displayPaths:', pathError);
            throw pathError; // Re-throw to be caught by parent
        }
        
        // Show VsuzH markers by default (after markers are loaded)
        setTimeout(() => {
            this.showInitialVsuzHMarkers();
            
            // Refresh character panel to sync checkbox states after both paths and markers are loaded
            if (window.characterPanel && window.characterPanel.refreshPanel) {
                Logger.movement('🔄 Refreshing character panel after paths loaded...');
                window.characterPanel.refreshPanel();
            }
        }, 100);
        
        // Refresh character panel checkboxes after paths are loaded
        if (window.characterPanel) {
            window.characterPanel.refreshPanel();
        }
    }

    // A character's path as one layer group: polylines for the walked stretches, and for each teleport movement a
    // dotted arc with ✨ at its apex (a jump, not a route). The movement types pair with the coordinates only when
    // every movement could be placed; otherwise (or without teleports) it is one polyline, as before.
    buildPathLayer(pathInfo, coords, style) {
        const moves = pathInfo.metadata?.movementHistory || [];
        const types = moves.length === coords.length ? moves.map((m) => m.type) : null;
        const group = L.featureGroup();
        if (!types || !types.includes('teleport')) return group.addLayer(L.polyline(coords, style));
        let run = [coords[0]];
        for (let i = 1; i < coords.length; i++) {
            if (types[i] === 'teleport') {
                if (run.length > 1) group.addLayer(L.polyline(run, style));
                group.addLayer(this.teleportArc(coords[i - 1], coords[i], style));
                run = [coords[i]];
            } else {
                run.push(coords[i]);
            }
        }
        if (run.length > 1) group.addLayer(L.polyline(run, style));
        return group;
    }

    // a and b as [lat, lng]: a gentle quadratic curve (its apex 3% of the distance to the side)
    teleportArc(a, b, style) {
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const dLat = b[0] - a[0];
        const dLng = b[1] - a[1];
        const ctrl = [mid[0] + dLng * 0.06, mid[1] - dLat * 0.06];
        const apex = [0.25 * a[0] + 0.5 * ctrl[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * ctrl[1] + 0.25 * b[1]];
        const arc = L.curve(['M', a, 'Q', ctrl, b], { ...style, dashArray: '1, 20', lineCap: 'round', weight: ((style.weight || 4) + 1) * 0.7 });
        arc.bindTooltip('✨ Teleport', { sticky: true });
        const spark = L.marker(apex, { icon: L.divIcon({ className: 'teleport-spark', html: '✨', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, keyboard: false });
        return L.featureGroup([arc, spark]);
    }

    // Show VsuzH movement markers by default
    showInitialVsuzHMarkers() {
        // Only show if markers are globally enabled
        if (!this.markersVisible) {
            Logger.movement('Skipping VsuzH markers - markers globally disabled');
            return;
        }

        MapUtils.withMap(map => {
            Logger.movement('Showing initial VsuzH movement markers...');
            
            let vsuzHCount = 0;
            this.movementMarkers
                .filter(markerData => {
                    const isVsuzH = markerData.characterId?.toLowerCase().includes('vsuzh');
                    return isVsuzH;
                })
                .forEach(markerData => {
                    if (!map.hasLayer(markerData.marker)) {
                        MapUtils.addToMap(markerData.marker);
                        markerData.isVisible = true;
                        vsuzHCount++;
                    }
                });
                
            if (vsuzHCount > 0) {
                Logger.success(`✅ Made ${vsuzHCount} VsuzH movement markers visible`);
                
                // Update VsuzH checkbox state if character panel is available
                setTimeout(() => {
                    const vsuzHCheckbox = document.getElementById('path-vsuzh');
                    if (vsuzHCheckbox && !vsuzHCheckbox.checked) {
                        vsuzHCheckbox.checked = true;
                        Logger.movement('✅ Synced VsuzH checkbox to checked state');
                    }
                }, 100);
            }
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
                
                // Also show movement markers for this character (if markers are globally visible)
                if (this.markersVisible) {
                    this.movementMarkers
                        .filter(markerData => markerData.characterId === characterId)
                        .forEach(markerData => {
                            if (MapUtils.addToMap(markerData.marker)) {
                                markerData.isVisible = true;
                            }
                        });
                }
                
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
        // Check both path visibility and movement marker visibility
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        const pathVisible = pathData?.isVisible || false;
        
        // Also check if movement markers are visible for this character
        const markersVisible = this.movementMarkers.some(markerData => 
            markerData.characterId === characterId && markerData.isVisible
        );
        
        // Special case: VsuzH should be considered visible by default
        const isVsuzH = characterId?.toLowerCase().includes('vsuzh');
        
        return pathVisible || markersVisible || isVsuzH;
    }

    // Toggle all movement markers visibility
    toggleAllMovementMarkers() {
        this.markersVisible = !this.markersVisible;
        
        if (this.markersVisible) {
            this.showAllMovementMarkers();
        } else {
            this.hideAllMovementMarkers();
        }
        
        return this.markersVisible;
    }

    // Show all movement markers (respecting individual character path states)
    showAllMovementMarkers() {
        return MapUtils.withMap(map => {
            Logger.movement('Showing all movement markers...');
            
            let shownCount = 0;
            this.movementMarkers.forEach(markerData => {
                // Only show markers for characters whose paths are currently visible
                const pathData = this.characterPaths.find(path => path.character?.id === markerData.characterId);
                const shouldShow = pathData?.isVisible || markerData.characterId?.toLowerCase().includes('vsuzh');
                
                if (shouldShow && !map.hasLayer(markerData.marker)) {
                    MapUtils.addToMap(markerData.marker);
                    markerData.isVisible = true;
                    shownCount++;
                }
            });
            
            this.markersVisible = true;
            Logger.success(`✅ Showed ${shownCount} movement markers`);
            return true;
        }, 'Cannot show movement markers - map not available');
    }

    // Hide all movement markers
    hideAllMovementMarkers() {
        return MapUtils.withMap(map => {
            Logger.movement('Hiding all movement markers...');
            
            let hiddenCount = 0;
            this.movementMarkers.forEach(markerData => {
                if (map.hasLayer(markerData.marker)) {
                    MapUtils.removeFromMap(markerData.marker);
                    markerData.isVisible = false;
                    hiddenCount++;
                    
                    // Clean up any fanned out markers for clusters
                    if (markerData.type === 'cluster' && markerData.marker._fanMarkers) {
                        this.markersSystem.fanInClusteredMarkers(markerData.marker);
                    }
                }
            });
            
            this.markersVisible = false;
            Logger.success(`✅ Hid ${hiddenCount} movement markers`);
            return true;
        }, 'Cannot hide movement markers - map not available');
    }

    // Check if markers are currently visible globally
    areMarkersVisible() {
        return this.markersVisible;
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
