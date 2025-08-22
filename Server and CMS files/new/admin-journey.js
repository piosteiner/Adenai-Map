// Journey Management - Integrated with Main CMS
class JourneyManager {
    constructor() {
        this.journeys = [];
        this.currentJourney = null;
        this.map = null;
        this.journeyLayers = new Map();
        this.editMode = false;
        this.tempSegments = [];
        this.apiBaseUrl = '/api/journey';
        this.debugMode = true; // Enable debugging
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Tab activation listener
        document.addEventListener('DOMContentLoaded', () => {
            const journeyTab = document.querySelector('[data-tab="journeys"]');
            if (journeyTab) {
                journeyTab.addEventListener('click', () => {
                    setTimeout(() => this.initializeJourneyTab(), 100);
                });
            }
        });

        // Form event listeners
        this.setupFormListeners();
    }

    setupFormListeners() {
        // Add Journey button
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

    async initializeJourneyTab() {
        if (this.map && this.journeys.length > 0) return; // Already initialized

        // Show loading indicator
        const listContainer = document.getElementById('journeys-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="loading">🔄 Loading journeys...</div>';
        }

        try {
            this.log('🚀 Initializing journey tab...');
            await this.loadJourneys();
            this.initializeMap();
            this.renderJourneyList();
            this.log('✅ Journey tab initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing journey tab:', error);
            this.showError('Failed to initialize journey management');
            
            if (listContainer) {
                listContainer.innerHTML = `
                    <div class="error-state" style="text-align: center; padding: 40px 20px;">
                        <p style="color: #dc3545; font-weight: bold;">❌ Failed to load journeys</p>
                        <p style="color: #666; margin: 10px 0;">${error.message}</p>
                        <button id="retry-load-journeys" class="btn-primary" style="margin-top: 15px;">
                            🔄 Retry Loading
                        </button>
                        <details style="margin-top: 20px; text-align: left;">
                            <summary style="cursor: pointer; color: #007bff;">🔧 Debug Info</summary>
                            <div style="background: #f8f9fa; padding: 15px; margin-top: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">
                                <p><strong>API URL:</strong> ${this.apiBaseUrl}</p>
                                <p><strong>Current Location:</strong> ${window.location.href}</p>
                                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                                <p><strong>Auth Status:</strong> ${this.getAuthStatus()}</p>
                            </div>
                        </details>
                    </div>
                `;
            }
        }
    }

    async loadJourneys() {
        try {
            this.log('🔄 Loading journeys from:', this.apiBaseUrl);
            
            const response = await fetch(this.apiBaseUrl);
            this.log('📡 Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                // Show specific error based on status
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in to view journeys.');
                } else if (response.status === 404) {
                    throw new Error('Journey API endpoint not found. Check server configuration.');
                } else if (response.status === 500) {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${errorText}`);
                } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
                }
            }
            
            const journeys = await response.json();
            this.log('📦 Raw journey data:', journeys);
            
            // Validate data structure
            if (!Array.isArray(journeys)) {
                throw new Error(`Invalid journey data format - expected array, got ${typeof journeys}`);
            }
            
            this.journeys = journeys;
            this.log(`✅ Successfully loaded ${this.journeys.length} journeys`);
            
        } catch (error) {
            console.error('❌ Error loading journeys:', error);
            this.showError(`Failed to load journeys: ${error.message}`);
            this.journeys = [];
            
            // Additional debug info
            this.log('🔧 Debug info:');
            this.log('- API URL:', this.apiBaseUrl);
            this.log('- Current location:', window.location.href);
            this.log('- Auth status:', this.getAuthStatus());
            
            throw error; // Re-throw to be caught by initializeJourneyTab
        }
    }

    initializeMap() {
        const mapContainer = document.getElementById('journeys-map');
        if (!mapContainer) {
            throw new Error('Map container not found - check HTML structure');
        }
        
        if (this.map) {
            this.log('🗺️ Map already initialized, skipping...');
            return;
        }

        try {
            this.log('🗺️ Initializing map...');
            
            this.map = L.map('journeys-map', {
                crs: L.CRS.Simple,
                minZoom: -2,
                maxZoom: 3
            });

            // Try multiple possible image paths
            const possibleImagePaths = [
                'images/adenai_map_01.jpg',    // Your correct path
                'adenai_map_01.jpg',
                './images/adenai_map_01.jpg', 
                '/images/adenai_map_01.jpg'
            ];

            const bounds = [[0, 0], [2500, 1500]];
            const imagePath = possibleImagePaths[0]; // Start with correct path
            
            const imageOverlay = L.imageOverlay(imagePath, bounds).addTo(this.map);
            
            // Fix: Handle image load events safely
            imageOverlay.on('load', () => {
                this.log(`✅ Map image loaded successfully: ${imagePath}`);
            });
            
            imageOverlay.on('error', () => {
                console.warn(`⚠️ Failed to load map image: ${imagePath}`);
                this.showNotification(`Map image not found: ${imagePath}`, 'warning');
            });

            this.map.fitBounds(bounds);

            // Setup click handler for adding segments
            this.map.on('click', (e) => {
                if (this.editMode) {
                    this.addMapPoint(e.latlng);
                }
            });

            this.log('✅ Journey map initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing map:', error);
            this.showError(`Failed to initialize map: ${error.message}`);
            throw error;
        }
    }

    renderJourneyList() {
        const listContainer = document.getElementById('journeys-list');
        if (!listContainer) {
            this.log('⚠️ Journey list container not found');
            return;
        }

        this.log(`🎨 Rendering ${this.journeys.length} journeys`);

        if (this.journeys.length === 0) {
            listContainer.innerHTML = `
                <div class="no-journeys">
                    <p>🗺️ No journeys found</p>
                    <p>Click "New Journey" to create your first journey!</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = this.journeys.map(journey => `
            <div class="journey-item ${journey.active ? 'active' : 'inactive'}" 
                 onclick="journeyManager.selectJourney('${journey.id}')">
                <div class="journey-item-header">
                    <h4>${journey.name}</h4>
                    <span class="journey-status" style="background-color: ${journey.color}"></span>
                </div>
                ${journey.description ? `<p class="journey-description">${journey.description}</p>` : ''}
                <div class="journey-meta">
                    <span>${journey.segments ? journey.segments.length : 0} Segmente</span>
                    <span>${new Date(journey.updatedAt || journey.createdAt).toLocaleDateString('de-DE')}</span>
                </div>
            </div>
        `).join('');

        // Update overview stats
        this.updateOverviewStats();
        this.log('✅ Journey list rendered successfully');
    }

    updateOverviewStats() {
        const totalJourneysElement = document.getElementById('total-journeys');
        if (totalJourneysElement) {
            totalJourneysElement.textContent = this.journeys.length;
        }
    }

    selectJourney(journeyId) {
        this.log(`🎯 Selecting journey: ${journeyId}`);
        this.currentJourney = this.journeys.find(j => j.id === journeyId);
        if (!this.currentJourney) {
            this.showError(`Journey not found: ${journeyId}`);
            return;
        }

        this.showEditor();
        this.populateEditor();
        this.renderJourneyOnMap();
        this.renderSegmentList();
    }

    showEditor() {
        const editor = document.getElementById('journey-editor');
        const list = document.getElementById('journeys-list');
        
        if (editor && list) {
            editor.style.display = 'block';
            // Don't hide the list, just make room for both
        }
    }

    closeEditor() {
        const editor = document.getElementById('journey-editor');
        if (editor) {
            editor.style.display = 'none';
        }
        
        this.currentJourney = null;
        this.clearMap();
        this.editMode = false;
        this.hideMapInstructions();
    }

    populateEditor() {
        if (!this.currentJourney) return;

        const form = document.getElementById('journey-form');
        if (!form) return;

        document.getElementById('journey-name').value = this.currentJourney.name || '';
        document.getElementById('journey-description').value = this.currentJourney.description || '';
        document.getElementById('journey-color').value = this.currentJourney.color || '#ff6600';
        document.getElementById('journey-opacity').value = this.currentJourney.opacity || 0.7;
        document.getElementById('journey-weight').value = this.currentJourney.weight || 4;
        document.getElementById('journey-weight-mobile').value = this.currentJourney.weightMobile || 6;
        document.getElementById('journey-active').checked = this.currentJourney.active !== false;
        
        // Update opacity display
        const opacityValue = document.querySelector('.opacity-value');
        if (opacityValue) {
            opacityValue.textContent = this.currentJourney.opacity || 0.7;
        }
    }

    renderJourneyOnMap() {
        this.clearMap();
        
        if (!this.currentJourney || !this.currentJourney.segments || !this.currentJourney.segments.length) {
            this.log('⚠️ No segments to render on map');
            return;
        }

        try {
            this.log(`🗺️ Rendering ${this.currentJourney.segments.length} segments on map`);
            const pathData = this.buildPathData(this.currentJourney.segments);
            
            if (pathData.length === 0) {
                this.log('⚠️ No valid coordinates found in segments');
                return;
            }
            
            const journey = L.polyline(pathData, {
                color: this.currentJourney.color || '#ff6600',
                weight: this.currentJourney.weight || 4,
                dashArray: this.currentJourney.dashArray || '10,6',
                opacity: this.currentJourney.opacity || 0.7
            }).addTo(this.map);

            journey.bindPopup(this.currentJourney.name);
            this.journeyLayers.set(this.currentJourney.id, journey);

            // Add segment markers
            this.addSegmentMarkers();
            
            this.log('✅ Journey rendered on map successfully');

        } catch (error) {
            console.error('❌ Error rendering journey on map:', error);
            this.showError(`Failed to render journey on map: ${error.message}`);
        }
    }

    buildPathData(segments) {
        const latlngs = [];
        
        for (const segment of segments) {
            if (segment.coords && Array.isArray(segment.coords) && segment.coords.length === 2) {
                latlngs.push([segment.coords[0], segment.coords[1]]);
            } else {
                this.log('⚠️ Invalid segment coordinates:', segment);
            }
        }
        
        this.log(`📍 Built path data with ${latlngs.length} points`);
        return latlngs;
    }

    addSegmentMarkers() {
        if (!this.currentJourney || !this.currentJourney.segments) return;

        this.currentJourney.segments.forEach((segment, index) => {
            if (!segment.coords || segment.coords.length !== 2) return;
            
            const marker = L.marker([segment.coords[0], segment.coords[1]], {
                icon: L.divIcon({
                    className: 'segment-marker',
                    html: `<div style="background: #007bff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${index + 1}</div>`,
                    iconSize: [20, 20]
                })
            }).addTo(this.map);

            marker.bindPopup(`
                <div>
                    <strong>Segment ${index + 1}</strong><br>
                    <em>${segment.description || 'No description'}</em><br>
                    Type: ${segment.type}<br>
                    Coords: [${segment.coords[0]}, ${segment.coords[1]}]
                    ${segment.control ? `<br>Control: [${segment.control[0]}, ${segment.control[1]}]` : ''}
                </div>
            `);
        });
    }

    renderSegmentList() {
        const listContainer = document.getElementById('segments-list');
        if (!listContainer) return;
        
        if (!this.currentJourney || !this.currentJourney.segments || !this.currentJourney.segments.length) {
            listContainer.innerHTML = '<p class="no-segments">No segments yet. Click "Add Segment" to start building the route.</p>';
            return;
        }

        listContainer.innerHTML = this.currentJourney.segments.map((segment, index) => `
            <div class="segment-item">
                <div class="segment-header">
                    <div>
                        <span class="segment-type">${segment.type}</span>
                        <span class="segment-coords">[${segment.coords[0]}, ${segment.coords[1]}]</span>
                    </div>
                    <button class="btn-danger btn-small" onclick="journeyManager.deleteSegment(${index})" title="Delete segment">
                        🗑️
                    </button>
                </div>
                <div class="segment-description">${segment.description || 'No description'}</div>
                ${segment.control ? `<div class="segment-control">Control: [${segment.control[0]}, ${segment.control[1]}]</div>` : ''}
            </div>
        `).join('');
    }

    async saveJourney() {
        if (!this.currentJourney) return;

        const formData = {
            name: document.getElementById('journey-name').value,
            description: document.getElementById('journey-description').value,
            color: document.getElementById('journey-color').value,
            opacity: parseFloat(document.getElementById('journey-opacity').value),
            weight: parseInt(document.getElementById('journey-weight').value),
            weightMobile: parseInt(document.getElementById('journey-weight-mobile').value),
            active: document.getElementById('journey-active').checked,
            segments: this.currentJourney.segments || []
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/${this.currentJourney.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const updatedJourney = await response.json();
                const index = this.journeys.findIndex(j => j.id === this.currentJourney.id);
                this.journeys[index] = updatedJourney;
                this.currentJourney = updatedJourney;
                
                this.renderJourneyList();
                this.renderJourneyOnMap();
                this.showSuccess('Journey saved successfully!');
            } else {
                throw new Error('Failed to save journey');
            }
        } catch (error) {
            console.error('Error saving journey:', error);
            this.showError('Failed to save journey');
        }
    }

    async deleteSegment(segmentIndex) {
        if (!this.currentJourney || !confirm('Delete this segment?')) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/${this.currentJourney.id}/segments/${segmentIndex}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.currentJourney.segments.splice(segmentIndex, 1);
                this.renderSegmentList();
                this.renderJourneyOnMap();
                this.showSuccess('Segment deleted');
            } else {
                throw new Error('Failed to delete segment');
            }
        } catch (error) {
            console.error('Error deleting segment:', error);
            this.showError('Failed to delete segment');
        }
    }

    startAddingSegment() {
        this.editMode = true;
        this.tempSegments = [];
        this.showMapInstructions();
        this.map.getContainer().style.cursor = 'crosshair';
    }

    addMapPoint(latlng) {
        if (!this.editMode) return;

        const coords = [Math.round(latlng.lat), Math.round(latlng.lng)];
        
        // Add temporary marker
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'temp-marker',
                html: '<div style="background: #ff9800; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; animation: pulse 1s infinite;">+</div>',
                iconSize: [16, 16]
            })
        }).addTo(this.map);

        this.tempSegments.push({ marker, coords });
    }

    async finishAddingSegment() {
        if (!this.editMode || !this.tempSegments.length || !this.currentJourney) return;

        const segmentType = this.tempSegments.length === 1 ? 'L' : 'Q';
        const coords = this.tempSegments[0].coords;
        const control = this.tempSegments.length > 1 ? this.tempSegments[1].coords : null;
        
        const description = prompt('Description for this segment:') || '';

        const segmentData = {
            type: segmentType,
            coords: coords,
            control: control,
            description: description
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/${this.currentJourney.id}/segments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(segmentData)
            });

            if (response.ok) {
                if (!this.currentJourney.segments) {
                    this.currentJourney.segments = [];
                }
                this.currentJourney.segments.push(segmentData);
                this.cancelAddingSegment();
                this.renderSegmentList();
                this.renderJourneyOnMap();
                this.showSuccess('Segment added');
            } else {
                throw new Error('Failed to add segment');
            }
        } catch (error) {
            console.error('Error adding segment:', error);
            this.showError('Failed to add segment');
        }
    }

    cancelAddingSegment() {
        this.editMode = false;
        this.hideMapInstructions();
        this.map.getContainer().style.cursor = '';
        
        // Remove temporary markers
        this.tempSegments.forEach(segment => {
            this.map.removeLayer(segment.marker);
        });
        this.tempSegments = [];
    }

    toggleEditMode() {
        this.editMode = !this.editMode;
        const cursor = this.editMode ? 'crosshair' : '';
        this.map.getContainer().style.cursor = cursor;
        
        if (this.editMode) {
            this.showMapInstructions();
        } else {
            this.hideMapInstructions();
        }
    }

    showMapInstructions() {
        const instructions = document.getElementById('map-instructions');
        if (instructions) {
            instructions.style.display = 'block';
        }
    }

    hideMapInstructions() {
        const instructions = document.getElementById('map-instructions');
        if (instructions) {
            instructions.style.display = 'none';
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

        try {
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(journeyData)
            });

            if (response.ok) {
                const newJourney = await response.json();
                this.journeys.push(newJourney);
                this.renderJourneyList();
                this.selectJourney(newJourney.id);
                this.showSuccess('New journey created');
            } else {
                throw new Error('Failed to create journey');
            }
        } catch (error) {
            console.error('Error creating journey:', error);
            this.showError('Failed to create journey');
        }
    }

    async deleteJourney() {
        if (!this.currentJourney || !confirm(`Delete journey "${this.currentJourney.name}"?`)) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/${this.currentJourney.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.journeys = this.journeys.filter(j => j.id !== this.currentJourney.id);
                this.renderJourneyList();
                this.closeEditor();
                this.showSuccess('Journey deleted');
            } else {
                throw new Error('Failed to delete journey');
            }
        } catch (error) {
            console.error('Error deleting journey:', error);
            this.showError('Failed to delete journey');
        }
    }

    async syncToClient() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/sync`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showSuccess('Client synchronized successfully');
            } else {
                throw new Error('Sync failed');
            }
        } catch (error) {
            console.error('Error syncing to client:', error);
            this.showError('Failed to synchronize client');
        }
    }

    clearMap() {
        if (!this.map) return;
        
        this.journeyLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.journeyLayers.clear();
        
        // Remove all markers
        this.map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                this.map.removeLayer(layer);
            }
        });
    }

    // Utility functions
    log(...args) {
        if (this.debugMode) {
            console.log('[JourneyManager]', ...args);
        }
    }

    getAuthStatus() {
        const authContainer = document.querySelector('#auth-container');
        if (authContainer && authContainer.innerHTML.includes('Logout')) {
            return 'Logged in';
        }
        return 'Not logged in';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Use existing notification system or create a simple one
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.journeyManager = new JourneyManager();
});

// Add CSS animation for notifications
const notificationCSS = `
@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;

const notificationStyleSheet = document.createElement('style');
notificationStyleSheet.textContent = notificationCSS;
document.head.appendChild(notificationStyleSheet);