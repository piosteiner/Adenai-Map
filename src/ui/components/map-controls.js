// map-controls.js - Handle main map control buttons
class MapControls {
    constructor() {
        this.markersToggleBtn = null;
        this.mapControlsContainer = null;
        this.characterPanel = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupControls());
        } else {
            this.setupControls();
        }

        // Listen for movement system to be ready
        document.addEventListener('adenaiMapReady', () => {
            this.updateButtonStates();
        });

        // Listen for window resize to update positioning
        window.addEventListener('resize', () => this.updatePosition());
    }

    setupControls() {
        this.markersToggleBtn = document.getElementById('toggle-movement-markers');
        this.mapControlsContainer = document.getElementById('map-controls');
        this.characterPanel = document.getElementById('character-panel');
        
        if (!this.markersToggleBtn || !this.mapControlsContainer) {
            Logger.warning('Movement markers toggle button or container not found');
            return;
        }

        // Set initial state (markers are visible by default)
        this.markersToggleBtn.classList.add('active');
        
        // Add click handler
        this.markersToggleBtn.addEventListener('click', () => {
            this.toggleMovementMarkers();
        });

        // Set up position tracking
        this.setupPositionTracking();

        // Initial position update
        this.updatePosition();

        // Add keyboard shortcut (M key)
        document.addEventListener('keydown', (e) => {
            // Only trigger if not typing in an input field
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    this.toggleMovementMarkers();
                    
                    // Show brief feedback
                    this.showKeyboardShortcutFeedback();
                }
            }
        });

        Logger.success('✅ Map controls initialized');
    }

    setupPositionTracking() {
        if (!this.characterPanel) return;

        // Watch for panel width changes (from resizing)
        const resizeObserver = new ResizeObserver(() => {
            this.updatePosition();
        });
        
        resizeObserver.observe(this.characterPanel);

        // Also listen for panel state changes if character panel has events
        document.addEventListener('characterPanelResized', () => {
            this.updatePosition();
        });
    }

    updatePosition() {
        if (!this.mapControlsContainer || !this.characterPanel) return;

        // Get the panel width and position the controls to the left of it
        const panelWidth = this.characterPanel.offsetWidth;
        const panelIsVisible = this.characterPanel.offsetWidth > 50; // Panel is expanded
        
        if (panelIsVisible) {
            // Position just to the left of the panel with some spacing
            this.mapControlsContainer.style.right = `${panelWidth + 15}px`;
        } else {
            // Panel is collapsed, position close to the edge
            this.mapControlsContainer.style.right = `${panelWidth + 5}px`;
        }
    }

    showKeyboardShortcutFeedback() {
        // Create a brief visual feedback for keyboard shortcut
        const feedback = document.createElement('div');
        feedback.textContent = `Markers ${window.movementSystem?.areMarkersVisible() ? 'shown' : 'hidden'} (M)`;
        
        // Position relative to the controls container
        const controlsRect = this.mapControlsContainer.getBoundingClientRect();
        
        feedback.style.cssText = `
            position: fixed;
            top: ${controlsRect.bottom + 10}px;
            right: ${window.innerWidth - controlsRect.right}px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 2000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            white-space: nowrap;
        `;
        
        document.body.appendChild(feedback);
        
        // Animate in
        requestAnimationFrame(() => {
            feedback.style.opacity = '1';
        });
        
        // Remove after delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 1500);
    }

    toggleMovementMarkers() {
        if (!window.movementSystem) {
            Logger.warning('Movement system not available');
            return;
        }

        // Toggle markers in the movement system
        const markersVisible = window.movementSystem.toggleAllMovementMarkers();
        
        // Update button appearance
        if (markersVisible) {
            this.markersToggleBtn.classList.add('active');
            this.markersToggleBtn.title = 'Hide Movement Markers';
            Logger.info('🟢 Movement markers shown');
        } else {
            this.markersToggleBtn.classList.remove('active');
            this.markersToggleBtn.title = 'Show Movement Markers';
            Logger.info('🔴 Movement markers hidden');
        }
    }

    updateButtonStates() {
        if (!this.markersToggleBtn || !window.movementSystem) {
            return;
        }

        // Sync button state with movement system
        const markersVisible = window.movementSystem.areMarkersVisible();
        
        if (markersVisible) {
            this.markersToggleBtn.classList.add('active');
            this.markersToggleBtn.title = 'Hide Movement Markers';
        } else {
            this.markersToggleBtn.classList.remove('active');
            this.markersToggleBtn.title = 'Show Movement Markers';
        }
    }

    // Public methods for external control
    showMarkers() {
        if (window.movementSystem && !window.movementSystem.areMarkersVisible()) {
            this.toggleMovementMarkers();
        }
    }

    hideMarkers() {
        if (window.movementSystem && window.movementSystem.areMarkersVisible()) {
            this.toggleMovementMarkers();
        }
    }

    areMarkersVisible() {
        return window.movementSystem?.areMarkersVisible() || false;
    }
}

// Initialize map controls
const mapControls = new MapControls();

// Make it globally available
window.mapControls = mapControls;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapControls;
}

Logger.loading('🎮 Map controls loaded');
