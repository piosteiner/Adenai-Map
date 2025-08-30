// movement-timeline.js - VsuzH Movement Timeline Component
// Displays a horizontal timeline of VsuzH's movement history at the bottom of the screen

class MovementTimeline {
    constructor() {
        this.timeline = null;
        this.vsuzHData = null;
        this.isVisible = true;
        this.init();
    }

    async init() {
        try {
            await this.loadVsuzHData();
            this.createTimelineElement();
            this.renderTimeline();
            this.setupEventHandlers();
            Logger.loading('📍 VsuzH Movement Timeline loaded');
        } catch (error) {
            Logger.error('Failed to initialize movement timeline:', error);
        }
    }

    async loadVsuzHData() {
        try {
            const response = await fetch('public/data/characters.json');
            const data = await response.json();
            this.vsuzHData = data.characters.find(char => char.id === 'vsuzh');
            
            if (!this.vsuzHData) {
                throw new Error('VsuzH character not found');
            }
            
            // Sort movement history by date and movement_nr
            this.vsuzHData.movementHistory.sort((a, b) => {
                if (a.movement_nr !== undefined && b.movement_nr !== undefined) {
                    return a.movement_nr - b.movement_nr;
                }
                return new Date(a.date) - new Date(b.date);
            });
            
        } catch (error) {
            Logger.error('Failed to load VsuzH data:', error);
            throw error;
        }
    }

    createTimelineElement() {
        this.timeline = document.createElement('div');
        this.timeline.id = 'movement-timeline';
        this.timeline.className = 'movement-timeline';
        
        this.timeline.innerHTML = `
            <div class="timeline-header">
                <h3>VsuzH Journey Timeline</h3>
                <button class="timeline-toggle" id="timeline-toggle">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div class="timeline-content" id="timeline-content">
                <div class="timeline-track" id="timeline-track">
                    <!-- Timeline items will be populated here -->
                </div>
            </div>
        `;
        
        document.body.appendChild(this.timeline);
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .movement-timeline {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(255, 255, 255, 0.95);
                border-top: 3px solid #6366f1;
                box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                backdrop-filter: blur(5px);
                transition: transform 0.3s ease;
            }

            .movement-timeline.collapsed {
                transform: translateY(calc(100% - 50px));
            }

            .timeline-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 20px;
                background: rgba(99, 102, 241, 0.1);
                border-bottom: 1px solid rgba(99, 102, 241, 0.2);
            }

            .timeline-header h3 {
                margin: 0;
                font-size: 1.1em;
                font-weight: 600;
                color: #6366f1;
                letter-spacing: 0.5px;
            }

            .timeline-toggle {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            }

            .timeline-toggle:hover {
                background: rgba(99, 102, 241, 0.1);
            }

            .toggle-icon {
                display: inline-block;
                font-size: 0.9em;
                color: #6366f1;
                transition: transform 0.3s ease;
            }

            .movement-timeline.collapsed .toggle-icon {
                transform: rotate(180deg);
            }

            .timeline-content {
                max-height: 200px;
                overflow-y: auto;
                overflow-x: hidden;
                transition: max-height 0.3s ease, opacity 0.3s ease;
            }

            .movement-timeline.collapsed .timeline-content {
                max-height: 0;
                opacity: 0;
            }

            .timeline-track {
                display: flex;
                flex-direction: row;
                padding: 20px;
                gap: 15px;
                overflow-x: auto;
                min-height: 120px;
                align-items: flex-end;
            }

            .timeline-item {
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 120px;
                cursor: pointer;
                transition: transform 0.2s ease;
                position: relative;
            }

            .timeline-item:hover {
                transform: translateY(-3px);
            }

            .timeline-marker {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                border: 3px solid #6366f1;
                background: white;
                margin-bottom: 8px;
                position: relative;
                z-index: 2;
            }

            .timeline-item.current .timeline-marker {
                background: #6366f1;
                box-shadow: 0 0 8px rgba(99, 102, 241, 0.5);
            }

            .timeline-item.mission .timeline-marker {
                border-color: #ef4444;
                background: #ef4444;
            }

            .timeline-item.stay .timeline-marker {
                border-color: #10b981;
            }

            .timeline-item.travel .timeline-marker {
                border-color: #f59e0b;
            }

            .timeline-connector {
                position: absolute;
                top: 8px;
                left: 50%;
                width: calc(100% + 15px);
                height: 2px;
                background: #d1d5db;
                z-index: 1;
            }

            .timeline-item:last-child .timeline-connector {
                display: none;
            }

            .timeline-info {
                text-align: center;
                font-size: 0.8em;
            }

            .timeline-location {
                font-weight: 600;
                color: #374151;
                margin-bottom: 2px;
                word-wrap: break-word;
                max-width: 100px;
            }

            .timeline-date {
                color: #6b7280;
                font-size: 0.75em;
            }

            .timeline-type {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.7em;
                font-weight: 500;
                margin-top: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .timeline-type.mission {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }

            .timeline-type.stay {
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
            }

            .timeline-type.travel {
                background: rgba(245, 158, 11, 0.1);
                color: #f59e0b;
            }

            /* Dark mode support */
            [data-theme="dark"] .movement-timeline {
                background: rgba(31, 41, 55, 0.95);
                border-top-color: #818cf8;
            }

            [data-theme="dark"] .timeline-header {
                background: rgba(129, 140, 248, 0.1);
                border-bottom-color: rgba(129, 140, 248, 0.2);
            }

            [data-theme="dark"] .timeline-header h3 {
                color: #818cf8;
            }

            [data-theme="dark"] .timeline-toggle:hover {
                background: rgba(129, 140, 248, 0.1);
            }

            [data-theme="dark"] .toggle-icon {
                color: #818cf8;
            }

            [data-theme="dark"] .timeline-marker {
                border-color: #818cf8;
                background: #1f2937;
            }

            [data-theme="dark"] .timeline-item.current .timeline-marker {
                background: #818cf8;
            }

            [data-theme="dark"] .timeline-location {
                color: #f3f4f6;
            }

            [data-theme="dark"] .timeline-date {
                color: #9ca3af;
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .timeline-header {
                    padding: 10px 15px;
                }
                
                .timeline-header h3 {
                    font-size: 1em;
                }
                
                .timeline-track {
                    padding: 15px;
                }
                
                .timeline-item {
                    min-width: 100px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    renderTimeline() {
        const track = this.timeline.querySelector('#timeline-track');
        track.innerHTML = '';

        if (!this.vsuzHData.movementHistory || this.vsuzHData.movementHistory.length === 0) {
            track.innerHTML = '<div class="timeline-empty">No movement history available</div>';
            return;
        }

        this.vsuzHData.movementHistory.forEach((movement, index) => {
            const item = this.createTimelineItem(movement, index);
            track.appendChild(item);
        });
    }

    createTimelineItem(movement, index) {
        const isLatest = index === this.vsuzHData.movementHistory.length - 1;
        const item = document.createElement('div');
        item.className = `timeline-item ${movement.type || 'travel'} ${isLatest ? 'current' : ''}`;
        item.dataset.movementId = movement.id;

        item.innerHTML = `
            ${index < this.vsuzHData.movementHistory.length - 1 ? '<div class="timeline-connector"></div>' : ''}
            <div class="timeline-marker"></div>
            <div class="timeline-info">
                <div class="timeline-location">${movement.location || 'Unknown'}</div>
                <div class="timeline-date">${this.formatDate(movement.date)}</div>
                <div class="timeline-type ${movement.type || 'travel'}">${movement.type || 'travel'}</div>
            </div>
        `;

        // Add click handler to center map on location
        item.addEventListener('click', () => {
            this.handleTimelineItemClick(movement);
        });

        return item;
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            // Handle fantasy dates that might not parse correctly
            if (dateString.includes('-')) {
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
            }
            return dateString;
        } catch (error) {
            return dateString;
        }
    }

    handleTimelineItemClick(movement) {
        if (movement.coordinates && window.map) {
            // Center map on the movement location
            const [x, y] = movement.coordinates;
            const latLng = window.map.unproject([x, y], window.map.getMaxZoom());
            window.map.setView(latLng, Math.max(window.map.getZoom(), 3));
            
            Logger.debug('📍 Timeline: Centered map on', movement.location);
        }
    }

    setupEventHandlers() {
        const toggleButton = this.timeline.querySelector('#timeline-toggle');
        toggleButton.addEventListener('click', () => {
            this.toggleTimeline();
        });

        // Auto-collapse when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.timeline.contains(e.target) && this.isVisible) {
                // Don't auto-collapse for now, let user control it
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.collapseTimeline();
            }
        });
    }

    toggleTimeline() {
        if (this.timeline.classList.contains('collapsed')) {
            this.expandTimeline();
        } else {
            this.collapseTimeline();
        }
    }

    expandTimeline() {
        this.timeline.classList.remove('collapsed');
        this.isVisible = true;
        Logger.debug('📍 Timeline expanded');
    }

    collapseTimeline() {
        this.timeline.classList.add('collapsed');
        this.isVisible = false;
        Logger.debug('📍 Timeline collapsed');
    }

    // Public methods for external control
    show() {
        this.timeline.style.display = 'block';
        this.expandTimeline();
    }

    hide() {
        this.timeline.style.display = 'none';
    }

    refresh() {
        this.loadVsuzHData().then(() => {
            this.renderTimeline();
        }).catch(error => {
            Logger.error('Failed to refresh timeline:', error);
        });
    }

    // Cleanup method
    cleanup() {
        if (this.timeline && this.timeline.parentNode) {
            this.timeline.parentNode.removeChild(this.timeline);
        }
        Logger.cleanup('Movement timeline cleaned up');
    }
}

// Create global instance
window.movementTimeline = new MovementTimeline();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (window.movementTimeline) {
            window.movementTimeline.cleanup();
        }
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementTimeline;
}
