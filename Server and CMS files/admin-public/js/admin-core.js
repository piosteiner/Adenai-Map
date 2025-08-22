// Core Admin Orchestration Module
class AdenaiAdmin {
    constructor() {
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.locations = window.adminLocations;
        this.characters = window.adminCharacters;
        this.journeys = window.journeyManager; // Add journey manager reference
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Adenai Admin Interface');
        
        this.setupEventListeners();
        await this.checkConnection();
        
        // Wait for all modules to initialize
        await this.waitForModules();
        
        this.updateStats();
        
        // Listen for data changes to update stats
        document.addEventListener('dataChanged', () => {
            this.updateStats();
        });
        
        console.log('✅ Adenai Admin Interface fully initialized');
    }

    async waitForModules() {
        // Small delay to ensure all modules are fully loaded
        return new Promise(resolve => setTimeout(resolve, 100));
    }

    setupEventListeners() {
        // REMOVED: Tab switching (now handled by AdminUI)
        // Tab switching is handled by adminUI.switchTab()
        
        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }
        
        // View raw JSON button
        const viewRawBtn = document.getElementById('view-raw-btn');
        if (viewRawBtn) {
            viewRawBtn.addEventListener('click', () => {
                this.viewRawJson();
            });
        }
    }

    // Called by AdminUI when tabs change
    onTabChanged(tabName) {
        console.log(`📋 Admin Core handling tab change: ${tabName}`);
        
        // Handle tab-specific logic here
        if (tabName === 'overview') {
            // Force update stats when overview tab is opened
            setTimeout(() => this.updateStats(), 100);
        }
        
        if (tabName === 'journeys') {
            // Update journey reference if it exists now
            if (window.journeyManager && !this.journeys) {
                this.journeys = window.journeyManager;
                console.log('🗺️ Journey manager reference updated');
            }
        }
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/test');
            const result = await response.json();
            
            const indicator = document.getElementById('status-indicator');
            const text = document.getElementById('status-text');
            
            if (result.success) {
                indicator.textContent = '✅';
                text.textContent = `Connected to ${result.repo}`;
                console.log('✅ GitHub connection successful');
            } else {
                indicator.textContent = '❌';
                text.textContent = 'Connection failed';
                console.error('❌ GitHub connection failed');
            }
        } catch (error) {
            const indicator = document.getElementById('status-indicator');
            const text = document.getElementById('status-text');
            
            indicator.textContent = '❌';
            text.textContent = 'Connection error';
            
            console.error('❌ Connection error:', error);
            this.ui.showToast('Failed to connect to GitHub', 'error');
        }
    }

    updateStats() {
        try {
            const locations = this.locations?.getLocations() || [];
            const characters = this.characters?.getCharacters() || [];
            const journeys = this.journeys?.journeys || [];
            
            // Update location stats
            const totalLocationsEl = document.getElementById('total-locations');
            if (totalLocationsEl) {
                totalLocationsEl.textContent = locations.length;
            }
            
            const visitedLocationsEl = document.getElementById('visited-locations');
            if (visitedLocationsEl) {
                const visited = locations.filter(loc => loc.properties.visited).length;
                visitedLocationsEl.textContent = visited;
            }
            
            const regionsCountEl = document.getElementById('regions-count');
            if (regionsCountEl) {
                const regions = new Set(locations.map(loc => loc.properties.region).filter(Boolean));
                regionsCountEl.textContent = regions.size;
            }
            
            // Update character stats
            const totalCharactersEl = document.getElementById('total-characters');
            if (totalCharactersEl) {
                totalCharactersEl.textContent = characters.length;
            }
            
            const aliveCharactersEl = document.getElementById('alive-characters');
            if (aliveCharactersEl) {
                const alive = characters.filter(char => char.status === 'alive').length;
                aliveCharactersEl.textContent = alive;
            }
            
            // Update journey stats
            const totalJourneysEl = document.getElementById('total-journeys');
            if (totalJourneysEl) {
                totalJourneysEl.textContent = journeys.length;
            }
            
            console.log(`📊 Stats updated: ${locations.length} locations, ${characters.length} characters, ${journeys.length} journeys`);
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    exportData() {
        try {
            const locations = this.locations?.getLocations() || [];
            const characters = this.characters?.getCharacters() || [];
            const journeys = this.journeys?.journeys || [];
            
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: "1.0",
                    campaign: "Adenai",
                    totalLocations: locations.length,
                    totalCharacters: characters.length,
                    totalJourneys: journeys.length
                },
                locations: {
                    type: "FeatureCollection",
                    features: locations
                },
                characters: {
                    version: "1.0",
                    characters: characters,
                    lastUpdated: new Date().toISOString()
                },
                journeys: {
                    version: "1.0",
                    journeys: journeys,
                    lastUpdated: new Date().toISOString()
                }
            };
            
            this.ui.exportJson(exportData, 'adenai-campaign-data');
        } catch (error) {
            console.error('Export failed:', error);
            this.ui.showToast('❌ Failed to export data', 'error');
        }
    }

    viewRawJson() {
        try {
            const locations = this.locations?.getLocations() || [];
            const characters = this.characters?.getCharacters() || [];
            const journeys = this.journeys?.journeys || [];
            
            const data = {
                metadata: {
                    generated: new Date().toISOString(),
                    version: "1.0",
                    campaign: "Adenai",
                    stats: {
                        totalLocations: locations.length,
                        totalCharacters: characters.length,
                        totalJourneys: journeys.length,
                        visitedLocations: locations.filter(loc => loc.properties.visited).length,
                        aliveCharacters: characters.filter(char => char.status === 'alive').length,
                        activeJourneys: journeys.filter(journey => journey.active).length
                    }
                },
                locations: {
                    type: "FeatureCollection",
                    features: locations
                },
                characters: {
                    version: "1.0",
                    characters: characters
                },
                journeys: {
                    version: "1.0",
                    journeys: journeys
                }
            };
            
            this.ui.viewRawJson(data, 'Adenai Campaign - Complete Data');
        } catch (error) {
            console.error('View raw JSON failed:', error);
            this.ui.showToast('❌ Failed to view raw data', 'error');
        }
    }

    // Utility method to get all campaign data
    getCampaignData() {
        return {
            locations: this.locations?.getLocations() || [],
            characters: this.characters?.getCharacters() || [],
            journeys: this.journeys?.journeys || []
        };
    }

    // Method to refresh all data
    async refreshAllData() {
        try {
            console.log('🔄 Refreshing all campaign data...');
            
            if (this.locations) {
                await this.locations.loadLocations();
            }
            
            if (this.characters) {
                await this.characters.loadCharacters();
            }
            
            if (this.journeys && typeof this.journeys.loadJourneys === 'function') {
                await this.journeys.loadJourneys();
            }
            
            this.updateStats();
            this.ui.showToast('✅ All data refreshed successfully!', 'success');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.ui.showToast('❌ Failed to refresh data', 'error');
        }
    }

    // Compatibility methods for existing global functions
    closeModal() {
        if (this.locations) {
            this.locations.closeModal();
        }
    }

    closeCharacterModal() {
        if (this.characters) {
            this.characters.closeCharacterModal();
        }
    }

    closeLoginModal() {
        if (this.auth) {
            this.auth.closeLoginModal();
        }
    }

    showToast(message, type = 'success') {
        this.ui.showToast(message, type);
    }

    // Debug method to check module status
    getModuleStatus() {
        return {
            ui: !!this.ui,
            auth: !!this.auth && this.auth.isAuthenticated,
            locations: !!this.locations,
            characters: !!this.characters,
            journeys: !!this.journeys,
            theme: !!window.themeManager
        };
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all modules are loaded
    setTimeout(() => {
        window.admin = new AdenaiAdmin();
        console.log('🎯 Global admin instance created');
        
        // Debug info
        console.log('📋 Module status:', window.admin.getModuleStatus());
    }, 200);
});

// Global functions for backward compatibility
window.closeModal = () => window.admin?.closeModal();
window.closeCharacterModal = () => window.admin?.closeCharacterModal();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdenaiAdmin;
}