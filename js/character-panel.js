// character-panel.js - Character Panel Functionality
class CharacterPanel {
    constructor() {
        this.panel = null;
        this.toggleBtn = null;
        this.grid = null;
        this.isPanelOpen = false;
        this.characters = [];
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initPanel());
        } else {
            this.initPanel();
        }

        // Listen for characters loaded event
        document.addEventListener('charactersLoaded', (e) => {
            this.characters = e.detail.characters;
            this.populateCharacterGrid();
        });
    }

    initPanel() {
        this.panel = document.getElementById('character-panel');
        this.toggleBtn = document.getElementById('toggle-panel');
        this.grid = document.getElementById('character-grid');
        
        if (!this.panel || !this.toggleBtn || !this.grid) {
            console.warn('Character panel elements not found');
            return;
        }
        
        this.setupEventListeners();
        this.addPanelCSS();
    }

    setupEventListeners() {
        // Panel toggle button
        this.toggleBtn.addEventListener('click', () => {
            this.togglePanel();
        });

        // Filter functionality
        const relationshipFilter = document.getElementById('relationship-filter');
        const statusFilter = document.getElementById('status-filter');
        
        if (relationshipFilter) {
            relationshipFilter.addEventListener('change', () => this.filterCharacters());
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterCharacters());
        }
    }

    togglePanel() {
        this.isPanelOpen = !this.isPanelOpen;
        this.panel.classList.toggle('open', this.isPanelOpen);
        this.toggleBtn.textContent = this.isPanelOpen ? '✖️' : '📖';
    }

    populateCharacterGrid(characters = this.characters) {
        if (!this.grid) return;
        
        this.grid.innerHTML = '';
        
        if (characters.length === 0) {
            this.showEmptyState();
            return;
        }
        
        characters.forEach(character => {
            const card = this.createCharacterCard(character);
            this.grid.appendChild(card);
        });
    }

    createCharacterCard(character) {
        const card = document.createElement('div');
        card.className = 'character-card';
        
        // Enhanced card with movement indicator
        const movementCount = character.movementHistory ? character.movementHistory.length : 0;
        const movementIndicator = movementCount > 0 ? `🛤️ ${movementCount}` : '';
        
        card.innerHTML = `
            ${character.image ? `<img src="${character.image}" alt="${character.name}">` : ''}
            <div class="character-info">
                <h4>${character.name} ${movementIndicator}</h4>
                ${character.title ? `<div class="title">${character.title}</div>` : ''}
                <div class="location">📍 ${character.location || 'Unknown'}</div>
                <div class="status-badge status-${character.status}">${character.status || 'unknown'}</div>
                <div class="relationship-badge relationship-${character.relationship}">
                    ${this.formatRelationship(character.relationship)}
                </div>
            </div>
        `;
        
        // Add click handler to focus character on map
        card.addEventListener('click', () => {
            this.focusCharacterOnMap(character);
        });
        
        return card;
    }

    formatRelationship(relationship) {
        const relationships = {
            ally: '😊 Ally',
            friendly: '🙂 Friendly',
            neutral: '😐 Neutral',
            suspicious: '🤨 Suspicious',
            hostile: '😠 Hostile',
            enemy: '⚔️ Enemy'
        };
        return relationships[relationship] || relationship || 'Unknown';
    }

    focusCharacterOnMap(character) {
        const success = window.characterSystem?.focusCharacter?.(character.name);

        // 1) Resolve pixel [x, y] from your data
        const xy = character?.currentLocation?.coordinates?.length === 2
            ? character.currentLocation.coordinates
            : character?.coordinates?.length === 2
                ? character.coordinates
                : null;
        if (!xy || !this.map) return;

        // 2) Convert pixels -> latlng (use maxZoom if you set one for your image map)
        const zoomForUnproject = this.map.getMaxZoom?.() ?? this.map.getZoom();
        const latlng = this.map.unproject([xy[0], xy[1]], zoomForUnproject);

        // 3) Compute paddings so the "allowed box" is the inner 50% of the visible area
        const size = this.map.getSize();           // full map container size
        const panelIsOpen = this.panel?.classList?.contains('open');
        const panelSide = 'left';                  // change to 'right' if your panel is on the right

        let leftOverlay = 0, rightOverlay = 0;
        if (panelIsOpen) {
            const w = this.panel.getBoundingClientRect?.().width || 0;
            if (panelSide === 'left') leftOverlay = w; else rightOverlay = w;
        }

        const visibleW = Math.max(0, size.x - leftOverlay - rightOverlay);
        const visibleH = size.y;

        // Inner 50% means 25% margin on each visible side
        const padLeft   = leftOverlay  + visibleW * 0.25;
        const padRight  = rightOverlay + visibleW * 0.25;
        const padTop    =               visibleH * 0.25;
        const padBottom =               visibleH * 0.25;

        const options = {
            paddingTopLeft:    L.point(padLeft,  padTop),
            paddingBottomRight:L.point(padRight, padBottom),
            animate: true
        };

        // 4) Ensure the point lies within that inner box (no over-centering if already close)
        const doPan = () => this.map.panInside(latlng, options);
        // let characterSystem finish any own pan/zoom first
        requestAnimationFrame(() => requestAnimationFrame(doPan));

        // 5) Mobile: close panel after focusing (keep your behavior)
        if (success && window.innerWidth <= 768) {
            this.isPanelOpen = false;
            this.panel.classList.remove('open');
            this.toggleBtn.textContent = '📖';
        }
    }

    filterCharacters() {
        const relationshipFilter = document.getElementById('relationship-filter')?.value || '';
        const statusFilter = document.getElementById('status-filter')?.value || '';
        
        let filtered = this.characters;
        
        if (relationshipFilter) {
            filtered = filtered.filter(char => char.relationship === relationshipFilter);
        }
        
        if (statusFilter) {
            filtered = filtered.filter(char => char.status === statusFilter);
        }
        
        this.populateCharacterGrid(filtered);
    }

    showEmptyState() {
        this.grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>No Characters Found</h3>
                <p>No characters match your current filters or none have been added yet.</p>
            </div>
        `;
    }

    // Get panel statistics
    getPanelStats() {
        return {
            totalCharacters: this.characters.length,
            withMovements: this.characters.filter(c => c.movementHistory && c.movementHistory.length > 0).length,
            withCoordinates: this.characters.filter(c => c.coordinates).length,
            byStatus: this.groupBy(this.characters, 'status'),
            byRelationship: this.groupBy(this.characters, 'relationship')
        };
    }

    groupBy(array, property) {
        return array.reduce((acc, item) => {
            const key = item[property] || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }

    addPanelCSS() {
        const panelCSS = `
            /* Enhanced Character Panel Styles */
            .character-panel {
                position: fixed;
                top: 0;
                right: -400px;
                width: 350px;
                height: 100vh;
                background: var(--popup-bg);
                border-left: 1px solid var(--dropdown-border);
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                transition: right 0.3s ease;
                z-index: 1000;
                overflow-y: auto;
            }

            .character-panel.open {
                right: 0;
            }

            .character-panel .panel-header {
                padding: 20px;
                border-bottom: 1px solid var(--dropdown-border);
                background: var(--card-bg);
            }

            .character-panel .panel-header h3 {
                margin: 0;
                color: var(--text-color);
            }

            .character-panel .panel-content {
                padding: 20px;
            }

            .character-filters {
                margin-bottom: 20px;
            }

            .character-filters select {
                width: 100%;
                margin-bottom: 10px;
                padding: 8px;
                border: 1px solid var(--dropdown-border);
                border-radius: 4px;
                background: var(--popup-bg);
                color: var(--text-color);
            }

            .character-grid {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .character-card {
                background: var(--card-bg);
                border: 1px solid var(--dropdown-border);
                border-radius: 8px;
                padding: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
            }

            .character-card:hover {
                background: var(--dropdown-hover);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .character-card img {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                object-fit: cover;
                float: right;
                margin-left: 15px;
            }

            .character-info h4 {
                margin: 0 0 8px 0;
                color: var(--text-color);
                font-size: 1.1em;
            }

            .character-info .title {
                font-style: italic;
                color: var(--text-muted);
                margin-bottom: 8px;
                font-size: 0.9em;
            }

            .character-info .location {
                color: var(--text-muted);
                margin-bottom: 8px;
                font-size: 0.9em;
            }

            .status-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 0.8em;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .status-badge.status-alive {
                background: #E8F5E8;
                color: #2E7D32;
            }

            .status-badge.status-dead {
                background: #FFEBEE;
                color: #C62828;
            }

            .status-badge.status-missing {
                background: #FFF3E0;
                color: #EF6C00;
            }

            .status-badge.status-unknown {
                background: #F3E5F5;
                color: #7B1FA2;
            }

            .relationship-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 0.8em;
                font-weight: bold;
                margin-left: 5px;
            }

            .relationship-badge.relationship-ally {
                background: #E8F5E8;
                color: #2E7D32;
            }

            .relationship-badge.relationship-friendly {
                background: #E8F8F5;
                color: #00695C;
            }

            .relationship-badge.relationship-neutral {
                background: #FFFDE7;
                color: #F57F17;
            }

            .relationship-badge.relationship-suspicious {
                background: #FFF3E0;
                color: #EF6C00;
            }

            .relationship-badge.relationship-hostile {
                background: #FFEBEE;
                color: #C62828;
            }

            .relationship-badge.relationship-enemy {
                background: #FFEBEE;
                color: #B71C1C;
            }

            .empty-state {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-muted);
            }

            .empty-state .empty-icon {
                font-size: 3em;
                margin-bottom: 15px;
                opacity: 0.5;
            }

            .empty-state h3 {
                margin: 0 0 10px 0;
                color: var(--text-color);
            }

            .empty-state p {
                margin: 0;
                line-height: 1.4;
            }

            #toggle-panel {
                position: fixed;
                top: 50%;
                right: 10px;
                transform: translateY(-50%);
                background: var(--popup-bg);
                border: 1px solid var(--dropdown-border);
                border-radius: 50%;
                width: 50px;
                height: 50px;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.15);
                z-index: 1001;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2em;
            }

            #toggle-panel:hover {
                background: var(--dropdown-hover);
                transform: translateY(-50%) scale(1.1);
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .character-panel {
                    width: 100%;
                    right: -100%;
                }

                .character-panel .panel-content {
                    padding: 15px;
                }

                .character-card {
                    padding: 12px;
                }

                .character-card img {
                    width: 50px;
                    height: 50px;
                }

                #toggle-panel {
                    right: 15px;
                    width: 45px;
                    height: 45px;
                }
            }

            /* Dark mode adjustments */
            [data-theme="dark"] .character-panel {
                box-shadow: -2px 0 10px rgba(0,0,0,0.3);
            }

            [data-theme="dark"] .status-badge.status-alive {
                background: rgba(46, 125, 50, 0.3);
                color: #81C784;
            }

            [data-theme="dark"] .status-badge.status-dead {
                background: rgba(198, 40, 40, 0.3);
                color: #E57373;
            }

            [data-theme="dark"] .status-badge.status-missing {
                background: rgba(239, 108, 0, 0.3);
                color: #FFB74D;
            }

            [data-theme="dark"] .status-badge.status-unknown {
                background: rgba(123, 31, 162, 0.3);
                color: #CE93D8;
            }

            [data-theme="dark"] .relationship-badge.relationship-ally {
                background: rgba(46, 125, 50, 0.3);
                color: #81C784;
            }

            [data-theme="dark"] .relationship-badge.relationship-friendly {
                background: rgba(0, 105, 92, 0.3);
                color: #4DB6AC;
            }

            [data-theme="dark"] .relationship-badge.relationship-neutral {
                background: rgba(245, 127, 23, 0.3);
                color: #FFD54F;
            }

            [data-theme="dark"] .relationship-badge.relationship-suspicious {
                background: rgba(239, 108, 0, 0.3);
                color: #FFB74D;
            }

            [data-theme="dark"] .relationship-badge.relationship-hostile {
                background: rgba(198, 40, 40, 0.3);
                color: #E57373;
            }

            [data-theme="dark"] .relationship-badge.relationship-enemy {
                background: rgba(183, 28, 28, 0.3);
                color: #EF5350;
            }
        `;

        const style = document.createElement('style');
        style.textContent = panelCSS;
        document.head.appendChild(style);
    }

    // Public methods
    openPanel() {
        this.isPanelOpen = true;
        this.panel.classList.add('open');
        this.toggleBtn.textContent = '✖️';
    }

    closePanel() {
        this.isPanelOpen = false;
        this.panel.classList.remove('open');
        this.toggleBtn.textContent = '📖';
    }

    refreshPanel() {
        this.populateCharacterGrid();
    }

    isOpen() {
        return this.isPanelOpen;
    }
}

// Create global character panel instance
window.characterPanel = new CharacterPanel();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterPanel;
}