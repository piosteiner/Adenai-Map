// data-config.js - Configuration for Data Loading Strategies
// Centralized configuration for managing static vs dynamic data sources

class DataConfig {
    static config = {
        // Data sources that update daily and should always be fresh
        dailyUpdates: [
            'journeys'  // Journey data from CMS API updates daily
        ],
        
        // Static data files that can be cached longer
        staticFiles: [
            'characters',     // Character data (updates less frequently)
            'locations',      // Location data (stable)
            'reviews',        // Review data (historical)
            'media-library'   // Media references (stable)
        ],
        
        // Cache durations in milliseconds
        cacheDurations: {
            // Static file caching (longer TTL)
            characters: 30 * 60 * 1000,        // 30 minutes
            locations: 60 * 60 * 1000,         // 1 hour
            reviews: 2 * 60 * 60 * 1000,       // 2 hours
            'media-library': 24 * 60 * 60 * 1000, // 24 hours
            
            // Dynamic data (always fresh or very short TTL)
            journeys: 0  // 0 = always fresh from network
        },
        
        // Network strategies per data type
        networkStrategies: {
            // Cache-first for static data (better performance)
            characters: 'cache-first',
            locations: 'cache-first', 
            reviews: 'cache-first',
            'media-library': 'cache-first',
            
            // Network-first for dynamic data (always fresh)
            journeys: 'network-first'
        },
        
        // Fallback behavior when network fails
        fallbackBehavior: {
            characters: 'serve-cache',      // Serve cached version
            locations: 'serve-cache',       // Serve cached version
            reviews: 'serve-cache',         // Serve cached version
            'media-library': 'serve-cache', // Serve cached version
            journeys: 'serve-cache-with-warning' // Serve cache but warn it's stale
        }
    };
    
    // Check if data type should always be fresh
    static shouldAlwaysBeFresh(dataType) {
        return this.config.dailyUpdates.includes(dataType);
    }
    
    // Get cache duration for data type
    static getCacheDuration(dataType) {
        return this.config.cacheDurations[dataType] || 30 * 60 * 1000; // 30 min default
    }
    
    // Get network strategy for data type
    static getNetworkStrategy(dataType) {
        return this.config.networkStrategies[dataType] || 'cache-first';
    }
    
    // Get fallback behavior for data type
    static getFallbackBehavior(dataType) {
        return this.config.fallbackBehavior[dataType] || 'serve-cache';
    }
    
    // Check if data type is static file
    static isStaticFile(dataType) {
        return this.config.staticFiles.includes(dataType);
    }
    
    // Check if data type is from API
    static isApiData(dataType) {
        return this.config.dailyUpdates.includes(dataType);
    }
    
    // Get all daily update data types
    static getDailyUpdateTypes() {
        return [...this.config.dailyUpdates];
    }
    
    // Get all static file types
    static getStaticFileTypes() {
        return [...this.config.staticFiles];
    }
    
    // Get configuration summary
    static getConfigSummary() {
        return {
            dailyUpdates: this.config.dailyUpdates.length,
            staticFiles: this.config.staticFiles.length,
            totalDataTypes: this.config.dailyUpdates.length + this.config.staticFiles.length,
            strategies: {
                networkFirst: Object.values(this.config.networkStrategies).filter(s => s === 'network-first').length,
                cacheFirst: Object.values(this.config.networkStrategies).filter(s => s === 'cache-first').length
            }
        };
    }
    
    // Update configuration (for runtime changes)
    static updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        Logger.debug('Data configuration updated:', this.getConfigSummary());
    }
    
    // Validate data type configuration
    static validateDataType(dataType) {
        const isStatic = this.isStaticFile(dataType);
        const isApi = this.isApiData(dataType);
        
        if (!isStatic && !isApi) {
            Logger.warning(`Data type '${dataType}' not configured. Adding as static file.`);
            this.config.staticFiles.push(dataType);
            this.config.networkStrategies[dataType] = 'cache-first';
            this.config.cacheDurations[dataType] = 30 * 60 * 1000; // 30 min default
            return false;
        }
        
        return true;
    }
}

// Make available globally
window.DataConfig = DataConfig;

// Log configuration on load
Logger.debug('📊 Data configuration loaded:', DataConfig.getConfigSummary());
