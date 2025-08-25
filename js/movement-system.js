// movement-system.js - Enhanced Character Movement System with Auto VsuzH Path
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
            party: '#3c55e2ff'
        };
        // 🔥 NEW: Special VsuzH party path settings
        this.partyPathSettings = {
            color: '3c55e2ff',          // Bright blue        
            weight: 6,                  // Thicker than normal paths
            opacity: 0.9,               // More visible
            dashArray: '12,8',          // Distinctive pattern
            zIndex: 1000               // Above other paths
        };
        this.vsuzHAutoShown = false;    // Track if we've auto-shown VsuzH path
        this.init();
    }

    init() {
        // Listen for characters loaded event
        document.addEventListener('charactersLoaded', (e) => {
            this.addCharacterMovementPaths();
        });
        
        // 🔥 NEW: Listen for map ready events to ensure VsuzH path shows
        document.addEventListener('adenaiMapReady', (e) => {
            setTimeout(() => this.ensureVsuzHPathVisible(), 500);
        });
    }

    addCharacterMovementPaths() {
        // Clear existing paths
        this.clearCharacterPaths();
        
        const characters = window.characterSystem.getCharacters();
        let vsuzHCharacter = null;
        
        characters.forEach(character => {
            if (!character.movementHistory || character.movementHistory.length < 1) {
                return; // Need at least 1 movement point
            }
            
            // 🔥 NEW: Check if this is the VsuzH party character
            const isVsuzHParty = this.isVsuzHParty(character);
            if (isVsuzHParty) {
                vsuzHCharacter = character;
                console.log('🎯 Found VsuzH party character:', character.name);
            }
            
            const pathColor = isVsuzHParty ? 
                this.partyPathSettings.color : 
                (this.pathColors[character.relationship] || '#666666');
            
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
                this.createCharacterPath(character, movementPoints, pathColor, isVsuzHParty);
            }
        });
        
        // 🔥 NEW: Auto-show VsuzH path if found
        if (vsuzHCharacter && !this.vsuzHAutoShown) {
            setTimeout(() => {
                this.autoShowVsuzHPath(vsuzHCharacter);
            }, 100);
        }
        
        console.log(`🛤️ Created ${this.characterPaths.length} character movement paths`);
    }

    // 🔥 NEW: Check if character is VsuzH party
    isVsuzHParty(character) {
        const name = character.name.toLowerCase();
        const relationship = character.relationship;
        
        // Check multiple ways VsuzH might be identified
        return (
            name.includes('vsuzh') ||
            name.includes('vsuz') ||
            name === 'party' ||
            relationship === 'party' ||
            // Add more variations if needed
            name.includes('adventurers') ||
            name.includes('heroes')
        );
    }

    // 🔥 NEW: Auto-show VsuzH party path with special fanfare
    autoShowVsuzHPath(vsuzHCharacter) {
        console.log('🎉 Auto-showing VsuzH party path!');
        
        this.showCharacterPath(vsuzHCharacter.id);
        this.vsuzHAutoShown = true;
        
        // Store preference for next time
        localStorage.setItem('vsuzh-path-visible', 'true');
        
        // Show notification
        if (window.adminUI && typeof window.adminUI.showToast === 'function') {
            window.adminUI.showToast('🗺️ VsuzH party journey path loaded!', 'info');
        }
        
        // Optionally focus on the path
        this.focusOnCharacterPath(vsuzHCharacter.id);
    }

    // 🔥 NEW: Ensure VsuzH path is visible (for map reload scenarios)
    ensureVsuzHPathVisible() {
        const shouldShow = localStorage.getItem('vsuzh-path-visible') === 'true';
        
        if (shouldShow && !this.vsuzHAutoShown) {
            const vsuzHPath = this.characterPaths.find(path => 
                this.isVsuzHParty(path.character)
            );
            
            if (vsuzHPath && !vsuzHPath.isVisible) {
                this.autoShowVsuzHPath(vsuzHPath.character);
            }
        }
    }

    // 🔥 NEW: Focus map view on character path
    focusOnCharacterPath(characterId) {
        const pathData = this.getCharacterPath(characterId);
        if (!pathData || !pathData.isVisible) return;
        
        try {
            const map = window.mapCore.getMap();
            if (map && pathData.pathLine) {
                // Fit map bounds to show the entire path
                const bounds = pathData.pathLine.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { 
                        padding: [20, 20],
                        maxZoom: 1  // Don't zoom in too much
                    });
                    console.log('🎯 Focused map on VsuzH party path');
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not focus on character path:', error);
        }
    }

    createCharacterPath(character, movementPoints, pathColor, isVsuzHParty = false) {
        const map = window.mapCore.getMap();
        
        // Create path coordinates for Leaflet (using the same coordinate system as characters)
        const pathCoords = movementPoints.map(point => [
            point.coordinates[1], // lat = y
            point.coordinates[0]  // lng = x
        ]);
        
        // 🔥 ENHANCED: Special styling for VsuzH party
        const pathOptions = {
            color: pathColor,
            weight: isVsuzHParty ? this.partyPathSettings.weight : 4,
            opacity: isVsuzHParty ? this.partyPathSettings.opacity : 0.7,
            dashArray: isVsuzHParty ? this.partyPathSettings.dashArray : '10,5',
            className: `character-path character-path-${character.id}${isVsuzHParty ? ' party-path' : ''}`
        };
        
        // Create the path polyline
        const pathLine = L.polyline(pathCoords, pathOptions);
        
        // 🔥 ENHANCED: Special tooltip for VsuzH party
        const tooltipText = isVsuzHParty ? 
            `🎮 ${character.name} (Party Journey)` : 
            `🛤️ ${character.name}`;
        
        pathLine.bindTooltip(tooltipText, {
            permanent: false,
            sticky: true,
            direction: 'top',
            offset: [0, -10],
            className: `character-path-tooltip${isVsuzHParty ? ' party-tooltip' : ''}`
        });

        // Add click handler for path info
        pathLine.bindPopup(this.createPathPopup(character, movementPoints, isVsuzHParty));
        
        // Create movement markers for each point
        const pathMarkers = movementPoints.map((point, index) => {
            return this.createMovementMarker(point, index, movementPoints.length, character, isVsuzHParty);
        });
        
        // Store path data
        const pathData = {
            character: character,
            pathLine: pathLine,
            markers: pathMarkers,
            points: movementPoints,
            isVisible: false,
            isPartyPath: isVsuzHParty
        };
        
        this.characterPaths.push(pathData);
    }

    createPathPopup(character, movementPoints, isVsuzHParty = false) {
        const partyBadge = isVsuzHParty ? '<span style="background: #ff6600; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-left: 8px;">🎮 PARTY</span>' : '';
        
        return `
            <div class="character-path-popup${isVsuzHParty ? ' party-path-popup' : ''}">
                <h4>🗺️ ${character.name}'s Journey${partyBadge}</h4>
                <p><strong>Total Locations:</strong> ${movementPoints.length}</p>
                <p><strong>Relationship:</strong> ${character.relationship}${isVsuzHParty ? ' (Main Party)' : ''}</p>
                <div class="movement-timeline">
                    ${movementPoints.map((point, index) => `
                        <div class="timeline-entry">
                            <strong>${index + 1}.</strong> ${point.location} 
                            <small>(${this.formatDate(point.date)})</small>
                            ${point.notes ? `<br><em>${point.notes}</em>` : ''}
                        </div>
                    `).join('')}
                </div>
                ${isVsuzHParty ? '<p style="color: #ff6600; font-size: 0.9em; margin-top: 10px;"><em>🎯 This is your party\'s main journey path</em></p>' : ''}
            </div>
        `;
    }

    createMovementMarker(point, index, totalPoints, character, isVsuzHParty = false) {
        const isFirst = index === 0;
        const isLast = index === totalPoints - 1;
        
        let markerIcon;
        if (isFirst) {
            // 🔥 ENHANCED: Special start marker for party
            const startEmoji = isVsuzHParty ? '💨' : '📍';
            markerIcon = L.divIcon({
                html: startEmoji,
                iconSize: isVsuzHParty ? [24, 24] : [20, 20],
                className: `movement-start-marker${isVsuzHParty ? ' party-marker' : ''}`
            });
        } else if (isLast) {
            // 🔥 ENHANCED: Special end marker for party
            const endEmoji = isVsuzHParty ? '⭐' : '🚩';
            markerIcon = L.divIcon({
                html: endEmoji,
                iconSize: isVsuzHParty ? [24, 24] : [20, 20],
                className: `movement-end-marker${isVsuzHParty ? ' party-marker' : ''}`
            });
        } else {
            markerIcon = L.divIcon({
                html: `${index + 1}`,
                iconSize: isVsuzHParty ? [22, 22] : [20, 20],
                className: `movement-number-marker${isVsuzHParty ? ' party-marker' : ''}`,
                iconAnchor: isVsuzHParty ? [11, 11] : [10, 10]
            });
        }
        
        // Use same coordinate system as characters
        const marker = L.marker([point.coordinates[1], point.coordinates[0]], {
            icon: markerIcon,
            zIndexOffset: isVsuzHParty ? 1000 : 0  // Party markers appear above others
        });
        
        const partyNote = isVsuzHParty ? '<p style="color: #ff6600;"><strong>🎮 Party Journey</strong></p>' : '';
        
        marker.bindPopup(`
            <div class="movement-point-popup${isVsuzHParty ? ' party-point-popup' : ''}">
                <h4>${point.location}</h4>
                ${partyNote}
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
        this.vsuzHAutoShown = false;  // Reset for next load
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
        
        // Update localStorage for VsuzH
        if (pathData.isPartyPath) {
            localStorage.setItem('vsuzh-path-visible', 'true');
        }
        
        console.log(`🗺️ Showing path for ${pathData.character.name}${pathData.isPartyPath ? ' (Party Path)' : ''}`);
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
        
        // Update localStorage for VsuzH
        if (pathData.isPartyPath) {
            localStorage.setItem('vsuzh-path-visible', 'false');
        }
        
        console.log(`🗺️ Hiding path for ${pathData.character.name}${pathData.isPartyPath ? ' (Party Path)' : ''}`);
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

    // 🔥 NEW: Get VsuzH party path specifically
    getVsuzHPath() {
        return this.characterPaths.find(path => path.isPartyPath) || null;
    }

    // 🔥 NEW: Toggle VsuzH path visibility
    toggleVsuzHPath() {
        const vsuzHPath = this.getVsuzHPath();
        if (!vsuzHPath) {
            console.log('⚠️ No VsuzH party path found');
            return false;
        }
        
        if (vsuzHPath.isVisible) {
            this.hideCharacterPath(vsuzHPath.character.id);
        } else {
            this.showCharacterPath(vsuzHPath.character.id);
        }
        
        return vsuzHPath.isVisible;
    }

    // 🔥 NEW: Check if VsuzH path is currently visible
    isVsuzHPathVisible() {
        const vsuzHPath = this.getVsuzHPath();
        return vsuzHPath ? vsuzHPath.isVisible : false;
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

    // 🔥 NEW: Get movement system stats for debugging
    getMovementStats() {
        const vsuzHPath = this.getVsuzHPath();
        return {
            totalPaths: this.characterPaths.length,
            visiblePaths: this.visibleCharacterPaths.size,
            vsuzHPathExists: !!vsuzHPath,
            vsuzHPathVisible: vsuzHPath ? vsuzHPath.isVisible : false,
            vsuzHAutoShown: this.vsuzHAutoShown,
            partyPathSettings: this.partyPathSettings
        };
    }
}

// Create global movement system instance
window.movementSystem = new MovementSystem();

// 🔥 NEW: Add CSS for enhanced party path styling
const partyPathStyles = document.createElement('style');
partyPathStyles.id = 'party-path-styles';
partyPathStyles.textContent = `
/* Enhanced VsuzH Party Path Styling */
.party-path {
    z-index: 1000 !important;
    filter: drop-shadow(0 0 3px rgba(64, 4, 175, 0.5));
}

.party-tooltip {
    background: #3c55e2ff !important;
    color: white !important;
    border: none !important;
    font-weight: bold;
    border-radius: 6px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.party-tooltip:before {
    border-top-color: #3c55e2ff !important;
}

.party-marker {
    z-index: 1000;
    filter: drop-shadow(0 0 2px rgba(60, 85, 226, 1));
    transform: scale(1.1);
}

.party-path-popup {
    border-left: 4px solid #3c55e2ff;
}

.party-path-popup h4 {
    color: #3c55e2ff;
}

.party-point-popup {
    border-left: 3px solid #3c55e2ff;
}

/* Pulse animation for party markers */
@keyframes party-pulse {
    0% { transform: scale(1.1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1.1); }
}

.party-marker:hover {
    animation: party-pulse 1s ease-in-out infinite;
}
`;

if (!document.getElementById('party-path-styles')) {
    document.head.appendChild(partyPathStyles);
}

// 🔥 NEW: Expose party-specific functions globally
window.toggleVsuzHPath = () => window.movementSystem.toggleVsuzHPath();
window.focusVsuzHPath = () => {
    const vsuzHPath = window.movementSystem.getVsuzHPath();
    if (vsuzHPath) {
        window.movementSystem.focusOnCharacterPath(vsuzHPath.character.id);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementSystem;
}