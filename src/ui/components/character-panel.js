// character-panel.js - Clean Character Panel Logic
class CharacterPanel {
    constructor() {
        this.panel = null;
        this.toggleBtn = null;
        this.grid = null;
        this.resizeHandle = null;
        this.isPanelOpen = false;
        this.characters = [];
        this.showMovementControls = false;
        
        // Resize properties
        this.isResizing = false;
        this.currentWidth = 320;
        this.minWidth = 30;
        this.maxWidth = 600;
        this.collapseThreshold = 320;
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
        this.toggleBtn = document.getElementById('toggle-panel');
        this.grid = document.getElementById('character-grid');
        this.resizeHandle = document.getElementById('resize-handle');
        
        if (!this.panel || !this.toggleBtn || !this.grid) {
            console.warn('Character panel elements not found');
            return;
        }
        
        this.setupEventListeners();
        this.setupResizeHandlers();
        this.initializePanelContent();
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.togglePanel());
        
        // Add event delegation for character clicks
        this.panel.addEventListener('click', (e) => {
            const characterInfo = e.target.closest('.character-info');
            if (characterInfo) {
                const characterName = characterInfo.dataset.characterName;
                if (characterName) {
                    this.focusCharacter(characterName);
                }
            }
        });
    }

    setupResizeHandlers() {
        if (!this.resizeHandle) return;

        let startX, startWidth;

        const startResize = (e) => {
            if (!this.isPanelOpen) return;
            
            this.isResizing = true;
            startX = e.clientX || e.touches[0].clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(this.panel).width, 10);
            
            this.resizeHandle.classList.add('dragging');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };

        const doResize = (e) => {
            if (!this.isResizing || !this.isPanelOpen) return;
            
            const clientX = e.clientX || e.touches[0].clientX;
            const diff = startX - clientX;
            let newWidth = startWidth + diff;
            
            // Clamp width between min and max
            newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));
            
            this.setWidth(newWidth);
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
        };

        // Mouse events
        this.resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

        // Touch events for mobile
        this.resizeHandle.addEventListener('touchstart', startResize);
        document.addEventListener('touchmove', doResize);
        document.addEventListener('touchend', stopResize);
    }

    setWidth(width) {
        this.currentWidth = width;
        this.panel.style.width = width + 'px';
    }

    collapsePanel() {
        this.panel.classList.add('collapsed');
        this.setWidth(this.minWidth);
    }

    expandPanel() {
        this.panel.classList.remove('collapsed');
        this.setWidth(this.collapseThreshold);
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
            <div class="movement-section">
                <div class="movement-header" onclick="window.characterPanel.toggleMovementControls()">
                    <h4>🛤️ Movement Paths Options</h4>
                    <span class="movement-toggle">▼</span>
                </div>
                
                <div id="movement-content" class="movement-content">
                    <div class="movement-actions">
                        <button id="show-all-paths" class="movement-btn">✅ Show All</button>
                        <button id="hide-all-paths" class="movement-btn">❌ Hide All</button>
                    </div>
                </div>
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

    toggleMovementControls() {
        this.showMovementControls = !this.showMovementControls;
        const content = document.getElementById('movement-content');
        const toggle = document.querySelector('.movement-toggle');
        
        if (content && toggle) {
            content.style.display = this.showMovementControls ? 'block' : 'none';
            toggle.textContent = this.showMovementControls ? '▼' : '▶';
        }
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
        const searchFields = [
            character.name,
            character.title,
            character.location,
            character.relationship,
            character.status,
            character.faction,
            character.description,
            character.notes
        ];

        return searchFields.some(field => 
            field && field.toLowerCase().includes(query)
        );
    }

    // Panel management
    togglePanel() {
        this.isPanelOpen = !this.isPanelOpen;
        this.panel.classList.toggle('open', this.isPanelOpen);
        this.toggleBtn.textContent = this.isPanelOpen ? '✖️' : '📖';
        
        // Reset to default width when opening
        if (this.isPanelOpen) {
            this.expandPanel();
        }
    }

    openPanel() {
        this.isPanelOpen = true;
        this.panel.classList.add('open');
        this.toggleBtn.textContent = '✖️';
        this.expandPanel();
    }

    closePanel() {
        this.isPanelOpen = false;
        this.panel.classList.remove('open');
        this.toggleBtn.textContent = '📖';
        // Reset width when closing
        this.setWidth(this.collapseThreshold);
        this.panel.classList.remove('collapsed');
    }

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
                            <span class="checkmark" style="border-color: ${this.getRelationshipColor(character.relationship)}"></span>
                        </label>
                    </div>
                </div>
                
                <div class="character-info" data-character-name="${character.name}">
                    <div class="character-details">
                        <h4>${character.name}${hasMovement ? ` 🛤️ ${movementCount + 1}` : ''}</h4>
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
        const success = window.characterSystem?.focusCharacter?.(characterName);
        
        if (!success) {
            console.warn(`⚠️ Could not focus on character "${characterName}"`);
            return;
        }

        // Close panel on mobile
        if (window.innerWidth <= 768) {
            this.closePanel();
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

// Initialize
window.characterPanel = new CharacterPanel();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterPanel;
}