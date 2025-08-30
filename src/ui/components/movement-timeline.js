// movement-timeline.js - VsuzH Movement Timeline Component
// Displays a horizontal timeline of VsuzH's movement history at the bottom of the screen

class MovementTimeline {
    constructor() {
        this.timeline = null;
        this.vsuzHData = null;
        this.isVisible = true;
        this.timelineElements = null; // Cache DOM elements
        this.eventElements = []; // Cache event elements
        this.scaleElements = []; // Cache scale elements
        this.renderScheduled = false; // Prevent multiple renders
        this.isInitialized = false; // Track initialization state
        
        // Wait for movement markers to be loaded before initializing
        this.waitForMovementMarkers();
    }

    waitForMovementMarkers() {
        Logger.loading('🕒 Timeline waiting for movement markers to load...');
        
        // Listen for movement markers loaded event
        document.addEventListener('movementMarkersLoaded', (e) => {
            Logger.loading('🎯 Movement markers loaded, initializing timeline...');
            Logger.loading(`📊 Found ${e.detail.markersCount} movement markers`);
            this.init();
        });
        
        // Fallback: Initialize after a delay if event doesn't fire
        setTimeout(() => {
            if (!this.isInitialized) {
                Logger.warning('⚠️ Timeline fallback initialization after 5 seconds');
                this.init();
            }
        }, 5000);
    }

    async init() {
        // Prevent double initialization
        if (this.isInitialized) {
            Logger.warning('Timeline already initialized, skipping...');
            return;
        }
        
        try {
            await this.loadVsuzHData();
            this.createTimelineElement();
            this.renderTimeline();
            this.setupEventHandlers();
            this.isInitialized = true;
            Logger.loading('📍 VsuzH Movement Timeline loaded');
        } catch (error) {
            Logger.error('Failed to initialize movement timeline:', error);
        }
    }

    async loadVsuzHData() {
        try {
            const response = await fetch('public/data/characters.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch characters.json: ${response.status}`);
            }
            
            const data = await response.json();
            this.vsuzHData = data.characters.find(char => char.id === 'vsuzh');
            
            if (!this.vsuzHData) {
                throw new Error('VsuzH character not found in characters.json');
            }
            
            if (!this.vsuzHData.movementHistory || this.vsuzHData.movementHistory.length === 0) {
                Logger.warning('VsuzH has no movement history data');
                this.vsuzHData.movementHistory = [];
                return;
            }
            
            // Sort movement history by date and movement_nr
            this.vsuzHData.movementHistory.sort((a, b) => {
                if (a.movement_nr !== undefined && b.movement_nr !== undefined) {
                    return a.movement_nr - b.movement_nr;
                }
                return new Date(a.date) - new Date(b.date);
            });
            
            Logger.success(`📍 Loaded ${this.vsuzHData.movementHistory.length} VsuzH movement entries`);
            
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
                <div class="timeline-container" id="timeline-container">
                    <div class="timeline-scale" id="timeline-scale"></div>
                    <div class="timeline-events-line"></div>
                    <div class="timeline-track" id="timeline-track">
                        <!-- Timeline events will be populated here -->
                    </div>
                </div>
                <div class="timeline-controls">
                    <div class="timeline-legend">
                        <div class="legend-item">
                            <div class="legend-marker travel"></div>
                            <span>Travel</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker stay"></div>
                            <span>Stay</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker mission"></div>
                            <span>Mission</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker combat"></div>
                            <span>Combat</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker diplomacy"></div>
                            <span>Diplomacy</span>
                        </div>
                    </div>
                    <div class="timeline-zoom-controls">
                        <button class="timeline-control-btn" id="zoom-out">Zoom Out</button>
                        <button class="timeline-control-btn" id="zoom-in">Zoom In</button>
                        <button class="timeline-control-btn" id="reset-view">Reset</button>
                    </div>
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
                background: rgba(255, 255, 255, 0.98);
                border-top: 2px solid #8b5a3c;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                backdrop-filter: blur(8px);
                transition: transform 0.3s ease;
                height: 200px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .movement-timeline.collapsed {
                transform: translateY(calc(100% - 45px));
            }

            .timeline-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 20px;
                background: linear-gradient(135deg, #8b5a3c 0%, #a0633b 100%);
                color: white;
                position: relative;
                height: 45px;
                box-sizing: border-box;
            }

            .timeline-header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #d4af37 0%, #ffd700 50%, #d4af37 100%);
            }

            .timeline-header h3 {
                margin: 0;
                font-size: 1.1em;
                font-weight: 600;
                color: white;
                letter-spacing: 0.5px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }

            .timeline-toggle {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                cursor: pointer;
                padding: 6px 10px;
                border-radius: 4px;
                transition: all 0.2s ease;
                color: white;
            }

            .timeline-toggle:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
            }

            .toggle-icon {
                display: inline-block;
                font-size: 0.9em;
                transition: transform 0.3s ease;
            }

            .movement-timeline.collapsed .toggle-icon {
                transform: rotate(180deg);
            }

            .timeline-content {
                height: 155px;
                overflow: hidden;
                transition: height 0.3s ease, opacity 0.3s ease;
                background: #f8f6f3;
                position: relative;
            }

            .movement-timeline.collapsed .timeline-content {
                height: 0;
                opacity: 0;
            }

            .timeline-container {
                height: 100%;
                position: relative;
                overflow: hidden;
                cursor: grab;
                user-select: none;
            }

            .timeline-container.dragging {
                cursor: grabbing;
            }

            .timeline-container.dragging * {
                pointer-events: none;
            }

            .timeline-track {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                display: flex;
                align-items: center;
                min-width: 200%;
                padding: 0 50px;
                box-sizing: border-box;
                will-change: transform;
            }

            .timeline-scale {
                position: absolute;
                top: 20px;
                left: 0;
                right: 0;
                height: 30px;
                border-bottom: 2px solid #8b5a3c;
                pointer-events: none;
            }

            .scale-marker {
                position: absolute;
                top: 0;
                width: 1px;
                height: 8px;
                background: #8b5a3c;
                transform: translateX(-50%);
                opacity: 0.6;
            }

            .scale-marker.day-marker {
                height: 8px;
                width: 1px;
                background: #8b5a3c;
                opacity: 0.4;
            }

            .scale-marker.week-marker {
                height: 15px;
                width: 2px;
                background: #8b5a3c;
                opacity: 0.7;
            }

            .scale-marker.month-marker {
                height: 25px;
                width: 3px;
                background: #d4af37;
                opacity: 1;
            }

            .scale-marker.month-change {
                background: #d4af37;
                box-shadow: 0 0 4px rgba(212, 175, 55, 0.6);
            }

            .scale-marker.major {
                height: 30px;
                width: 3px;
                background: #d4af37;
            }

            .scale-label {
                position: absolute;
                top: -18px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.65em;
                color: #8b5a3c;
                font-weight: 600;
                white-space: nowrap;
                text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
                padding: 1px 3px;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 2px;
                border: 1px solid rgba(139, 90, 60, 0.2);
            }

            .scale-marker.month .scale-label {
                font-weight: 700;
                color: #d4af37;
                background: rgba(139, 90, 60, 0.9);
                color: white;
                top: -20px;
            }

            .timeline-events-line {
                position: absolute;
                top: 70px;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #8b5a3c 0%, #d4af37 50%, #8b5a3c 100%);
                border-radius: 2px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .timeline-event {
                position: absolute;
                top: 50px;
                transform: translateX(-50%);
                cursor: pointer;
                transition: all 0.2s ease;
                z-index: 10;
            }

            .timeline-event:hover {
                transform: translateX(-50%) translateY(-3px);
                z-index: 20;
            }

            .event-marker {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 3px solid #d4af37;
                background: white;
                margin: 0 auto 8px;
                position: relative;
                box-shadow: 0 2px 8px rgba(139, 90, 60, 0.3);
                transition: all 0.2s ease;
                will-change: transform;
            }

            .timeline-event:hover .event-marker {
                transform: scale(1.2);
                box-shadow: 0 4px 16px rgba(139, 90, 60, 0.4);
            }

            .timeline-event.current .event-marker {
                background: #8b5a3c;
                border-color: #d4af37;
                box-shadow: 0 0 12px rgba(212, 175, 55, 0.6);
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }

            .timeline-event.mission .event-marker {
                border-color: #dc2626;
                background: #dc2626;
                border-width: 4px;
                width: 24px;
                height: 24px;
            }

            .timeline-event.mission .event-marker::after {
                content: '⚔';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 12px;
                font-weight: bold;
            }

            .timeline-event.stay .event-marker {
                border-color: #059669;
                background: #059669;
                border-radius: 20%;
                border-width: 4px;
            }

            .timeline-event.stay .event-marker::after {
                content: '🏠';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 10px;
            }

            .timeline-event.travel .event-marker {
                border-color: #0284c7;
                background: #0284c7;
                clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                border-radius: 0;
                width: 22px;
                height: 22px;
            }

            .timeline-event.combat .event-marker {
                border-color: #991b1b;
                background: #991b1b;
                border-width: 5px;
                box-shadow: 0 0 15px rgba(153, 27, 27, 0.6);
            }

            .timeline-event.combat .event-marker::after {
                content: '⚡';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 12px;
                font-weight: bold;
            }

            .timeline-event.diplomacy .event-marker {
                border-color: #7c3aed;
                background: #7c3aed;
            }

            .timeline-event.diplomacy .event-marker::after {
                content: '🤝';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 10px;
            }

            .timeline-event.travel .event-marker {
                border-color: #d97706;
                background: #d97706;
            }

            .event-popup {
                position: absolute;
                bottom: 35px;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                border: 2px solid #d4af37;
                border-radius: 8px;
                padding: 8px 12px;
                min-width: 120px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
                z-index: 100;
            }

            .timeline-event:hover .event-popup {
                opacity: 1;
            }

            .event-popup::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 8px solid transparent;
                border-top-color: #d4af37;
            }

            .event-location {
                font-weight: 600;
                color: #8b5a3c;
                font-size: 0.9em;
                margin-bottom: 2px;
                text-align: center;
            }

            .event-date {
                color: #666;
                font-size: 0.75em;
                text-align: center;
                margin-bottom: 4px;
            }

            .event-type {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.7em;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                width: 100%;
                text-align: center;
                box-sizing: border-box;
            }

            .event-type.mission {
                background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                color: white;
            }

            .event-type.stay {
                background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                color: white;
            }

            .event-type.travel {
                background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
                color: white;
            }

            .timeline-controls {
                position: absolute;
                bottom: 10px;
                left: 20px;
                right: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 20;
            }

            .timeline-legend {
                display: flex;
                gap: 15px;
                align-items: center;
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.8em;
                color: #8b5a3c;
                font-weight: 500;
            }

            .legend-marker {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                border: 2px solid;
                position: relative;
                flex-shrink: 0;
            }

            .legend-marker.travel {
                border-color: #0284c7;
                background: #0284c7;
                clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                border-radius: 0;
            }

            .legend-marker.stay {
                border-color: #059669;
                background: #059669;
                border-radius: 20%;
            }

            .legend-marker.stay::after {
                content: '🏠';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 8px;
            }

            .legend-marker.mission {
                border-color: #dc2626;
                background: #dc2626;
            }

            .legend-marker.mission::after {
                content: '⚔';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 10px;
                font-weight: bold;
            }

            .legend-marker.combat {
                border-color: #991b1b;
                background: #991b1b;
                border-width: 3px;
            }

            .legend-marker.combat::after {
                content: '⚡';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 10px;
                font-weight: bold;
            }

            .legend-marker.diplomacy {
                border-color: #7c3aed;
                background: #7c3aed;
            }

            .legend-marker.diplomacy::after {
                content: '🤝';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 8px;
            }

            .timeline-zoom-controls {
                display: flex;
                gap: 8px;
            }

            .timeline-control-btn {
                background: rgba(139, 90, 60, 0.8);
                border: 1px solid #d4af37;
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8em;
                transition: all 0.2s ease;
            }

            .timeline-control-btn:hover {
                background: rgba(139, 90, 60, 1);
                transform: translateY(-1px);
            }

            /* Dark mode support */
            [data-theme="dark"] .movement-timeline {
                background: rgba(31, 41, 55, 0.98);
                border-top-color: #a0633b;
            }

            [data-theme="dark"] .timeline-content {
                background: #1f2937;
            }

            [data-theme="dark"] .timeline-scale {
                border-bottom-color: #6b7280;
            }

            [data-theme="dark"] .scale-marker {
                background: #6b7280;
            }

            [data-theme="dark"] .scale-marker.day-marker {
                background: #6b7280;
            }

            [data-theme="dark"] .scale-marker.week-marker {
                background: #9ca3af;
            }

            [data-theme="dark"] .scale-marker.month-marker {
                background: #fbbf24;
            }

            [data-theme="dark"] .scale-marker.major {
                background: #9ca3af;
            }

            [data-theme="dark"] .scale-label {
                color: #d1d5db;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
                background: rgba(31, 41, 55, 0.9);
                border-color: rgba(107, 114, 128, 0.3);
            }

            [data-theme="dark"] .scale-marker.month .scale-label {
                background: rgba(251, 191, 36, 0.9);
                color: #1f2937;
            }

            [data-theme="dark"] .timeline-events-line {
                background: linear-gradient(90deg, #6b7280 0%, #9ca3af 50%, #6b7280 100%);
            }

            [data-theme="dark"] .event-marker {
                background: #374151;
                border-color: #9ca3af;
            }

            [data-theme="dark"] .timeline-event.current .event-marker {
                background: #6b7280;
                border-color: #9ca3af;
            }

            [data-theme="dark"] .event-popup {
                background: #374151;
                border-color: #9ca3af;
                color: #f3f4f6;
            }

            [data-theme="dark"] .event-location {
                color: #f3f4f6;
            }

            [data-theme="dark"] .event-date {
                color: #d1d5db;
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .movement-timeline {
                    height: 150px;
                }
                
                .timeline-content {
                    height: 105px;
                }
                
                .timeline-header {
                    padding: 8px 15px;
                    height: 40px;
                }
                
                .timeline-header h3 {
                    font-size: 1em;
                }
                
                .event-marker {
                    width: 16px;
                    height: 16px;
                }
                
                .timeline-controls {
                    bottom: 5px;
                    right: 10px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    renderTimeline() {
        // Prevent multiple simultaneous renders
        if (this.renderScheduled) return;
        
        // Performance check: Skip render if browser is busy
        if (performance.now() - (this.lastRenderTime || 0) < 16) {
            // Too soon since last render, skip this one
            return;
        }
        
        this.renderScheduled = true;

        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            this.performRender();
            this.renderScheduled = false;
            this.lastRenderTime = performance.now();
        });
    }

    performRender() {
        const track = this.timeline.querySelector('#timeline-track');
        const scale = this.timeline.querySelector('#timeline-scale');
        
        if (!this.vsuzHData.movementHistory || this.vsuzHData.movementHistory.length === 0) {
            track.innerHTML = '<div class="timeline-empty">No movement history available for VsuzH</div>';
            return;
        }

        // Calculate timeline dimensions and positions (only if not cached or zoom changed significantly)
        const zoomChanged = !this.lastZoomLevel || Math.abs(this.zoomLevel - this.lastZoomLevel) > 0.1;
        if (!this.timelineData || zoomChanged) {
            this.measurePerformance('calculateTimelineData', () => {
                this.calculateTimelineData();
            });
            this.lastZoomLevel = this.zoomLevel;
        }
        
        // Use efficient rendering methods with performance monitoring
        this.measurePerformance('renderTimeScale', () => {
            this.renderTimeScaleEfficient(scale);
        });
        
        this.measurePerformance('renderEvents', () => {
            this.renderEventsEfficient(track);
        });
    }

    calculateTimelineData() {
        const movements = this.vsuzHData.movementHistory;
        
        // Parse dates and find min/max (cache parsed dates)
        if (!this.cachedTimelineData) {
            this.cachedTimelineData = movements.map((movement, index) => {
                const parsedDate = this.parseDate(movement.date);
                return {
                    ...movement,
                    parsedDate,
                    index
                };
            }).filter(item => item.parsedDate); // Remove invalid dates

            if (this.cachedTimelineData.length === 0) return;

            // Sort by date (only once)
            this.cachedTimelineData.sort((a, b) => a.parsedDate - b.parsedDate);
        }
        
        this.timelineData = this.cachedTimelineData;

        // Find exact date range - start at first event, end at last event
        this.minDate = new Date(this.timelineData[0].parsedDate);
        this.maxDate = new Date(this.timelineData[this.timelineData.length - 1].parsedDate);
        
        // Expand by 1 week on each side
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        this.minDate = new Date(this.minDate.getTime() - oneWeek);
        this.maxDate = new Date(this.maxDate.getTime() + oneWeek);
        
        // Calculate total days in the journey (including the 2-week expansion)
        const totalDays = Math.ceil((this.maxDate - this.minDate) / (24 * 60 * 60 * 1000)) + 1;
        
        // Set minimum width per day (40px seems good for readability)
        const minWidthPerDay = 40;
        const minTimelineWidth = totalDays * minWidthPerDay;
        
        // Calculate total timeline width (minimum width or 3x viewport, whichever is larger)
        // BUT cap it at a reasonable maximum to prevent performance issues
        const maxTimelineWidth = window.innerWidth * 8; // Maximum 8x viewport width
        this.timelineWidth = Math.min(Math.max(minTimelineWidth, window.innerWidth * 3), maxTimelineWidth);
        
        this.pixelsPerMs = this.timelineWidth / (this.maxDate - this.minDate);
        
        // Current zoom and pan state
        this.zoomLevel = this.zoomLevel || 1;
        this.panOffset = this.panOffset || 0;
    }

    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            // Handle fantasy dates like "5055-05-05" and standard dates
            if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = dateString.split('-').map(Number);
                // Create date in a way that works with fantasy years
                const date = new Date();
                date.setFullYear(year, month - 1, day);
                date.setHours(0, 0, 0, 0);
                return date;
            }
            
            // Try parsing as regular date
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            Logger.warning(`Failed to parse date: ${dateString}`, error);
            return null;
        }
    }

    renderTimeScaleEfficient(scale) {
        if (!this.timelineData || this.timelineData.length === 0) return;

        const totalDays = Math.ceil((this.maxDate - this.minDate) / (24 * 60 * 60 * 1000)) + 1;
        const dayWidth = this.timelineWidth / totalDays;
        const effectiveDayWidth = dayWidth * (this.zoomLevel || 1);
        
        // Performance: Only generate markers that will be visible and useful
        const markers = [];
        
        // Determine what level of detail to show based on zoom
        if (effectiveDayWidth >= 20) {
            // Zoomed in enough to show daily markers
            this.generateOptimizedDayMarkers(markers, effectiveDayWidth);
        } else if (effectiveDayWidth >= 8) {
            // Medium zoom: show weekly markers with some daily labels
            this.generateOptimizedWeekMarkers(markers, effectiveDayWidth);
        } else {
            // Zoomed out: only show monthly markers
            this.generateOptimizedMonthMarkers(markers);
        }

        // Efficiently update existing elements or create new ones
        this.updateScaleElements(scale, markers);
    }

    generateOptimizedDayMarkers(markers, effectiveDayWidth) {
        const startDate = new Date(this.minDate);
        const endDate = new Date(this.maxDate);
        let currentDate = new Date(startDate);
        
        // Limit to reasonable number of markers for performance
        const maxDayMarkers = 200;
        const totalDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
        const skipDays = Math.max(1, Math.floor(totalDays / maxDayMarkers));
        
        while (currentDate <= endDate) {
            const position = (currentDate - this.minDate) * this.pixelsPerMs;
            const dayOfWeek = currentDate.getDay();
            
            // Show labels only on Monday, Wednesday, Saturday and only if spacing allows
            const showLabel = (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 6) && effectiveDayWidth >= 40;
            
            markers.push({
                position,
                date: new Date(currentDate),
                type: 'day',
                showLabel,
                height: '8px',
                className: 'day-marker'
            });
            
            currentDate.setDate(currentDate.getDate() + skipDays);
        }
    }

    generateOptimizedWeekMarkers(markers, effectiveDayWidth) {
        const startDate = new Date(this.minDate);
        const endDate = new Date(this.maxDate);
        let currentDate = new Date(startDate);
        
        // Find the first Monday
        while (currentDate.getDay() !== 1 && currentDate <= endDate) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        while (currentDate <= endDate) {
            const position = (currentDate - this.minDate) * this.pixelsPerMs;
            
            // Show weekly markers
            markers.push({
                position,
                date: new Date(currentDate),
                type: 'week',
                showLabel: effectiveDayWidth >= 15,
                height: '15px',
                className: 'week-marker'
            });
            
            currentDate.setDate(currentDate.getDate() + 7);
        }
        
        // Add monthly markers too
        this.generateOptimizedMonthMarkers(markers);
    }

    generateOptimizedMonthMarkers(markers) {
        const startDate = new Date(this.minDate);
        const endDate = new Date(this.maxDate);
        let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        
        while (currentDate <= endDate) {
            const position = (currentDate - this.minDate) * this.pixelsPerMs;
            
            markers.push({
                position,
                date: new Date(currentDate),
                type: 'month',
                showLabel: true,
                height: '25px',
                className: 'month-marker',
                isMonthChange: true
            });
            
            // Move to first day of next month
            currentDate.setMonth(currentDate.getMonth() + 1, 1);
        }
    }

    updateScaleElements(scale, markers) {
        // Performance limit: Cap the number of scale markers
        const maxMarkers = 150;
        if (markers.length > maxMarkers) {
            // Keep monthly markers and reduce others
            const monthMarkers = markers.filter(m => m.type === 'month');
            const otherMarkers = markers.filter(m => m.type !== 'month');
            const reducedOthers = otherMarkers.filter((_, index) => index % Math.ceil(otherMarkers.length / (maxMarkers - monthMarkers.length)) === 0);
            markers = [...monthMarkers, ...reducedOthers].sort((a, b) => a.position - b.position);
        }

        // Remove excess elements efficiently
        const excessCount = this.scaleElements.length - markers.length;
        if (excessCount > 0) {
            // Remove in batches for better performance
            const toRemove = this.scaleElements.splice(markers.length, excessCount);
            const fragment = document.createDocumentFragment();
            toRemove.forEach(element => fragment.appendChild(element));
            // Fragment removes all elements at once when it goes out of scope
        }

        // Update existing and create new elements
        markers.forEach((marker, index) => {
            let element = this.scaleElements[index];
            
            if (!element) {
                // Create new element efficiently
                element = document.createElement('div');
                element.innerHTML = '<div class="scale-label"></div>';
                scale.appendChild(element);
                this.scaleElements.push(element);
            }

            // Update element properties using efficient property setting
            if (element.currentMarkerType !== marker.type) {
                element.className = `scale-marker ${marker.className} ${marker.type}`;
                element.style.height = marker.height;
                element.currentMarkerType = marker.type;
            }
            
            // Only update position if it changed
            const newLeft = marker.position + 'px';
            if (element.style.left !== newLeft) {
                element.style.left = newLeft;
            }
            
            // Update label efficiently
            const label = element.firstElementChild;
            if (marker.showLabel) {
                const newText = this.formatMarkerDate(marker.date, marker.type);
                if (label.textContent !== newText) {
                    label.textContent = newText;
                }
                if (label.style.display === 'none') {
                    label.style.display = 'block';
                }
            } else {
                if (label.style.display !== 'none') {
                    label.style.display = 'none';
                }
            }
            
            // Special styling for month markers
            if (marker.isMonthChange && !element.classList.contains('month-change')) {
                element.classList.add('month-change');
            } else if (!marker.isMonthChange && element.classList.contains('month-change')) {
                element.classList.remove('month-change');
            }
        });
    }

    formatMarkerDate(date, type) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        switch (type) {
            case 'day':
                return `${day}.${month}`;
            case 'month':
                return `${month}/${year}`;
            default:
                return `${day}.${month}`;
        }
    }

    renderEventsEfficient(track) {
        if (!this.timelineData || this.timelineData.length === 0) return;

        // Efficiently update existing elements or create new ones
        this.updateEventElements(track, this.timelineData);
    }

    updateEventElements(track, timelineData) {
        // Remove excess elements
        while (this.eventElements.length > timelineData.length) {
            const element = this.eventElements.pop();
            element.remove();
        }

        // Update existing and create new elements
        timelineData.forEach((movement, index) => {
            let element = this.eventElements[index];
            const isLatest = index === timelineData.length - 1;
            
            if (!element) {
                // Create new element structure
                element = this.createEventElementOptimized(movement, isLatest);
                track.appendChild(element);
                this.eventElements.push(element);
            } else {
                // Update existing element
                this.updateEventElement(element, movement, isLatest);
            }
        });
    }

    createEventElementOptimized(movement, isLatest) {
        const position = (movement.parsedDate - this.minDate) * this.pixelsPerMs;
        
        const event = document.createElement('div');
        event.className = `timeline-event ${movement.type || 'travel'} ${isLatest ? 'current' : ''}`;
        event.style.left = position + 'px';
        event.dataset.movementId = movement.id;

        // Create structure once
        const marker = document.createElement('div');
        marker.className = 'event-marker';
        
        const popup = document.createElement('div');
        popup.className = 'event-popup';
        
        const location = document.createElement('div');
        location.className = 'event-location';
        
        const date = document.createElement('div');
        date.className = 'event-date';
        
        const type = document.createElement('div');
        type.className = 'event-type';
        
        popup.appendChild(location);
        popup.appendChild(date);
        popup.appendChild(type);
        event.appendChild(marker);
        event.appendChild(popup);

        // Set content
        this.updateEventContent(event, movement, isLatest);

        // Add click handler (only once)
        event.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTimelineItemClick(movement);
        });

        return event;
    }

    updateEventElement(element, movement, isLatest) {
        const position = (movement.parsedDate - this.minDate) * this.pixelsPerMs;
        
        // Update position and classes efficiently
        element.style.left = position + 'px';
        element.className = `timeline-event ${movement.type || 'travel'} ${isLatest ? 'current' : ''}`;
        element.dataset.movementId = movement.id;
        
        // Update content
        this.updateEventContent(element, movement, isLatest);
    }

    updateEventContent(element, movement, isLatest) {
        const location = element.querySelector('.event-location');
        const date = element.querySelector('.event-date');
        const type = element.querySelector('.event-type');
        
        location.textContent = movement.location || 'Unknown';
        date.textContent = this.formatDate(movement.date);
        type.textContent = movement.type || 'travel';
        type.className = `event-type ${movement.type || 'travel'}`;
    }

    createChapters(movements) {
        // Group movements into logical chapters based on dates or location clusters
        const chapters = [];
        let currentChapter = null;
        let chapterNumber = 1;

        movements.forEach((movement, index) => {
            // Start a new chapter every 3-4 movements or when there's a significant time gap
            const shouldStartNewChapter = !currentChapter || 
                                        currentChapter.movements.length >= 4 || 
                                        this.isSignificantTimeGap(currentChapter.movements[currentChapter.movements.length - 1], movement);

            if (shouldStartNewChapter) {
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                
                currentChapter = {
                    title: this.generateChapterTitle(movement, chapterNumber),
                    movements: [movement],
                    startDate: movement.date
                };
                chapterNumber++;
            } else {
                currentChapter.movements.push(movement);
            }
        });

        // Add the last chapter
        if (currentChapter) {
            chapters.push(currentChapter);
        }

        return chapters;
    }

    generateChapterTitle(firstMovement, chapterNumber) {
        // Generate chapter titles based on location or movement type
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const roman = romanNumerals[chapterNumber - 1] || chapterNumber.toString();
        
        if (firstMovement.location) {
            // Use location-based titles
            if (firstMovement.location.toLowerCase().includes('custom')) {
                return `Chapter ${roman}: Uncharted Territories`;
            } else {
                return `Chapter ${roman}: ${firstMovement.location} Region`;
            }
        }
        
        return `Chapter ${roman}: Adventure Continues`;
    }

    isSignificantTimeGap(prev, current) {
        if (!prev || !current) return false;
        
        try {
            // Simple check for different dates (this could be made more sophisticated)
            return prev.date !== current.date;
        } catch (error) {
            return false;
        }
    }

    createChapterElement(chapter, chapterNumber) {
        const chapterDiv = document.createElement('div');
        chapterDiv.className = 'timeline-chapter';

        chapterDiv.innerHTML = `
            <div class="chapter-header">
                <div class="chapter-icon">${chapterNumber}</div>
                <div class="chapter-title">${chapter.title}</div>
            </div>
            <div class="chapter-entries">
                ${chapter.movements.map((movement, index) => this.createTimelineEntryHTML(movement, index === chapter.movements.length - 1)).join('')}
            </div>
        `;

        // Add click handlers to entries
        chapterDiv.querySelectorAll('.timeline-entry').forEach((entry, index) => {
            entry.addEventListener('click', () => {
                this.handleTimelineItemClick(chapter.movements[index]);
            });
        });

        return chapterDiv;
    }

    createTimelineEntryHTML(movement, isLatest) {
        const notes = movement.notes ? `<div class="entry-notes">"${movement.notes}"</div>` : '';
        
        return `
            <div class="timeline-entry ${movement.type || 'travel'} ${isLatest ? 'current' : ''}" data-movement-id="${movement.id}">
                <div class="entry-content">
                    <div class="entry-header">
                        <h4 class="entry-location">${movement.location || 'Unknown Location'}</h4>
                        <span class="entry-date">${this.formatDate(movement.date)}</span>
                    </div>
                    <div class="entry-type ${movement.type || 'travel'}">${movement.type || 'travel'}</div>
                    ${notes}
                </div>
            </div>
        `;
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
        const timelineContainer = this.timeline.querySelector('.timeline-container');
        
        // Toggle timeline visibility
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

        // Drag functionality for timeline - optimized with RAF throttling
        let isDragging = false;
        let lastX = 0;
        let currentTranslateX = 0;
        let animationId = null;
        let lastUpdateTime = 0;

        // More efficient throttle function
        const throttleTransform = (translateX) => {
            const now = Date.now();
            if (now - lastUpdateTime < 8) return; // Limit to ~120fps for smoother dragging
            
            if (animationId) cancelAnimationFrame(animationId);
            animationId = requestAnimationFrame(() => {
                this.updateTimelinePosition(translateX);
                lastUpdateTime = now;
                animationId = null;
            });
        };

        // Mouse drag functionality
        timelineContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            timelineContainer.style.cursor = 'grabbing';
            timelineContainer.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - lastX;
            currentTranslateX += deltaX;
            
            // Apply bounds
            const maxTranslate = 0;
            const minTranslate = Math.min(0, window.innerWidth - (this.timelineWidth || 2000));
            currentTranslateX = Math.max(minTranslate, Math.min(maxTranslate, currentTranslateX));
            
            throttleTransform(currentTranslateX);
            lastX = e.clientX;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (timelineContainer) {
                timelineContainer.style.cursor = 'grab';
                timelineContainer.classList.remove('dragging');
            }
        });

        // Touch support for mobile with performance optimization
        let touchStartX = 0;
        timelineContainer.addEventListener('touchstart', (e) => {
            isDragging = true;
            touchStartX = e.touches[0].clientX;
            lastX = touchStartX;
        });

        timelineContainer.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.touches[0].clientX - lastX;
            currentTranslateX += deltaX;
            
            const maxTranslate = 0;
            const minTranslate = Math.min(0, window.innerWidth - (this.timelineWidth || 2000));
            currentTranslateX = Math.max(minTranslate, Math.min(maxTranslate, currentTranslateX));
            
            throttleTransform(currentTranslateX);
            lastX = e.touches[0].clientX;
            e.preventDefault();
        });

        timelineContainer.addEventListener('touchend', () => {
            isDragging = false;
        });

        // Zoom functionality with mouse wheel - heavily optimized
        let zoomTimeout = null;
        let lastZoomTime = 0;
        let pendingZoomLevel = this.zoomLevel || 1;
        
        timelineContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const now = Date.now();
            if (now - lastZoomTime < 32) return; // Limit to ~30fps for zoom
            lastZoomTime = now;
            
            if (zoomTimeout) clearTimeout(zoomTimeout);
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            pendingZoomLevel = Math.max(0.5, Math.min(3, pendingZoomLevel * zoomFactor));
            
            // Only re-render if zoom level changed significantly
            if (Math.abs(pendingZoomLevel - this.zoomLevel) > 0.05) {
                this.zoomLevel = pendingZoomLevel;
                
                // Aggressive debounce for expensive re-render
                zoomTimeout = setTimeout(() => {
                    this.renderTimeline();
                    zoomTimeout = null;
                }, 150); // Increased debounce time
            }
        });

        // Zoom controls
        const zoomInBtn = this.timeline.querySelector('#zoom-in');
        const zoomOutBtn = this.timeline.querySelector('#zoom-out');
        const resetBtn = this.timeline.querySelector('#reset-view');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.zoomLevel = Math.min(3, this.zoomLevel * 1.2);
                this.renderTimeline();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoomLevel = Math.max(0.5, this.zoomLevel * 0.8);
                this.renderTimeline();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.zoomLevel = 1;
                currentTranslateX = 0;
                this.renderTimeline();
                this.updateTimelinePosition(0);
            });
        }

        // Store state for helper method
        this.currentTranslateX = currentTranslateX;
    }

    updateTimelinePosition(translateX) {
        const track = this.timeline.querySelector('#timeline-track');
        const scale = this.timeline.querySelector('#timeline-scale');
        
        // Use transform3d for hardware acceleration
        const transform = `translate3d(${translateX}px, 0, 0) scaleX(${this.zoomLevel || 1})`;
        
        if (track) {
            track.style.transform = transform;
        }
        if (scale) {
            scale.style.transform = transform;
        }
        
        this.currentTranslateX = translateX;
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
        if (!this.isInitialized) {
            Logger.warning('Timeline not initialized yet, waiting for movement markers...');
            return;
        }
        
        this.loadVsuzHData().then(() => {
            this.renderTimeline();
            Logger.success('📍 Timeline refreshed with updated data');
        }).catch(error => {
            Logger.error('Failed to refresh timeline:', error);
        });
    }

    // Enhanced cleanup method
    cleanup() {
        if (this.timeline && this.timeline.parentNode) {
            this.timeline.parentNode.removeChild(this.timeline);
        }
        
        // Clear cached elements to prevent memory leaks
        this.eventElements = [];
        this.scaleElements = [];
        this.timelineElements = null;
        
        // Clear data
        this.timelineData = null;
        
        Logger.cleanup('Movement timeline cleaned up');
    }

    // Performance monitoring method
    measurePerformance(operation, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        if (end - start > 5) { // Only log slow operations
            console.log(`Timeline ${operation}: ${(end - start).toFixed(2)}ms`);
        }
        return result;
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
