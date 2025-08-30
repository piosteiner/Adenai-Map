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
                background: rgba(255, 255, 255, 0.98);
                border-top: 2px solid #8b5a3c;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                backdrop-filter: blur(8px);
                transition: transform 0.3s ease;
                max-height: 60vh;
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
                max-height: calc(55vh - 45px);
                overflow-y: auto;
                overflow-x: hidden;
                transition: max-height 0.3s ease, opacity 0.3s ease;
                background: #f8f6f3;
            }

            .movement-timeline.collapsed .timeline-content {
                max-height: 0;
                opacity: 0;
            }

            .timeline-track {
                padding: 20px;
                position: relative;
            }

            .timeline-track::before {
                content: '';
                position: absolute;
                left: 40px;
                top: 0;
                bottom: 0;
                width: 3px;
                background: linear-gradient(to bottom, #8b5a3c 0%, #d4af37 50%, #8b5a3c 100%);
                border-radius: 2px;
            }

            .timeline-chapter {
                margin-bottom: 30px;
                position: relative;
            }

            .chapter-header {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                position: relative;
                z-index: 2;
            }

            .chapter-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #8b5a3c 0%, #a0633b 100%);
                border: 3px solid #d4af37;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 0.9em;
                margin-right: 15px;
                box-shadow: 0 2px 8px rgba(139, 90, 60, 0.3);
            }

            .chapter-title {
                background: white;
                padding: 8px 15px;
                border-radius: 20px;
                border: 2px solid #d4af37;
                font-weight: 600;
                color: #8b5a3c;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                position: relative;
            }

            .timeline-entry {
                margin-left: 60px;
                margin-bottom: 12px;
                background: white;
                border-radius: 8px;
                border-left: 4px solid #d4af37;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                cursor: pointer;
                position: relative;
            }

            .timeline-entry:hover {
                transform: translateX(5px);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
            }

            .timeline-entry.current {
                border-left-color: #8b5a3c;
                background: linear-gradient(135deg, #fff8f0 0%, #ffffff 100%);
            }

            .timeline-entry.current::before {
                content: '📍';
                position: absolute;
                right: 10px;
                top: 10px;
                font-size: 1.2em;
            }

            .entry-content {
                padding: 12px 15px;
            }

            .entry-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
            }

            .entry-location {
                font-weight: 600;
                color: #8b5a3c;
                font-size: 1em;
                margin: 0;
            }

            .entry-date {
                color: #666;
                font-size: 0.85em;
                font-weight: 500;
                background: #f0f0f0;
                padding: 2px 8px;
                border-radius: 10px;
            }

            .entry-type {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 0.75em;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-top: 5px;
            }

            .entry-type.mission {
                background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                color: white;
            }

            .entry-type.stay {
                background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                color: white;
            }

            .entry-type.travel {
                background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
                color: white;
            }

            .entry-notes {
                margin-top: 8px;
                font-size: 0.9em;
                color: #555;
                line-height: 1.4;
                font-style: italic;
            }

            .timeline-empty {
                text-align: center;
                padding: 40px 20px;
                color: #666;
                font-style: italic;
            }

            /* Scrollbar styling */
            .timeline-content::-webkit-scrollbar {
                width: 8px;
            }

            .timeline-content::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }

            .timeline-content::-webkit-scrollbar-thumb {
                background: #8b5a3c;
                border-radius: 4px;
            }

            .timeline-content::-webkit-scrollbar-thumb:hover {
                background: #a0633b;
            }

            /* Dark mode support */
            [data-theme="dark"] .movement-timeline {
                background: rgba(31, 41, 55, 0.98);
                border-top-color: #a0633b;
            }

            [data-theme="dark"] .timeline-header {
                background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
            }

            [data-theme="dark"] .timeline-content {
                background: #1f2937;
            }

            [data-theme="dark"] .timeline-track::before {
                background: linear-gradient(to bottom, #6b7280 0%, #9ca3af 50%, #6b7280 100%);
            }

            [data-theme="dark"] .chapter-icon {
                background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
                border-color: #9ca3af;
            }

            [data-theme="dark"] .chapter-title {
                background: #374151;
                border-color: #9ca3af;
                color: #f3f4f6;
            }

            [data-theme="dark"] .timeline-entry {
                background: #374151;
                border-left-color: #9ca3af;
            }

            [data-theme="dark"] .timeline-entry.current {
                background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                border-left-color: #6b7280;
            }

            [data-theme="dark"] .entry-location {
                color: #f3f4f6;
            }

            [data-theme="dark"] .entry-date {
                background: #1f2937;
                color: #d1d5db;
            }

            [data-theme="dark"] .entry-notes {
                color: #d1d5db;
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .movement-timeline {
                    max-height: 50vh;
                }
                
                .timeline-header {
                    padding: 8px 15px;
                }
                
                .timeline-header h3 {
                    font-size: 1em;
                }
                
                .timeline-track {
                    padding: 15px;
                }
                
                .timeline-track::before {
                    left: 25px;
                }
                
                .chapter-icon {
                    width: 24px;
                    height: 24px;
                    font-size: 0.8em;
                    margin-right: 10px;
                }
                
                .timeline-entry {
                    margin-left: 45px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    renderTimeline() {
        const track = this.timeline.querySelector('#timeline-track');
        track.innerHTML = '';

        if (!this.vsuzHData.movementHistory || this.vsuzHData.movementHistory.length === 0) {
            track.innerHTML = '<div class="timeline-empty">No movement history available for VsuzH</div>';
            return;
        }

        // Group movements by approximate time periods or create chapters
        const chapters = this.createChapters(this.vsuzHData.movementHistory);
        
        chapters.forEach((chapter, chapterIndex) => {
            const chapterElement = this.createChapterElement(chapter, chapterIndex + 1);
            track.appendChild(chapterElement);
        });
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
