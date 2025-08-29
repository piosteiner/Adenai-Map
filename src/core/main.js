// main.js - Modular Adenai Map Initialization
class AdenaiMap {
    constructor() {
        this.initialized = false;
        this.systems = {};
        this.init();
    }

    async init() {
        try {
            Logger.system('Adenai Map', 'Initializing...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Wait for map core to be ready
            await this.waitForMapCore();
            
            // Initialize systems in order
            await this.initializeSystems();
            await this.loadData();
            this.setupGlobalEventListeners();
            
            this.initialized = true;
            Logger.success('Adenai Map initialization complete!');
            
            // Dispatch initialization complete event
            document.dispatchEvent(new CustomEvent('adenaiMapReady', {
                detail: { 
                    systems: this.systems,
                    map: this.getLeafletMap() // 🔥 Include map reference
                }
            }));
            
        } catch (error) {
        Logger.error('Failed to initialize Adenai Map:', error);
        }
    }

    // 🔥 NEW: Wait for map core to be ready
    async waitForMapCore() {
        Logger.loading('Waiting for map core...');
        
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        while (attempts < maxAttempts) {
            if (window.mapCore && window.mapCore.map && window.map === window.mapCore.map) {
                Logger.success('Map core ready!');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Map core failed to initialize within timeout');
    }

    async initializeSystems() {
        Logger.system('Systems', 'Initializing core systems...');
        
        // Systems are already initialized via their constructors
        // We just need to register them for easier access
        this.systems = {
            mapCore: window.mapCore,
            characterSystem: window.characterSystem,
            movementSystem: window.movementSystem,
            locationsSystem: window.locationsSystem,
            locationSystem: window.locationSystem, // Add this line for new naming
            searchSystem: window.searchSystem,
            characterPanel: window.characterPanel
        };

        // Make location system available globally for media modal access
        window.locationSystem = window.locationsSystem || window.locationSystem;

        // Verify all systems are available
        const missingSystems = Object.entries(this.systems)
            .filter(([name, system]) => !system)
            .map(([name]) => name);

        if (missingSystems.length > 0) {
            console.warn('⚠️ Missing systems:', missingSystems);
            // Don't throw error, just warn - some systems might be optional
        }

        // 🔥 Validate map reference is working
        const map = this.getLeafletMap();
        if (!map || typeof map.addLayer !== 'function') {
            throw new Error('Leaflet map not properly initialized for systems');
        }

        Logger.success('All systems initialized');
        Logger.info('Map reference validated:', {
            hasMap: !!map,
            hasAddLayer: typeof map.addLayer === 'function',
            mapType: map.constructor.name
        });
    }

    async loadData() {
        Logger.loading('Loading map data...');
        
        try {
            // Load locations first (they provide coordinates for characters)
            if (this.systems.locationsSystem) {
                await this.systems.locationsSystem.loadLocations();
            }
            
            // Then load characters (which depend on location coordinates)
            if (this.systems.characterSystem) {
                await this.systems.characterSystem.loadCharacters();
            }
            
            // Initialize movement controls after characters are loaded
            setTimeout(() => {
                if (this.systems.movementSystem) {
                    this.systems.movementSystem.addIntegratedMovementControls();
                }
            }, 100);
            
            // 🔥 Initialize journeys after map and systems are ready
            setTimeout(() => {
                this.initializeJourneys();
            }, 200);
            
            Logger.success('All data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading map data:', error);
            throw error;
        }
    }

    // 🔥 NEW: Initialize journey system
    initializeJourneys() {
        console.log('🛤️ Initializing journey system...');
        
        // Check if journey functions are available
        if (typeof window.loadJourneys === 'function') {
            // Validate map is available for journeys
            if (window.map && typeof window.map.addLayer === 'function') {
                console.log('📍 Map validated for journeys, loading...');
                window.loadJourneys().catch(error => {
                    console.error('❌ Failed to load journeys:', error);
                });
            } else {
                console.error('❌ Map not available for journey system');
                console.log('Debug info:', {
                    windowMap: !!window.map,
                    mapType: window.map?.constructor?.name,
                    hasAddLayer: typeof window.map?.addLayer
                });
            }
        } else {
            console.log('ℹ️ Journey system not loaded (loadJourneys function not found)');
        }
    }

    setupGlobalEventListeners() {
        // Listen for data updates (useful for admin interface integration)
        document.addEventListener('charactersUpdated', () => {
            Logger.refresh('Characters updated, reloading...');
            if (this.systems.characterSystem) {
                this.systems.characterSystem.reloadCharacters();
            }
        });

        // Listen for location updates
        document.addEventListener('locationsUpdated', () => {
            Logger.refresh('Locations updated, reloading...');
            if (this.systems.locationsSystem) {
                this.systems.locationsSystem.reloadLocations();
            }
        });

        // 🔥 NEW: Listen for journey updates
        document.addEventListener('journeysUpdated', () => {
            Logger.refresh('Journeys updated, reloading...');
            if (typeof window.refreshJourneys === 'function') {
                window.refreshJourneys();
            }
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

    // 🔥 NEW: Get the actual Leaflet map instance
    getLeafletMap() {
        // Try multiple ways to access the map
        return window.map || 
               this.systems?.mapCore?.getMap() || 
               window.mapCore?.map || 
               null;
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

    // 🔥 NEW: Get map with validation
    getMap() {
        const map = this.getLeafletMap();
        if (!map) {
            console.error('❌ No Leaflet map available');
            return null;
        }
        if (typeof map.addLayer !== 'function') {
            console.error('❌ Invalid map object (missing addLayer method)');
            return null;
        }
        return map;
    }

    // Character management shortcuts
    focusCharacter(name) {
        return this.systems.characterSystem?.focusCharacter(name);
    }

    focusLocation(name) {
        return this.systems.locationsSystem?.focusLocation(name);
    }

    searchMap(query) {
        return this.systems.searchSystem?.search(query);
    }

    toggleCharacterPaths() {
        return this.systems.movementSystem?.toggleCharacterPaths();
    }

    toggleCharacterPanel() {
        return this.systems.characterPanel?.togglePanel();
    }

    // 🔥 NEW: Journey management shortcuts
    loadJourneys() {
        if (typeof window.loadJourneys === 'function') {
            return window.loadJourneys();
        }
        console.warn('⚠️ Journey system not available');
    }

    refreshJourneys() {
        if (typeof window.refreshJourneys === 'function') {
            return window.refreshJourneys();
        }
        console.warn('⚠️ Journey system not available');
    }

    clearJourneys() {
        if (typeof window.clearJourneys === 'function') {
            return window.clearJourneys();
        }
        console.warn('⚠️ Journey system not available');
    }

    // Debug and utility methods
    getMapStats() {
        const baseStats = {
            map: {
                available: !!this.getLeafletMap(),
                type: this.getLeafletMap()?.constructor?.name || 'N/A',
                hasAddLayer: typeof this.getLeafletMap()?.addLayer === 'function'
            },
            systems: {
                loaded: Object.keys(this.systems).length,
                available: Object.values(this.systems).filter(Boolean).length
            }
        };

        // Add system-specific stats if available
        if (this.systems.characterSystem) {
            baseStats.characters = {
                total: this.systems.characterSystem.getCharacters?.()?.length || 0,
                withCoordinates: this.systems.characterSystem.getCharacters?.()?.filter(c => c.coordinates)?.length || 0,
                withMovements: this.systems.characterSystem.getCharacters?.()?.filter(c => c.movementHistory?.length > 0)?.length || 0
            };
        }

        if (this.systems.locationsSystem) {
            baseStats.locations = {
                total: this.systems.locationsSystem.getLocations?.()?.length || 0,
                ...this.systems.locationsSystem.getLocationStats?.() || {}
            };
        }

        if (this.systems.movementSystem) {
            baseStats.movement = {
                pathsCreated: this.systems.movementSystem.getCharacterPaths?.()?.length || 0,
                pathsVisible: this.systems.movementSystem.getShowCharacterPaths?.() || false
            };
        }

        if (this.systems.searchSystem) {
            baseStats.search = {
                indexSize: this.systems.searchSystem.getSearchIndex?.()?.length || 0
            };
        }

        if (this.systems.characterPanel) {
            baseStats.panel = {
                isOpen: this.systems.characterPanel.isOpen?.() || false,
                ...this.systems.characterPanel.getPanelStats?.() || {}
            };
        }

        // Add journey stats if available
        if (typeof window.debugJourneys === 'function') {
            try {
                // This will log journey debug info to console
                window.debugJourneys();
                baseStats.journeys = {
                    systemAvailable: true,
                    checkConsoleForDetails: true
                };
            } catch (e) {
                baseStats.journeys = {
                    systemAvailable: false,
                    error: e.message
                };
            }
        } else {
            baseStats.journeys = {
                systemAvailable: false,
                reason: 'debugJourneys function not found'
            };
        }

        return baseStats;
    }

    printStats() {
        const stats = this.getMapStats();
        console.log('📊 Adenai Map Statistics:', stats);
        return stats;
    }

    // Admin interface integration helpers
    refreshCharacters() {
        return this.systems.characterSystem?.reloadCharacters();
    }

    refreshLocations() {
        return this.systems.locationsSystem?.reloadLocations();
    }

    refreshPanel() {
        return this.systems.characterPanel?.refreshPanel();
    }

    // 🔥 NEW: Map debugging helper
    debugMap() {
        const map = this.getLeafletMap();
        console.log('🔍 Map Debug Info:');
        console.log('  window.map:', window.map);
        console.log('  window.mapCore:', window.mapCore);
        console.log('  this.getLeafletMap():', map);
        console.log('  Map methods available:', {
            addLayer: typeof map?.addLayer,
            removeLayer: typeof map?.removeLayer,
            fitBounds: typeof map?.fitBounds,
            on: typeof map?.on
        });
        
        if (map && map.getContainer) {
            console.log('  Map container:', map.getContainer());
        }
        
        return {
            map,
            isValid: !!(map && typeof map.addLayer === 'function'),
            globalRefs: {
                windowMap: window.map,
                mapCore: window.mapCore
            }
        };
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
window.reloadLocations = () => window.adenaiMap?.refreshLocations();

// 🔥 NEW: Expose map debugging function globally
window.debugMap = () => window.adenaiMap?.debugMap();

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

// Test function to verify AdenaiConfig integration
window.testAdenaiConfig = function() {
    console.log('🧪 Testing AdenaiConfig integration...');
    
    if (!window.AdenaiConfig) {
        console.error('❌ AdenaiConfig not found!');
        return false;
    }
    
    console.log('✅ AdenaiConfig is available globally');
    
    // Test character status labels
    console.log('👤 Character Status Tests:');
    console.log('  alive →', AdenaiConfig.getCharacterStatusLabel('alive'));
    console.log('  dead →', AdenaiConfig.getCharacterStatusLabel('dead'));
    console.log('  undead →', AdenaiConfig.getCharacterStatusLabel('undead'));
    console.log('  missing →', AdenaiConfig.getCharacterStatusLabel('missing'));
    
    // Test character relationship labels
    console.log('🤝 Character Relationship Tests:');
    console.log('  ally →', AdenaiConfig.getCharacterRelationshipLabel('ally'));
    console.log('  friendly →', AdenaiConfig.getCharacterRelationshipLabel('friendly'));
    console.log('  neutral →', AdenaiConfig.getCharacterRelationshipLabel('neutral'));
    console.log('  hostile →', AdenaiConfig.getCharacterRelationshipLabel('hostile'));
    console.log('  enemy →', AdenaiConfig.getCharacterRelationshipLabel('enemy'));
    
    // Test location type labels
    console.log('🏛️ Location Type Tests:');
    console.log('  city →', AdenaiConfig.getLocationTypeLabel('city'));
    console.log('  town →', AdenaiConfig.getLocationTypeLabel('town'));
    console.log('  village →', AdenaiConfig.getLocationTypeLabel('village'));
    console.log('  dungeon →', AdenaiConfig.getLocationTypeLabel('dungeon'));
    
    // Test location region labels
    console.log('🗺️ Location Region Tests:');
    console.log('  north_adenai →', AdenaiConfig.getLocationRegionLabel('north_adenai'));
    console.log('  valaris_region →', AdenaiConfig.getLocationRegionLabel('valaris_region'));
    console.log('  underdark →', AdenaiConfig.getLocationRegionLabel('underdark'));
    
    // Test movement type labels
    console.log('🚶 Movement Type Tests:');
    console.log('  stay →', AdenaiConfig.getMovementTypeLabel('stay'));
    console.log('  travel →', AdenaiConfig.getMovementTypeLabel('travel'));
    console.log('  mission →', AdenaiConfig.getMovementTypeLabel('mission'));
    
    // Test select generation
    console.log('📋 Select Options Test:');
    const statusOptions = AdenaiConfig.generateSelectOptions('characterStatus');
    console.log('  Character status options (HTML):', statusOptions.substring(0, 100) + '...');
    
    const relationshipArray = AdenaiConfig.getSelectOptionsArray('characterRelationships');
    console.log('  Relationship options (Array):', relationshipArray.slice(0, 3));
    
    console.log('🎉 AdenaiConfig integration test complete!');
    return true;
};

// Auto-run test after map initialization
document.addEventListener('adenaiMapInitialized', () => {
    setTimeout(() => {
        console.log('🔄 Running AdenaiConfig integration test...');
        window.testAdenaiConfig();
    }, 1000);
});

// ============================================
// DRAGON SHADOW CONTROLLER
// ============================================
class DragonShadowController {
    constructor() {
        this.shadows = [];
        this.isActive = true;
        this.mapBounds = {
            topLeft: [3, -3],
            topRight: [2497, -24], 
            bottomRight: [2468, 1546],
            bottomLeft: [1, 1537]
        };
        this.init();
    }

    init() {
        // Wait for the map to be fully loaded
        document.addEventListener('adenaiMapInitialized', () => {
            setTimeout(() => {
                this.setupShadows();
                this.startRandomShadows();
                console.log('🐉 Dragon shadows activated within map bounds');
            }, 2000);
        });
    }

    setupShadows() {
        this.shadows = document.querySelectorAll('.dragon-shadow');
    }

    // Convert map coordinates to screen percentage
    mapCoordsToScreenPercent(x, y) {
        const map = window.mapCore.getMap();
        if (!map) return { x: 50, y: 50 }; // Fallback to center
        
        // Convert map coordinates to LatLng
        const point = map.project([y, x], map.getZoom());
        const bounds = map.getPixelBounds();
        
        // Calculate percentage position within map view
        const percentX = ((point.x - bounds.min.x) / (bounds.max.x - bounds.min.x)) * 100;
        const percentY = ((point.y - bounds.min.y) / (bounds.max.y - bounds.min.y)) * 100;
        
        return { 
            x: Math.max(0, Math.min(100, percentX)), 
            y: Math.max(0, Math.min(100, percentY)) 
        };
    }

    // Get random position within map bounds
    getRandomMapPosition() {
        // Random position within the defined bounds
        const minX = Math.min(this.mapBounds.topLeft[0], this.mapBounds.bottomLeft[0]);
        const maxX = Math.max(this.mapBounds.topRight[0], this.mapBounds.bottomRight[0]);
        const minY = Math.min(this.mapBounds.topLeft[1], this.mapBounds.topRight[1]);
        const maxY = Math.max(this.mapBounds.bottomLeft[1], this.mapBounds.bottomRight[1]);
        
        const randomX = minX + Math.random() * (maxX - minX);
        const randomY = minY + Math.random() * (maxY - minY);
        
        return this.mapCoordsToScreenPercent(randomX, randomY);
    }

    startRandomShadows() {
        if (!this.isActive) return;

        // Schedule the next random dragon shadow - shorter delay for testing
        const randomDelay = Math.random() * 15000 + 5000; // Between 5-20 seconds for testing
        
        setTimeout(() => {
            this.triggerRandomShadow();
            this.startRandomShadows(); // Schedule the next one
        }, randomDelay);
    }

    // Manual trigger for testing
    triggerNow() {
        console.log('🐉 Manually triggering dragon shadow...');
        this.triggerRandomShadow();
    }

    triggerRandomShadow() {
        if (!this.isActive || this.shadows.length === 0) return;

        // Pick a random shadow variant
        const randomShadow = this.shadows[Math.floor(Math.random() * this.shadows.length)];
        
        // Simplified positioning - use viewport percentages directly for now
        const startX = Math.random() * 20; // Start from left edge area
        const endX = 80 + Math.random() * 20; // End at right edge area
        const startY = 10 + Math.random() * 60; // Random Y position within map area
        const endY = 10 + Math.random() * 60;
        
        // Create a unique animation with random properties
        const animationName = `dragonFly-${Date.now()}`;
        const duration = Math.random() * 4 + 6; // 6-10 seconds
        const direction = Math.random() > 0.5 ? 1 : -1;
        
        // Create simplified keyframes for testing
        const keyframes = `
            @keyframes ${animationName} {
                0% { 
                    opacity: 0; 
                    left: ${startX}%;
                    top: ${startY}%;
                    transform: scale(0.8) rotate(${direction * -10}deg);
                }
                25% { 
                    opacity: 0.6; 
                    left: ${startX + (endX - startX) * 0.25}%;
                    top: ${startY + (endY - startY) * 0.25}%;
                    transform: scale(1) rotate(${direction * -5}deg);
                }
                50% { 
                    opacity: 0.8; 
                    left: ${startX + (endX - startX) * 0.5}%;
                    top: ${startY + (endY - startY) * 0.5}%;
                    transform: scale(1.1) rotate(0deg);
                }
                75% { 
                    opacity: 0.6; 
                    left: ${startX + (endX - startX) * 0.75}%;
                    top: ${startY + (endY - startY) * 0.75}%;
                    transform: scale(1) rotate(${direction * 5}deg);
                }
                100% { 
                    opacity: 0; 
                    left: ${endX}%;
                    top: ${endY}%;
                    transform: scale(0.8) rotate(${direction * 10}deg);
                }
            }
        `;

        // Add keyframes to document
        const style = document.createElement('style');
        style.textContent = keyframes;
        document.head.appendChild(style);

        // Apply animation
        randomShadow.style.animation = `${animationName} ${duration}s ease-in-out`;

        console.log(`🐉 Dragon shadow triggered: ${animationName} for ${duration}s`);

        // Clean up after animation
        setTimeout(() => {
            randomShadow.style.animation = '';
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, (duration + 1) * 1000);
    }

    toggle() {
        this.isActive = !this.isActive;
        console.log(`🐉 Dragon shadows ${this.isActive ? 'enabled' : 'disabled'}`);
    }
}

// Initialize dragon shadows - DISABLED
// window.dragonShadows = new DragonShadowController();

console.log('🗺️ Adenai Map modules loaded and ready for initialization');