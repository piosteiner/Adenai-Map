class MovementSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        
        // Initialize Character Path Manager for API integration
        this.pathManager = new CharacterPathManager();
        
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
            const apiData = await this.pathManager.loadCharacterPaths();
            this.displayPaths(apiData.paths);
        } catch (error) {
            console.error('❌ Character Paths API unavailable');
            this.showError('Character movement data unavailable. Please contact developer through GitHub.');
        }
    }

    // Display paths on the map
    displayPaths(paths) {
        const map = window.mapCore.getMap();
        
        if (!map) {
            console.error('❌ Map not available for path display');
            return;
        }
        
        // Hide existing paths before loading new ones
        this.hideAllPaths();
        
        Object.values(paths).forEach((pathInfo) => {
            if (pathInfo.type === 'movement' && pathInfo.coordinates.length >= 2) {
                // Create path line using server-provided styling
                const pathLine = L.polyline(pathInfo.coordinates, {
                    color: pathInfo.style.color,
                    weight: pathInfo.style.weight,
                    opacity: pathInfo.style.opacity,
                    dashArray: pathInfo.style.dashArray
                });
                
                pathLine.addTo(map);
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
                    coordinates: pathInfo.coordinates,
                    style: pathInfo.style
                });
            }
        });
    }

    // Show all character paths
    showAllPaths() {
        const map = window.mapCore.getMap();
        if (!map) return;

        this.movementLayers.forEach(layer => {
            if (!map.hasLayer(layer)) {
                layer.addTo(map);
            }
        });
    }

    // Hide all character paths
    hideAllPaths() {
        const map = window.mapCore.getMap();
        if (!map) return;

        this.movementLayers.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
    }

    // Show specific character path by ID
    showCharacterPath(characterId) {
        const map = window.mapCore.getMap();
        if (!map) return false;

        // Find the path layer for this character
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        if (pathData && pathData.pathLine && !map.hasLayer(pathData.pathLine)) {
            pathData.pathLine.addTo(map);
            return true;
        }
        return false;
    }

    // Hide specific character path by ID
    hideCharacterPath(characterId) {
        const map = window.mapCore.getMap();
        if (!map) return false;

        // Find the path layer for this character
        const pathData = this.characterPaths.find(path => path.character?.id === characterId);
        if (pathData && pathData.pathLine && map.hasLayer(pathData.pathLine)) {
            map.removeLayer(pathData.pathLine);
            return true;
        }
        return false;
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
