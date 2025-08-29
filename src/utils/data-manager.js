// data-manager.js - Centralized Data Management with Advanced Loading
// Provides unified interface for all application data with smart caching

class DataManager {
    static instance = null;
    static loadingPromises = new Map();
    static subscribers = new Map();
    static data = new Map();
    static loadingState = new Map();
    
    static get() {
        if (!this.instance) {
            this.instance = new DataManager();
        }
        return this.instance;
    }
    
    constructor() {
        this.initialized = false;
        this.critical = {};
        this.important = {};
        this.optional = {};
        
        // Initialize subscribers map
        this.subscribers = new Map();
        
        // Track data loading states
        this.loadingStates = {
            characters: 'idle',
            locations: 'idle', 
            reviews: 'idle',
            journeys: 'idle',
            'media-library': 'idle'
        };
        
        this.setupEventListeners();
    }
    
    // Initialize progressive data loading
    async initialize() {
        if (this.initialized) {
            Logger.debug('DataManager already initialized');
            return;
        }
        
        Logger.loading('🎯 Initializing DataManager with progressive loading...');
        const startTime = performance.now();
        
        try {
            // Start progressive loading
            const results = await AdvancedLoader.loadProgressively();
            
            // Store critical data immediately
            this.critical = results.critical;
            this.important = results.important;
            this.optional = results.optional;
            
            // Update loading states
            Object.keys(results.critical).forEach(key => {
                this.loadingStates[key] = 'loaded';
                this.notifySubscribers(key, results.critical[key]);
            });
            
            this.initialized = true;
            const endTime = performance.now();
            
            Logger.success(`✅ DataManager initialized in ${(endTime - startTime).toFixed(2)}ms`);
            Logger.debug('Critical data loaded:', Object.keys(this.critical));
            
            // Dispatch global event
            document.dispatchEvent(new CustomEvent('dataManagerReady', {
                detail: { 
                    critical: this.critical,
                    loadTime: endTime - startTime
                }
            }));
            
            return this.critical;
            
        } catch (error) {
            Logger.error('DataManager initialization failed:', error);
            throw error;
        }
    }
    
    // Get data with automatic loading
    async getData(type, options = {}) {
        const startTime = performance.now();
        
        // Check if we already have the data
        if (this.hasData(type) && !options.forceRefresh) {
            const data = this.getCachedData(type);
            Logger.cache(`📋 Retrieved cached ${type} (${Array.isArray(data) ? data.length : 'object'} items)`);
            return data;
        }
        
        // Check loading state
        if (this.loadingStates[type] === 'loading') {
            Logger.debug(`⏳ Waiting for ongoing ${type} load...`);
            return await this.waitForLoad(type);
        }
        
        // Start loading
        this.loadingStates[type] = 'loading';
        this.notifyLoadingState(type, 'loading');
        
        try {
            const data = await AdvancedLoader.loadDataOptimized(type, options);
            
            // Store data
            this.storeData(type, data);
            this.loadingStates[type] = 'loaded';
            
            const endTime = performance.now();
            Logger.success(`📦 Loaded ${type} in ${(endTime - startTime).toFixed(2)}ms`);
            
            // Notify subscribers
            this.notifySubscribers(type, data);
            this.notifyLoadingState(type, 'loaded');
            
            return data;
            
        } catch (error) {
            this.loadingStates[type] = 'error';
            this.notifyLoadingState(type, 'error', error);
            
            Logger.error(`Failed to load ${type}:`, error);
            throw error;
        }
    }
    
    // Store data in appropriate location
    storeData(type, data) {
        // Store in relevant category
        if (AdvancedLoader.config.priorities.critical.includes(type)) {
            this.critical[type] = data;
        } else if (AdvancedLoader.config.priorities.important.includes(type)) {
            this.important[type] = data;
        } else {
            this.optional[type] = data;
        }
        
        // Also store in general data map
        DataManager.data.set(type, data);
    }
    
    // Check if we have data
    hasData(type) {
        return this.critical[type] || 
               this.important[type] || 
               this.optional[type] ||
               DataManager.data.has(type);
    }
    
    // Get cached data
    getCachedData(type) {
        return this.critical[type] || 
               this.important[type] || 
               this.optional[type] ||
               DataManager.data.get(type);
    }
    
    // Wait for ongoing load
    async waitForLoad(type) {
        return new Promise((resolve, reject) => {
            const checkInterval = PerformanceUtils.setInterval(() => {
                if (this.loadingStates[type] === 'loaded') {
                    PerformanceUtils.clearTimeout(checkInterval);
                    resolve(this.getCachedData(type));
                } else if (this.loadingStates[type] === 'error') {
                    PerformanceUtils.clearTimeout(checkInterval);
                    reject(new Error(`Loading failed for ${type}`));
                }
            }, 50, `wait_load_${type}`);
            
            // Timeout after 30 seconds
            PerformanceUtils.setTimeout(() => {
                PerformanceUtils.clearTimeout(checkInterval);
                reject(new Error(`Timeout waiting for ${type} load`));
            }, 30000, `wait_timeout_${type}`);
        });
    }
    
    // Specialized getters for common data types
    async getCharacters(options = {}) {
        return await this.getData('characters', options);
    }
    
    async getLocations(options = {}) {
        return await this.getData('locations', options);
    }
    
    async getReviews(options = {}) {
        return await this.getData('reviews', options);
    }
    
    async getJourneys(options = {}) {
        return await this.getData('journeys', options);
    }
    
    async getMediaLibrary(options = {}) {
        return await this.getData('media-library', options);
    }
    
    // Character-specific helpers
    async getCharacterById(id, options = {}) {
        const characters = await this.getCharacters(options);
        if (!Array.isArray(characters)) return null;
        
        const character = characters.find(c => c.id === id || c.name === id);
        if (character) {
            Logger.debug(`🎭 Found character: ${character.name || character.id}`);
        }
        return character;
    }
    
    async getCharactersByType(type, options = {}) {
        const characters = await this.getCharacters(options);
        if (!Array.isArray(characters)) return [];
        
        const filtered = characters.filter(c => c.type === type);
        Logger.debug(`🎭 Found ${filtered.length} characters of type: ${type}`);
        return filtered;
    }
    
    async getActiveCharacters(options = {}) {
        const characters = await this.getCharacters(options);
        if (!Array.isArray(characters)) return [];
        
        const active = characters.filter(c => 
            c.status === 'active' || 
            (c.movementHistory && c.movementHistory.length > 0)
        );
        Logger.debug(`🎭 Found ${active.length} active characters`);
        return active;
    }
    
    // Location-specific helpers
    async getLocationById(id, options = {}) {
        const locations = await this.getLocations(options);
        if (!locations?.features) return null;
        
        const location = locations.features.find(f => 
            f.id === id || 
            f.properties?.id === id ||
            f.properties?.name === id
        );
        
        if (location) {
            Logger.debug(`📍 Found location: ${location.properties?.name || location.id}`);
        }
        return location;
    }
    
    async getLocationsByType(type, options = {}) {
        const locations = await this.getLocations(options);
        if (!locations?.features) return [];
        
        const filtered = locations.features.filter(f => 
            f.properties?.type === type ||
            f.properties?.category === type
        );
        Logger.debug(`📍 Found ${filtered.length} locations of type: ${type}`);
        return filtered;
    }
    
    // Review-specific helpers
    async getRecentReviews(limit = 10, options = {}) {
        const reviews = await this.getReviews(options);
        if (!Array.isArray(reviews)) return [];
        
        const recent = reviews
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
            
        Logger.debug(`📝 Retrieved ${recent.length} recent reviews`);
        return recent;
    }
    
    async getReviewsByLocation(locationId, options = {}) {
        const reviews = await this.getReviews(options);
        if (!Array.isArray(reviews)) return [];
        
        const filtered = reviews.filter(r => 
            r.locationId === locationId ||
            r.location === locationId
        );
        Logger.debug(`📝 Found ${filtered.length} reviews for location: ${locationId}`);
        return filtered;
    }
    
    // Data subscription system
    subscribe(dataType, callback) {
        // Ensure subscribers map exists
        if (!this.subscribers) {
            this.subscribers = new Map();
        }
        
        if (!this.subscribers.has(dataType)) {
            this.subscribers.set(dataType, new Set());
        }
        
        this.subscribers.get(dataType).add(callback);
        
        // If data already loaded, call immediately
        if (this.hasData(dataType)) {
            try {
                callback(this.getCachedData(dataType));
            } catch (error) {
                Logger.error(`Subscription callback error for ${dataType}:`, error);
            }
        }
        
        Logger.debug(`📢 Subscribed to ${dataType} updates`);
        
        // Return unsubscribe function
        return () => {
            if (this.subscribers) {
                this.subscribers.get(dataType)?.delete(callback);
            }
        };
    }
    
    // Notify subscribers
    notifySubscribers(dataType, data) {
        // Ensure subscribers map exists
        if (!this.subscribers) {
            this.subscribers = new Map();
            Logger.debug(`⚠️ Subscribers map was not initialized, creating it now`);
        }
        
        const callbacks = this.subscribers.get(dataType);
        if (!callbacks) return;
        
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                Logger.error(`Subscription callback error for ${dataType}:`, error);
            }
        });
        
        Logger.debug(`📢 Notified ${callbacks.size} subscribers for ${dataType}`);
    }
    
    // Notify loading state changes
    notifyLoadingState(dataType, state, error = null) {
        document.dispatchEvent(new CustomEvent(`${dataType}LoadingState`, {
            detail: { state, error, timestamp: Date.now() }
        }));
    }
    
    // Setup event listeners for background loads
    setupEventListeners() {
        // Ensure subscribers map is initialized
        if (!this.subscribers) {
            this.subscribers = new Map();
        }
        
        // Listen for background load completions
        ['journeys', 'reviews', 'media-library'].forEach(dataType => {
            document.addEventListener(`${dataType}Loaded`, (event) => {
                try {
                    this.storeData(dataType, event.detail.data);
                    this.loadingStates[dataType] = 'loaded';
                    this.notifySubscribers(dataType, event.detail.data);
                    this.notifyLoadingState(dataType, 'loaded');
                    
                    Logger.debug(`📡 Background loaded: ${dataType}`);
                } catch (error) {
                    Logger.error(`Error handling background load for ${dataType}:`, error);
                }
            });
        });
    }
    
    // Get current loading states
    getLoadingStates() {
        return { ...this.loadingStates };
    }
    
    // Get data summary
    getDataSummary() {
        const summary = {
            initialized: this.initialized,
            loadingStates: this.getLoadingStates(),
            dataTypes: {
                critical: Object.keys(this.critical),
                important: Object.keys(this.important),
                optional: Object.keys(this.optional)
            },
            cacheStats: AdvancedLoader.getCacheStats(),
            subscriberCounts: {}
        };
        
        if (this.subscribers) {
            this.subscribers.forEach((callbacks, dataType) => {
                summary.subscriberCounts[dataType] = callbacks.size;
            });
        }
        
        return summary;
    }
    
    // Refresh specific data type
    async refreshData(type) {
        Logger.loading(`🔄 Refreshing ${type} data...`);
        return await this.getData(type, { forceRefresh: true });
    }
    
    // Refresh all data
    async refreshAllData() {
        Logger.loading('🔄 Refreshing all data...');
        const types = Object.keys(this.loadingStates);
        
        const promises = types.map(type => 
            this.refreshData(type).catch(error => {
                Logger.warning(`Failed to refresh ${type}:`, error);
                return null;
            })
        );
        
        await Promise.all(promises);
        Logger.success('✅ Data refresh completed');
    }
    
    // Cleanup
    cleanup() {
        if (this.subscribers) {
            this.subscribers.clear();
        }
        DataManager.data.clear();
        DataManager.loadingPromises.clear();
        this.critical = {};
        this.important = {};
        this.optional = {};
        this.initialized = false;
        
        Logger.cleanup('DataManager cleaned up');
    }
}

// Global instance
window.DataManager = DataManager;

// Auto-cleanup
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        DataManager.get().cleanup();
    });
}

Logger.loading('📊 Data management system ready');
