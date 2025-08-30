// movement-timeline-optimized.js - Ultra-lightweight SVG-based timeline
// Minimal DOM manipulation with pre-calculated timeline data

class OptimizedMovementTimeline {
    constructor() {
        this.timeline = null;
        this.vsuzHData = null;
        this.isVisible = true;
        this.isInitialized = false;
        this.preCalculatedData = null;
        
        // Performance settings
        this.zoomLevel = 1;
        this.panOffset = 0;
        this.baseWidth = 2000;
        
        this.waitForMovementMarkers();
    }

    waitForMovementMarkers() {
        Logger.loading('🕒 Optimized Timeline waiting for movement markers...');
        
        document.addEventListener('movementMarkersLoaded', (e) => {
            Logger.loading('🎯 Movement markers loaded, initializing optimized timeline...');
            this.init();
        });
        
        setTimeout(() => {
            if (!this.isInitialized) {
                Logger.warning('⚠️ Optimized Timeline fallback initialization');
                this.init();
            }
        }, 3000);
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.loadAndProcessData();
            this.createSimpleTimeline();
            this.setupSimpleEventHandlers();
            this.isInitialized = true;
            Logger.loading('📍 Optimized VsuzH Timeline loaded');
        } catch (error) {
            Logger.error('Failed to initialize optimized timeline:', error);
        }
    }

    async loadAndProcessData() {
        try {
            const response = await fetch('public/data/characters.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.vsuzHData = data.characters.find(char => char.id === 'vsuzh');
            
            if (!this.vsuzHData || !this.vsuzHData.movementHistory) {
                throw new Error('No VsuzH movement data found');
            }

            // Pre-calculate everything once
            this.preCalculateTimelineData();
            Logger.success(`📍 Processed ${this.preCalculatedData.events.length} movement events`);
            
        } catch (error) {
            Logger.error('Failed to load VsuzH data:', error);
            throw error;
        }
    }

    preCalculateTimelineData() {
        const movements = this.vsuzHData.movementHistory;
        
        // Parse and sort dates
        const validMovements = movements
            .map(movement => ({
                ...movement,
                parsedDate: this.parseDate(movement.date)
            }))
            .filter(item => item.parsedDate)
            .sort((a, b) => a.parsedDate - b.parsedDate);

        if (validMovements.length === 0) {
            this.preCalculatedData = { events: [], timeScale: [], minDate: null, maxDate: null };
            return;
        }

        // Calculate date range with 1-week buffer
        const minDate = new Date(validMovements[0].parsedDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const maxDate = new Date(validMovements[validMovements.length - 1].parsedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const totalMs = maxDate - minDate;
        const pixelsPerMs = this.baseWidth / totalMs;

        // Pre-calculate event positions
        const events = validMovements.map((movement, index) => ({
            id: movement.id,
            x: Math.round((movement.parsedDate - minDate) * pixelsPerMs),
            y: 60,
            type: movement.type || 'travel',
            location: movement.location || 'Unknown',
            date: movement.date,
            isLatest: index === validMovements.length - 1
        }));

        // Pre-calculate time scale (simplified)
        const timeScale = this.generateSimpleTimeScale(minDate, maxDate, pixelsPerMs);

        this.preCalculatedData = {
            events,
            timeScale,
            minDate,
            maxDate,
            totalWidth: this.baseWidth,
            pixelsPerMs
        };
    }

    generateSimpleTimeScale(minDate, maxDate, pixelsPerMs) {
        const scale = [];
        let currentDate = new Date(minDate);
        
        // Only generate monthly markers for performance
        currentDate.setDate(1);
        
        while (currentDate <= maxDate) {
            const x = Math.round((currentDate - minDate) * pixelsPerMs);
            scale.push({
                x,
                label: `${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`,
                type: 'month'
            });
            
            currentDate.setMonth(currentDate.getMonth() + 1, 1);
        }
        
        return scale;
    }

    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = dateString.split('-').map(Number);
                const date = new Date();
                date.setFullYear(year, month - 1, day);
                date.setHours(0, 0, 0, 0);
                return date;
            }
            
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            return null;
        }
    }

    createSimpleTimeline() {
        this.timeline = document.createElement('div');
        this.timeline.id = 'optimized-timeline';
        this.timeline.className = 'optimized-timeline';
        
        this.timeline.innerHTML = `
            <div class="timeline-header">
                <h3>VsuzH Journey</h3>
                <button class="timeline-toggle" id="opt-timeline-toggle">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div class="timeline-content">
                <div class="timeline-viewport">
                    <canvas id="timeline-canvas" width="${this.preCalculatedData.totalWidth}" height="100"></canvas>
                </div>
                <div class="timeline-controls">
                    <button id="opt-zoom-out">-</button>
                    <button id="opt-zoom-in">+</button>
                    <button id="opt-reset">Reset</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.timeline);
        this.addOptimizedStyles();
        this.renderCanvasTimeline();
    }

    renderCanvasTimeline() {
        const canvas = this.timeline.querySelector('#timeline-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw timeline base line
        ctx.strokeStyle = '#8b5a3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 60);
        ctx.lineTo(canvas.width, 60);
        ctx.stroke();
        
        // Draw time scale
        ctx.fillStyle = '#8b5a3c';
        ctx.font = '10px sans-serif';
        this.preCalculatedData.timeScale.forEach(marker => {
            // Scale line
            ctx.beginPath();
            ctx.moveTo(marker.x, 50);
            ctx.lineTo(marker.x, 70);
            ctx.stroke();
            
            // Label
            ctx.fillText(marker.label, marker.x - 15, 45);
        });
        
        // Draw events
        this.preCalculatedData.events.forEach(event => {
            const color = this.getEventColor(event.type);
            
            // Event marker
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(event.x, event.y, event.isLatest ? 8 : 6, 0, 2 * Math.PI);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    getEventColor(type) {
        const colors = {
            travel: '#0284c7',
            stay: '#059669',
            mission: '#dc2626',
            combat: '#991b1b',
            diplomacy: '#7c3aed'
        };
        return colors[type] || '#8b5a3c';
    }

    setupSimpleEventHandlers() {
        const toggle = this.timeline.querySelector('#opt-timeline-toggle');
        const zoomIn = this.timeline.querySelector('#opt-zoom-in');
        const zoomOut = this.timeline.querySelector('#opt-zoom-out');
        const reset = this.timeline.querySelector('#opt-reset');
        
        toggle.addEventListener('click', () => {
            this.timeline.classList.toggle('collapsed');
        });
        
        // Simple zoom without heavy re-rendering
        zoomIn.addEventListener('click', () => {
            const canvas = this.timeline.querySelector('#timeline-canvas');
            canvas.style.transform = `scaleX(${Math.min(3, this.zoomLevel * 1.2)})`;
            this.zoomLevel = Math.min(3, this.zoomLevel * 1.2);
        });
        
        zoomOut.addEventListener('click', () => {
            const canvas = this.timeline.querySelector('#timeline-canvas');
            canvas.style.transform = `scaleX(${Math.max(0.5, this.zoomLevel * 0.8)})`;
            this.zoomLevel = Math.max(0.5, this.zoomLevel * 0.8);
        });
        
        reset.addEventListener('click', () => {
            const canvas = this.timeline.querySelector('#timeline-canvas');
            canvas.style.transform = 'scaleX(1)';
            this.zoomLevel = 1;
        });
    }

    addOptimizedStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .optimized-timeline {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(255, 255, 255, 0.95);
                border-top: 2px solid #8b5a3c;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                height: 150px;
                transition: transform 0.3s ease;
                font-family: sans-serif;
            }

            .optimized-timeline.collapsed {
                transform: translateY(calc(100% - 40px));
            }

            .optimized-timeline .timeline-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 20px;
                background: #8b5a3c;
                color: white;
                height: 40px;
                box-sizing: border-box;
            }

            .optimized-timeline .timeline-header h3 {
                margin: 0;
                font-size: 1.1em;
            }

            .optimized-timeline .timeline-toggle {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 1.2em;
            }

            .optimized-timeline .timeline-content {
                height: 110px;
                overflow: hidden;
            }

            .optimized-timeline .timeline-viewport {
                height: 100px;
                overflow-x: auto;
                overflow-y: hidden;
                padding: 5px;
            }

            .optimized-timeline #timeline-canvas {
                display: block;
                height: 100px;
                transform-origin: left center;
                transition: transform 0.2s ease;
            }

            .optimized-timeline .timeline-controls {
                position: absolute;
                bottom: 5px;
                right: 10px;
                display: flex;
                gap: 5px;
            }

            .optimized-timeline .timeline-controls button {
                background: #8b5a3c;
                border: 1px solid #d4af37;
                color: white;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 0.9em;
            }

            .optimized-timeline .timeline-controls button:hover {
                background: #d4af37;
                color: #8b5a3c;
            }
        `;
        
        document.head.appendChild(style);
    }

    // Public methods
    show() {
        if (this.timeline) {
            this.timeline.style.display = 'block';
        }
    }

    hide() {
        if (this.timeline) {
            this.timeline.style.display = 'none';
        }
    }

    cleanup() {
        if (this.timeline && this.timeline.parentNode) {
            this.timeline.parentNode.removeChild(this.timeline);
        }
    }
}

// Replace the heavy timeline with the optimized version
if (window.movementTimeline) {
    window.movementTimeline.cleanup();
}

window.optimizedMovementTimeline = new OptimizedMovementTimeline();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedMovementTimeline;
}
