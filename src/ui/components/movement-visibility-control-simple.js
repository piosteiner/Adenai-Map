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
        // Simple implementation - just log for now
        console.log('🎛️ Updating visibility for mode:', this.currentMode);
        
        // TODO: Integrate with actual movement system
        // For now, this provides a working UI that can be connected later
    }

    getCurrentMode() {
        return this.currentMode;
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.movementVisibilityControl) {
            window.movementVisibilityControl = new MovementVisibilityControl();
            window.movementVisibilityControl.init();
        }
    }, 500);
});

// Export
if (typeof window !== 'undefined') {
    window.MovementVisibilityControl = MovementVisibilityControl;
}
