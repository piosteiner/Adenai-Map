// char-path-sys.js - Character Path Display System
// Handles display and interaction of character paths on the map

class CharPathSystem {
    constructor() {
        this.characterPaths = [];
        this.movementLayers = [];
        
        // Initialize Character Path API client
        this.pathAPI = new CharPathAPI();
        
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

    // Simple API-only path loading and display
    async loadAndDisplayPaths() {
        console.log('🗺️ Loading character paths from API...');
        
        try {
            // Load paths from API
            const apiData = await this.pathAPI.loadCharacterPaths();
            
            console.log(`📈 Loaded ${Object.keys(apiData.paths).length} character paths from API`);
            
            // Display paths on map
            this.displayPaths(apiData.paths);
            
        } catch (error) {
            console.error('❌ Character Paths API unavailable');
            this.showError('Character movement data unavailable. Please contact developer through GitHub.');
        }
    }

    // Display paths on the map
    displayPaths(paths) {
        const map = window.mapCore.getMap();
        
        console.log('🎯 DisplayPaths called with:', Object.keys(paths).length, 'paths');
        console.log('🗺️ Map available:', !!map);
        
        if (!map) {
            console.error('❌ Map not available in displayPaths');
            return;
        }
        
        Object.values(paths).forEach((pathInfo, index) => {
            console.log(`📊 Processing path ${index + 1}:`, pathInfo.name, pathInfo.type);
            
            if (pathInfo.type === 'movement' && pathInfo.coordinates.length >= 2) {
                console.log(`📍 Creating path for ${pathInfo.name} with ${pathInfo.coordinates.length} coordinates`);
                console.log('🎨 Style:', pathInfo.style);
                
                // Create path line using API styling
                const pathLine = L.polyline(pathInfo.coordinates, {
                    color: pathInfo.style.color,
                    weight: pathInfo.style.weight,
                    opacity: pathInfo.style.opacity,
                    dashArray: pathInfo.style.dashArray || '5,2'
                });
                
                // Add to map
                pathLine.addTo(map);
                this.movementLayers.push(pathLine);
                
                // Add tooltip
                pathLine.bindTooltip(pathInfo.name, {
                    permanent: false,
                    sticky: true,
                    direction: 'top'
                });
                
                console.log(`✅ Displayed path for ${pathInfo.name}`);
            } else {
                console.log(`⚠️ Skipping path ${pathInfo.name}: type=${pathInfo.type}, coords=${pathInfo.coordinates.length}`);
            }
        });
        
        console.log(`✅ Total displayed: ${this.movementLayers.length} character paths`);
    }

    // Clear all paths from map
    clearPaths() {
        const map = window.mapCore.getMap();
        
        this.movementLayers.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        
        this.movementLayers = [];
        this.characterPaths = [];
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
        console.log('✅ Character Path System initialized');
        
        // Update version info via GitHub checker if available
        if (window.gitHubVersionChecker) {
            window.gitHubVersionChecker.updateVersionDisplay();
        }
        
        return true;
    }

    // Manual test function
    async testLoadPaths() {
        console.log('🧪 Manual test: Loading paths...');
        await this.loadAndDisplayPaths();
        
        // Update version after test if GitHub checker available
        if (window.gitHubVersionChecker) {
            window.gitHubVersionChecker.updateVersionDisplay();
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CharPathSystem = CharPathSystem;
    
    // Create and expose instance for global access
    window.charPathSystem = new CharPathSystem();
    // Legacy alias for backward compatibility
    window.movementSystem = window.charPathSystem;
}
