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
                <div class="timeline-container" id="timeline-container">
                    <div class="timeline-scale" id="timeline-scale"></div>
                    <div class="timeline-events-line"></div>
                    <div class="timeline-track" id="timeline-track">
                        <!-- Timeline events will be populated here -->
                    </div>
                </div>
                <div class="timeline-controls">
                    <button class="timeline-control-btn" id="zoom-out">Zoom Out</button>
                    <button class="timeline-control-btn" id="zoom-in">Zoom In</button>
                    <button class="timeline-control-btn" id="reset-view">Reset</button>
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

            .timeline-track {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                display: flex;
                align-items: center;
                transition: transform 0.3s ease;
                min-width: 200%;
                padding: 0 50px;
                box-sizing: border-box;
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
                width: 2px;
                height: 20px;
                background: #8b5a3c;
                transform: translateX(-50%);
            }

            .scale-marker.major {
                height: 30px;
                width: 3px;
                background: #d4af37;
            }

            .scale-label {
                position: absolute;
                top: -15px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.7em;
                color: #8b5a3c;
                font-weight: 600;
                white-space: nowrap;
                text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
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
            }

            .timeline-event:hover .event-marker {
                transform: scale(1.2);
                box-shadow: 0 4px 16px rgba(139, 90, 60, 0.4);
            }

            .timeline-event.current .event-marker {
                background: #8b5a3c;
                border-color: #d4af37;
                box-shadow: 0 0 12px rgba(212, 175, 55, 0.6);
            }

            .timeline-event.mission .event-marker {
                border-color: #dc2626;
                background: #dc2626;
            }

            .timeline-event.stay .event-marker {
                border-color: #059669;
                background: #059669;
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
                right: 20px;
                display: flex;
                gap: 8px;
                z-index: 20;
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

            [data-theme="dark"] .scale-marker.major {
                background: #9ca3af;
            }

            [data-theme="dark"] .scale-label {
                color: #d1d5db;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
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
        const track = this.timeline.querySelector('#timeline-track');
        const scale = this.timeline.querySelector('#timeline-scale');
        
        if (!this.vsuzHData.movementHistory || this.vsuzHData.movementHistory.length === 0) {
            track.innerHTML = '<div class="timeline-empty">No movement history available for VsuzH</div>';
            return;
        }

        // Calculate timeline dimensions and positions
        this.calculateTimelineData();
        
        // Render time scale markers
        this.renderTimeScale(scale);
        
        // Render events
        this.renderEvents(track);
    }

    calculateTimelineData() {
        const movements = this.vsuzHData.movementHistory;
        
        // Parse dates and find min/max
        this.timelineData = movements.map((movement, index) => {
            const parsedDate = this.parseDate(movement.date);
            return {
                ...movement,
                parsedDate,
                index
            };
        }).filter(item => item.parsedDate); // Remove invalid dates

        if (this.timelineData.length === 0) return;

        // Sort by date
        this.timelineData.sort((a, b) => a.parsedDate - b.parsedDate);

        // Find exact date range - start at first event, end at last event
        this.minDate = this.timelineData[0].parsedDate;
        this.maxDate = this.timelineData[this.timelineData.length - 1].parsedDate;
        
        // Calculate total days in the journey
        const totalDays = Math.ceil((this.maxDate - this.minDate) / (24 * 60 * 60 * 1000)) + 1; // +1 to include the last day
        
        // Set minimum width per day (40px seems good for readability)
        const minWidthPerDay = 40;
        const minTimelineWidth = totalDays * minWidthPerDay;
        
        // Calculate total timeline width (minimum width or 3x viewport, whichever is larger)
        this.timelineWidth = Math.max(minTimelineWidth, window.innerWidth * 3);
        this.pixelsPerMs = this.timelineWidth / (this.maxDate - this.minDate);
        
        // Current zoom and pan state
        this.zoomLevel = 1;
        this.panOffset = 0;
    }

    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            // Handle fantasy dates like "5055-05-05"
            if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = dateString.split('-').map(Number);
                return new Date(year, month - 1, day);
            }
            
            // Try parsing as regular date
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            return null;
        }
    }

    renderTimeScale(scale) {
        scale.innerHTML = '';
        
        if (!this.timelineData || this.timelineData.length === 0) return;

        const totalDays = Math.ceil((this.maxDate - this.minDate) / (24 * 60 * 60 * 1000)) + 1;
        const dayWidth = this.timelineWidth / totalDays;
        
        // Determine scale interval based on day width and zoom level
        let interval = 1; // days
        if (dayWidth * this.zoomLevel < 30) interval = 7; // weeks
        if (dayWidth * this.zoomLevel < 10) interval = 30; // months
        if (dayWidth * this.zoomLevel < 3) interval = 365; // years

        // Start from the actual first date, not a padded date
        const startDate = new Date(this.minDate);
        const endDate = new Date(this.maxDate);
        
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const position = (currentDate - this.minDate) * this.pixelsPerMs;
            
            const marker = document.createElement('div');
            marker.className = `scale-marker ${interval >= 30 ? 'major' : ''}`;
            marker.style.left = position + 'px';
            
            const label = document.createElement('div');
            label.className = 'scale-label';
            label.textContent = this.formatScaleDate(currentDate, interval);
            marker.appendChild(label);
            
            scale.appendChild(marker);
            
            // Move to next interval
            if (interval >= 365) {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
            } else if (interval >= 30) {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else {
                currentDate.setDate(currentDate.getDate() + interval);
            }
        }
    }

    formatScaleDate(date, interval) {
        if (interval >= 365) {
            return date.getFullYear().toString();
        } else if (interval >= 30) {
            return `${date.getMonth() + 1}/${date.getFullYear()}`;
        } else if (interval >= 7) {
            return `${date.getDate()}.${date.getMonth() + 1}`;
        } else {
            return `${date.getDate()}.${date.getMonth() + 1}`;
        }
    }

    renderEvents(track) {
        track.innerHTML = '';
        
        if (!this.timelineData || this.timelineData.length === 0) return;

        this.timelineData.forEach((movement, index) => {
            const event = this.createEventElement(movement, index === this.timelineData.length - 1);
            track.appendChild(event);
        });
    }

    createEventElement(movement, isLatest) {
        const position = (movement.parsedDate - this.minDate) * this.pixelsPerMs;
        
        const event = document.createElement('div');
        event.className = `timeline-event ${movement.type || 'travel'} ${isLatest ? 'current' : ''}`;
        event.style.left = position + 'px';
        event.dataset.movementId = movement.id;

        event.innerHTML = `
            <div class="event-marker"></div>
            <div class="event-popup">
                <div class="event-location">${movement.location || 'Unknown'}</div>
                <div class="event-date">${this.formatDate(movement.date)}</div>
                <div class="event-type ${movement.type || 'travel'}">${movement.type || 'travel'}</div>
            </div>
        `;

        // Add click handler
        event.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTimelineItemClick(movement);
        });

        return event;
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

        // Drag functionality for timeline
        let isDragging = false;
        let lastX = 0;
        let currentTranslateX = 0;

        // Mouse drag functionality
        timelineContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            timelineContainer.style.cursor = 'grabbing';
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
            
            this.updateTimelinePosition(currentTranslateX);
            lastX = e.clientX;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (timelineContainer) {
                timelineContainer.style.cursor = 'grab';
            }
        });

        // Touch support for mobile
        timelineContainer.addEventListener('touchstart', (e) => {
            isDragging = true;
            lastX = e.touches[0].clientX;
        });

        timelineContainer.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.touches[0].clientX - lastX;
            currentTranslateX += deltaX;
            
            const maxTranslate = 0;
            const minTranslate = Math.min(0, window.innerWidth - (this.timelineWidth || 2000));
            currentTranslateX = Math.max(minTranslate, Math.min(maxTranslate, currentTranslateX));
            
            this.updateTimelinePosition(currentTranslateX);
            lastX = e.touches[0].clientX;
            e.preventDefault();
        });

        timelineContainer.addEventListener('touchend', () => {
            isDragging = false;
        });

        // Zoom functionality with mouse wheel
        timelineContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel * zoomFactor));
            
            this.renderTimeline(); // Re-render with new scale
        });

        // Zoom controls
        const zoomInBtn = this.timeline.querySelector('.zoom-in');
        const zoomOutBtn = this.timeline.querySelector('.zoom-out');
        const resetBtn = this.timeline.querySelector('.reset-zoom');

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
        
        if (track) {
            track.style.transform = `translateX(${translateX}px) scaleX(${this.zoomLevel || 1})`;
        }
        if (scale) {
            scale.style.transform = `translateX(${translateX}px) scaleX(${this.zoomLevel || 1})`;
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
