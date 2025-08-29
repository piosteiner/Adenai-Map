// character-panel.js - Clean Character Panel Logic
class CharacterPanel {
    constructor() {
        this.panel = null;
        this.grid = null;
        this.resizeHandle = null;
        this.isPanelOpen = true; // Always visible, but collapsed by default
        this.characters = [];
        this.showMovementControls = false;
        
        // Hover behavior properties
        this.hoverTimer = null;
        this.hoverDelay = 200; // 200ms delay
        this.collapseHoverTimer = null;
        this.collapseHoverDelay = 1000; // 1.0 seconds delay for collapse
        this.collapseTimer = null; // Timer for resize handle collapse delay
        this.isHoverExpanded = false; // Track if panel was expanded by hover
        
        // Resize properties
        this.isResizing = false;
        this.currentWidth = 30; // Start in collapsed state
        this.minWidth = 30;
        this.maxWidth = 600;
        this.collapseThreshold = 350;
        this.expandThreshold = 50;
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initPanel());
        } else {
            this.initPanel();
        }

        document.addEventListener('charactersLoaded', (e) => {
            this.characters = e.detail.characters;
            this.populateCharacterGrid();
        });
    }

    initPanel() {
        this.panel = document.getElementById('character-panel');
        this.grid = document.getElementById('character-grid');
        this.resizeHandle = document.getElementById('resize-handle');
        this.retractBtn = document.getElementById('retract-panel');
        
        console.log('🔧 Panel init - resize handle found:', !!this.resizeHandle);
        
        if (!this.panel || !this.grid) {
            console.warn('Character panel elements not found');
            return;
        }
        
        // Set initial state to collapsed but visible
        this.panel.classList.add('open', 'collapsed');
        this.setWidth(this.minWidth);
        
        this.setupEventListeners();
        this.setupResizeHandlers();
        this.initializePanelContent();
    }

    setupEventListeners() {
        // Add event delegation for character clicks
        this.panel.addEventListener('click', (e) => {
            // Prevent retract button from interfering with character clicks
            if (e.target.closest('#retract-panel')) {
                return; // Let the retract button handle its own click
            }
            
            const characterInfo = e.target.closest('.character-info');
            if (characterInfo) {
                const characterName = characterInfo.dataset.characterName;
                if (characterName) {
                    console.log(`🖱️ Character clicked: "${characterName}"`);
                    this.focusCharacter(characterName);
                }
            }
        });

        // Retract button event listener
        if (this.retractBtn) {
            this.retractBtn.addEventListener('click', () => {
                this.collapsePanel();
            });
        }

        // Hover behavior for auto-expand
        this.setupHoverBehavior();
    }

    setupHoverBehavior() {
        // Setup hover behavior for panel expansion/collapse
        if (this.panel) {
            this.panelHoverCleanup = EventUtils.setupHoverBehavior(this.panel, {
                enterDelay: this.hoverDelay,
                onEnter: () => {
                    if (this.panel.classList.contains('collapsed') && !this.isResizing) {
                        this.expandPanel();
                        this.isHoverExpanded = true;
                    }
                },
                onLeave: () => {
                    // Panel stays open once hover-triggered (no auto-collapse from main panel)
                }
            });
        }

        // Setup hover behavior for resize handle
        if (this.resizeHandle) {
            console.log('🔧 Setting up resize handle hover behavior');
            console.log('🔧 EventUtils available:', typeof EventUtils !== 'undefined');
            this.handleHoverCleanup = EventUtils.setupHoverBehavior(this.resizeHandle, {
                enterDelay: this.hoverDelay,
                leaveDelay: this.collapseHoverDelay,
                onEnter: () => {
                    console.log('🖱️ Resize handle mouse enter');
                    if (this.panel.classList.contains('collapsed') && !this.isResizing) {
                        console.log('🖱️ Expanding panel from resize handle hover');
                        this.expandPanel();
                        this.isHoverExpanded = true;
                    } else if (!this.panel.classList.contains('collapsed') && !this.isResizing) {
                        // Panel is open - start timer to collapse it after delay
                        console.log('🖱️ Panel is open - starting collapse timer');
                        this.collapseTimer = setTimeout(() => {
                            console.log('🖱️ Collapsing panel after hover delay');
                            this.collapsePanel();
                            this.isHoverExpanded = false;
                        }, 1000); // 1.0 second delay
                    }
                },
                onLeave: () => {
                    console.log('🖱️ Resize handle mouse leave');
                    // Clear any pending collapse timer
                    if (this.collapseTimer) {
                        console.log('🖱️ Clearing collapse timer');
                        clearTimeout(this.collapseTimer);
                        this.collapseTimer = null;
                    }
                }
            });
        }
    }

    setupResizeHandlers() {
        if (!this.resizeHandle) return;

        let startX, startWidth;

        const startResize = (e) => {
            this.isResizing = true;
            startX = e.clientX || e.touches[0].clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(this.panel).width, 10);
            
            // Clear hover state when user starts dragging
            this.clearHoverTimer();
            this.clearCollapseHoverTimer();
            this.isHoverExpanded = false;
            
            this.resizeHandle.classList.add('dragging');
            this.resizeHandle.classList.remove('trigger-zone');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };

        const doResize = (e) => {
            if (!this.isResizing) return;
            
            const clientX = e.clientX || e.touches[0].clientX;
            const diff = startX - clientX;
            let newWidth = startWidth + diff;
            
            // Clamp width between min and max
            newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));
            
            this.setWidth(newWidth);
            this.updateHandlePosition();
            e.preventDefault();
        };

        const stopResize = () => {
            if (!this.isResizing) return;
            
            this.isResizing = false;
            this.resizeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Auto-collapse or expand logic
            if (this.currentWidth < this.collapseThreshold) {
                this.collapsePanel();
            } else if (this.panel.classList.contains('collapsed') && this.currentWidth > this.expandThreshold) {
                this.expandPanel();
            }
            
            this.updateHandlePosition();
        };

        // Mouse events
        this.resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

        // Touch events for mobile
        this.resizeHandle.addEventListener('touchstart', startResize);
        document.addEventListener('touchmove', doResize);
        document.addEventListener('touchend', stopResize);
        
        // Initialize handle position
        this.updateHandlePosition();
    }

    setWidth(width) {
        this.currentWidth = width;
        this.panel.style.width = width + 'px';
    }

    updateHandlePosition() {
        if (!this.resizeHandle) return;
        
        // Always position handle next to the panel (since panel is always visible)
        // Handle is now 16px wide, so subtract 16 from panel width
        this.resizeHandle.classList.remove('trigger-zone');
        this.resizeHandle.style.right = (this.currentWidth - 16) + 'px';
    }

    collapsePanel() {
        this.panel.classList.add('collapsed');
        this.setWidth(this.minWidth);
        this.updateHandlePosition();
        // Clear hover state when manually collapsing
        this.clearHoverTimer();
        this.clearCollapseHoverTimer();
        this.isHoverExpanded = false;
    }

    expandPanel() {
        this.panel.classList.remove('collapsed');
        this.setWidth(this.collapseThreshold);
        this.updateHandlePosition();
    }

    initializePanelContent() {
        const panelContent = this.panel.querySelector('.panel-content');
        if (!panelContent) return;

        // Add movement controls and search - HTML comes from templates
        const controlsHTML = this.getMovementControlsHTML();
        const searchHTML = this.getSearchBarHTML();
        
        panelContent.insertAdjacentHTML('afterbegin', controlsHTML + searchHTML);
        this.bindMovementControls();
    }

    getMovementControlsHTML() {
        return `
            <div class="movement-actions">
                <button id="show-all-paths" class="movement-btn">✅ Alle Pfade zeigen</button>
                <button id="hide-all-paths" class="movement-btn">❌ Alle Pfade ausblenden</button>
            </div>
        `;
    }

    getSearchBarHTML() {
        return `
            <div class="search-section">
                <input type="text" 
                       id="character-search" 
                       class="character-search" 
                       placeholder="🔍 Search characters..."
                       oninput="window.characterPanel.handleSearch()">
            </div>
        `;
    }

    bindMovementControls() {
        document.getElementById('show-all-paths')?.addEventListener('click', () => {
            this.showAllCharacterPaths();
        });
        
        document.getElementById('hide-all-paths')?.addEventListener('click', () => {
            this.hideAllCharacterPaths();
        });
    }

    // Movement control methods
    showAllCharacterPaths() {
        if (!window.movementSystem) return;
        
        window.movementSystem.showAllPaths();
        this.updateAllCheckboxes(true);
    }

    hideAllCharacterPaths() {
        if (!window.movementSystem) return;
        
        window.movementSystem.hideAllPaths();
        this.updateAllCheckboxes(false);
    }

    updateAllCheckboxes(checked) {
        this.characters.forEach(character => {
            const checkbox = document.getElementById(`path-${character.id}`);
            if (checkbox && !checkbox.disabled) {
                checkbox.checked = checked;
            }
        });
    }

    // Search functionality
    handleSearch() {
        const searchInput = document.getElementById('character-search');
        if (!searchInput) return;
        
        const query = searchInput.value.toLowerCase().trim();
        const filteredCharacters = query === '' 
            ? this.characters
            : this.characters.filter(character => this.matchesSearchQuery(character, query));
        
        this.populateCharacterGrid(filteredCharacters);
    }

    matchesSearchQuery(character, query) {
        return DataUtils.matchesSearchQuery(character, query, [
            'name', 'title', 'location', 'relationship', 
            'status', 'faction', 'description', 'notes'
        ]);
    }

    // Panel management
    // Character grid management
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
        
        const hasMovement = character.movementHistory && character.movementHistory.length > 0;
        const movementCount = hasMovement ? character.movementHistory.length : 0;
        const isPathVisible = window.movementSystem?.isCharacterPathVisible?.(character.id) || false;
        
        card.innerHTML = `
            <div class="card-layout">
                <div class="avatar-checkbox-section ${!character.image ? 'no-avatar' : ''}">
                    ${character.image ? `<img src="${character.image}" alt="${character.name}" class="character-avatar">` : ''}
                    <div class="movement-checkbox">
                        <label>
                            <input type="checkbox" 
                                   id="path-${character.id}" 
                                   ${isPathVisible ? 'checked' : ''} 
                                   ${!hasMovement ? 'disabled' : ''}
                                   onchange="window.characterPanel.toggleCharacterPath('${character.id}')">
                            <span class="checkmark" 
                                  style="border-color: ${this.getRelationshipColor(character.relationship)}; 
                                         --checkmark-color: ${this.getRelationshipColor(character.relationship)}"></span>
                        </label>
                    </div>
                </div>
                
                <div class="character-info" data-character-name="${character.name}">
                    <div class="character-details">
                        <h4>${character.name}</h4>
                        ${character.title ? `<div class="character-title">${character.title}</div>` : ''}
                        <div class="character-location">📍 ${character.location || 'Unknown'}</div>
                        <div class="character-badges">
                            <span class="badge status-${character.status}">${AdenaiConfig.getCharacterStatusLabel(character.status) || 'unknown'}</span>
                            <span class="badge relationship-${character.relationship}">
                                ${this.formatRelationship(character.relationship)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return card;
    }

    toggleCharacterPath(characterId) {
        if (!window.movementSystem) {
            console.warn('⚠️ Movement system not available');
            return;
        }
        
        const checkbox = document.getElementById(`path-${characterId}`);
        const isVisible = checkbox?.checked || false;
        
        if (isVisible) {
            const success = window.movementSystem.showCharacterPath(characterId);
            // If showing path failed, uncheck the checkbox
            if (success === false) {
                checkbox.checked = false;
            }
        } else {
            window.movementSystem.hideCharacterPath(characterId);
        }
    }

    focusCharacter(characterName) {
        console.log(`🎯 Character panel requesting focus for: "${characterName}"`);
        
        // Check if character system is available
        if (!window.characterSystem) {
            console.error('❌ Character system not available!');
            return;
        }
        
        if (typeof window.characterSystem.focusCharacter !== 'function') {
            console.error('❌ Character system focusCharacter method not available!');
            return;
        }
        
        const success = window.characterSystem.focusCharacter(characterName);
        
        if (!success) {
            console.warn(`⚠️ Could not focus on character "${characterName}"`);
            return;
        }

        console.log(`✅ Successfully focused on character "${characterName}"`);
        
        // Collapse panel on mobile for better map visibility
        if (window.innerWidth <= 768) {
            this.collapsePanel();
        }
    }

    // Helper methods
    getRelationshipColor(relationship) {
        const colors = {
            ally: '#4CAF50',
            friendly: '#8BC34A',
            neutral: '#FFC107',
            suspicious: '#FF9800',
            hostile: '#FF5722',
            enemy: '#F44336',
            party: '#584cffff'
        };
        return colors[relationship] || '#666666';
    }

    formatRelationship(relationship) {
        return AdenaiConfig.getCharacterRelationshipLabel(relationship) || relationship || 'Unknown';
    }

    showEmptyState() {
        this.grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>No Characters Found</h3>
                <p>No characters match your search or none have been added yet.</p>
            </div>
        `;
    }

    // Public API
    refreshPanel() {
        this.populateCharacterGrid();
    }

    isExpanded() {
        return !this.panel.classList.contains('collapsed');
    }

    getPanelStats() {
        return {
            totalCharacters: this.characters.length,
            withMovements: this.characters.filter(c => c.movementHistory && c.movementHistory.length > 0).length,
            withCoordinates: this.characters.filter(c => c.coordinates).length,
            byStatus: DataUtils.groupBy(this.characters, 'status'),
            byRelationship: DataUtils.groupBy(this.characters, 'relationship')
        };
    }
}

// Initialize
window.characterPanel = new CharacterPanel();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterPanel;
}