// admin-public/js/modules/journeys/index.js - Journey Management - Main Coordinator

class JourneyManager {
    constructor() {
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.currentJourney = null;
        this.debugMode = true;
        
        // Initialize sub-modules
        this.operations = new JourneyOperations(this.auth, this.ui);
        this.mapManager = new JourneyMap(this.ui);
        this.segments = new JourneySegments(this.ui);
        
        this.setupFormListeners();
        this.setupSegmentEventListeners();
        
        console.log('Journey Manager created and ready for integration');
    }

    setupFormListeners() {
        // Main form actions
        document.addEventListener('click', (e) => {
            if (e.target.id === 'add-journey-btn') {
                this.createNewJourney();
            }
            
            if (e.target.id === 'sync-journey-btn') {
                this.syncToClient();
            }
            
            if (e.target.id === 'close-journey-editor') {
                this.closeEditor();
            }
            
            if (e.target.id === 'delete-journey-btn') {
                this.deleteJourney();
            }
            
            if (e.target.id === 'add-segment-btn') {
                this.startAddingSegment();
            }
            
            if (e.target.id === 'toggle-edit-mode') {
                this.toggleEditMode();
            }
            
            if (e.target.id === 'finish-segment-btn') {
                this.finishAddingSegment();
            }
            
            if (e.target.id === 'cancel-segment-btn') {
                this.cancelAddingSegment();
            }
            
            if (e.target.id === 'retry-load-journeys') {
                this.initializeJourneyTab();
            }
        });

        // Journey form submission
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'journey-form') {
                e.preventDefault();
                this.saveJourney();
            }
        });

        // Opacity slider update
        document.addEventListener('input', (e) => {
            if (e.target.id === 'journey-opacity') {
                const valueSpan = document.querySelector('.opacity-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value;
                }
            }
        });
    }

    setupSegmentEventListeners() {
        // Listen for segment events from the segments module
        document.addEventListener('segmentEdit', (e) => {
            this.editSegment(e.detail.segmentIndex);
        });
        
        document.addEventListener('segmentDelete', (e) => {
            this.deleteSegment(e.detail.segmentIndex);
        });
    }

    async initializeJourneyTab() {
        if (this.operations.getJourneys().length > 0 && this.mapManager.map) {
            this.log('Journey tab already initialized, refreshing...');
            this.mapManager.forceMapResize();
            this.renderJourneyList();
            return;
        }

        const listContainer = document.getElementById('journeys-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="loading">Loading journeys...</div>';
        }

        try {
            this.log('Initializing journey tab...');
            await this.loadJourneys();
            
            setTimeout(() => {
                this.mapManager.initializeMap();
                this.renderJourneyList();
                this.log('Journey tab initialized successfully');
            }, 150);
            
        } catch (error) {
            console.error('Error initializing journey tab:', error);
            this.showError('Failed to initialize journey management');
            
            if (listContainer) {
                this.renderErrorState(listContainer, error);
            }
        }
    }

    renderErrorState(container, error) {
        container.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 40px 20px;">
                <p style="color: #dc3545; font-weight: bold;">Failed to load journeys</p>
                <p style="color: #666; margin: 10px 0;">${error.message}</p>
                <button id="retry-load-journeys" class="btn-primary" style="margin-top: 15px;">
                    Retry Loading
                </button>
                <details style="margin-top: 20px; text-align: left;">
                    <summary style="cursor: pointer; color: #007bff;">Debug Info</summary>
                    <div style="background: #f8f9fa; padding: 15px; margin-top: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">
                        <p><strong>API URL:</strong> ${this.operations.apiBaseUrl}</p>
                        <p><strong>Current Location:</strong> ${window.location.href}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Auth Status:</strong> ${this.getAuthStatus()}</p>
                        <p><strong>Map Container:</strong> ${!!document.getElementById('journeys-map')}</p>
                        <p><strong>Leaflet Loaded:</strong> ${typeof L !== 'undefined'}</p>
                    </div>
                </details>
            </div>
        `;
    }

    async loadJourneys() {
        try {
            await this.operations.loadJourneys();
            this.log(`Successfully loaded ${this.operations.getJourneys().length} journeys`);
        } catch (error) {
            this.log('Debug info:', this.operations.getDebugInfo());
            throw error;
        }
    }

    renderJourneyList() {
        const listContainer = document.getElementById('journeys-list');
        if (!listContainer) {
            this.log('Journey list container not found');
            return;
        }

        const journeys = this.operations.getJourneys();
        this.log(`Rendering ${journeys.length} journeys`);

        if (journeys.length === 0) {
            listContainer.innerHTML = `
                <div class="no-journeys">
                    <p>No journeys found</p>
                    <p>Click "New Journey" to create your first journey!</p>
                </div>
            `;
            return;
        }

        // Sort journeys alphabetically by name
        const sortedJourneys = [...journeys].sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        listContainer.innerHTML = sortedJourneys.map(journey => `
            <div class="journey-item ${journey.active ? 'active' : 'inactive'}" 
                 onclick="journeyManager.selectJourney('${journey.id}')">
                <div class="journey-item-header">
                    <h4>${this.escapeHtml(journey.name)}</h4>
                    <span class="journey-status" style="background-color: ${journey.color}"></span>
                </div>
                ${journey.description ? `<p class="journey-description">${this.escapeHtml(journey.description)}</p>` : ''}
                <div class="journey-meta">
                    <span>${journey.segments ? journey.segments.length : 0} Segments</span>
                    <span>${new Date(journey.updatedAt || journey.createdAt).toLocaleDateString('de-DE')}</span>
                </div>
            </div>
        `).join('');

        this.updateOverviewStats();
        this.log('Journey list rendered successfully');
    }

    updateOverviewStats() {
        const stats = this.operations.getJourneyStats();
        
        const totalJourneysElement = document.getElementById('total-journeys');
        if (totalJourneysElement) {
            totalJourneysElement.textContent = stats.total;
        }
        
        document.dispatchEvent(new CustomEvent('dataChanged', { 
            detail: { type: 'journeys', count: stats.total }
        }));
    }

    selectJourney(journeyId) {
        this.log(`Selecting journey: ${journeyId}`);
        this.currentJourney = this.operations.getJourneyById(journeyId);
        
        if (!this.currentJourney) {
            this.showError(`Journey not found: ${journeyId}`);
            return;
        }

        this.showEditor();
        this.populateEditor();
        this.mapManager.clearMap();
        this.mapManager.renderJourneyOnMap(this.currentJourney);
        this.segments.renderSegmentList(this.currentJourney);
    }

    showEditor() {
        const editor = document.getElementById('journey-editor');
        if (editor) {
            editor.style.display = 'block';
            setTimeout(() => this.mapManager.forceMapResize(), 100);
        }
    }

    closeEditor() {
        const editor = document.getElementById('journey-editor');
        if (editor) {
            editor.style.display = 'none';
        }
        
        this.currentJourney = null;
        this.mapManager.clearMap();
        this.mapManager.stopEditMode();
    }

    populateEditor() {
        if (!this.currentJourney) return;

        const form = document.getElementById('journey-form');
        if (!form) return;

        // Populate form fields
        this.ui.populateForm('journey-form', {
            'journey-name': this.currentJourney.name || '',
            'journey-description': this.currentJourney.description || '',
            'journey-color': this.currentJourney.color || '#ff6600',
            'journey-opacity': this.currentJourney.opacity || 0.7,
            'journey-weight': this.currentJourney.weight || 4,
            'journey-weight-mobile': this.currentJourney.weightMobile || 6,
            'journey-active': this.currentJourney.active !== false
        });
        
        // Update opacity display
        const opacityValue = document.querySelector('.opacity-value');
        if (opacityValue) {
            opacityValue.textContent = this.currentJourney.opacity || 0.7;
        }
    }

    async saveJourney() {
        if (!this.currentJourney) return;

        const formData = this.ui.getFormData('journey-form');
        if (!formData) return;

        // Validate form data
        const validation = this.operations.validateJourneyData(formData);
        if (!validation.isValid) {
            validation.errors.forEach(error => this.ui.showToast(error, 'error'));
            return;
        }

        // Prepare journey data
        const journeyData = {
            name: formData['journey-name'],
            description: formData['journey-description'],
            color: formData['journey-color'],
            opacity: parseFloat(formData['journey-opacity']),
            weight: parseInt(formData['journey-weight']),
            weightMobile: parseInt(formData['journey-weight-mobile']),
            active: formData['journey-active'] === 'on', // Handle checkbox properly
            segments: this.currentJourney.segments || []
        };

        const updatedJourney = await this.operations.saveJourney(journeyData, this.currentJourney.id);
        if (updatedJourney) {
            this.currentJourney = updatedJourney;
            this.renderJourneyList();
            this.mapManager.renderJourneyOnMap(this.currentJourney);
        }
    }

    async createNewJourney() {
        const name = prompt('Name for the new journey:');
        if (!name) return;

        const journeyData = {
            name: name,
            description: '',
            color: '#ff6600',
            weight: 4,
            weightMobile: 6,
            dashArray: '10,6',
            dashArrayMobile: '16,10',
            opacity: 0.7,
            active: true,
            segments: []
        };

        const newJourney = await this.operations.createJourney(journeyData);
        if (newJourney) {
            this.renderJourneyList();
            this.selectJourney(newJourney.id);
        }
    }

    async deleteJourney() {
        if (!this.currentJourney) return;
        
        const success = await this.operations.deleteJourney(
            this.currentJourney.id, 
            this.currentJourney.name
        );
        
        if (success) {
            this.renderJourneyList();
            this.closeEditor();
        }
    }

    async syncToClient() {
        await this.operations.syncToClient();
    }

    // Segment Management
    startAddingSegment() {
        this.mapManager.startEditMode();
    }

    cancelAddingSegment() {
        this.mapManager.stopEditMode();
    }

    async finishAddingSegment() {
        const tempSegments = this.mapManager.getTempSegments();
        if (!tempSegments.length || !this.currentJourney) return;

        const description = prompt('Description for this segment:') || '';
        const segmentData = this.segments.createSegmentFromPoints(tempSegments, description);
        
        // Validate segment data
        const validation = this.segments.validateSegmentData(segmentData);
        if (!validation.isValid) {
            validation.errors.forEach(error => this.ui.showToast(error, 'error'));
            return;
        }

        const success = await this.operations.addSegment(this.currentJourney.id, segmentData);
        if (success) {
            this.currentJourney.segments = this.currentJourney.segments || [];
            this.currentJourney.segments.push(segmentData);
            
            this.mapManager.stopEditMode();
            this.segments.renderSegmentList(this.currentJourney);
            this.mapManager.renderJourneyOnMap(this.currentJourney);
        }
    }

    async deleteSegment(segmentIndex) {
        if (!this.currentJourney) return;
        
        const success = await this.operations.deleteSegment(this.currentJourney.id, segmentIndex);
        if (success) {
            this.segments.renderSegmentList(this.currentJourney);
            this.mapManager.renderJourneyOnMap(this.currentJourney);
        }
    }

    toggleEditMode() {
        if (this.mapManager.editMode) {
            this.mapManager.stopEditMode();
        } else {
            this.mapManager.startEditMode();
        }
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

    getAuthStatus() {
        const authContainer = document.querySelector('#auth-container');
        if (authContainer && authContainer.innerHTML.includes('Logout')) {
            return 'Logged in';
        }
        return 'Not logged in';
    }

    showError(message) {
        this.ui.showToast(message, 'error');
    }

    log(...args) {
        if (this.debugMode) {
            console.log('[JourneyManager]', ...args);
        }
    }

    // Cleanup method
    cleanup() {
        this.mapManager.cleanup();
        this.log('Journey Manager cleaned up');
    }

    // Debug utility
    getDebugInfo() {
        return {
            ...this.operations.getDebugInfo(),
            ...this.mapManager.getDebugInfo(),
            ...this.segments.getDebugInfo(),
            currentJourney: !!this.currentJourney
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JourneyManager;
}