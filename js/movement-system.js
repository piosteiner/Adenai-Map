// movement-system.js - Enhanced Character Movement Tracking with Individual Path Toggles
class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        this.showPathsPanel = false;
        this.visibleCharacterPaths = new Set(); // Track which character paths are visible
        this.currentTimelineDate = null;
        this.pathColors = {
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
        this.addMovementCSS();
        
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
        
        console.log(`🛤️ Created ${this.characterPaths.length} character movement paths`);
        
        // Refresh character list if paths panel is visible
        if (this.showPathsPanel) {
            this.updateCharacterPathsList();
        }
    }

    createCharacterPath(character, movementPoints, pathColor) {
        const map = window.mapCore.getMap();
        
        // Create path coordinates for Leaflet
        const pathCoords = movementPoints.map(point => [
            point.coordinates[1], // lat
            point.coordinates[0]  // lng
        ]);
        
        // Create the path polyline
        const pathLine = L.polyline(pathCoords, {
            color: pathColor,
            weight: 4,
            opacity: 0.7,
            dashArray: '10,5',
            className: `character-path character-path-${character.id}`
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
        const map = window.mapCore.getMap();
        const isFirst = index === 0;
        const isLast = index === totalPoints - 1;
        
        let markerIcon;
        if (isFirst) {
            // FIXED: Start marker now uses 📍
            markerIcon = L.divIcon({
                html: '📍',
                iconSize: [20, 20],
                className: 'movement-start-marker'
            });
        } else if (isLast) {
            // FIXED: Current marker now uses 🚩
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

    // NEW: Toggle the character paths selection panel
    togglePathsPanel() {
        this.showPathsPanel = !this.showPathsPanel;
        
        const charactersList = document.getElementById('character-paths-list');
        const pathToggleBtn = document.getElementById('toggle-character-paths');
        
        if (this.showPathsPanel) {
            // Show character selection panel
            charactersList.style.display = 'block';
            pathToggleBtn.textContent = '🛤️ Hide Paths Panel';
            pathToggleBtn.classList.add('active');
            this.updateCharacterPathsList();
            console.log('🗺️ Character paths panel shown');
        } else {
            // Hide panel and all paths
            charactersList.style.display = 'none';
            pathToggleBtn.textContent = '🛤️ Show Paths';
            pathToggleBtn.classList.remove('active');
            this.hideAllPaths();
            console.log('🗺️ Character paths panel hidden');
        }
    }

    // NEW: Update character paths list with checkboxes
    updateCharacterPathsList() {
        const charactersList = document.getElementById('character-paths-list');
        if (!charactersList) return;

        // Get all characters from character system (not just those with movement)
        const allCharacters = window.characterSystem.getCharacters();
        
        let listHTML = `
            <div class="paths-controls">
                <button id="show-all-paths" class="btn-secondary movement-btn-small">✅ Show All</button>
                <button id="hide-all-paths" class="btn-secondary movement-btn-small">❌ Hide All</button>
            </div>
            <div class="characters-paths-list">
        `;
        
        allCharacters.forEach(character => {
            const hasMovementData = this.getCharacterPath(character.id) !== null;
            const isVisible = this.visibleCharacterPaths.has(character.id);
            const movementCount = character.movementHistory ? character.movementHistory.length : 0;
            
            listHTML += `
                <div class="character-path-item ${!hasMovementData ? 'no-movement' : ''}">
                    <label class="character-path-checkbox">
                        <input type="checkbox" 
                               id="path-${character.id}" 
                               ${isVisible ? 'checked' : ''} 
                               ${!hasMovementData ? 'disabled' : ''}
                               onchange="window.movementSystem.toggleCharacterPath('${character.id}')">
                        <span class="checkmark" style="border-color: ${this.pathColors[character.relationship] || '#666'}"></span>
                        <div class="character-path-info">
                            <strong>${character.name}</strong>
                            <div class="character-path-details">
                                ${character.relationship} ${hasMovementData ? `• ${movementCount + 1} locations` : '• No movement data'}
                            </div>
                        </div>
                    </label>
                </div>
            `;
        });
        
        listHTML += '</div>';
        charactersList.innerHTML = listHTML;
        
        // Add event listeners for show/hide all buttons
        document.getElementById('show-all-paths')?.addEventListener('click', () => this.showAllPaths());
        document.getElementById('hide-all-paths')?.addEventListener('click', () => this.hideAllPaths());
    }

    // NEW: Toggle individual character path
    toggleCharacterPath(characterId) {
        const checkbox = document.getElementById(`path-${characterId}`);
        const isVisible = checkbox?.checked || false;
        
        if (isVisible) {
            this.showCharacterPath(characterId);
        } else {
            this.hideCharacterPath(characterId);
        }
    }

    // NEW: Show individual character path
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

    // NEW: Hide individual character path
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

    // NEW: Show all character paths
    showAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.showCharacterPath(pathData.character.id);
        });
        
        // Update all checkboxes
        this.characterPaths.forEach(pathData => {
            const checkbox = document.getElementById(`path-${pathData.character.id}`);
            if (checkbox && !checkbox.disabled) {
                checkbox.checked = true;
            }
        });
        
        console.log('🗺️ All character paths shown');
    }

    // NEW: Hide all character paths
    hideAllPaths() {
        this.characterPaths.forEach(pathData => {
            this.hideCharacterPath(pathData.character.id);
        });
        
        // Update all checkboxes
        this.characterPaths.forEach(pathData => {
            const checkbox = document.getElementById(`path-${pathData.character.id}`);
            if (checkbox) {
                checkbox.checked = false;
            }
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

    addIntegratedMovementControls() {
        // Find the character panel content area
        const characterPanel = document.getElementById('character-panel');
        if (!characterPanel) {
            console.warn('Character panel not found');
            return;
        }

        // Create movement controls section
        const movementControlsHtml = `
            <div class="movement-controls-section">
                <div class="movement-header" onclick="window.movementSystem.toggleMovementControls()">
                    <h4>🛤️ Character Movement</h4>
                    <span class="movement-toggle">▼</span>
                </div>
                
                <div id="movement-controls-content" class="movement-controls-content">
                    <button id="toggle-character-paths" class="btn-secondary movement-btn">
                        🛤️ Show Paths
                    </button>
                    
                    <div id="character-paths-list" class="character-paths-list" style="display: none;">
                        <!-- Character checkboxes will be populated here -->
                    </div>
                    
                    <div id="timeline-controls" style="display: none;">
                        <label class="movement-label">📅 Date Range Filter:</label>
                        <div class="date-inputs">
                            <input type="date" id="start-date" class="date-input" />
                            <input type="date" id="end-date" class="date-input" />
                        </div>
                        <button id="apply-date-filter" class="btn-secondary movement-btn">Apply Filter</button>
                        <button id="clear-date-filter" class="btn-secondary movement-btn">Clear Filter</button>
                    </div>
                    
                    <div class="movement-legend">
                        <div class="legend-title">Legend:</div>
                        <div class="legend-text">📍 = Start • 🚩 = Current • Numbers = Path order</div>
                    </div>
                </div>
            </div>
        `;

        // Insert movement controls at the top of panel content, after the header
        const panelContent = characterPanel.querySelector('.panel-content');
        if (panelContent) {
            panelContent.insertAdjacentHTML('afterbegin', movementControlsHtml);
        }

        // Add event listeners
        this.setupMovementControlListeners();
    }

    toggleMovementControls() {
        const content = document.getElementById('movement-controls-content');
        const toggle = document.querySelector('.movement-toggle');
        
        if (content && toggle) {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            toggle.textContent = isVisible ? '▶' : '▼';
        }
    }

    setupMovementControlListeners() {
        // Toggle paths panel button (UPDATED)
        const toggleBtn = document.getElementById('toggle-character-paths');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.togglePathsPanel();
                
                const timelineControls = document.getElementById('timeline-controls');
                if (timelineControls) {
                    timelineControls.style.display = this.showPathsPanel ? 'block' : 'none';
                }
            });
        }
        
        // Date filter buttons
        const applyBtn = document.getElementById('apply-date-filter');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;
                
                if (startDate && endDate) {
                    this.filterPathsByDateRange(startDate, endDate);
                }
            });
        }
        
        const clearBtn = document.getElementById('clear-date-filter');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                document.getElementById('start-date').value = '';
                document.getElementById('end-date').value = '';
                
                // Reset to show original paths
                this.characterPaths.forEach(pathData => {
                    if (pathData.isVisible) {
                        this.hideCharacterPath(pathData.character.id);
                        this.showCharacterPath(pathData.character.id);
                    }
                });
            });
        }
    }

    addMovementCSS() {
        const movementCSS = `
            /* Movement Controls Section in Character Panel */
            .movement-controls-section {
                margin-bottom: 20px;
                border-bottom: 1px solid var(--dropdown-border);
                padding-bottom: 15px;
            }

            .movement-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                padding: 8px 0;
                border-bottom: 1px solid var(--dropdown-border);
                margin-bottom: 10px;
            }

            .movement-header:hover {
                background: var(--dropdown-hover);
                padding: 8px;
                margin: 0 -8px 10px -8px;
                border-radius: 4px;
            }

            .movement-header h4 {
                margin: 0;
                font-size: 1em;
                color: var(--text-color);
            }

            .movement-toggle {
                font-size: 0.8em;
                color: var(--text-color);
                opacity: 0.7;
            }

            .movement-controls-content {
                display: block;
            }

            .movement-btn {
                width: 100%;
                margin-bottom: 8px;
                padding: 6px 10px;
                font-size: 0.85em;
                background: var(--popup-bg);
                color: var(--text-color);
                border: 1px solid var(--dropdown-border);
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s ease, color 0.3s ease;
            }

            .movement-btn:hover {
                background: var(--dropdown-hover);
            }

            .movement-btn.active {
                background: #4CAF50;
                color: white;
                border-color: #4CAF50;
            }

            /* NEW: Character paths list styles */
            .character-paths-list {
                margin-top: 10px;
                border: 1px solid var(--dropdown-border);
                border-radius: 4px;
                background: var(--dropdown-bg);
                max-height: 300px;
                overflow-y: auto;
            }

            .paths-controls {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                padding: 8px;
                border-bottom: 1px solid var(--dropdown-border);
                background: var(--card-bg);
            }

            .movement-btn-small {
                padding: 4px 8px;
                font-size: 0.8em;
                background: var(--popup-bg);
                color: var(--text-color);
                border: 1px solid var(--dropdown-border);
                border-radius: 3px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }

            .movement-btn-small:hover {
                background: var(--dropdown-hover);
            }

            .characters-paths-list {
                padding: 4px;
            }

            .character-path-item {
                margin: 2px 0;
                border-radius: 4px;
                transition: background-color 0.3s ease;
            }

            .character-path-item:hover {
                background: var(--dropdown-hover);
            }

            .character-path-item.no-movement {
                opacity: 0.6;
            }

            .character-path-checkbox {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                cursor: pointer;
                width: 100%;
                position: relative;
            }

            .character-path-checkbox input[type="checkbox"] {
                margin-right: 10px;
                cursor: pointer;
                position: absolute;
                opacity: 0;
                width: 16px;
                height: 16px;
            }

            .checkmark {
                width: 16px;
                height: 16px;
                border: 2px solid var(--dropdown-border);
                border-radius: 3px;
                margin-right: 10px;
                flex-shrink: 0;
                position: relative;
                background: var(--popup-bg);
                transition: all 0.3s ease;
            }

            .character-path-checkbox input[type="checkbox"]:checked + .checkmark {
                background: var(--dropdown-border);
            }

            .character-path-checkbox input[type="checkbox"]:checked + .checkmark::after {
                content: '✓';
                position: absolute;
                color: white;
                font-size: 12px;
                font-weight: bold;
                top: -2px;
                left: 2px;
            }

            .character-path-checkbox input[type="checkbox"]:disabled + .checkmark {
                background: var(--dropdown-bg);
                border-color: var(--text-muted);
                opacity: 0.5;
            }

            .character-path-info {
                flex: 1;
            }

            .character-path-info strong {
                display: block;
                font-size: 0.9em;
                color: var(--text-color);
                margin-bottom: 2px;
            }

            .character-path-details {
                font-size: 0.75em;
                color: var(--text-muted);
                text-transform: capitalize;
            }

            .movement-label {
                display: block;
                margin: 10px 0 5px 0;
                font-size: 0.85em;
                font-weight: bold;
                color: var(--text-color);
            }

            .date-inputs {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 8px;
            }

            .date-input {
                padding: 4px 6px;
                font-size: 0.8em;
                background: var(--popup-bg);
                color: var(--text-color);
                border: 1px solid var(--dropdown-border);
                border-radius: 4px;
            }

            .movement-legend {
                margin-top: 12px;
                padding: 8px;
                background: var(--dropdown-bg);
                border-radius: 4px;
                border: 1px solid var(--dropdown-border);
            }

            .legend-title {
                font-size: 0.8em;
                font-weight: bold;
                color: var(--text-color);
                margin-bottom: 4px;
            }

            .legend-text {
                font-size: 0.75em;
                color: var(--text-color);
                opacity: 0.8;
                line-height: 1.3;
            }

            /* Movement marker styles */
            .movement-start-marker, .movement-end-marker, .movement-number-marker {
                background: white;
                border: 2px solid #333;
                border-radius: 50%;
                text-align: center;
                line-height: 16px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .movement-number-marker {
                background: #2196F3;
                color: white;
                border-color: #1976D2;
            }
            
            .character-path-popup {
                max-width: 300px;
            }
            
            .timeline-entry {
                padding: 5px 0;
                border-bottom: 1px solid #eee;
                font-size: 0.9em;
            }
            
            .timeline-entry:last-child {
                border-bottom: none;
            }
            
            .movement-point-popup {
                max-width: 250px;
            }

            /* Path styling */
            .character-path {
                stroke-linecap: round;
                stroke-linejoin: round;
            }
            
            .character-path:hover {
                stroke-width: 6px;
                opacity: 1;
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .movement-controls-section {
                    margin-bottom: 15px;
                }
                
                .movement-btn {
                    font-size: 0.9em;
                    padding: 8px 10px;
                }
                
                .date-inputs {
                    grid-template-columns: 1fr;
                    gap: 6px;
                }

                .character-paths-list {
                    max-height: 200px;
                }

                .paths-controls {
                    grid-template-columns: 1fr;
                    gap: 4px;
                }
            }

            /* Dark mode adjustments */
            [data-theme="dark"] .movement-start-marker,
            [data-theme="dark"] .movement-end-marker {
                background: #2a2a2a;
                border-color: #fff;
                color: #fff;
            }
            
            [data-theme="dark"] .timeline-entry {
                border-bottom-color: #444;
            }

            [data-theme="dark"] .checkmark {
                border-color: var(--dropdown-border);
                background: var(--card-bg);
            }

            [data-theme="dark"] .character-path-checkbox input[type="checkbox"]:checked + .checkmark {
                background: #4CAF50;
                border-color: #4CAF50;
            }
        `;

        const style = document.createElement('style');
        style.textContent = movementCSS;
        document.head.appendChild(style);
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