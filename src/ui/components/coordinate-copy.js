// Map Coordinate Copy System - Click+Hold+C to copy coordinates
class CoordinateCopySystem {
    constructor() {
        this.isHolding = false;
        this.holdStartTime = null;
        this.currentCoordinates = null;
        this.holdThreshold = 0; // No delay - immediate activation
        this.holdIndicator = null;
        this.init();
    }

    init() {
        // Wait for map to be ready
        MapUtils.withMap(() => {
            this.setupMapListeners();
        }, () => {
            // Wait for map initialization
            document.addEventListener('adenaiMapReady', () => {
                this.setupMapListeners();
            });
        });
    }

    setupMapListeners() {
        MapUtils.withMap((map) => {
            Logger.info('Setting up coordinate copy system (Click+Hold+C)');

            // Mouse events
            map.on('mousedown', (e) => this.startHold(e));
            map.on('mouseup', () => this.endHold());
            map.on('mousemove', (e) => this.handleMouseMove(e));

            // Touch events for mobile
            map.on('touchstart', (e) => this.startHold(e));
            map.on('touchend', () => this.endHold());
            map.on('touchmove', (e) => this.handleMouseMove(e));

            // Keyboard listener
            document.addEventListener('keydown', (e) => this.handleKeyPress(e));

            // Cleanup on mouse leave
            map.on('mouseout', () => this.endHold());

        }, () => {
            Logger.warning('Could not setup coordinate copy - map not available');
        });
    }

    startHold(e) {
        this.isHolding = true; // Immediate activation
        this.holdStartTime = Date.now();
        this.updateCoordinates(e);

        // No visual indicator - just activate immediately
        Logger.info('Hold activated - press C to copy coordinates:', this.currentCoordinates);
    }

    endHold() {
        this.isHolding = false;
        this.holdStartTime = null;
        // No visual indicator to hide
    }

    handleMouseMove(e) {
        this.updateCoordinates(e);
        // No visual indicator to update
    }

    updateCoordinates(e) {
        // Convert Leaflet latlng to map coordinates
        const latlng = e.latlng;
        
        // For your coordinate system: lng = x, lat = y (standard mapping)
        const x = Math.round(latlng.lng);
        const y = Math.round(latlng.lat);
        
        this.currentCoordinates = [x, y];
        // No visual indicator to update
    }

    handleKeyPress(e) {
        // Check if we're holding and user pressed C
        if (this.isHolding && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this.copyCoordinates();
        }
        
        // Escape to cancel hold
        if (e.key === 'Escape') {
            this.endHold();
        }
    }

    async copyCoordinates() {
        if (!this.currentCoordinates) return;
        
        const success = await CoordinateUtils.copyToClipboard(this.currentCoordinates);
        if (success) {
            this.endHold();
        }
    }

    // Public methods for external control
    disable() {
        this.endHold();
        Logger.info('Coordinate copy system disabled');
    }

    enable() {
        Logger.info('Coordinate copy system enabled');
    }
}

// Initialize the coordinate copy system
const coordinateCopySystem = new CoordinateCopySystem();

// Make it globally available
window.coordinateCopySystem = coordinateCopySystem;

// Add help command
window.showCoordinateHelp = function() {
    Logger.info('📍 COORDINATE COPY SYSTEM HELP');
    Logger.info('==============================');
    Logger.info('1. Click and hold anywhere on the map');
    Logger.info('2. Press "C" to copy coordinates to clipboard');
    Logger.info('3. Press "Escape" to cancel');
    Logger.info('');
    Logger.info('💡 Works on both desktop and mobile!');
    Logger.info('🎯 Coordinates are formatted as "x y" (space-separated)');
    Logger.info('📋 Notification appears in top-right corner');
};

Logger.success('Coordinate Copy System loaded!');
Logger.info('Usage: Click+Hold on map, then press C to copy coordinates');
Logger.info('❓ Run showCoordinateHelp() for detailed instructions');