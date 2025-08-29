/**
 * Movement Visibility Control
 * Provides a global toggle for movement paths and markers visibility
 * Acts as an overlay filter on top of character panel selections
 */

class MovementVisibilityControl {
    constructor() {
        this.currentMode = 'default'; // 'default', 'paths-only', 'hidden'
        this.controlElement = null;
        this.isInitialized = false;
        
        // Bind methods
        this.setMode = this.setMode.bind(this);
        this.updateVisibility = this.updateVisibility.bind(this);
        this.onCharacterSelectionChanged = this.onCharacterSelectionChanged.bind(this);
    }

    // Initialize the visibility control
    init() {
        if (this.isInitialized) {
            console.log('🎛️ Movement Visibility Control already initialized');
            return;
        }
        
        console.log('🎛️ Creating Movement Visibility Control...');
        this.createControlElement();
        this.attachEventListeners();
        this.isInitialized = true;
        
        console.log('✅ Movement Visibility Control initialized successfully');
        console.log('🎛️ Control element:', this.controlElement);
    }

    // Create the control element
    createControlElement() {
        console.log('🎛️ Creating control element HTML...');
        
        const controlHtml = `
            <div class="movement-visibility-control">
                <div class="visibility-slider">
                    <div class="slider-track">
                        <div class="slider-thumb" data-mode="default"></div>
                    </div>
                    <div class="slider-options">
                        <div class="slider-option active" data-mode="default" title="Default - Show paths and markers">
                            <span class="option-icon">👁️</span>
                            <span class="option-label">All</span>
                        </div>
                        <div class="slider-option" data-mode="paths-only" title="Paths only - Hide markers">
                            <span class="option-icon">📍</span>
                            <span class="option-label">Paths</span>
                        </div>
                        <div class="slider-option" data-mode="hidden" title="Hidden - Hide paths and markers">
                            <span class="option-icon">🚫</span>
                            <span class="option-label">None</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert into page
        console.log('🎛️ Inserting control into DOM...');
        document.body.insertAdjacentHTML('beforeend', controlHtml);
        this.controlElement = document.querySelector('.movement-visibility-control');
        
        if (this.controlElement) {
            console.log('✅ Control element created successfully');
            console.log('🎛️ Element position:', this.controlElement.getBoundingClientRect());
        } else {
            console.error('❌ Failed to create control element');
        }
    }

    // Attach event listeners
    attachEventListeners() {
        const options = this.controlElement.querySelectorAll('.slider-option');
        
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.setMode(mode);
            });
        });
    }

    // Set the visibility mode
    setMode(mode) {
        if (this.currentMode === mode) return;
        
        this.currentMode = mode;
        this.updateUI();
        this.updateVisibility();
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('movementVisibilityChanged', {
            detail: { mode: this.currentMode }
        }));
    }

    // Update the UI to reflect current mode
    updateUI() {
        const options = this.controlElement.querySelectorAll('.slider-option');
        const thumb = this.controlElement.querySelector('.slider-thumb');
        
        options.forEach(option => {
            option.classList.toggle('active', option.dataset.mode === this.currentMode);
        });

        // Move thumb to current option
        const activeOption = this.controlElement.querySelector(`[data-mode="${this.currentMode}"]`);
        if (activeOption && thumb) {
            const optionRect = activeOption.getBoundingClientRect();
            const containerRect = this.controlElement.querySelector('.slider-options').getBoundingClientRect();
            const offset = optionRect.left - containerRect.left + (optionRect.width / 2) - 8;
            thumb.style.transform = `translateX(${offset}px)`;
        }
    }

    // Update movement visibility based on current mode
    updateVisibility() {
        const movementSystem = window.movementSystem;
        if (!movementSystem) return;

        // Get currently visible character paths and markers
        const visibleCharacters = movementSystem.getVisibleCharacters();
        
        visibleCharacters.forEach(characterId => {
            this.applyVisibilityToCharacter(characterId);
        });
    }

    // Apply visibility rules to a specific character
    applyVisibilityToCharacter(characterId) {
        const movementSystem = window.movementSystem;
        if (!movementSystem) return;

        const pathData = movementSystem.characterPaths?.find(p => p.character?.id === characterId);
        const markerData = movementSystem.markersSystem?.markers?.filter(m => m.characterId === characterId);

        if (!pathData && !markerData) return;

        switch (this.currentMode) {
            case 'default':
                // Show both paths and markers (default behavior)
                this.setCharacterPathVisibility(pathData, true);
                this.setCharacterMarkersVisibility(markerData, true);
                break;
                
            case 'paths-only':
                // Show paths, hide markers
                this.setCharacterPathVisibility(pathData, true);
                this.setCharacterMarkersVisibility(markerData, false);
                break;
                
            case 'hidden':
                // Hide both paths and markers
                this.setCharacterPathVisibility(pathData, false);
                this.setCharacterMarkersVisibility(markerData, false);
                break;
        }
    }

    // Set visibility for character path
    setCharacterPathVisibility(pathData, visible) {
        if (!pathData || !pathData.layer) return;
        
        const map = window.mapCore?.getMap();
        if (!map) return;

        if (visible && pathData.isVisible) {
            // Only show if the character is selected in the character panel
            if (!map.hasLayer(pathData.layer)) {
                pathData.layer.addTo(map);
            }
        } else {
            // Hide regardless of character panel selection
            if (map.hasLayer(pathData.layer)) {
                map.removeLayer(pathData.layer);
            }
        }
    }

    // Set visibility for character markers
    setCharacterMarkersVisibility(markerData, visible) {
        if (!markerData) return;
        
        const map = window.mapCore?.getMap();
        if (!map) return;

        markerData.forEach(markerInfo => {
            if (!markerInfo.marker) return;

            if (visible && markerInfo.isVisible) {
                // Only show if the character is selected in the character panel
                if (!map.hasLayer(markerInfo.marker)) {
                    markerInfo.marker.addTo(map);
                }
            } else {
                // Hide regardless of character panel selection
                if (map.hasLayer(markerInfo.marker)) {
                    map.removeLayer(markerInfo.marker);
                }
            }
        });
    }

    // Get current mode
    getCurrentMode() {
        return this.currentMode;
    }

    // Method called when character selection changes in character panel
    onCharacterSelectionChanged() {
        // Re-apply visibility rules when character selection changes
        this.updateVisibility();
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.MovementVisibilityControl = MovementVisibilityControl;
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎛️ DOM Content Loaded - Attempting to initialize Movement Visibility Control...');
    setTimeout(() => {
        if (!window.movementVisibilityControl) {
            console.log('🎛️ Creating new MovementVisibilityControl instance...');
            try {
                window.movementVisibilityControl = new MovementVisibilityControl();
                window.movementVisibilityControl.init();
                console.log('✅ MovementVisibilityControl created and initialized successfully');
            } catch (error) {
                console.error('❌ Error creating MovementVisibilityControl:', error);
            }
        }
    }, 1000);
});

// Also try to initialize when the map is ready
if (typeof window !== 'undefined') {
    // Immediate test
    console.log('🎛️ Script loaded - MovementVisibilityControl class available');
    
    window.addEventListener('load', () => {
        console.log('🎛️ Window Load Event - Attempting fallback initialization...');
        setTimeout(() => {
            if (!window.movementVisibilityControl) {
                console.log('🎛️ Creating MovementVisibilityControl (fallback)...');
                try {
                    window.movementVisibilityControl = new MovementVisibilityControl();
                    window.movementVisibilityControl.init();
                    console.log('✅ MovementVisibilityControl (fallback) created successfully');
                } catch (error) {
                    console.error('❌ Error in fallback MovementVisibilityControl:', error);
                }
            }
        }, 2000);
    });
}
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other systems to initialize
    setTimeout(() => {
        if (!window.movementVisibilityControl) {
            console.log('🎛️ Initializing Movement Visibility Control...');
            window.movementVisibilityControl = new MovementVisibilityControl();
            window.movementVisibilityControl.init();
        }
    }, 1000);
});

// Also try to initialize when the map is ready
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (!window.movementVisibilityControl) {
                console.log('🎛️ Initializing Movement Visibility Control (fallback)...');
                window.movementVisibilityControl = new MovementVisibilityControl();
                window.movementVisibilityControl.init();
            }
        }, 2000);
    });
}
