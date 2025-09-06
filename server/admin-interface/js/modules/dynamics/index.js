// admin-interface/js/modules/temporal/index.js - Dynamics Features Management

class DynamicsManager {
    constructor() {
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.currentFeature = null;
        this.currentType = 'political_areas';
        this.debugMode = true;
        
        // Initialize sub-modules
        this.operations = new DynamicsOperations(this.auth, this.ui);
        this.mapManager = new DynamicsMap(this.ui);
        this.timelineManager = new DynamicsTimeline(this.ui);
        
        this.setupFormListeners();
        this.setupTypeSelector();
        
        console.log('Dynamics Manager created and ready');
    }

    setupFormListeners() {
        document.addEventListener('click', (e) => {
            // Feature management
            if (e.target.id === 'add-dynamics-feature-btn') {
                this.createNewFeature();
            }
            
            if (e.target.id === 'delete-dynamics-feature-btn') {
                this.deleteFeature();
            }
            
            if (e.target.id === 'close-dynamics-editor') {
                this.closeEditor();
            }
            
            // Timeframe management
            if (e.target.id === 'add-timeframe-btn') {
                this.addTimeframe();
            }
            
            if (e.target.classList.contains('delete-timeframe-btn')) {
                const index = parseInt(e.target.dataset.index);
                this.deleteTimeframe(index);
            }
            
            // Timeline controls
            if (e.target.id === 'dynamics-timeline-play') {
                this.timelineManager.play();
            }
            
            if (e.target.id === 'dynamics-timeline-pause') {
                this.timelineManager.pause();
            }
            
            if (e.target.id === 'sync-dynamics-btn') {
                this.syncToClient();
            }
        });

        // Feature form submission
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'dynamics-feature-form') {
                e.preventDefault();
                this.saveFeature();
            }
        });

        // Type selector change
        document.addEventListener('change', (e) => {
            if (e.target.id === 'dynamics-type-selector') {
                this.currentType = e.target.value;
                this.renderFeatureList();
            }
        });

        // Timeline date selector
        document.addEventListener('input', (e) => {
            if (e.target.id === 'dynamics-date-slider') {
                this.timelineManager.setDate(e.target.value);
            }
        });
    }

    setupTypeSelector() {
        const selector = document.getElementById('dynamics-type-selector');
        if (selector) {
            selector.innerHTML = `
                <option value="political_areas">Political Areas</option>
                <option value="military_movements">Military Movements</option>
                <option value="strategic_markers">Strategic Markers</option>
            `;
        }
    }

    async initializeTemporalTab() {
        if (this.operations.getFeatures(this.currentType).length > 0 && this.mapManager.map) {
            this.log('Dynamics tab already initialized, refreshing...');
            this.mapManager.forceMapResize();
            this.renderFeatureList();
            return;
        }

        const listContainer = document.getElementById('dynamics-features-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="loading">Loading temporal features...</div>';
        }

        try {
            this.log('Initializing temporal tab...');
            await this.loadFeatures();
            
            setTimeout(() => {
                this.mapManager.initializeMap();
                this.timelineManager.initializeTimeline();
                this.renderFeatureList();
                this.log('Dynamics tab initialized successfully');
            }, 150);
            
        } catch (error) {
            console.error('Error initializing temporal tab:', error);
            this.showError('Failed to initialize temporal features management');
            
            if (listContainer) {
                this.renderErrorState(listContainer, error);
            }
        }
    }

    async loadFeatures() {
        try {
            await this.operations.loadAllFeatures();
            this.log(`Successfully loaded temporal features`);
        } catch (error) {
            this.log('Debug info:', this.operations.getDebugInfo());
            throw error;
        }
    }

    renderFeatureList() {
        const listContainer = document.getElementById('dynamics-features-list');
        if (!listContainer) {
            this.log('Dynamics features list container not found');
            return;
        }

        const features = this.operations.getFeatures(this.currentType);
        this.log(`Rendering ${features.length} ${this.currentType} features`);

        if (features.length === 0) {
            listContainer.innerHTML = `
                <div class="no-features">
                    <p>No ${this.currentType.replace('_', ' ')} found</p>
                    <p>Click "New Feature" to create your first ${this.currentType.replace('_', ' ')}!</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = features.map(feature => `
            <div class="dynamics-feature-item ${feature.active ? 'active' : 'inactive'}" 
                 onclick="dynamicsManager.selectFeature('${feature.id}')">
                <div class="feature-item-header">
                    <h4>${this.escapeHtml(feature.name)}</h4>
                    <span class="feature-status" style="background-color: ${feature.color}"></span>
                </div>
                <p class="feature-category">${this.escapeHtml(feature.category)}</p>
                <div class="feature-meta">
                    <span>${feature.timeframes ? feature.timeframes.length : 0} Timeframes</span>
                    <span>${new Date(feature.updatedAt || feature.createdAt).toLocaleDateString('de-DE')}</span>
                </div>
            </div>
        `).join('');

        this.updateOverviewStats();
        this.log('Feature list rendered successfully');
    }

    selectFeature(featureId) {
        this.log(`Selecting feature: ${featureId}`);
        this.currentFeature = this.operations.getFeatureById(this.currentType, featureId);
        
        if (!this.currentFeature) {
            this.showError(`Feature not found: ${featureId}`);
            return;
        }

        this.showEditor();
        this.populateEditor();
        this.mapManager.clearMap();
        this.mapManager.renderFeatureOnMap(this.currentFeature);
        this.renderTimeframeList();
    }

    showEditor() {
        const editor = document.getElementById('dynamics-editor');
        if (editor) {
            editor.style.display = 'block';
            setTimeout(() => this.mapManager.forceMapResize(), 100);
        }
    }

    closeEditor() {
        const editor = document.getElementById('dynamics-editor');
        if (editor) {
            editor.style.display = 'none';
        }
        
        this.currentFeature = null;
        this.mapManager.clearMap();
    }

    populateEditor() {
        if (!this.currentFeature) return;

        const form = document.getElementById('dynamics-feature-form');
        if (!form) return;

        // Populate form fields based on feature type
        this.ui.populateForm('dynamics-feature-form', {
            'feature-name': this.currentFeature.name || '',
            'feature-category': this.currentFeature.category || '',
            'feature-color': this.currentFeature.color || '#3366cc',
            'feature-opacity': this.currentFeature.opacity || 0.6,
            'feature-weight': this.currentFeature.weight || 3,
            'feature-active': this.currentFeature.active !== false
        });
    }

    async saveFeature() {
        if (!this.currentFeature) return;

        const formData = this.ui.getFormData('dynamics-feature-form');
        if (!formData) return;

        // Validate form data
        const validation = this.operations.validateFeatureData(formData);
        if (!validation.isValid) {
            validation.errors.forEach(error => this.ui.showToast(error, 'error'));
            return;
        }

        // Prepare feature data
        const featureData = {
            name: formData['feature-name'],
            category: formData['feature-category'],
            color: formData['feature-color'],
            opacity: parseFloat(formData['feature-opacity']),
            weight: parseInt(formData['feature-weight']),
            active: formData['feature-active'] === 'on',
            timeframes: this.currentFeature.timeframes || []
        };

        const updatedFeature = await this.operations.saveFeature(
            this.currentType, 
            featureData, 
            this.currentFeature.id
        );
        
        if (updatedFeature) {
            this.currentFeature = updatedFeature;
            this.renderFeatureList();
            this.mapManager.renderFeatureOnMap(this.currentFeature);
        }
    }

    async createNewFeature() {
        const name = prompt(`Name for the new ${this.currentType.replace('_', ' ')}:`);
        if (!name) return;

        const featureData = {
            name: name,
            category: 'default',
            color: '#3366cc',
            opacity: 0.6,
            weight: 3,
            active: true,
            timeframes: []
        };

        const newFeature = await this.operations.createFeature(this.currentType, featureData);
        if (newFeature) {
            this.renderFeatureList();
            this.selectFeature(newFeature.id);
        }
    }

    async deleteFeature() {
        if (!this.currentFeature) return;
        
        const success = await this.operations.deleteFeature(
            this.currentType,
            this.currentFeature.id, 
            this.currentFeature.name
        );
        
        if (success) {
            this.renderFeatureList();
            this.closeEditor();
        }
    }

    addTimeframe() {
        if (!this.currentFeature) return;

        const date = prompt('Date for this timeframe (YYYY-MM-DD):');
        if (!date) return;

        const description = prompt('Description for this timeframe:') || '';

        // Basic timeframe structure - coordinates will be added via map interaction
        const timeframe = {
            date: date,
            description: description,
            coordinates: [],
            properties: {}
        };

        this.currentFeature.timeframes = this.currentFeature.timeframes || [];
        this.currentFeature.timeframes.push(timeframe);
        
        // Sort by date
        this.currentFeature.timeframes.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        this.renderTimeframeList();
        this.saveFeature(); // Auto-save
    }

    deleteTimeframe(index) {
        if (!this.currentFeature || !this.currentFeature.timeframes) return;
        
        if (confirm('Delete this timeframe?')) {
            this.currentFeature.timeframes.splice(index, 1);
            this.renderTimeframeList();
            this.saveFeature(); // Auto-save
        }
    }

    renderTimeframeList() {
        const container = document.getElementById('timeframes-list');
        if (!container || !this.currentFeature) return;

        const timeframes = this.currentFeature.timeframes || [];
        
        container.innerHTML = timeframes.map((timeframe, index) => `
            <div class="timeframe-item">
                <div class="timeframe-header">
                    <strong>${timeframe.date}</strong>
                    <button class="delete-timeframe-btn btn-danger" data-index="${index}">×</button>
                </div>
                <p>${this.escapeHtml(timeframe.description)}</p>
                <small>Coordinates: ${timeframe.coordinates ? timeframe.coordinates.length : 0} points</small>
            </div>
        `).join('');
    }

    async syncToClient() {
        await this.operations.syncToClient();
    }

    updateOverviewStats() {
        // Update statistics for the overview tab
        const totalFeatures = Object.values(this.operations.getAllFeatures()).flat().length;
        
        document.dispatchEvent(new CustomEvent('dataChanged', { 
            detail: { type: 'temporal_features', count: totalFeatures }
        }));
    }

    // Utility functions
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    showError(message) {
        this.ui.showToast(message, 'error');
    }

    log(...args) {
        if (this.debugMode) {
            console.log('[DynamicsManager]', ...args);
        }
    }

    // Debug utility
    getDebugInfo() {
        return {
            currentType: this.currentType,
            currentFeature: !!this.currentFeature,
            operations: this.operations.getDebugInfo(),
            mapManager: this.mapManager.getDebugInfo()
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DynamicsManager;
}
