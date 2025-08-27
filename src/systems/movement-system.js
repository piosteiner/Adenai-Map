// movement-system.js - Simplified Character Movement System (UI handled by character panel)
class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        this.visibleCharacterPaths = new Set(); // Track which character paths are visible
        this.consolidatedMarkers = []; // Track consolidated markers for overlapping locations
        this.currentTimelineDate = null;
        this.pathColors = {
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
        // Listen for characters loaded event
        document.addEventListener('charactersLoaded', (e) => {
            this.addCharacterMovementPaths();
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

    addCharacterMovementPaths() {
        // Clear existing paths
        this.clearCharacterPaths();
        
        const characters = window.characterSystem.getCharacters();
        
        characters.forEach(character => {
            if (!character.movementHistory || character.movementHistory.length < 1) {
                return; // Need at least 1 movement point
            }
            
            const pathColor = this.pathColors[character.relationship] || '#666666';
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
                this.createCharacterPath(character, movementPoints, pathColor);
            }
        });
        
        // Auto-show VsuzH path by default
        const vsuzHPath = this.characterPaths.find(pathData => {
            const name = pathData.character.name.toLowerCase();
            return name.includes('vsuzh') || name.includes('vsuz') || pathData.character.relationship === 'party';
        });

        if (vsuzHPath) {
            this.showCharacterPath(vsuzHPath.character.id);
            console.log(`Auto-showing VsuzH path for: ${vsuzHPath.character.name}`);
        }

        console.log(`Created ${this.characterPaths.length} character movement paths`);
    }

    createCharacterPath(character, movementPoints, pathColor) {
        const map = window.mapCore.getMap();
        
        // Create path coordinates for Leaflet (using the same coordinate system as characters)
        const pathCoords = movementPoints.map(point => [
            point.coordinates[1], // lat = y
            point.coordinates[0]  // lng = x
        ]);
        
        // Create the path polyline
        const pathLine = L.polyline(pathCoords, {
            color: pathColor,
            weight: 4,
            opacity: 0.7,
            dashArray: '10,5',
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
                html: this.createMarkerHTML('🚩', hasMultipleVisits, visitsToShow.length, hasDateRange),
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
            markerHtml = this.createMarkerHTML('1', true, group.visits.length, hasDateRange);
            markerClass = 'movement-start-end-marker';
        } else if (hasStart) {
            markerHtml = this.createMarkerHTML('1', true, group.visits.length, hasDateRange, true);
            markerClass = 'movement-start-marker';
        } else if (hasEnd) {
            markerHtml = this.createMarkerHTML('🚩', true, group.visits.length, hasDateRange);
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
}

// Create global movement system instance
window.movementSystem = new MovementSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementSystem;
}