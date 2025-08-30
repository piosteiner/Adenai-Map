// Map Coordinate Copy System - Click+Hold+C to copy coordinates
class CoordinateCopySystem {
    constructor() {
        this.isHolding = false;
        this.holdStartTime = null;
        this.currentCoordinates = null;
        this.holdThreshold = 0; // No delay - immediate activation
        this.holdIndicator = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        // Wait for map to be ready
        MapUtils.withMap(() => {
            this.setupMapListeners();
        });
        
        // Also listen for the map ready event as backup
        document.addEventListener('adenaiMapReady', () => {
            if (!this.isInitialized) {
                this.setupMapListeners();
            }
        });

        // Try to initialize immediately if map is already available
        setTimeout(() => {
            if (!this.isInitialized && window.mapCore?.getMap?.()) {
                this.setupMapListeners();
            }
        }, 1000);
    }

    setupMapListeners() {
        // Prevent double initialization
        if (this.isInitialized) {
            Logger.info('Coordinate copy system already initialized');
            return;
        }

        const map = MapUtils.getMap();
        if (!map || typeof map.on !== 'function') {
            Logger.warning('Could not setup coordinate copy - map not available');
            return;
        }

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

        this.isInitialized = true;
        Logger.success('✅ Coordinate copy system initialized successfully');
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
        
        // Format coordinates as "x y" (space-separated)
        const coordString = `${this.currentCoordinates[0]} ${this.currentCoordinates[1]}`;
        
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(coordString);
                Logger.success('Copied coordinates:', coordString);
                
                // Show notification using the notification system
                if (typeof NotificationUtils !== 'undefined' && NotificationUtils.showCopySuccess) {
                    NotificationUtils.showCopySuccess(coordString);
                } else {
                    // Fallback notification
                    this.showSimpleNotification(`Coordinates copied: ${coordString}`);
                }
                
                this.endHold();
                return true;
            } else {
                // Fallback for older browsers
                return this.fallbackCopyToClipboard(coordString);
            }
        } catch (error) {
            Logger.error('Failed to copy coordinates:', error);
            this.showSimpleNotification('Failed to copy coordinates');
            return false;
        }
    }

    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                Logger.success('Copied coordinates (fallback):', text);
                this.showSimpleNotification(`Coordinates copied: ${text}`);
                this.endHold();
                return true;
            } else {
                throw new Error('Fallback copy failed');
            }
        } catch (error) {
            Logger.error('Fallback copy failed:', error);
            this.showSimpleNotification('Failed to copy coordinates');
            return false;
        }
    }

    showSimpleNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(139, 90, 60, 0.95);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(212, 175, 55, 0.3);
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 2 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
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