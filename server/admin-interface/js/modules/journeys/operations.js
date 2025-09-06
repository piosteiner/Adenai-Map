// admin-public/js/modules/journeys/operations.js - Journey Operations Module - Core CRUD functionality

class JourneyOperations {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.journeys = [];
        this.apiBaseUrl = '/api/journey';
        this.debugMode = true;
    }

    async loadJourneys() {
        try {
            this.log('📄 Loading journeys from:', this.apiBaseUrl);
            
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
            
            return this.journeys;
        } catch (error) {
            console.error('❌ Error loading journeys:', error);
            this.showError(`Failed to load journeys: ${error.message}`);
            this.journeys = [];
            
            // Additional debug info
            this.log('🔧 Debug info:');
            this.log('- API URL:', this.apiBaseUrl);
            this.log('- Current location:', window.location.href);
            this.log('- Auth status:', this.getAuthStatus());
            
            throw error;
        }
    }

    async saveJourney(journeyData, journeyId) {
        if (!this.auth.requireAuth()) return null;

        try {
            this.log(`💾 Saving journey: ${journeyData.name}`);
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/${journeyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(journeyData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const updatedJourney = await response.json();
            
            // Update local data
            const index = this.journeys.findIndex(j => j.id === journeyId);
            if (index !== -1) {
                this.journeys[index] = updatedJourney;
            }
            
            this.log('✅ Journey saved successfully');
            this.showSuccess('Journey saved successfully!');
            
            // Notify stats update
            document.dispatchEvent(new CustomEvent('dataChanged', { 
                detail: { type: 'journeys', count: this.journeys.length }
            }));
            
            return updatedJourney;
        } catch (error) {
            console.error('❌ Error saving journey:', error);
            this.showError(`Failed to save journey: ${error.message}`);
            return null;
        }
    }

    async createJourney(journeyData) {
        if (!this.auth.requireAuth()) return null;

        try {
            this.log(`📝 Creating new journey: ${journeyData.name}`);
            
            const response = await this.auth.authenticatedFetch(this.apiBaseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(journeyData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const newJourney = await response.json();
            this.journeys.push(newJourney);
            
            this.log('✅ Journey created successfully');
            this.showSuccess('New journey created');
            
            // Notify stats update
            document.dispatchEvent(new CustomEvent('dataChanged', { 
                detail: { type: 'journeys', count: this.journeys.length }
            }));
            
            return newJourney;
        } catch (error) {
            console.error('❌ Error creating journey:', error);
            this.showError(`Failed to create journey: ${error.message}`);
            return null;
        }
    }

    async deleteJourney(journeyId, journeyName) {
        if (!this.auth.requireAuth()) return false;
        
        if (!this.ui.confirm(`Delete journey "${journeyName}"?`)) {
            return false;
        }

        try {
            this.log(`🗑️ Deleting journey: ${journeyName}`);
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/${journeyId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Remove from local data
            this.journeys = this.journeys.filter(j => j.id !== journeyId);
            
            this.log('✅ Journey deleted successfully');
            this.showSuccess('Journey deleted');
            
            // Notify stats update
            document.dispatchEvent(new CustomEvent('dataChanged', { 
                detail: { type: 'journeys', count: this.journeys.length }
            }));
            
            return true;
        } catch (error) {
            console.error('❌ Error deleting journey:', error);
            this.showError(`Failed to delete journey: ${error.message}`);
            return false;
        }
    }

    async addSegment(journeyId, segmentData) {
        if (!this.auth.requireAuth()) return null;

        try {
            this.log(`➕ Adding segment to journey: ${journeyId}`);
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/${journeyId}/segments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(segmentData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Update local journey data
            const journey = this.getJourneyById(journeyId);
            if (journey) {
                if (!journey.segments) {
                    journey.segments = [];
                }
                journey.segments.push(segmentData);
            }
            
            this.log('✅ Segment added successfully');
            this.showSuccess('Segment added');
            
            return true;
        } catch (error) {
            console.error('❌ Error adding segment:', error);
            this.showError(`Failed to add segment: ${error.message}`);
            return null;
        }
    }

    async deleteSegment(journeyId, segmentIndex) {
        if (!this.auth.requireAuth()) return false;
        
        if (!this.ui.confirm('Delete this segment?')) {
            return false;
        }

        try {
            this.log(`🗑️ Deleting segment ${segmentIndex} from journey: ${journeyId}`);
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/${journeyId}/segments/${segmentIndex}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Update local journey data
            const journey = this.getJourneyById(journeyId);
            if (journey && journey.segments) {
                journey.segments.splice(segmentIndex, 1);
            }
            
            this.log('✅ Segment deleted successfully');
            this.showSuccess('Segment deleted');
            
            return true;
        } catch (error) {
            console.error('❌ Error deleting segment:', error);
            this.showError(`Failed to delete segment: ${error.message}`);
            return false;
        }
    }

    async syncToClient() {
        if (!this.auth.requireAuth()) return false;

        try {
            this.log('🔄 Syncing to client...');
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/sync`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.log('✅ Client synchronized successfully');
            this.showSuccess('Client synchronized successfully');
            
            return true;
        } catch (error) {
            console.error('❌ Error syncing to client:', error);
            this.showError(`Failed to synchronize client: ${error.message}`);
            return false;
        }
    }

    getJourneyById(id) {
        return this.journeys.find(j => j.id === id);
    }

    getJourneys() {
        return this.journeys;
    }

    getActiveJourneys() {
        return this.journeys.filter(j => j.active !== false);
    }

    getJourneyStats() {
        const totalJourneys = this.journeys.length;
        const activeJourneys = this.getActiveJourneys().length;
        const totalSegments = this.journeys.reduce((sum, journey) => 
            sum + (journey.segments ? journey.segments.length : 0), 0
        );
        
        return {
            total: totalJourneys,
            active: activeJourneys,
            inactive: totalJourneys - activeJourneys,
            totalSegments
        };
    }

    validateJourneyData(formData) {
        const errors = [];
        
        if (!formData['journey-name']?.trim()) {
            errors.push('Journey name is required');
        }
        
        if (formData['journey-name'] && formData['journey-name'].length > 100) {
            errors.push('Journey name must be less than 100 characters');
        }
        
        if (formData['journey-color'] && !/^#[0-9A-F]{6}$/i.test(formData['journey-color'])) {
            errors.push('Invalid color format - must be hex color (e.g., #ff6600)');
        }
        
        if (formData['journey-opacity'] && (formData['journey-opacity'] < 0 || formData['journey-opacity'] > 1)) {
            errors.push('Opacity must be between 0 and 1');
        }
        
        if (formData['journey-weight'] && (formData['journey-weight'] < 1 || formData['journey-weight'] > 20)) {
            errors.push('Weight must be between 1 and 20');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateSegmentData(segmentData) {
        const errors = [];
        
        if (!segmentData.coords || !Array.isArray(segmentData.coords) || segmentData.coords.length !== 2) {
            errors.push('Valid coordinates are required');
        }
        
        if (segmentData.type && !['L', 'Q', 'C'].includes(segmentData.type)) {
            errors.push('Invalid segment type - must be L, Q, or C');
        }
        
        if (segmentData.type === 'Q' && (!segmentData.control || !Array.isArray(segmentData.control) || segmentData.control.length !== 2)) {
            errors.push('Quadratic segments require valid control points');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    exportData() {
        const data = {
            version: "1.0",
            journeys: this.journeys,
            lastUpdated: new Date().toISOString()
        };
        this.ui.exportJson(data, 'adenai-journeys');
    }

    viewRawJson() {
        const data = {
            version: "1.0",
            journeys: this.journeys,
            lastUpdated: new Date().toISOString()
        };
        this.ui.viewRawJson(data, 'Adenai Journeys - Raw JSON');
    }

    // Utility functions
    log(...args) {
        if (this.debugMode) {
            console.log('[JourneyOps]', ...args);
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
        // Use AdminUI notification system if available
        if (this.ui && typeof this.ui.showToast === 'function') {
            this.ui.showToast(message, type);
            return;
        }
        
        // Fallback to console
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    // Debug utility for troubleshooting
    getDebugInfo() {
        return {
            journeysLoaded: this.journeys.length,
            apiBaseUrl: this.apiBaseUrl,
            authStatus: this.getAuthStatus(),
            stats: this.getJourneyStats()
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JourneyOperations;
}