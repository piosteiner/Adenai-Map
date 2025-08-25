// movement-system.js - Simplified Character Movement System (UI handled by character panel)
class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        this.visibleCharacterPaths = new Set(); // Track which character paths are visible
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

        // Add global function for consolidated popups
        window.showVisitDetails = (visitIndex, coordKey) => {
        const containerSelector = `#visit-details-${coordKey.replace(',', '-')}`;
        const container = document.querySelector(containerSelector);
        if (!container) return;
        
        // Parse coordinates from the coordKey
        const [x, y] = coordKey.split(',').map(Number);
        const coordinates = [x, y];
        
        // Find all visits at this location
        const allCharacters = window.characterSystem.getCharacters();
        const allVisits = window.movementSystem.findAllVisitsAtLocation(coordinates, allCharacters);
        
        if (visitIndex >= allVisits.length) {
            container.innerHTML = `<p style="color: red;">Visit not found.</p>`;
            return;
        }
        
        const visit = allVisits[visitIndex];
        const movement = visit; // The visit object IS the movement data
        const character = visit.character;
        
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
                        <strong>Character:</strong> 
                        <span class="character-name">${character.name}</span>
                    </div>
                    
                    <div class="info-row">
                        <strong>Date:</strong> 
                        <span class="visit-date">${window.movementSystem.formatMovementDateRange(movement)}</span>
                    </div>
                    
                    ${duration ? `
                    <div class="info-row duration-row">
                        <strong>Duration:</strong> 
                        <span class="duration-info">${duration}</span>
                    </div>
                    ` : ''}
                    
                    <div class="info-row">
                        <strong>Coordinates:</strong> 
                        <span class="coordinates">[${coordinates[0]}, ${coordinates[1]}]</span>
                    </div>
                    
                    ${movement.type ? `
                    <div class="info-row">
                        <strong>Type:</strong> 
                        <span class="movement-type">${movement.type}</span>
                    </div>
                    ` : ''}
                    
                    ${movement.notes ? `
                    <div class="info-row notes-row">
                        <strong>Notes:</strong> 
                        <div class="movement-notes">${movement.notes}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="visit-navigation">
                    ${allVisits.length > 1 ? `
                    <small class="visit-counter">
                        Visit ${visitIndex + 1} of ${allVisits.length} at this location
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
        const allCharacters = window.characterSystem.getCharacters();
        const allVisitsHere = this.findAllVisitsAtLocation(point.coordinates, allCharacters);
        const hasMultipleVisits = allVisitsHere.length > 1;

        let markerIcon;
        if (isFirst) {
            markerIcon = L.divIcon({
                html: this.createMarkerHTML('📍', hasMultipleVisits, allVisitsHere.length, hasDateRange),
                iconSize: [24, 24],
                className: `movement-start-marker${hasMultipleVisits ? ' has-multiple' : ''}${hasDateRange ? ' multi-day' : ''}`,
                iconAnchor: [12, 12]
            });
        } else if (isLast) {
            markerIcon = L.divIcon({
                html: this.createMarkerHTML('🚩', hasMultipleVisits, allVisitsHere.length, hasDateRange),
                iconSize: [24, 24],
                className: `movement-end-marker${hasMultipleVisits ? ' has-multiple' : ''}${hasDateRange ? ' multi-day' : ''}`,
                iconAnchor: [12, 12]
            });
        } else {
            const visitNumber = `${index + 1}`;
            markerIcon = L.divIcon({
                html: this.createMarkerHTML(visitNumber, hasMultipleVisits, allVisitsHere.length, hasDateRange, true),
                iconSize: [24, 24],
                className: `movement-number-marker${hasMultipleVisits ? ' has-multiple' : ''}${hasDateRange ? ' multi-day' : ''}`,
                iconAnchor: [12, 12]
            });
        }
        
        const marker = L.marker([point.coordinates[1], point.coordinates[0]], {
            icon: markerIcon,
            zIndexOffset: hasMultipleVisits ? 100 : 0
        });
        
        const popupContent = hasMultipleVisits ?
            this.createConsolidatedPopup(point, allVisitsHere) :
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
        return `
            <div class="consolidated-popup">
                <h4>${point.location} <span class="total-badge">${allVisits.length} visits</span></h4>
                <p><strong>Coordinates:</strong> [${point.coordinates[0]}, ${point.coordinates[1]}]</p>
                
                <div class="visit-selection">
                    <h5>Select Visit to View Details:</h5>
                    <div class="visit-buttons">
                        ${allVisits.map((visit, index) => `
                            <button class="visit-btn" onclick="showVisitDetails(${index}, '${point.coordinates[0]},${point.coordinates[1]}')">
                                <span class="visit-number">${visit.visitIndex}</span>
                                <small>${visit.characterName}</small>
                                <small>${this.formatDate(visit.dateStart || visit.date)}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div id="visit-details-${point.coordinates[0]}-${point.coordinates[1]}" class="visit-details-container">
                    <p style="text-align: center; color: #666; font-style: italic;">Click a visit number above to see details</p>
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
                <p><strong>Date:</strong> ${this.formatMovementDateRange(movement)}</p>
                ${duration ? `<p class="duration-info"><strong>Duration:</strong> ${duration}</p>` : ''}
                <p><strong>Character:</strong> ${character.name}</p>
                ${point.notes ? `<p><strong>Notes:</strong> ${point.notes}</p>` : ''}
                <p><strong>Coordinates:</strong> [${point.coordinates[0]}, ${point.coordinates[1]}]</p>
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

    // Show individual character path
    showCharacterPath(characterId) {
        const pathData = this.getCharacterPath(characterId);
        if (!pathData || pathData.isVisible) return;
        
        const map = window.mapCore.getMap();
        
        // Add path and markers to map
        pathData.pathLine.addTo(map);
        pathData.markers.forEach(marker => marker.addTo(map));
        this.movementLayers.push(pathData.pathLine, ...pathData.markers);
        
        pathData.isVisible = true;
        this.visibleCharacterPaths.add(characterId);
        
        console.log(`Showing path for ${pathData.character.name}`);
    }

    // Hide individual character path
    hideCharacterPath(characterId) {
        const pathData = this.getCharacterPath(characterId);
        if (!pathData || !pathData.isVisible) return;
        
        const map = window.mapCore.getMap();
        
        // Remove path and markers from map
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
        
        console.log(`Hiding path for ${pathData.character.name}`);
    }

    // Show all character paths
    showAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.showCharacterPath(pathData.character.id);
        });
        
        console.log('All character paths shown');
    }

    // Hide all character paths
    hideAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.hideCharacterPath(pathData.character.id);
        });
        
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

    // Required by main.js
    addIntegratedMovementControls() {
        console.log('Movement controls integration called');
        
        if (window.characterPanel) {
            window.characterPanel.addMovementControls(this);
        }
        
        return true;
    }
}

// Create global movement system instance
window.movementSystem = new MovementSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementSystem;
}