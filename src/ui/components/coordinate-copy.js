// Map Coordinate Copy System - Click+Hold+C to copy coordinates
class CoordinateCopySystem {
    constructor() {
        this.isHolding = false;
        this.holdStartTime = null;
        this.currentCoordinates = null;
        this.holdThreshold = 300; // Hold for 300ms before activating
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

            // Add styles
            this.addStyles();
        }, () => {
            Logger.warning('Could not setup coordinate copy - map not available');
        });
    }

    startHold(e) {
        this.isHolding = false; // Not yet holding, just started
        this.holdStartTime = Date.now();
        this.updateCoordinates(e);

        // Start hold timer
        this.holdTimer = setTimeout(() => {
            this.isHolding = true;
            this.showHoldIndicator(e);
            Logger.info('Hold activated - press C to copy coordinates:', this.currentCoordinates);
        }, this.holdThreshold);
    }

    endHold() {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        
        this.isHolding = false;
        this.holdStartTime = null;
        this.hideHoldIndicator();
    }

    handleMouseMove(e) {
        this.updateCoordinates(e);
        
        // Update indicator position if it's showing
        if (this.isHolding && this.holdIndicator) {
            this.updateIndicatorPosition(e);
        }
    }

    updateCoordinates(e) {
        // Convert Leaflet latlng to map coordinates
        const latlng = e.latlng;
        
        // For your coordinate system: lat = y, lng = x
        const x = Math.round(latlng.lng);
        const y = Math.round(latlng.lat);
        
        this.currentCoordinates = [x, y];
        
        // Update indicator content if showing
        if (this.isHolding && this.holdIndicator) {
            const content = this.holdIndicator.querySelector('.hold-content');
            if (content) {
                content.innerHTML = `${this.currentCoordinates[0]} ${this.currentCoordinates[1]}`;
            }
        }
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

    fallbackCopyToClipboard(text) {
        // Create temporary textarea
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showSuccessNotification(text);
        } catch (err) {
            Logger.error('Fallback copy failed:', err);
            this.showErrorNotification();
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showHoldIndicator(e) {
        // Create visual indicator
        this.holdIndicator = document.createElement('div');
        this.holdIndicator.className = 'coordinate-hold-indicator';
        this.holdIndicator.innerHTML = `
            <div class="hold-content">
                ${this.currentCoordinates[0]} ${this.currentCoordinates[1]}
                <div class="hold-instruction">Press <kbd>C</kbd> to copy</div>
            </div>
        `;

        document.body.appendChild(this.holdIndicator);

        // Initial positioning
        this.updateIndicatorPosition(e);
    }

    updateIndicatorPosition(e) {
        if (!this.holdIndicator) return;

        // Position near cursor with offset
        if (e.originalEvent) {
            const clientX = e.originalEvent.clientX || (e.originalEvent.touches && e.originalEvent.touches[0].clientX);
            const clientY = e.originalEvent.clientY || (e.originalEvent.touches && e.originalEvent.touches[0].clientY);
            
            if (clientX && clientY) {
                // Position with offset to not block cursor
                this.holdIndicator.style.left = `${clientX + 15}px`;
                this.holdIndicator.style.top = `${clientY - 50}px`;
            }
        }
    }

    hideHoldIndicator() {
        if (this.holdIndicator) {
            this.holdIndicator.remove();
            this.holdIndicator = null;
        }
    }

    showSuccessNotification(coordinates) {
        NotificationUtils.showCopySuccess(coordinates);
    }

    showErrorNotification() {
        NotificationUtils.showCopyError();
    }

    showNotification(message, type = 'info') {
        // Try to use existing notification system
        if (window.adminUI && typeof window.adminUI.showToast === 'function') {
            window.adminUI.showToast(message, type);
            return;
        }

        // Fallback notification
        const notification = document.createElement('div');
        notification.className = `coordinate-notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideInFromRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    addStyles() {
        if (document.getElementById('coordinate-copy-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'coordinate-copy-styles';
        styles.textContent = `
            .coordinate-hold-indicator {
                position: fixed;
                background: rgba(128, 128, 128, 0.6);
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                z-index: 10000;
                pointer-events: none;
                border: 2px solid rgba(64, 64, 64, 0.8);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                user-select: none;
                backdrop-filter: blur(2px);
                transition: all 0.1s ease;
            }

            .hold-content {
                text-align: center;
            }

            .hold-instruction {
                font-size: 11px;
                margin-top: 4px;
                color: #ddd;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .hold-instruction kbd {
                background: rgba(51, 51, 51, 0.8);
                border: 1px solid rgba(85, 85, 85, 0.8);
                border-radius: 3px;
                padding: 1px 4px;
                font-size: 10px;
                color: #fff;
            }

            @keyframes slideInFromRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            .coordinate-notification {
                animation: slideInFromRight 0.3s ease;
            }

            /* Prevent text selection during hold */
            .leaflet-container.coordinate-holding {
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
        `;
        
        document.head.appendChild(styles);
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
    Logger.info('2. Wait 300ms for the indicator to appear');
    Logger.info('3. Press "C" to copy coordinates to clipboard');
    Logger.info('4. Press "Escape" to cancel');
    Logger.info('');
    Logger.info('💡 Works on both desktop and mobile!');
    Logger.info('🎯 Coordinates are formatted as [x, y]');
};

Logger.success('Coordinate Copy System loaded!');
Logger.info('Usage: Click+Hold on map, then press C to copy coordinates');
Logger.info('❓ Run showCoordinateHelp() for detailed instructions');