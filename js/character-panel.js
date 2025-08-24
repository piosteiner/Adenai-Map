// character-panel.js - Enhanced Character Panel with Integrated Movement Controls
class CharacterPanel {
    constructor() {
        this.panel = null;
        this.toggleBtn = null;
        this.grid = null;
        this.isPanelOpen = false;
        this.characters = [];
        this.showMovementControls = false;
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
        this.addIntegratedPanelCSS();
        this.addMovementControlsSection();
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

    addMovementControlsSection() {
        const panelContent = this.panel.querySelector('.panel-content');
        if (!panelContent) return;

        // Add movement controls at the top
        const movementControlsHtml = `
            <div class="integrated-movement-section">
                <div class="movement-section-header" onclick="window.characterPanel.toggleMovementControls()">
                    <h4>🛤️ Movement Paths</h4>
                    <span class="movement-section-toggle">▶</span>
                </div>
                
                <div id="integrated-movement-content" class="integrated-movement-content" style="display: none;">
                    <div class="movement-quick-actions">
                        <button id="integrated-show-all-paths" class="btn-secondary movement-action-btn">✅ Show All</button>
                        <button id="integrated-hide-all-paths" class="btn-secondary movement-action-btn">❌ Hide All</button>
                    </div>
                    
                    <div id="integrated-timeline-controls" class="integrated-timeline-controls" style="display: none;">
                        <label class="movement-label">📅 Date Range Filter:</label>
                        <div class="date-inputs">
                            <input type="date" id="integrated-start-date" class="date-input" />
                            <input type="date" id="integrated-end-date" class="date-input" />
                        </div>
                        <button id="integrated-apply-date-filter" class="btn-secondary movement-action-btn">Apply Filter</button>
                        <button id="integrated-clear-date-filter" class="btn-secondary movement-action-btn">Clear Filter</button>
                    </div>
                    
                    <div class="movement-legend">
                        <div class="legend-title">Legend:</div>
                        <div class="legend-text">📍 = Start • 🚩 = Current • Numbers = Path order</div>
                    </div>
                </div>
            </div>
        `;

        panelContent.insertAdjacentHTML('afterbegin', movementControlsHtml);
        this.setupIntegratedMovementListeners();
    }

    toggleMovementControls() {
        this.showMovementControls = !this.showMovementControls;
        const content = document.getElementById('integrated-movement-content');
        const toggle = document.querySelector('.movement-section-toggle');
        const timelineControls = document.getElementById('integrated-timeline-controls');
        
        if (content && toggle) {
            content.style.display = this.showMovementControls ? 'block' : 'none';
            toggle.textContent = this.showMovementControls ? '▼' : '▶';
            
            // Show timeline controls if movement controls are visible
            if (timelineControls) {
                timelineControls.style.display = this.showMovementControls ? 'block' : 'none';
            }
            
            // Refresh character grid to show/hide checkboxes
            this.populateCharacterGrid();
        }
    }

    setupIntegratedMovementListeners() {
        // Show/Hide all buttons
        document.getElementById('integrated-show-all-paths')?.addEventListener('click', () => {
            if (window.movementSystem) {
                window.movementSystem.showAllPaths();
                // Update all checkboxes in the character grid
                this.characters.forEach(character => {
                    const checkbox = document.getElementById(`integrated-path-${character.id}`);
                    if (checkbox && !checkbox.disabled) {
                        checkbox.checked = true;
                    }
                });
            }
        });
        
        document.getElementById('integrated-hide-all-paths')?.addEventListener('click', () => {
            if (window.movementSystem) {
                window.movementSystem.hideAllPaths();
                // Update all checkboxes in the character grid
                this.characters.forEach(character => {
                    const checkbox = document.getElementById(`integrated-path-${character.id}`);
                    if (checkbox) {
                        checkbox.checked = false;
                    }
                });
            }
        });

        // Date filter buttons
        document.getElementById('integrated-apply-date-filter')?.addEventListener('click', () => {
            const startDate = document.getElementById('integrated-start-date').value;
            const endDate = document.getElementById('integrated-end-date').value;
            
            if (startDate && endDate && window.movementSystem) {
                window.movementSystem.filterPathsByDateRange(startDate, endDate);
            }
        });
        
        document.getElementById('integrated-clear-date-filter')?.addEventListener('click', () => {
            document.getElementById('integrated-start-date').value = '';
            document.getElementById('integrated-end-date').value = '';
            
            // Reset to show original paths
            if (window.movementSystem) {
                window.movementSystem.characterPaths.forEach(pathData => {
                    if (pathData.isVisible) {
                        window.movementSystem.hideCharacterPath(pathData.character.id);
                        window.movementSystem.showCharacterPath(pathData.character.id);
                    }
                });
            }
        });
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
            const card = this.createIntegratedCharacterCard(character);
            this.grid.appendChild(card);
        });
    }

    createIntegratedCharacterCard(character) {
        const card = document.createElement('div');
        card.className = 'integrated-character-card';
        
        // Check if character has movement data
        const hasMovementData = character.movementHistory && character.movementHistory.length > 0;
        const movementCount = hasMovementData ? character.movementHistory.length : 0;
        const isPathVisible = window.movementSystem?.visibleCharacterPaths?.has(character.id) || false;
        
        // Movement checkbox (only show if movement controls are visible)
        const movementCheckbox = this.showMovementControls ? `
            <div class="movement-checkbox-container">
                <label class="movement-checkbox-label">
                    <input type="checkbox" 
                           id="integrated-path-${character.id}" 
                           ${isPathVisible ? 'checked' : ''} 
                           ${!hasMovementData ? 'disabled' : ''}
                           onchange="window.characterPanel.toggleCharacterPath('${character.id}')">
                    <span class="movement-checkmark" style="border-color: ${this.getRelationshipColor(character.relationship)}"></span>
                </label>
            </div>
        ` : '';
        
        // Character info section (clickable to focus character)
        const characterInfo = `
            <div class="character-info-section" onclick="window.characterPanel.focusCharacterOnMap('${character.name}')" style="cursor: pointer;">
                ${character.image ? `<img src="${character.image}" alt="${character.name}" class="character-avatar">` : ''}
                <div class="character-details">
                    <h4 class="character-name">${character.name}${hasMovementData ? ` 🛤️ ${movementCount + 1}` : ''}</h4>
                    ${character.title ? `<div class="character-title">${character.title}</div>` : ''}
                    <div class="character-location">📍 ${character.location || 'Unknown'}</div>
                    <div class="character-badges">
                        <span class="status-badge status-${character.status}">${character.status || 'unknown'}</span>
                        <span class="relationship-badge relationship-${character.relationship}">
                            ${this.formatRelationship(character.relationship)}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        card.innerHTML = `
            <div class="integrated-card-layout">
                ${movementCheckbox}
                ${characterInfo}
            </div>
        `;
        
        return card;
    }

    toggleCharacterPath(characterId) {
        if (!window.movementSystem) return;
        
        const checkbox = document.getElementById(`integrated-path-${characterId}`);
        const isVisible = checkbox?.checked || false;
        
        if (isVisible) {
            window.movementSystem.showCharacterPath(characterId);
        } else {
            window.movementSystem.hideCharacterPath(characterId);
        }
    }

    focusCharacterOnMap(characterName) {
        // Use the centralized character system focus method
        const success = window.characterSystem?.focusCharacter?.(characterName);
        
        if (!success) {
            console.warn(`⚠️ Could not focus on character "${characterName}"`);
            return;
        }

        // Mobile: close panel after focusing
        if (window.innerWidth <= 768) {
            this.closePanel();
        }
    }

    getRelationshipColor(relationship) {
        const colors = {
            ally: '#4CAF50',
            friendly: '#8BC34A',
            neutral: '#FFC107',
            suspicious: '#FF9800',
            hostile: '#FF5722',
            enemy: '#F44336'
        };
        return colors[relationship] || '#666666';
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

    addIntegratedPanelCSS() {
        const integratedCSS = `
            /* Integrated Movement Controls in Character Panel */
            .integrated-movement-section {
                margin-bottom: 20px;
                border-bottom: 1px solid var(--dropdown-border);
                padding-bottom: 15px;
            }

            .movement-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                padding: 8px 0;
                border-bottom: 1px solid var(--dropdown-border);
                margin-bottom: 10px;
            }

            .movement-section-header:hover {
                background: var(--dropdown-hover);
                padding: 8px;
                margin: 0 -8px 10px -8px;
                border-radius: 4px;
            }

            .movement-section-header h4 {
                margin: 0;
                font-size: 1em;
                color: var(--text-color);
            }

            .movement-section-toggle {
                font-size: 0.8em;
                color: var(--text-color);
                opacity: 0.7;
            }

            .movement-quick-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 10px;
            }

            .movement-action-btn {
                padding: 6px 10px;
                font-size: 0.8em;
                background: var(--popup-bg);
                color: var(--text-color);
                border: 1px solid var(--dropdown-border);
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }

            .movement-action-btn:hover {
                background: var(--dropdown-hover);
            }

            /* Integrated Character Cards */
            .integrated-character-card {
                background: var(--card-bg);
                border: 1px solid var(--dropdown-border);
                border-radius: 8px;
                margin-bottom: 12px;
                overflow: hidden;
                transition: all 0.3s ease;
            }

            .integrated-character-card:hover {
                background: var(--dropdown-hover);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .integrated-card-layout {
                display: flex;
                align-items: center;
                padding: 12px;
            }

            .movement-checkbox-container {
                margin-right: 12px;
                flex-shrink: 0;
            }

            .movement-checkbox-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                position: relative;
            }

            .movement-checkbox-label input[type="checkbox"] {
                position: absolute;
                opacity: 0;
                width: 18px;
                height: 18px;
                cursor: pointer;
            }

            .movement-checkmark {
                width: 18px;
                height: 18px;
                border: 2px solid var(--dropdown-border);
                border-radius: 4px;
                background: var(--popup-bg);
                transition: all 0.3s ease;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .movement-checkbox-label input[type="checkbox"]:checked + .movement-checkmark {
                background: var(--dropdown-border);
            }

            .movement-checkbox-label input[type="checkbox"]:checked + .movement-checkmark::after {
                content: '✓';
                color: white;
                font-size: 12px;
                font-weight: bold;
            }

            .movement-checkbox-label input[type="checkbox"]:disabled + .movement-checkmark {
                background: var(--dropdown-bg);
                border-color: var(--text-muted);
                opacity: 0.5;
            }

            .character-info-section {
                display: flex;
                align-items: center;
                flex: 1;
                transition: all 0.2s ease;
            }

            .character-info-section:hover {
                transform: translateX(2px);
            }

            .character-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                object-fit: cover;
                margin-right: 12px;
                border: 2px solid var(--dropdown-border);
                flex-shrink: 0;
            }

            .character-details {
                flex: 1;
            }

            .character-name {
                margin: 0 0 4px 0;
                font-size: 1em;
                color: var(--text-color);
                font-weight: bold;
            }

            .character-title {
                font-style: italic;
                font-size: 0.85em;
                color: var(--text-muted);
                margin-bottom: 4px;
            }

            .character-location {
                font-size: 0.85em;
                color: var(--text-muted);
                margin-bottom: 8px;
            }

            .character-badges {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }

            .status-badge, .relationship-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 0.75em;
                font-weight: bold;
            }

            .status-badge.status-alive { background: #E8F5E8; color: #2E7D32; }
            .status-badge.status-dead { background: #FFEBEE; color: #C62828; }
            .status-badge.status-missing { background: #FFF3E0; color: #EF6C00; }
            .status-badge.status-unknown { background: #F3E5F5; color: #7B1FA2; }

            .relationship-badge.relationship-ally { background: #E8F5E8; color: #2E7D32; }
            .relationship-badge.relationship-friendly { background: #E8F8F5; color: #00695C; }
            .relationship-badge.relationship-neutral { background: #FFFDE7; color: #F57F17; }
            .relationship-badge.relationship-suspicious { background: #FFF3E0; color: #EF6C00; }
            .relationship-badge.relationship-hostile { background: #FFEBEE; color: #C62828; }
            .relationship-badge.relationship-enemy { background: #FFEBEE; color: #B71C1C; }

            /* Date Range Controls */
            .integrated-timeline-controls {
                margin-top: 10px;
                padding: 10px;
                background: var(--dropdown-bg);
                border-radius: 4px;
                border: 1px solid var(--dropdown-border);
            }

            .movement-label {
                display: block;
                margin-bottom: 6px;
                font-size: 0.85em;
                font-weight: bold;
                color: var(--text-color);
            }

            .date-inputs {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 8px;
            }

            .date-input {
                padding: 6px;
                font-size: 0.8em;
                background: var(--popup-bg);
                color: var(--text-color);
                border: 1px solid var(--dropdown-border);
                border-radius: 4px;
            }

            .movement-legend {
                margin-top: 12px;
                padding: 8px;
                background: var(--dropdown-bg);
                border-radius: 4px;
                border: 1px solid var(--dropdown-border);
            }

            .legend-title {
                font-size: 0.8em;
                font-weight: bold;
                color: var(--text-color);
                margin-bottom: 4px;
            }

            .legend-text {
                font-size: 0.75em;
                color: var(--text-color);
                opacity: 0.8;
                line-height: 1.3;
            }

            /* Mobile Responsiveness */
            @media (max-width: 768px) {
                .integrated-card-layout {
                    padding: 10px;
                }

                .character-avatar {
                    width: 40px;
                    height: 40px;
                }

                .movement-quick-actions {
                    grid-template-columns: 1fr;
                    gap: 6px;
                }

                .date-inputs {
                    grid-template-columns: 1fr;
                    gap: 6px;
                }
            }

            /* Dark Mode Support */
            [data-theme="dark"] .status-badge.status-alive { background: rgba(46, 125, 50, 0.3); color: #81C784; }
            [data-theme="dark"] .status-badge.status-dead { background: rgba(198, 40, 40, 0.3); color: #E57373; }
            [data-theme="dark"] .status-badge.status-missing { background: rgba(239, 108, 0, 0.3); color: #FFB74D; }
            [data-theme="dark"] .status-badge.status-unknown { background: rgba(123, 31, 162, 0.3); color: #CE93D8; }

            [data-theme="dark"] .relationship-badge.relationship-ally { background: rgba(46, 125, 50, 0.3); color: #81C784; }
            [data-theme="dark"] .relationship-badge.relationship-friendly { background: rgba(0, 105, 92, 0.3); color: #4DB6AC; }
            [data-theme="dark"] .relationship-badge.relationship-neutral { background: rgba(245, 127, 23, 0.3); color: #FFD54F; }
            [data-theme="dark"] .relationship-badge.relationship-suspicious { background: rgba(239, 108, 0, 0.3); color: #FFB74D; }
            [data-theme="dark"] .relationship-badge.relationship-hostile { background: rgba(198, 40, 40, 0.3); color: #E57373; }
            [data-theme="dark"] .relationship-badge.relationship-enemy { background: rgba(183, 28, 28, 0.3); color: #EF5350; }

            [data-theme="dark"] .movement-checkmark {
                border-color: var(--dropdown-border);
                background: var(--card-bg);
            }

            [data-theme="dark"] .movement-checkbox-label input[type="checkbox"]:checked + .movement-checkmark {
                background: #4CAF50;
                border-color: #4CAF50;
            }
        `;

        const style = document.createElement('style');
        style.textContent = integratedCSS;
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
}

// Create global character panel instance
window.characterPanel = new CharacterPanel();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterPanel;
}