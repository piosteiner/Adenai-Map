/**
 * Movement Markers System
 * Handles creation, display, and interaction of movement markers on the map
 */

class MovementMarkers {
    constructor(movementSystem) {
        this.movementSystem = movementSystem;
        this.markers = [];
    }

    // Get character path color by character ID
    getCharacterPathColor(characterId) {
        const pathData = this.movementSystem.characterPaths.find(path => path.character?.id === characterId);
        return pathData?.style?.color || '#333333'; // Default dark color if not found
    }

    // Create markers for a character's movement history
    createCharacterMovementMarkers(characterData) {
        const markers = [];
        
        if (!characterData.movementHistory || characterData.movementHistory.length === 0) {
            return markers;
        }

        // Group movements by coordinates to handle overlapping locations
        const movementsByLocation = {};
        
        characterData.movementHistory.forEach(movement => {
            if (movement.coordinates && Array.isArray(movement.coordinates) && movement.coordinates.length === 2) {
                const coordKey = `${movement.coordinates[0]},${movement.coordinates[1]}`;
                
                if (!movementsByLocation[coordKey]) {
                    movementsByLocation[coordKey] = [];
                }
                
                movementsByLocation[coordKey].push(movement);
            }
        });

        // Create markers for each location (single or clustered)
        Object.entries(movementsByLocation).forEach(([coordKey, movements]) => {
            const [x, y] = coordKey.split(',').map(Number);
            const mapCoords = [y, x]; // Leaflet expects [lat, lng]
            
            if (movements.length === 1) {
                // Single marker
                const movement = movements[0];
                const marker = this.createSingleMovementMarker(mapCoords, movement, characterData.name, characterData.id);
                
                if (marker) {
                    markers.push({
                        marker: marker,
                        characterId: characterData.id,
                        movementNr: movement.movement_nr,
                        movementData: movement,
                        isVisible: false,
                        type: 'single'
                    });
                }
            } else {
                // Clustered markers for same location
                const clusterMarker = this.createClusteredMovementMarker(mapCoords, movements, characterData.name, characterData.id);
                
                if (clusterMarker) {
                    markers.push({
                        marker: clusterMarker,
                        characterId: characterData.id,
                        movements: movements,
                        isVisible: false,
                        type: 'cluster'
                    });
                }
            }
        });

        return markers;
    }

    // Create a single movement marker
    createSingleMovementMarker(coordinates, movementData, characterName, characterId) {
        const map = window.mapCore.getMap();
        if (!map) return null;

        const markerNumber = (movementData.movement_nr || 0) + 1;
        const pathColor = this.getCharacterPathColor(characterId);

        const markerHtml = `
            <div class="movement-marker single-marker" style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                position: relative;
                cursor: pointer;
                background: ${pathColor};
                color: white;
                border: 2px solid white;
            ">${markerNumber}</div>
        `;

        const customIcon = L.divIcon({
            html: markerHtml,
            className: 'movement-marker-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker(coordinates, { icon: customIcon });
        
        marker.on('click', () => {
            this.showMovementPopup(movementData, characterName, markerNumber);
        });

        return marker;
    }

    // Create a clustered movement marker for multiple visits to same location
    createClusteredMovementMarker(coordinates, movements, characterName, characterId) {
        const map = window.mapCore.getMap();
        if (!map) return null;

        const count = movements.length;
        const pathColor = this.getCharacterPathColor(characterId);

        const markerHtml = `
            <div class="movement-marker cluster-marker" style="
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                position: relative;
                cursor: pointer;
                background: ${pathColor};
                color: white;
                border: 3px solid white;
            ">
                ${count}x
            </div>
        `;

        const customIcon = L.divIcon({
            html: markerHtml,
            className: 'movement-marker-icon cluster-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker(coordinates, { icon: customIcon });
        
        // Store movements data for fanning out
        marker._movements = movements;
        marker._characterName = characterName;
        marker._characterId = characterId;
        marker._isFannedOut = false;
        marker._fanMarkers = [];
        marker._hoverTimeout = null;
        
        // Add hover events for fanning out with better control
        marker.on('mouseover', () => {
            if (marker._hoverTimeout) {
                clearTimeout(marker._hoverTimeout);
            }
            this.fanOutClusteredMarkers(marker);
        });
        
        marker.on('mouseout', () => {
            // Delay the fan-in to allow moving to fanned markers
            marker._hoverTimeout = setTimeout(() => {
                this.fanInClusteredMarkers(marker);
            }, 500);
        });
        
        // Keep area active when hovering over fanned markers
        marker._keepFannedOut = () => {
            if (marker._hoverTimeout) {
                clearTimeout(marker._hoverTimeout);
            }
        };
        
        marker._scheduleFanIn = () => {
            marker._hoverTimeout = setTimeout(() => {
                this.fanInClusteredMarkers(marker);
            }, 300);
        };

        return marker;
    }

    // Fan out clustered markers on hover
    fanOutClusteredMarkers(clusterMarker) {
        if (clusterMarker._isFannedOut) return;
        
        const map = window.mapCore.getMap();
        if (!map) return;
        
        clusterMarker._isFannedOut = true;
        const movements = clusterMarker._movements;
        const characterName = clusterMarker._characterName;
        const characterId = clusterMarker._characterId;
        const centerLatLng = clusterMarker.getLatLng();
        const pathColor = this.getCharacterPathColor(characterId);
        
        // Spiral configuration
        const baseRadius = 33; // Starting radius in pixels
        const radiusIncrement = 15; // How much radius increases per revolution
        const itemsPerRevolution = 6; // How many items before increasing radius
        
        movements.forEach((movement, index) => {
            // Calculate spiral position
            const revolutionIndex = Math.floor(index / itemsPerRevolution);
            const positionInRevolution = index % itemsPerRevolution;
            
            // Start from top (0 degrees = top) and go clockwise
            const angleStep = (2 * Math.PI) / itemsPerRevolution;
            const angle = (positionInRevolution * angleStep) - (Math.PI / 2); // -π/2 to start from top
            
            // Calculate radius for this position (spiral outward)
            const radius = baseRadius + (revolutionIndex * radiusIncrement);
            
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            
            // Get the map container to calculate pixel offsets
            const mapContainer = map.getContainer();
            const centerPoint = map.latLngToContainerPoint(centerLatLng);
            const fanPoint = L.point(centerPoint.x + offsetX, centerPoint.y + offsetY);
            const fanLatLng = map.containerPointToLatLng(fanPoint);
            
            // Create individual marker for fanning out (same size as regular markers)
            const markerNumber = (movement.movement_nr || 0) + 1;

            const fanMarkerHtml = `
                <div class="movement-marker fan-marker" style="
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    transform: scale(0);
                    z-index: 1002;
                    background: ${pathColor};
                    color: white;
                    border: 2px solid white;
                ">${markerNumber}</div>
            `;

            const fanIcon = L.divIcon({
                html: fanMarkerHtml,
                className: 'movement-marker-icon fan-icon',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const fanMarker = L.marker(fanLatLng, { icon: fanIcon });
            
            // Add click event for detailed popup
            fanMarker.on('click', () => {
                this.showMovementPopup(movement, characterName, markerNumber);
            });
            
            // Add hover events to keep cluster fanned out
            fanMarker.on('mouseover', () => {
                clusterMarker._keepFannedOut();
            });
            
            fanMarker.on('mouseout', () => {
                clusterMarker._scheduleFanIn();
            });
            
            fanMarker.addTo(map);
            
            // Animate the fan out with spiral timing
            setTimeout(() => {
                const element = fanMarker.getElement();
                if (element) {
                    const markerDiv = element.querySelector('.fan-marker');
                    if (markerDiv) {
                        markerDiv.style.transform = 'scale(1)';
                        markerDiv.style.animation = 'fanOut 0.4s ease-out';
                    }
                }
            }, index * 60); // Slightly longer stagger for spiral effect
            
            clusterMarker._fanMarkers.push(fanMarker);
        });
        
        // Keep the cluster marker visible and on top
        const clusterElement = clusterMarker.getElement();
        if (clusterElement) {
            clusterElement.style.zIndex = '1001';
        }
    }

    // Fan in clustered markers
    fanInClusteredMarkers(clusterMarker) {
        if (!clusterMarker._isFannedOut) return;
        
        const map = window.mapCore.getMap();
        if (!map) return;
        
        // Animate fan in
        clusterMarker._fanMarkers.forEach((fanMarker, index) => {
            setTimeout(() => {
                const element = fanMarker.getElement();
                if (element) {
                    const markerDiv = element.querySelector('.fan-marker');
                    if (markerDiv) {
                        markerDiv.style.transform = 'scale(0)';
                        markerDiv.style.animation = 'fanIn 0.2s ease-in';
                    }
                }
                
                // Remove marker after animation
                setTimeout(() => {
                    if (map.hasLayer(fanMarker)) {
                        map.removeLayer(fanMarker);
                    }
                }, 200);
            }, index * 30);
        });
        
        // Reset cluster marker z-index
        const clusterElement = clusterMarker.getElement();
        if (clusterElement) {
            clusterElement.style.zIndex = '600';
        }
        
        clusterMarker._fanMarkers = [];
        clusterMarker._isFannedOut = false;
    }

    // Show detailed movement popup
    showMovementPopup(movementData, characterName, markerNumber) {
        const map = window.mapCore.getMap();
        if (!map) return;

        // Calculate duration if we have both start and end dates
        let durationText = null;
        let hasEndDate = false;
        
        const endDate = movementData.endDate || movementData.dateEnd;
        if (endDate) {
            hasEndDate = true;
            
            if (movementData.date) {
                const startDate = new Date(movementData.date);
                const endDateObj = new Date(endDate);
                
                if (!isNaN(startDate.getTime()) && !isNaN(endDateObj.getTime())) {
                    const diffTime = Math.abs(endDateObj - startDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    durationText = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                }
            }
        }

        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return null;
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date.toLocaleDateString();
        };

        const formattedEndDate = formatDate(endDate);

        // Create popup content
        const popupContent = `
            <div class="movement-popup">
                <div class="movement-popup-header">
                    <h3>🛤️ ${characterName} - Stop ${markerNumber}</h3>
                </div>
                <div class="movement-popup-content">
                    <div class="movement-info-row">
                        <strong>📍 Location:</strong> ${movementData.location || 'Unknown'}
                    </div>
                    <div class="movement-info-row">
                        <strong>🚶 Movement Type:</strong> ${movementData.type || 'travel'}
                    </div>
                    <div class="movement-info-row">
                        <strong>📅 Start Date:</strong> ${formatDate(movementData.date) || 'Not specified'}
                    </div>
                    ${hasEndDate && formattedEndDate ? `
                    <div class="movement-info-row">
                        <strong>📅 End Date:</strong> ${formattedEndDate}
                    </div>
                    ` : ''}
                    ${durationText ? `
                    <div class="movement-info-row">
                        <strong>⏱️ Duration:</strong> ${durationText}
                    </div>
                    ` : ''}
                    ${movementData.notes ? `
                    <div class="movement-info-row">
                        <strong>📝 Notes:</strong> ${movementData.notes}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Create and show popup
        const popup = L.popup({
            maxWidth: 300,
            className: 'movement-detail-popup'
        })
        .setLatLng(map.getCenter())
        .setContent(popupContent)
        .openOn(map);

        // Position popup near the marker if possible
        try {
            const markerLatLng = L.latLng(movementData.coordinates[1], movementData.coordinates[0]);
            popup.setLatLng(markerLatLng);
        } catch (e) {
            // Fallback to map center if positioning fails
            console.warn('Could not position popup at marker location');
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.MovementMarkers = MovementMarkers;
}
