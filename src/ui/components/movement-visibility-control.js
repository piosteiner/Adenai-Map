/**
 * Simple Movement Visibility Control
 * A working 3-mode toggle for movement paths and markers
 */

class MovementVisibilityControl {
    constructor() {
        this.currentMode = 'default';
        this.controlElement = null;
    }

    init() {
        console.log('🎛️ Initializing Movement Visibility Control...');
        this.createControl();
        this.attachEvents();
        console.log('✅ Movement Visibility Control ready');
    }

    createControl() {
        // Remove any existing control
        const existing = document.querySelector('.movement-visibility-control');
        if (existing) existing.remove();

        // Create the control HTML
        const controlHTML = `
            <div class="movement-visibility-control">
                <div class="visibility-slider">
                    <button class="slider-option active" data-mode="default" title="Show all">
                        <span class="option-icon">👁️</span>
                        <span class="option-label">All</span>
                    </button>
                    <button class="slider-option" data-mode="paths-only" title="Paths only">
                        <span class="option-icon">🛤️</span>
                        <span class="option-label">Paths</span>
                    </button>
                    <button class="slider-option" data-mode="hidden" title="Hide all">
                        <span class="option-icon">❌</span>
                        <span class="option-label">None</span>
                    </button>
                </div>
            </div>
        `;

        // Add to page
        document.body.insertAdjacentHTML('beforeend', controlHTML);
        this.controlElement = document.querySelector('.movement-visibility-control');
    }

    attachEvents() {
        if (!this.controlElement) return;

        const buttons = this.controlElement.querySelectorAll('.slider-option');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.setMode(mode);
            });
        });
    }

    setMode(mode) {
        console.log('🎛️ Setting mode:', mode);
        this.currentMode = mode;

        // Update UI
        this.controlElement.querySelectorAll('.slider-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Apply visibility changes
        this.updateVisibility();

        // Notify other systems
        window.dispatchEvent(new CustomEvent('movementVisibilityChanged', {
            detail: { mode }
        }));
    }

    updateVisibility() {
        console.log('🎛️ Updating visibility for mode:', this.currentMode);
        
        // Get movement system
        const movementSystem = window.movementSystem;
        if (!movementSystem) {
            console.log('🎛️ No movement system found');
            return;
        }

        // Apply visibility to all character movements
        const visibleCharacters = this.getVisibleCharacters();
        console.log('🎛️ Visible characters:', visibleCharacters);
        
        visibleCharacters.forEach(characterId => {
            this.applyVisibilityToCharacter(characterId);
        });
    }

    getVisibleCharacters() {
        // Try to get from movement system
        if (window.movementSystem && window.movementSystem.getVisibleCharacters) {
            return window.movementSystem.getVisibleCharacters();
        }
        
        // Fallback: check character panel directly
        const characterPanel = window.characterPanel;
        if (characterPanel && characterPanel.selectedCharacters) {
            return Array.from(characterPanel.selectedCharacters);
        }
        
        return [];
    }

    applyVisibilityToCharacter(characterId) {
        const map = window.mapCore?.getMap();
        if (!map) return;

        switch (this.currentMode) {
            case 'default':
                this.setCharacterMovementVisibility(characterId, true, true);
                break;
            case 'paths-only':
                this.setCharacterMovementVisibility(characterId, true, false);
                break;
            case 'hidden':
                this.setCharacterMovementVisibility(characterId, false, false);
                break;
        }
    }

    setCharacterMovementVisibility(characterId, showPaths, showMarkers) {
        const map = window.mapCore?.getMap();
        if (!map) return;

        // Handle paths
        if (window.movementSystem && window.movementSystem.characterPaths) {
            const pathData = window.movementSystem.characterPaths.find(p => p.character?.id === characterId);
            if (pathData && pathData.layer) {
                if (showPaths && pathData.isVisible) {
                    if (!map.hasLayer(pathData.layer)) {
                        pathData.layer.addTo(map);
                    }
                } else {
                    if (map.hasLayer(pathData.layer)) {
                        map.removeLayer(pathData.layer);
                    }
                }
            }
        }

        // Handle markers
        if (window.movementSystem && window.movementSystem.markersSystem) {
            const markers = window.movementSystem.markersSystem.markers?.filter(m => m.characterId === characterId);
            if (markers) {
                markers.forEach(markerInfo => {
                    if (markerInfo.marker) {
                        if (showMarkers && markerInfo.isVisible) {
                            if (!map.hasLayer(markerInfo.marker)) {
                                markerInfo.marker.addTo(map);
                            }
                        } else {
                            if (map.hasLayer(markerInfo.marker)) {
                                map.removeLayer(markerInfo.marker);
                            }
                        }
                    }
                });
            }
        }
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
                    <div class="slider-option active" data-mode="default" title="Show paths and markers">
                        <div class="option-icon">👁️</div>
                        <div class="option-label">All</div>
                    </div>
                    <div class="slider-option" data-mode="paths-only" title="Show paths only">
                        <div class="option-icon">�️</div>
                        <div class="option-label">Paths</div>
                    </div>
                    <div class="slider-option" data-mode="hidden" title="Hide all">
                        <div class="option-icon">❌</div>
                        <div class="option-label">None</div>
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎛️ DOM ready - initializing Movement Visibility Control...');
    
    // Wait a bit for other systems to load
    setTimeout(() => {
        if (!window.movementVisibilityControl) {
            window.movementVisibilityControl = new MovementVisibilityControl();
            window.movementVisibilityControl.init();
        }
    }, 1000);
});

// Export for global access
if (typeof window !== 'undefined') {
    window.MovementVisibilityControl = MovementVisibilityControl;
}
