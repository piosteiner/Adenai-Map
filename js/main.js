// main.js - Modular Adenai Map Initialization
class AdenaiMap {
    constructor() {
        this.initialized = false;
        this.systems = {};
        this.init();
    }

    async init() {
        try {
            console.log('🎮 Initializing Adenai Map...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize systems in order
            await this.initializeSystems();
            await this.loadData();
            this.setupGlobalEventListeners();
            
            this.initialized = true;
            console.log('🎉 Adenai Map initialization complete!');
            
            // Dispatch initialization complete event
            document.dispatchEvent(new CustomEvent('adenaiMapReady', {
                detail: { systems: this.systems }
            }));
            
        } catch (error) {
            console.error('❌ Failed to initialize Adenai Map:', error);
        }
    }

    async initializeSystems() {
        console.log('⚙️ Initializing core systems...');
        
        // Systems are already initialized via their constructors
        // We just need to register them for easier access
        this.systems = {
            mapCore: window.mapCore,
            characterSystem: window.characterSystem,
            movementSystem: window.movementSystem,
            locationsSystem: window.locationsSystem,
            searchSystem: window.searchSystem,
            characterPanel: window.characterPanel
        };

        // Verify all systems are available
        const missingSystems = Object.entries(this.systems)
            .filter(([name, system]) => !system)
            .map(([name]) => name);

        if (missingSystems.length > 0) {
            throw new Error(`Missing systems: ${missingSystems.join(', ')}`);
        }

        console.log('✅ All systems initialized');
    }

    async loadData() {
        console.log('📊 Loading map data...');
        
        try {
            // Load locations first (they provide coordinates for characters)
            await this.systems.locationsSystem.loadLocations();
            
            // Then load characters (which depend on location coordinates)
            await this.systems.characterSystem.loadCharacters();
            
            // Initialize movement controls after characters are loaded
            setTimeout(() => {
                this.systems.movementSystem.addIntegratedMovementControls();
            }, 100);
            
            console.log('✅ All data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading map data:', error);
            throw error;
        }
    }

    setupGlobalEventListeners() {
        // Listen for data updates (useful for admin interface integration)
        document.addEventListener('charactersUpdated', () => {
            console.log('🔄 Characters updated, reloading...');
            this.systems.characterSystem.reloadCharacters();
        });

        // Listen for location updates
        document.addEventListener('locationsUpdated', () => {
            console.log('🔄 Locations updated, reloading...');
            this.systems.locationsSystem.loadLocations();
        });

        // Error handling
        window.addEventListener('error', (event) => {
            console.error('🚨 Global error caught:', event.error);
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
        });
    }

    // Public API methods
    getSystem(systemName) {
        return this.systems[systemName];
    }

    getAllSystems() {
        return this.systems;
    }

    isReady() {
        return this.initialized;
    }

    // Character management shortcuts
    focusCharacter(name) {
        return this.systems.characterSystem.focusCharacter(name);
    }

    focusLocation(name) {
        return this.systems.locationsSystem.focusLocation(name);
    }

    searchMap(query) {
        return this.systems.searchSystem.search(query);
    }

    toggleCharacterPaths() {
        return this.systems.movementSystem.toggleCharacterPaths();
    }

    toggleCharacterPanel() {
        return this.systems.characterPanel.togglePanel();
    }

    // Debug and utility methods
    getMapStats() {
        return {
            characters: {
                total: this.systems.characterSystem.getCharacters().length,
                withCoordinates: this.systems.characterSystem.getCharacters().filter(c => c.coordinates).length,
                withMovements: this.systems.characterSystem.getCharacters().filter(c => c.movementHistory?.length > 0).length
            },
            locations: {
                total: this.systems.locationsSystem.getLocations().length,
                ...this.systems.locationsSystem.getLocationStats()
            },
            movement: {
                pathsCreated: this.systems.movementSystem.getCharacterPaths().length,
                pathsVisible: this.systems.movementSystem.getShowCharacterPaths()
            },
            search: {
                indexSize: this.systems.searchSystem.getSearchIndex().length
            },
            panel: {
                isOpen: this.systems.characterPanel.isOpen(),
                ...this.systems.characterPanel.getPanelStats()
            }
        };
    }

    printStats() {
        const stats = this.getMapStats();
        console.log('📊 Adenai Map Statistics:', stats);
        return stats;
    }

    // Admin interface integration helpers
    refreshCharacters() {
        return this.systems.characterSystem.reloadCharacters();
    }

    refreshLocations() {
        return this.systems.locationsSystem.loadLocations();
    }

    refreshPanel() {
        return this.systems.characterPanel.refreshPanel();
    }
}

// Initialize the main application
const adenaiMap = new AdenaiMap();

// Make it globally available for admin interface integration
window.adenaiMap = adenaiMap;

// Legacy support - expose key functions globally
window.addCharacterMovementPaths = () => window.movementSystem?.addCharacterMovementPaths();
window.clearCharacterPaths = () => window.movementSystem?.clearCharacterPaths();
window.reloadCharacters = () => window.characterSystem?.reloadCharacters();

// Cleanup - hide any remnants of old controls
const cleanupCSS = `
    #character-controls {
        display: none !important;
    }
    #movement-controls {
        display: none !important;
    }
`;
const cleanupStyle = document.createElement('style');
cleanupStyle.textContent = cleanupCSS;
document.head.appendChild(cleanupStyle);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdenaiMap;
}

console.log('🗺️ Adenai Map modules loaded and ready for initialization');