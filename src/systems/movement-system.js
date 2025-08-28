// movement-system.js - Simplified Character Movement System (UI handled by character panel)
class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        this.visibleCharacterPaths = new Set(); // Track which character paths are visible
        this.consolidatedMarkers = []; // Track consolidated markers for overlapping locations
        this.currentTimelineDate = null;
        
        // 🔥 NEW: Initialize Character Path Manager for API integration
        this.pathManager = new CharacterPathManager();
        this.isUsingAPI = false; // Track data source for debugging
        
        this.init();
    }

    init() {
        // Listen for characters loaded event - now handles async loading
        document.addEventListener('charactersLoaded', async (e) => {
            try {
                await this.addCharacterMovementPaths();
            } catch (error) {
                console.error('❌ Failed to add character movement paths:', error);
            }
        });

        // Set up zoom-based number visibility when map is ready
        setTimeout(() => {
            if (window.mapCore && window.mapCore.map) {
                this.setupZoomBasedNumberVisibility();
            }
        }, 500);

        // Add global function for consolidated popups
        window.showVisitDetails = (visitIndex, coordKey, characterId = null) => {
        const containerSelector = `#visit-details-${coordKey.replace(',', '-')}`;
        const container = document.querySelector(containerSelector);
        if (!container) return;
        
        // Parse coordinates from the coordKey
        const [x, y] = coordKey.split(',').map(Number);
        const coordinates = [x, y];
        
        let visits;
        let visit;
        
        if (characterId) {
            // Single character mode - find visits for specific character
            const allCharacters = window.characterSystem.getCharacters();
            const character = allCharacters.find(c => c.id === characterId);
            
            if (!character) {
                container.innerHTML = `<p style="color: red;">Character not found.</p>`;
                return;
            }
            
            visits = window.movementSystem.findVisitsAtLocationForCharacter(coordinates, character);
        } else {
            // Cross-character mode - find visits from all selected characters
            visits = window.movementSystem.findVisitsAtLocationFromSelectedCharacters(coordinates);
        }
        
        if (visitIndex >= visits.length) {
            container.innerHTML = `<p style="color: red;">Visit not found.</p>`;
            return;
        }
        
        visit = visits[visitIndex];
        const movement = visit; // The visit object IS the movement data
        
        // Check if this is a multi-day stay
        const hasDateRange = movement.dateEnd && movement.dateEnd !== (movement.dateStart || movement.date);
        const duration = hasDateRange ? 
            window.movementSystem.calculateDuration(
                new Date(movement.dateStart || movement.date), 
                new Date(movement.dateEnd)
            ) : null;
        
        // Generate the visit details HTML
        const visitDetailsHTML = `
            <div class="selected-visit-details${hasDateRange ? ' multi-day-stay' : ''}">
                <div class="visit-header">
                    <h4>${movement.location || 'Unknown Location'}${hasDateRange ? ' 🏠' : ''}</h4>
                    <span class="visit-badge">Visit ${visit.visitIndex}</span>
                </div>
                
                <div class="visit-info-grid">
                    <div class="info-row">
                        <strong>Person:</strong> 
                        <span class="character-name">${visit.characterName || (character ? character.name : 'Unknown')}</span>
                    </div>
                    
                    ${movement.type ? `
                    <div class="info-row">
                        <strong>Art der Reise:</strong> 
                        <span class="movement-type">${window.movementSystem.formatMovementType(movement.type)}</span>
                    </div>
                    ` : ''}
                    
                    <div class="info-row">
                        <strong>Datum:</strong> 
                        <span class="visit-date">${window.movementSystem.formatMovementDateRange(movement)}</span>
                    </div>
                    
                    ${duration ? `
                    <div class="info-row">
                        <strong>Dauer:</strong> 
                        <span class="duration-info">${duration}</span>
                    </div>
                    ` : ''}
                    
                    ${movement.notes ? `
                    <div class="info-row notes-row">
                        <strong>Notizen:</strong> 
                        <div class="movement-notes">${movement.notes}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="visit-navigation">
                    ${visits.length > 1 ? `
                    <small class="visit-counter">
                        Visit ${visitIndex + 1} of ${visits.length} at this location
                    </small>
                    ` : ''}
                </div>
            </div>
        `;
        
        container.innerHTML = visitDetailsHTML;
        
        // Add some visual feedback
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Highlight the selected visit button
        const popupElement = container.closest('.consolidated-popup');
        if (popupElement) {
            const allButtons = popupElement.querySelectorAll('.visit-btn');
            allButtons.forEach(btn => btn.classList.remove('selected'));
            
            const selectedButton = popupElement.querySelector(`[onclick*="${visitIndex},"]`);
            if (selectedButton) {
                selectedButton.classList.add('selected');
            }
        }
    };
    }

    // 🔥 NEW: Hybrid API implementation with fallback to existing system
    async addCharacterMovementPaths() {
        console.log('🗺️ Starting character path loading...');
        
        // Show loading state
        this.showLoadingState();
        
        // Clear existing paths
        this.clearCharacterPaths();
        
        try {
            // Try the new API first
            // API provides server-controlled path styling:
            // - color: by character relationship (ally=#4CAF50, neutral=#FFC107, etc.)
            // - weight: always 2px
            // - opacity: 0.7 for living, 0.4 for dead characters  
            // - dashArray: '5,2' for all paths (5px dash, 2px gap)
            const pathData = await this.pathManager.loadCharacterPaths();
            this.isUsingAPI = pathData.metadata.source !== 'legacy-json';
            
            console.log(`📊 Using ${this.isUsingAPI ? 'API' : 'fallback'} data source`);
            console.log(`📈 Loaded ${Object.keys(pathData.paths).length} character paths`);
            
            // Render paths from API data
            await this.renderPathsFromAPIData(pathData);
            
        } catch (error) {
            console.error('❌ Failed to load character paths:', error);
            
            // Final fallback to existing character system
            console.log('🔄 Attempting legacy character system fallback...');
            await this.loadLegacyCharacterPaths();
        }
        
        // Auto-show VsuzH path by default
        this.autoShowPartyPath();
        
        // Hide loading state
        this.hideLoadingState();
        
        console.log(`✅ Created ${this.characterPaths.length} character movement paths`);
        
        // Log performance info
        if (this.isUsingAPI) {
            this.pathManager.printStatistics();
        }
    }

    // Render paths from new API format
    async renderPathsFromAPIData(apiData) {
        const paths = apiData.paths;
        
        Object.values(paths).forEach(pathInfo => {
            if (pathInfo.type === 'movement' && pathInfo.coordinates.length >= 2) {
                // Multi-point movement path
                this.createCharacterPathFromAPI(pathInfo);
            } else if (pathInfo.type === 'static' && pathInfo.coordinates.length === 1) {
                // Static location marker
                this.createStaticCharacterMarker(pathInfo);
            }
        });
    }

    // Create character path from API data format
    createCharacterPathFromAPI(pathInfo) {
        const map = window.mapCore.getMap();
        
        // Use server-controlled styling for paths
        // Server controls: color (by relationship), weight (always 2), opacity (0.7 or 0.4), dashArray (always '5,2')
        const pathStyle = {
            color: pathInfo.style.color,           // Server-controlled by relationship
            weight: pathInfo.style.weight,         // Server-controlled (always 2)
            opacity: pathInfo.style.opacity,       // Server-controlled (0.7 for alive, 0.4 for dead)
            dashArray: pathInfo.style.dashArray || '5,2', // Server-controlled (standard dash pattern)
            className: `character-path character-path-${pathInfo.id}`
        };
        
        // Create the path polyline using server-controlled styling
        const pathLine = L.polyline(pathInfo.coordinates, pathStyle);
        
        // Add tooltip with character name
        pathLine.bindTooltip(pathInfo.name, {
            permanent: false,
            sticky: true,
            direction: 'top',
            offset: [0, -10],
            className: 'character-path-tooltip'
        });

        // Create popup with journey info
        pathLine.bindPopup(this.createAPIPathPopup(pathInfo));
        
        // Create movement markers for path points using the enhanced consolidation system
        const pathMarkers = pathInfo.coordinates.map((coord, index) => {
            // Convert API format to legacy format for consistency with consolidation system
            const point = {
                coordinates: [coord[1], coord[0]], // Convert [lat,lng] to [x,y] for legacy compatibility
                location: `${pathInfo.name} Stop ${index + 1}`,
                date: 'API Data'
            };
            
            // Create a mock character object for compatibility (markers use CSS styling, not API colors)
            const mockCharacter = {
                id: pathInfo.id,
                name: pathInfo.name,
                relationship: pathInfo.metadata.relationship,
                movementHistory: pathInfo.coordinates.map((c, i) => ({
                    coordinates: [c[1], c[0]], // Convert to [x,y]
                    location: `${pathInfo.name} Stop ${i + 1}`,
                    date: 'API Data'
                }))
            };
            
            return this.createMovementMarker(point, index, pathInfo.coordinates.length, mockCharacter);
        });
        
        // Store path data in the same format as legacy system for full consolidation compatibility
        const pathData = {
            character: {
                id: pathInfo.id,
                name: pathInfo.name,
                relationship: pathInfo.metadata.relationship,
                // Add movementHistory for consolidation compatibility
                movementHistory: pathInfo.coordinates.map((coord, i) => ({
                    coordinates: [coord[1], coord[0]], // Convert to [x,y]
                    location: `${pathInfo.name} Stop ${i + 1}`,
                    date: 'API Data',
                    dateStart: 'API Data'
                }))
            },
            pathLine: pathLine,
            markers: pathMarkers,
            points: pathInfo.coordinates.map((coord, index) => ({
                coordinates: [coord[1], coord[0]], // Convert back to [x,y] for compatibility
                location: `${pathInfo.name} Stop ${index + 1}`,
                date: 'API Data'
            })),
            isVisible: false,
            apiSource: true // Mark as API-sourced
        };
        
        this.characterPaths.push(pathData);
    }

    // Create static character marker for characters without movement
    createStaticCharacterMarker(pathInfo) {
        const map = window.mapCore.getMap();
        const coord = pathInfo.coordinates[0];
        
        const marker = L.circleMarker(coord, {
            radius: 8,
            fillColor: pathInfo.style.color,
            color: pathInfo.style.color,
            weight: 2,
            opacity: pathInfo.style.opacity,
            fillOpacity: pathInfo.style.opacity * 0.8,
            className: `static-character-marker character-${pathInfo.id}`
        });

        marker.bindTooltip(pathInfo.name, {
            permanent: false,
            direction: 'top',
            offset: [0, -10]
        });

        marker.bindPopup(this.createAPIStaticPopup(pathInfo));

        // Store as a simplified path data for consistency with consolidation system
        const pathData = {
            character: {
                id: pathInfo.id,
                name: pathInfo.name,
                relationship: pathInfo.metadata.relationship,
                // Add movementHistory even for static characters for consolidation compatibility
                movementHistory: [{
                    coordinates: [coord[1], coord[0]], // Convert to [x,y]
                    location: pathInfo.name,
                    date: 'Static',
                    dateStart: 'Static'
                }]
            },
            pathLine: marker, // Using marker as the main element
            markers: [marker],
            points: [{
                coordinates: [coord[1], coord[0]], // Convert to [x,y]
                location: pathInfo.name,
                date: 'Static'
            }],
            isVisible: false,
            isStatic: true,
            apiSource: true
        };

        this.characterPaths.push(pathData);
    }

    // Legacy fallback method (uses server-compatible styling)
    async loadLegacyCharacterPaths() {
        const characters = window.characterSystem.getCharacters();
        
        characters.forEach(character => {
            if (!character.movementHistory || character.movementHistory.length < 1) {
                return; // Need at least 1 movement point
            }
            
            // Use server-compatible styling for legacy paths to maintain consistency
            const movementPoints = [];
            
            // Add all movement history points
            character.movementHistory.forEach(movement => {
                if (movement.coordinates) {
                    movementPoints.push({
                        coordinates: movement.coordinates,
                        date: movement.dateStart || movement.date,
                        dateEnd: movement.dateEnd,
                        location: movement.location || 'Custom Location',
                        notes: movement.notes || '',
                        type: movement.type || 'travel'
                    });
                }
            });
            
            // Add current location as last point if it has coordinates and is different from last movement
            if (character.coordinates) {
                const lastMovement = movementPoints[movementPoints.length - 1];
                const isSameAsLastMovement = lastMovement && 
                    lastMovement.coordinates[0] === character.coordinates[0] && 
                    lastMovement.coordinates[1] === character.coordinates[1];
                    
                if (!isSameAsLastMovement) {
                    movementPoints.push({
                        coordinates: character.coordinates,
                        date: character.currentLocation?.date || 'Current',
                        dateEnd: null,
                        location: character.location || 'Current Location',
                        notes: character.currentLocation?.notes || 'Current position'
                    });
                }
            }
            
            // Sort points by date
            movementPoints.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            if (movementPoints.length >= 2) {
                this.createCharacterPath(character, movementPoints);
            }
        });
    }

    // Auto-show party/VsuzH path
    autoShowPartyPath() {
        const vsuzHPath = this.characterPaths.find(pathData => {
            const name = pathData.character.name.toLowerCase();
            return name.includes('vsuzh') || name.includes('vsuz') || pathData.character.relationship === 'party';
        });

        if (vsuzHPath) {
            this.showCharacterPath(vsuzHPath.character.id);
            console.log(`Auto-showing VsuzH path for: ${vsuzHPath.character.name}`);
        }
    }

    // UI feedback methods
    showLoadingState() {
        // Create or update loading indicator
        let loadingDiv = document.getElementById('character-paths-loading');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'character-paths-loading';
            loadingDiv.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                           background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; 
                           z-index: 10000; text-align: center;">
                    <div>🗺️ Loading character paths...</div>
                    <div style="margin-top: 10px; font-size: 0.8em; opacity: 0.8;">
                        Trying optimized API...
                    </div>
                </div>
            `;
            document.body.appendChild(loadingDiv);
        }
    }

    hideLoadingState() {
        const loadingDiv = document.getElementById('character-paths-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    // Create popup content for API paths
    createAPIPathPopup(pathInfo) {
        const metadata = pathInfo.metadata;
        return `
            <div class="character-path-popup">
                <h4>${pathInfo.name}'s Journey</h4>
                <p><strong>Total Locations:</strong> ${pathInfo.coordinates.length}</p>
                <p><strong>Relationship:</strong> ${metadata.relationship}</p>
                <p><strong>Status:</strong> ${metadata.status}</p>
                <div class="api-info">
                    <small>📊 Optimized path data • ${metadata.movementCount} movements</small>
                </div>
            </div>
        `;
    }

    // Create popup content for static API markers
    createAPIStaticPopup(pathInfo) {
        const metadata = pathInfo.metadata;
        return `
            <div class="character-static-popup">
                <h4>${pathInfo.name}</h4>
                <p><strong>Status:</strong> ${metadata.status}</p>
                <p><strong>Relationship:</strong> ${metadata.relationship}</p>
                <div class="api-info">
                    <small>📍 Static location</small>
                </div>
            </div>
        `;
    }

    // Create movement marker for API data
    createAPIMovementMarker(coord, index, totalPoints, pathInfo) {
        const isFirst = index === 0;
        const isLast = index === totalPoints - 1;
        
        let markerContent;
        if (isFirst) {
            markerContent = '1';
        } else if (isLast) {
            markerContent = '🚩';
        } else {
            markerContent = `${index + 1}`;
        }

        const markerIcon = L.divIcon({
            html: `<div class="movement-marker-content">${markerContent}</div>`,
            iconSize: [24, 24],
            className: `movement-${isFirst ? 'start' : isLast ? 'end' : 'number'}-marker api-marker`,
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker(coord, {
            icon: markerIcon,
            zIndexOffset: 10
        });

        marker.bindTooltip(`${pathInfo.name} - Stop ${index + 1}`, {
            direction: 'top',
            offset: [0, -12]
        });

        return marker;
    }

    createCharacterPath(character, movementPoints) {
        const map = window.mapCore.getMap();
        
        // Create path coordinates for Leaflet (using the same coordinate system as characters)
        const pathCoords = movementPoints.map(point => [
            point.coordinates[1], // lat = y
            point.coordinates[0]  // lng = x
        ]);
        
        // Use server-compatible styling for consistency
        // Server-controlled design: color by relationship, weight=2, opacity by status, dashArray='5,2'
        const pathStyle = this.getServerCompatiblePathStyle(character);
        
        // Create the path polyline with server-compatible styling
        const pathLine = L.polyline(pathCoords, {
            ...pathStyle,
            className: `character-path character-path-${character.id}`
        });
        
        // Add cursor-following tooltip with character name
        pathLine.bindTooltip(`${character.name}`, {
            permanent: false,
            sticky: true,
            direction: 'top',
            offset: [0, -10],
            className: 'character-path-tooltip'
        });

        // Add click handler for path info
        pathLine.bindPopup(this.createPathPopup(character, movementPoints));
        
        // Create movement markers for each point
        const pathMarkers = movementPoints.map((point, index) => {
            return this.createMovementMarker(point, index, movementPoints.length, character);
        });
        
        // Store path data
        const pathData = {
            character: character,
            pathLine: pathLine,
            markers: pathMarkers,
            points: movementPoints,
            isVisible: false
        };
        
        this.characterPaths.push(pathData);
    }

    // Get server-compatible path styling for legacy characters
    getServerCompatiblePathStyle(character) {
        // Match server-side design system:
        // Color by relationship, weight=2, opacity by status, dashArray='5,2'
        const relationshipColors = {
            ally: '#4CAF50',
            friendly: '#8BC34A', 
            neutral: '#FFC107',
            suspicious: '#FF9800',
            hostile: '#FF5722',
            enemy: '#F44336',
            party: '#584cffff'
        };
        
        return {
            color: relationshipColors[character.relationship] || '#666666',
            weight: 2,  // Server standard
            opacity: (character.status === 'dead' || character.status === 'deceased') ? 0.4 : 0.7, // Server standard
            dashArray: '5,2' // Server standard
        };
    }

    createPathPopup(character, movementPoints) {
        return `
            <div class="character-path-popup">
                <h4>${character.name}'s Journey</h4>
                <p><strong>Total Locations:</strong> ${movementPoints.length}</p>
                <p><strong>Relationship:</strong> ${character.relationship}</p>
                <div class="movement-timeline">
                    ${movementPoints.map((point, index) => {
                        // Find the corresponding movement data to get full date range info
                        const movement = character.movementHistory.find(m => 
                            m.coordinates && 
                            m.coordinates[0] === point.coordinates[0] && 
                            m.coordinates[1] === point.coordinates[1] &&
                            (m.location === point.location || (!m.location && point.location === 'Custom Location'))
                        );
                        
                        // Calculate duration if there's a date range
                        const hasDateRange = movement && movement.dateEnd && movement.dateEnd !== (movement.dateStart || movement.date);
                        const duration = hasDateRange ? this.calculateDuration(new Date(movement.dateStart || movement.date), new Date(movement.dateEnd)) : null;
                        
                        // Format the date range
                        const dateDisplay = movement ? this.formatMovementDateRange(movement) : this.formatDate(point.date);
                        
                        return `
                            <div class="timeline-entry${hasDateRange ? ' multi-day-stay' : ''}">
                                <strong>${index + 1}.</strong> ${point.location}${hasDateRange ? ' 🏠' : ''}
                                <small>(${dateDisplay})</small>
                                ${duration ? `<br><span class="duration-info"><strong>Duration:</strong> ${duration}</span>` : ''}
                                ${point.notes ? `<br><em>${point.notes}</em>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Enhanced method to group all visits by location
    findAllVisitsAtLocation(coordinates, allCharacters) {
        const visits = [];
        
        allCharacters.forEach(character => {
            if (!character.movementHistory) return;
            
            character.movementHistory.forEach((movement, index) => {
                if (movement.coordinates && 
                    movement.coordinates[0] === coordinates[0] && 
                    movement.coordinates[1] === coordinates[1]) {
                    visits.push({
                        ...movement,
                        character: character,
                        visitIndex: index + 1, // Journey sequence number
                        characterName: character.name
                    });
                }
            });
        });
        
        return visits.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
    }

    // 🔥 NEW: Method to find visits at location for a SINGLE character only
    // Find visits at a location from all selected characters
    // This enables cross-character consolidation when multiple selected characters
    // have visited the same location, showing a combined view of all visits
    findVisitsAtLocationFromSelectedCharacters(coordinates) {
        const visits = [];
        const selectedCharacterIds = this.getVisibleCharacterPaths();
        const allCharacters = window.characterSystem.getCharacters();
        
        selectedCharacterIds.forEach(characterId => {
            const character = allCharacters.find(c => c.id === characterId);
            if (!character || !character.movementHistory) return;
            
            character.movementHistory.forEach((movement, index) => {
                if (movement.coordinates && 
                    movement.coordinates[0] === coordinates[0] && 
                    movement.coordinates[1] === coordinates[1]) {
                    visits.push({
                        ...movement,
                        character: character,
                        visitIndex: index + 1,
                        characterName: character.name,
                        characterId: character.id
                    });
                }
            });
        });
        
        return visits.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
    }

    findVisitsAtLocationForCharacter(coordinates, character) {
        const visits = [];
        
        if (!character.movementHistory) return visits;
        
        character.movementHistory.forEach((movement, index) => {
            if (movement.coordinates && 
                movement.coordinates[0] === coordinates[0] && 
                movement.coordinates[1] === coordinates[1]) {
                visits.push({
                    ...movement,
                    character: character,
                    visitIndex: index + 1, // Journey sequence number
                    characterName: character.name
                });
            }
        });
        
        return visits.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
    }

    createMovementMarker(point, index, totalPoints, character) {
        const isFirst = index === 0;
        const isLast = index === totalPoints - 1;
        
        // Find the movement data for duration info
        const movement = character.movementHistory.find(m => 
            m.coordinates && 
            m.coordinates[0] === point.coordinates[0] && 
            m.coordinates[1] === point.coordinates[1] &&
            m.location === point.location
        );
        
        const hasDateRange = movement && movement.dateEnd && movement.dateEnd !== (movement.dateStart || movement.date);
        
        // Check for visits from ALL selected characters at this location
        const allSelectedVisits = this.findVisitsAtLocationFromSelectedCharacters(point.coordinates);
        const sameCharacterVisits = this.findVisitsAtLocationForCharacter(point.coordinates, character);
        
        // Determine if we should show cross-character consolidation
        const hasMultipleCharacters = new Set(allSelectedVisits.map(v => v.characterId)).size > 1;
        const hasMultipleVisits = hasMultipleCharacters ? allSelectedVisits.length > 1 : sameCharacterVisits.length > 1;
        const visitsToShow = hasMultipleCharacters ? allSelectedVisits : sameCharacterVisits;

        let markerIcon;
        if (isFirst) {
            markerIcon = L.divIcon({
                html: this.createMarkerHTML('1', hasMultipleVisits, visitsToShow.length, hasDateRange, true),
                iconSize: [24, 24],
                className: `movement-start-marker${hasMultipleVisits ? ' has-multiple' : ''}${hasDateRange ? ' multi-day' : ''}${hasMultipleCharacters ? ' cross-character' : ''}`,
                iconAnchor: [12, 12]
            });
        } else if (isLast) {
            markerIcon = L.divIcon({
                html: this.createMarkerHTML('🚩', hasMultipleVisits, visitsToShow.length, hasDateRange, false),
                iconSize: [24, 24],
                className: `movement-end-marker${hasMultipleVisits ? ' has-multiple' : ''}${hasDateRange ? ' multi-day' : ''}${hasMultipleCharacters ? ' cross-character' : ''}`,
                iconAnchor: [12, 12]
            });
        } else {
            const visitNumber = `${index + 1}`;
            markerIcon = L.divIcon({
                html: this.createMarkerHTML(visitNumber, hasMultipleVisits, visitsToShow.length, hasDateRange, true),
                iconSize: [24, 24],
                className: `movement-number-marker${hasMultipleVisits ? ' has-multiple' : ''}${hasDateRange ? ' multi-day' : ''}${hasMultipleCharacters ? ' cross-character' : ''}`,
                iconAnchor: [12, 12]
            });
        }
        
        const marker = L.marker([point.coordinates[1], point.coordinates[0]], {
            icon: markerIcon,
            zIndexOffset: hasMultipleVisits ? 100 : 0
        });
        
        const popupContent = hasMultipleVisits ?
            this.createConsolidatedPopup(point, visitsToShow) :
            this.createSingleVisitPopup(point, character);
        
        marker.bindPopup(popupContent);
        
        return marker;
    }

    // Helper method to create marker HTML with duration indicators
    createMarkerHTML(content, hasMultiple, visitCount, hasDateRange, isNumber = false) {
        const durationIndicator = hasDateRange ? '<span class="duration-dot"></span>' : '';
        const visitBadge = hasMultiple ? `<span class="total-visits">${visitCount}</span>` : '';
        
        if (isNumber) {
            return `
                <div class="consolidated-marker number-marker">
                    <div class="single-number-marker">${content}</div>
                    ${visitBadge}
                    ${durationIndicator}
                </div>
            `;
        } else {
            return `
                <div class="consolidated-marker">
                    ${content}
                    ${visitBadge}
                    ${durationIndicator}
                </div>
            `;
        }
    }

    // New method for consolidated popup with visit selection
    createConsolidatedPopup(point, allVisits) {
        // Check if this is cross-character consolidation
        const uniqueCharacters = new Set(allVisits.map(v => v.characterId || v.character?.id));
        const isCrossCharacter = uniqueCharacters.size > 1;
        
        // Determine grid layout based on number of visits
        let gridLayout = '';
        const visitCount = allVisits.length;
        
        if (visitCount === 1) {
            gridLayout = 'grid-template-columns: 1fr;';
        } else if (visitCount === 2) {
            gridLayout = 'grid-template-columns: 1fr 1fr;';
        } else if (visitCount === 3) {
            gridLayout = 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;';
        } else if (visitCount === 4) {
            gridLayout = 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;';
        } else if (visitCount === 5) {
            gridLayout = 'grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr;';
        } else {
            // For 6+ visits, use responsive auto-fit
            gridLayout = 'grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));';
        }
        
        return `
            <div class="consolidated-popup">
                <h4>${point.location} <span class="total-badge">${allVisits.length} visits</span></h4>
                ${isCrossCharacter ? '<p class="cross-character-indicator">🤝 Multiple characters visited this location</p>' : ''}
                
                <div class="visit-selection">
                    <h5>Select Visit to View Details:</h5>
                    <div class="visit-buttons" style="${gridLayout}">
                        ${allVisits.map((visit, index) => {
                            let additionalStyle = '';
                            
                            // Special positioning for 3 visits (third one spans both columns)
                            if (visitCount === 3 && index === 2) {
                                additionalStyle = 'grid-column: 1 / 3; justify-self: center;';
                            }
                            // Special positioning for 5 visits (4th and 5th on bottom row)
                            else if (visitCount === 5 && index >= 3) {
                                if (index === 3) additionalStyle = 'grid-row: 2; grid-column: 1;';
                                if (index === 4) additionalStyle = 'grid-row: 2; grid-column: 2;';
                            }
                            
                            return `
                                <button class="visit-btn" style="${additionalStyle}" onclick="showVisitDetails(${index}, '${point.coordinates[0]},${point.coordinates[1]}', ${isCrossCharacter ? 'null' : `'${visit.character.id}'`})">
                                    <span class="visit-number">${visit.visitIndex}</span>
                                    <small>${visit.characterName}</small>
                                    <small>${this.formatDate(visit.dateStart || visit.date)}</small>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div id="visit-details-${point.coordinates[0]}-${point.coordinates[1]}" class="visit-details-container">
                </div>
            </div>
        `;
    }

    createSingleVisitPopup(point, character) {
        const movement = character.movementHistory.find(m => 
            m.coordinates && 
            m.coordinates[0] === point.coordinates[0] && 
            m.coordinates[1] === point.coordinates[1] &&
            m.location === point.location
        );
        
        const hasDateRange = movement && movement.dateEnd && movement.dateEnd !== (movement.dateStart || movement.date);
        const duration = hasDateRange ? this.calculateDuration(new Date(movement.dateStart || movement.date), new Date(movement.dateEnd)) : null;
        
        return `
            <div class="movement-point-popup${hasDateRange ? ' multi-day-stay' : ''}">
                <h4>${point.location}${hasDateRange ? ' 🏠' : ''}</h4>
                <p><strong>Person:</strong> ${character.name}</p>
                ${movement?.type ? `<p><strong>Art der Reise:</strong> ${this.formatMovementType(movement.type)}</p>` : ''}
                <p><strong>Datum:</strong> ${this.formatMovementDateRange(movement)}</p>
                ${duration ? `<p><strong>Dauer:</strong> ${duration}</p>` : ''}
                ${movement?.notes ? `<p><strong>Notizen:</strong> ${movement.notes}</p>` : ''}
            </div>
        `;
    }

    // Helper method to format date ranges
    formatMovementDateRange(movement) {
        if (!movement) return 'Unknown date';
        
        const startDate = movement.dateStart || movement.date;
        const endDate = movement.dateEnd;
        
        if (!startDate) return 'No date';
        
        const formatDate = (dateStr) => {
            return new Date(dateStr).toLocaleDateString('de-DE');
        };
        
        if (endDate && endDate !== startDate) {
            return `${formatDate(startDate)} - ${formatDate(endDate)}`;
        } else {
            return formatDate(startDate);
        }
    }

    // Helper method to format movement type
    formatMovementType(type) {
        if (!type) return 'Unknown';
        
        const typeLabels = {
            'travel': 'Travel',
            'teleport': 'Teleportation',
            'flight': 'Flight',
            'ship': 'Ship Travel',
            'walk': 'Walking',
            'ride': 'Riding',
            'portal': 'Portal',
            'magic': 'Magical Transport',
            'forced': 'Forced Movement',
            'retreat': 'Retreat',
            'chase': 'Chase',
            'exploration': 'Exploration'
        };
        
        return typeLabels[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
    }

    // Helper method to calculate duration
    calculateDuration(startDate, endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) return 'Same day';
        if (daysDiff === 1) return '1 day';
        if (daysDiff <= 7) return `${daysDiff} days`;
        if (daysDiff <= 30) {
            const weeks = Math.ceil(daysDiff / 7);
            return weeks === 1 ? '1 week' : `${weeks} weeks`;
        } else {
            const months = Math.ceil(daysDiff / 30);
            return months === 1 ? '1 month' : `${months} months`;
        }
    }

    formatDate(dateString) {
        if (dateString === 'Current') return 'Current';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (error) {
            return dateString;
        }
    }

    clearCharacterPaths() {
        const map = window.mapCore.getMap();
        
        this.movementLayers.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        this.movementLayers = [];
        this.characterPaths = [];
        this.visibleCharacterPaths.clear();
    }

    // Create consolidated markers for overlapping coordinates across visible paths
    createConsolidatedMarkers() {
        const map = window.mapCore.getMap();
        const visibleCharacterIds = Array.from(this.visibleCharacterPaths);
        const allCharacters = window.characterSystem.getCharacters();
        
        // Clear existing consolidated markers
        this.clearConsolidatedMarkers();
        
        // Group all movement points by coordinates from visible characters
        const coordinateGroups = new Map();
        
        visibleCharacterIds.forEach(characterId => {
            const character = allCharacters.find(c => c.id === characterId);
            if (!character?.movementHistory) return;
            
            character.movementHistory.forEach((movement, index) => {
                if (!movement.coordinates) return;
                
                const coordKey = `${movement.coordinates[0]},${movement.coordinates[1]}`;
                if (!coordinateGroups.has(coordKey)) {
                    coordinateGroups.set(coordKey, {
                        coordinates: movement.coordinates,
                        location: movement.location,
                        visits: []
                    });
                }
                
                coordinateGroups.get(coordKey).visits.push({
                    ...movement,
                    character: character,
                    characterId: character.id,
                    characterName: character.name,
                    visitIndex: index + 1,
                    isFirst: index === 0,
                    isLast: index === character.movementHistory.length - 1,
                    pathIndex: index
                });
            });
        });
        
        // Create markers for each coordinate group
        coordinateGroups.forEach((group, coordKey) => {
            // Sort visits by date
            group.visits.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
            
            const uniqueCharacters = new Set(group.visits.map(v => v.characterId));
            const hasMultipleCharacters = uniqueCharacters.size > 1;
            const hasMultipleVisitsFromSameCharacter = group.visits.length > uniqueCharacters.size;
            
            // Only consolidate if there's actual overlap
            const needsConsolidation = hasMultipleCharacters || hasMultipleVisitsFromSameCharacter;
            
            if (needsConsolidation) {
                // Create consolidated marker for overlapping locations
                const marker = this.createConsolidatedMarkerForLocation(group);
                marker.addTo(map);
                this.consolidatedMarkers.push(marker);
            } else {
                // Create individual markers for single visits
                group.visits.forEach(visit => {
                    const marker = this.createMovementMarker(
                        { coordinates: group.coordinates, location: group.location },
                        visit.pathIndex,
                        visit.character.movementHistory.length,
                        visit.character
                    );
                    marker.addTo(map);
                    this.consolidatedMarkers.push(marker);
                });
            }
        });
    }

    // Clear all consolidated markers
    clearConsolidatedMarkers() {
        if (!this.consolidatedMarkers) {
            this.consolidatedMarkers = [];
            return;
        }
        
        const map = window.mapCore.getMap();
        this.consolidatedMarkers.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        this.consolidatedMarkers = [];
    }

    // Create a consolidated marker for a specific location with multiple visits
    createConsolidatedMarkerForLocation(group) {
        const hasMultipleCharacters = new Set(group.visits.map(v => v.characterId)).size > 1;
        const hasDateRange = group.visits.some(v => v.dateEnd && v.dateEnd !== (v.dateStart || v.date));
        
        // Determine marker type based on visit types
        const hasStart = group.visits.some(v => v.isFirst);
        const hasEnd = group.visits.some(v => v.isLast);
        
        let markerHtml, markerClass;
        if (hasStart && hasEnd) {
            markerHtml = this.createMarkerHTML('1', true, group.visits.length, hasDateRange, true);
            markerClass = 'movement-start-end-marker';
        } else if (hasStart) {
            markerHtml = this.createMarkerHTML('1', true, group.visits.length, hasDateRange, true);
            markerClass = 'movement-start-marker';
        } else if (hasEnd) {
            markerHtml = this.createMarkerHTML('🚩', true, group.visits.length, hasDateRange, false);
            markerClass = 'movement-end-marker';
        } else {
            // Show visit count for intermediate stops
            markerHtml = this.createMarkerHTML(group.visits.length.toString(), true, group.visits.length, hasDateRange, true);
            markerClass = 'movement-number-marker';
        }
        
        const markerIcon = L.divIcon({
            html: markerHtml,
            iconSize: [24, 24],
            className: `${markerClass} has-multiple${hasDateRange ? ' multi-day' : ''}${hasMultipleCharacters ? ' cross-character' : ''}`,
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker([group.coordinates[1], group.coordinates[0]], {
            icon: markerIcon,
            zIndexOffset: 200 // Higher priority for consolidated markers
        });
        
        const popupContent = this.createConsolidatedPopup(
            { coordinates: group.coordinates, location: group.location },
            group.visits
        );
        
        marker.bindPopup(popupContent);
        return marker;
    }

    // Show individual character path
    showCharacterPath(characterId) {
        const pathData = this.getCharacterPath(characterId);
        if (!pathData || pathData.isVisible) return;
        
        const map = window.mapCore.getMap();
        
        // Add path line and individual markers to map
        pathData.pathLine.addTo(map);
        pathData.markers.forEach(marker => marker.addTo(map));
        this.movementLayers.push(pathData.pathLine, ...pathData.markers);
        
        pathData.isVisible = true;
        this.visibleCharacterPaths.add(characterId);
        
        // Update marker visibility based on overlaps
        this.updateMarkerVisibility();
        
        console.log(`Showing path for ${pathData.character.name}`);
    }

    // Hide individual character path
    hideCharacterPath(characterId) {
        const pathData = this.getCharacterPath(characterId);
        if (!pathData || !pathData.isVisible) return;
        
        const map = window.mapCore.getMap();
        
        // Remove path line and markers from map
        if (map.hasLayer(pathData.pathLine)) {
            map.removeLayer(pathData.pathLine);
            this.movementLayers = this.movementLayers.filter(layer => layer !== pathData.pathLine);
        }

        pathData.markers.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
                this.movementLayers = this.movementLayers.filter(layer => layer !== marker);
            }
        });

        pathData.isVisible = false;
        this.visibleCharacterPaths.delete(characterId);
        
        // Clear any existing consolidated markers and update visibility
        this.clearConsolidatedMarkers();
        this.updateMarkerVisibility();
        
        console.log(`Hiding path for ${pathData.character.name}`);
    }

    // Update marker visibility to handle overlaps
    updateMarkerVisibility() {
        const map = window.mapCore.getMap();
        const visibleCharacterIds = Array.from(this.visibleCharacterPaths);
        const allCharacters = window.characterSystem.getCharacters();
        
        // Clear existing consolidated markers
        this.clearConsolidatedMarkers();
        
        if (visibleCharacterIds.length === 0) return;
        
        // Group all movement points by coordinates from visible characters
        const coordinateGroups = new Map();
        const markerLookup = new Map(); // Track original markers by coordinate
        
        visibleCharacterIds.forEach(characterId => {
            const character = allCharacters.find(c => c.id === characterId);
            const pathData = this.getCharacterPath(characterId);
            if (!character?.movementHistory || !pathData) return;
            
            character.movementHistory.forEach((movement, index) => {
                if (!movement.coordinates) return;
                
                const coordKey = `${movement.coordinates[0]},${movement.coordinates[1]}`;
                if (!coordinateGroups.has(coordKey)) {
                    coordinateGroups.set(coordKey, {
                        coordinates: movement.coordinates,
                        location: movement.location,
                        visits: [],
                        originalMarkers: []
                    });
                }
                
                const group = coordinateGroups.get(coordKey);
                group.visits.push({
                    ...movement,
                    character: character,
                    characterId: character.id,
                    characterName: character.name,
                    visitIndex: index + 1,
                    isFirst: index === 0,
                    isLast: index === character.movementHistory.length - 1,
                    pathIndex: index
                });
                
                // Find the corresponding original marker
                if (pathData.markers[index]) {
                    group.originalMarkers.push(pathData.markers[index]);
                }
            });
        });
        
        // Handle overlaps
        coordinateGroups.forEach((group, coordKey) => {
            const uniqueCharacters = new Set(group.visits.map(v => v.characterId));
            const hasMultipleCharacters = uniqueCharacters.size > 1;
            const hasMultipleVisitsFromSameCharacter = group.visits.length > uniqueCharacters.size;
            
            if (hasMultipleCharacters || hasMultipleVisitsFromSameCharacter) {
                // Hide original markers at this location
                group.originalMarkers.forEach(marker => {
                    if (map.hasLayer(marker)) {
                        map.removeLayer(marker);
                    }
                });
                
                // Create and show consolidated marker
                group.visits.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
                const consolidatedMarker = this.createConsolidatedMarkerForLocation(group);
                consolidatedMarker.addTo(map);
                this.consolidatedMarkers.push(consolidatedMarker);
            }
            // If no overlap, original markers remain visible
        });
    }    // Show all character paths
    showAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.showCharacterPath(pathData.character.id);
        });
        
        console.log('All character paths shown');
    }

    // Hide all character paths
    hideAllPaths() {
        this.characterPaths.forEach(pathData => {
            if (pathData.isVisible) {
                const map = window.mapCore.getMap();
                
                // Remove path line and markers
                if (map.hasLayer(pathData.pathLine)) {
                    map.removeLayer(pathData.pathLine);
                    this.movementLayers = this.movementLayers.filter(layer => layer !== pathData.pathLine);
                }
                
                pathData.markers.forEach(marker => {
                    if (map.hasLayer(marker)) {
                        map.removeLayer(marker);
                        this.movementLayers = this.movementLayers.filter(layer => layer !== marker);
                    }
                });
                
                pathData.isVisible = false;
            }
        });
        
        this.visibleCharacterPaths.clear();
        this.clearConsolidatedMarkers();
        
        console.log('All character paths hidden');
    }

    // Helper method to get character path data
    getCharacterPath(characterId) {
        return this.characterPaths.find(pathData => pathData.character.id === characterId) || null;
    }

    filterPathsByDateRange(startDate, endDate) {
        const map = window.mapCore.getMap();
        
        this.characterPaths.forEach(pathData => {
            if (!pathData.isVisible) return; // Skip invisible paths
            
            const filteredPoints = pathData.points.filter(point => {
                const pointDate = new Date(point.date);
                return pointDate >= new Date(startDate) && pointDate <= new Date(endDate);
            });
            
            if (filteredPoints.length >= 2) {
                // Update path with filtered points
                const filteredCoords = filteredPoints.map(point => [
                    point.coordinates[1], // lat
                    point.coordinates[0]  // lng
                ]);
                pathData.pathLine.setLatLngs(filteredCoords);
                
                // Show/hide markers based on date range
                pathData.markers.forEach((marker, index) => {
                    const point = pathData.points[index];
                    const pointDate = new Date(point.date);
                    const inRange = pointDate >= new Date(startDate) && pointDate <= new Date(endDate);
                    
                    if (inRange) {
                        if (!map.hasLayer(marker)) marker.addTo(map);
                    } else {
                        if (map.hasLayer(marker)) map.removeLayer(marker);
                    }
                });
            } else {
                // Hide path if not enough points in date range
                if (map.hasLayer(pathData.pathLine)) {
                    map.removeLayer(pathData.pathLine);
                }
                pathData.markers.forEach(marker => {
                    if (map.hasLayer(marker)) map.removeLayer(marker);
                });
            }
        });
    }

    // Public methods for global access
    getCharacterPaths() {
        return this.characterPaths;
    }

    getVisibleCharacterPaths() {
        return Array.from(this.visibleCharacterPaths);
    }

    // Debug method to get consolidation info
    getConsolidationInfo() {
        const visibleCharacterIds = Array.from(this.visibleCharacterPaths);
        const allCharacters = window.characterSystem.getCharacters();
        const coordinateGroups = new Map();
        
        visibleCharacterIds.forEach(characterId => {
            const character = allCharacters.find(c => c.id === characterId);
            if (!character?.movementHistory) return;
            
            character.movementHistory.forEach((movement, index) => {
                if (!movement.coordinates) return;
                
                const coordKey = `${movement.coordinates[0]},${movement.coordinates[1]}`;
                if (!coordinateGroups.has(coordKey)) {
                    coordinateGroups.set(coordKey, {
                        location: movement.location,
                        visits: []
                    });
                }
                
                coordinateGroups.get(coordKey).visits.push({
                    character: character.name,
                    visitIndex: index + 1
                });
            });
        });
        
        const consolidatedLocations = [];
        coordinateGroups.forEach((group, coordKey) => {
            const hasMultipleCharacters = new Set(group.visits.map(v => v.character)).size > 1;
            const hasMultipleVisits = group.visits.length > 1;
            
            if (hasMultipleCharacters || hasMultipleVisits) {
                consolidatedLocations.push({
                    coordinates: coordKey,
                    location: group.location,
                    visitCount: group.visits.length,
                    characterCount: new Set(group.visits.map(v => v.character)).size,
                    isCrossCharacter: hasMultipleCharacters
                });
            }
        });
        
        return {
            totalLocations: coordinateGroups.size,
            consolidatedLocations: consolidatedLocations,
            consolidatedCount: consolidatedLocations.length
        };
    }

    // Required by main.js
    addIntegratedMovementControls() {
        console.log('Movement controls integration called');
        
        // Movement controls are already integrated in the character panel
        // Verify character panel is available
        if (window.characterPanel) {
            console.log('✅ Character panel available for movement controls');
        } else {
            console.warn('⚠️ Character panel not available');
        }
        
        return true;
    }

    setupZoomBasedNumberVisibility() {
        const map = window.mapCore.map;
        if (!map) return;

        // Initial visibility check
        this.updateNumberVisibility();

        // Listen for zoom changes
        map.on('zoomend', () => {
            this.updateNumberVisibility();
        });

        console.log('🔍 Zoom-based number visibility setup complete');
    }

    updateNumberVisibility() {
        const map = window.mapCore.map;
        if (!map) return;

        // Calculate current zoom percentage
        const currentZoom = map.getZoom();
        const minZoom = map.getMinZoom();
        const maxZoom = map.getMaxZoom();
        const zoomPercentage = ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100;

        // Show numbers only if zoom is 30% or more
        const shouldShowNumbers = zoomPercentage >= 30;

        // Find all numbered movement markers and toggle visibility
        const numberMarkers = document.querySelectorAll('.movement-number-marker');
        numberMarkers.forEach(marker => {
            if (shouldShowNumbers) {
                marker.style.display = '';
            } else {
                marker.style.display = 'none';
            }
        });

        // Also hide total-visits indicators when zoom is below 30%
        const totalVisitsElements = document.querySelectorAll('.total-visits');
        totalVisitsElements.forEach(element => {
            if (shouldShowNumbers) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });

        // Hide single-number-marker elements (the actual number content)
        const singleNumberMarkers = document.querySelectorAll('.single-number-marker');
        singleNumberMarkers.forEach(element => {
            if (shouldShowNumbers) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });

        console.log(`📊 Zoom: ${zoomPercentage.toFixed(1)}% - Numbers ${shouldShowNumbers ? 'visible' : 'hidden'}`);
    }

    // 🔥 NEW: Debug and testing methods for Character Path Manager integration
    
    // Test API connection
    async testAPIConnection() {
        console.log('🧪 Testing Character Paths API connection...');
        const result = await this.pathManager.testAPIConnection();
        console.log(`API Test Result: ${result ? '✅ Success' : '❌ Failed'}`);
        return result;
    }

    // Test fallback system
    async testFallback() {
        console.log('🧪 Testing fallback character data loading...');
        const result = await this.pathManager.testFallback();
        console.log(`Fallback Test Result: ${result ? '✅ Success' : '❌ Failed'}`);
        return result;
    }

    // Force reload with API
    async forceAPIReload() {
        console.log('🔄 Forcing reload with API data...');
        this.pathManager.clearCache();
        await this.addCharacterMovementPaths();
    }

    // Force reload with fallback
    async forceFallbackReload() {
        console.log('🔄 Forcing reload with fallback data...');
        this.clearCharacterPaths();
        await this.loadLegacyCharacterPaths();
        this.autoShowPartyPath();
    }

    // Get performance statistics
    getPerformanceStats() {
        return {
            ...this.pathManager.getStatistics(),
            currentDataSource: this.isUsingAPI ? 'API' : 'fallback',
            pathsLoaded: this.characterPaths.length,
            visiblePaths: this.visibleCharacterPaths.size
        };
    }

    // Show debug panel
    showDebugPanel() {
        const stats = this.getPerformanceStats();
        
        let debugPanel = document.getElementById('character-path-debug-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'character-path-debug-panel';
            debugPanel.className = 'character-path-debug';
            document.body.appendChild(debugPanel);
        }

        debugPanel.innerHTML = `
            <h4>📊 Character Path Debug</h4>
            <div class="stat-row">
                <span class="stat-label">Data Source:</span>
                <span class="stat-value">${stats.currentDataSource}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Paths Loaded:</span>
                <span class="stat-value">${stats.pathsLoaded}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Visible Paths:</span>
                <span class="stat-value">${stats.visiblePaths}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">API Calls:</span>
                <span class="stat-value">${stats.apiCalls}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Cache Hits:</span>
                <span class="stat-value">${stats.cacheHits}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Fallback Usage:</span>
                <span class="stat-value">${stats.fallbackUsage}</span>
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <button onclick="window.movementSystem.hideDebugPanel()" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        `;

        debugPanel.classList.add('show');
        
        // Auto-hide after 30 seconds
        setTimeout(() => this.hideDebugPanel(), 30000);
    }

    // Hide debug panel
    hideDebugPanel() {
        const debugPanel = document.getElementById('character-path-debug-panel');
        if (debugPanel) {
            debugPanel.classList.remove('show');
        }
    }

    // Show performance indicator
    showPerformanceIndicator(type, message, duration = 3000) {
        let indicator = document.getElementById('performance-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'performance-indicator';
            indicator.className = 'performance-indicator';
            document.body.appendChild(indicator);
        }

        indicator.className = `performance-indicator ${type}`;
        indicator.textContent = message;
        indicator.classList.add('show');

        setTimeout(() => {
            indicator.classList.remove('show');
        }, duration);
    }

    // Enhanced logging for development
    logDataComparison() {
        const stats = this.pathManager.getStatistics();
        if (stats.dataSizeComparisons.length > 1) {
            const apiData = stats.dataSizeComparisons.filter(d => d.source === 'api');
            const fallbackData = stats.dataSizeComparisons.filter(d => d.source === 'fallback');
            
            if (apiData.length > 0 && fallbackData.length > 0) {
                const apiAvgSize = apiData.reduce((sum, d) => sum + d.size, 0) / apiData.length;
                const fallbackAvgSize = fallbackData.reduce((sum, d) => sum + d.size, 0) / fallbackData.length;
                const improvement = ((fallbackAvgSize - apiAvgSize) / fallbackAvgSize * 100).toFixed(1);
                
                console.log('📊 Data Size Comparison:');
                console.log(`  API average: ${(apiAvgSize / 1024).toFixed(2)}KB`);
                console.log(`  Fallback average: ${(fallbackAvgSize / 1024).toFixed(2)}KB`);
                console.log(`  Improvement: ${improvement}% reduction`);
                
                this.showPerformanceIndicator('api-success', `${improvement}% bandwidth saved`, 5000);
            }
        }
    }
}

// Create global movement system instance
window.movementSystem = new MovementSystem();

// 🔥 NEW: Global testing and debugging functions for Character Path Manager

// Test the entire character path system
window.testCharacterPaths = async function() {
    console.log('🧪 Testing Character Path System...');
    
    try {
        console.log('1. Testing API connection...');
        const apiTest = await window.movementSystem.testAPIConnection();
        
        console.log('2. Testing fallback system...');
        const fallbackTest = await window.movementSystem.testFallback();
        
        console.log('3. Showing current statistics...');
        const stats = window.movementSystem.getPerformanceStats();
        console.log('Stats:', stats);
        
        console.log('4. Data comparison...');
        window.movementSystem.logDataComparison();
        
        console.log('✅ Character Path System test complete!');
        window.movementSystem.showDebugPanel();
        
        return {
            apiTest,
            fallbackTest,
            stats
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
};

// Force API reload for testing
window.testAPIReload = function() {
    console.log('🔄 Testing API reload...');
    return window.movementSystem.forceAPIReload();
};

// Force fallback reload for testing
window.testFallbackReload = function() {
    console.log('🔄 Testing fallback reload...');
    return window.movementSystem.forceFallbackReload();
};

// Show character path debug panel
window.showCharacterPathDebug = function() {
    window.movementSystem.showDebugPanel();
};

// Clear character path cache
window.clearCharacterPathCache = function() {
    window.movementSystem.pathManager.clearCache();
    console.log('🧹 Character path cache cleared');
};

// Toggle debug mode
window.toggleCharacterPathDebug = function(enabled) {
    window.movementSystem.pathManager.setDebugMode(enabled);
    console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
};

// Performance comparison tool
window.compareCharacterPathPerformance = async function() {
    console.log('📊 Running performance comparison...');
    
    // Clear cache to ensure fresh data
    window.movementSystem.pathManager.clearCache();
    
    // Test API performance
    console.log('Testing API performance...');
    const apiStart = performance.now();
    await window.movementSystem.forceAPIReload();
    const apiTime = performance.now() - apiStart;
    
    // Test fallback performance
    console.log('Testing fallback performance...');
    const fallbackStart = performance.now();
    await window.movementSystem.forceFallbackReload();
    const fallbackTime = performance.now() - fallbackStart;
    
    const improvement = ((fallbackTime - apiTime) / fallbackTime * 100).toFixed(1);
    
    console.log('📈 Performance Comparison Results:');
    console.log(`  API load time: ${apiTime.toFixed(2)}ms`);
    console.log(`  Fallback load time: ${fallbackTime.toFixed(2)}ms`);
    console.log(`  Performance improvement: ${improvement}%`);
    
    // Show data size comparison
    window.movementSystem.logDataComparison();
    
    return {
        apiTime,
        fallbackTime,
        improvement: parseFloat(improvement)
    };
};

// Test server-side path styling
window.testServerSideStyling = async function() {
    console.log('🎨 Testing server-side path styling...');
    
    try {
        const response = await fetch('https://adenai-admin.piogino.ch/api/character-paths');
        const data = await response.json();
        
        console.log('📊 Server-Side Path Design Analysis:');
        Object.values(data.paths).forEach(pathInfo => {
            const style = pathInfo.style;
            console.log(`${pathInfo.name}:`);
            console.log(`  Color: ${style.color} (${pathInfo.metadata.relationship})`);
            console.log(`  Weight: ${style.weight}px`);
            console.log(`  Opacity: ${style.opacity} (${pathInfo.metadata.status})`);
            console.log(`  DashArray: ${style.dashArray || 'null (will use 5,2)'}`);
            console.log('---');
        });
        
        console.log('✅ Server-side styling test complete!');
        return true;
        
    } catch (error) {
        console.error('❌ Server-side styling test failed:', error);
        return false;
    }
};

// Test design consistency between API and legacy paths
window.testDesignConsistency = function() {
    console.log('🔍 Testing design consistency between API and legacy systems...');
    
    const movementSystem = window.movementSystem;
    const apiPaths = movementSystem.characterPaths.filter(p => p.apiSource);
    const legacyPaths = movementSystem.characterPaths.filter(p => !p.apiSource);
    
    console.log('📊 Design Analysis:');
    console.log('API Paths:', apiPaths.length);
    console.log('Legacy Paths:', legacyPaths.length);
    
    // Check if legacy paths use consistent server-style design
    legacyPaths.forEach(pathData => {
        if (pathData.pathLine && pathData.pathLine.options) {
            const options = pathData.pathLine.options;
            console.log(`${pathData.character.name} (Legacy):`);
            console.log(`  Weight: ${options.weight} (should be 2)`);
            console.log(`  DashArray: ${options.dashArray} (should be '5,2')`);
            console.log(`  Color: ${options.color}`);
            console.log(`  Opacity: ${options.opacity}`);
        }
    });
    
    console.log('✅ Design consistency test complete!');
};

console.log('🔧 Character Path testing functions loaded:');
console.log('  - testCharacterPaths() - Full system test');
console.log('  - testAPIReload() - Test API data loading');
console.log('  - testFallbackReload() - Test fallback data loading');
console.log('  - showCharacterPathDebug() - Show debug panel');
console.log('  - clearCharacterPathCache() - Clear cache');
console.log('  - toggleCharacterPathDebug(true/false) - Toggle debug mode');
console.log('  - compareCharacterPathPerformance() - Performance comparison');
console.log('  - testServerSideStyling() - Test server-side path design');
console.log('  - testDesignConsistency() - Test API vs legacy design consistency');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementSystem;
}