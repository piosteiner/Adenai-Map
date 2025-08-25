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
            party: '#3F51B5'
        };
        this.init();
    }

    init() {
        // Listen for characters loaded event
        document.addEventListener('charactersLoaded', (e) => {
            this.addCharacterMovementPaths();
        });
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
                        date: movement.date,
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
            console.log(`🎮 Auto-showing VsuzH path for: ${vsuzHPath.character.name}`);
        }

        console.log(`🛤️ Created ${this.characterPaths.length} character movement paths`);
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
        pathLine.bindTooltip(`🛤️ ${character.name}`, {
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
                <h4>🗺️ ${character.name}'s Journey</h4>
                <p><strong>Total Locations:</strong> ${movementPoints.length}</p>
                <p><strong>Relationship:</strong> ${character.relationship}</p>
                <div class="movement-timeline">
                    ${movementPoints.map((point, index) => `
                        <div class="timeline-entry">
                            <strong>${index + 1}.</strong> ${point.location} 
                            <small>(${this.formatDate(point.date)})</small>
                            ${point.notes ? `<br><em>${point.notes}</em>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    createMovementMarker(point, index, totalPoints, character) {
        const isFirst = index === 0;
        const isLast = index === totalPoints - 1;
        
        let markerIcon;
        if (isFirst) {
            // Start marker uses 📍
            markerIcon = L.divIcon({
                html: '📍',
                iconSize: [20, 20],
                className: 'movement-start-marker'
            });
        } else if (isLast) {
            // Current marker uses 🚩
            markerIcon = L.divIcon({
                html: '🚩',
                iconSize: [20, 20],
                className: 'movement-end-marker'
            });
        } else {
            markerIcon = L.divIcon({
                html: `${index + 1}`,
                iconSize: [20, 20],
                className: 'movement-number-marker',
                iconAnchor: [10, 10]
            });
        }
        
        // Use same coordinate system as characters
        const marker = L.marker([point.coordinates[1], point.coordinates[0]], {
            icon: markerIcon
        });
        
        marker.bindPopup(`
            <div class="movement-point-popup">
                <h4>${point.location}</h4>
                <p><strong>📅 Date:</strong> ${this.formatDate(point.date)}</p>
                <p><strong>👤 Character:</strong> ${character.name}</p>
                ${point.notes ? `<p><strong>📝 Notes:</strong> ${point.notes}</p>` : ''}
                <p><strong>🗺️ Coordinates:</strong> [${point.coordinates[0]}, ${point.coordinates[1]}]</p>
            </div>
        `);
        
        return marker;
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
        
        console.log(`🗺️ Showing path for ${pathData.character.name}`);
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
        
        console.log(`🗺️ Hiding path for ${pathData.character.name}`);
    }

    // Show all character paths
    showAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.showCharacterPath(pathData.character.id);
        });
        
        console.log('🗺️ All character paths shown');
    }

    // Hide all character paths
    hideAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.hideCharacterPath(pathData.character.id);
        });
        
        console.log('🗺️ All character paths hidden');
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
}

// Create global movement system instance
window.movementSystem = new MovementSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementSystem;
}