// advanced-loader.js - Progressive Loading and Smart Caching System
// Optimizes data loading with chunking, background sync, and progressive enhancement

class AdvancedLoader {
    static cache = new Map();
    static pendingRequests = new Map();
    static loadingQueue = [];
    static maxConcurrentLoads = 3;
    static activeLoads = 0;
    
    static config = {
        // Cache TTL for different data types (milliseconds)
        cacheTTL: {
            characters: 10 * 60 * 1000,    // 10 minutes
            locations: 30 * 60 * 1000,     // 30 minutes  
            reviews: 60 * 60 * 1000,       // 1 hour
            journeys: 5 * 60 * 1000,       // 5 minutes (more dynamic)
            'media-library': 24 * 60 * 60 * 1000  // 24 hours
        },
        
        // Progressive loading priorities
        priorities: {
            critical: ['locations', 'characters'],
            important: ['journeys'],
            optional: ['reviews', 'media-library']
        },
        
        // Chunk sizes for large files
        chunkSizes: {
            characters: 50,  // Load 50 characters at a time
            reviews: 100,    // Load 100 reviews at a time
            locations: 25    // Load 25 locations at a time
        }
    };
    
    // Progressive data loading with priorities
    static async loadProgressively() {
        Logger.loading('🚀 Starting progressive data loading...');
        
        const startTime = performance.now();
        const results = {
            critical: {},
            important: {},
            optional: {},
            errors: []
        };
        
        try {
            // Phase 1: Critical data (blocking)
            Logger.loading('📍 Loading critical data (locations, characters)...');
            for (const dataType of this.config.priorities.critical) {
                try {
                    results.critical[dataType] = await this.loadDataOptimized(dataType);
                } catch (error) {
                    Logger.error(`Critical load failed for ${dataType}:`, error);
                    results.errors.push({ type: dataType, error, phase: 'critical' });
                }
            }
            
            // Phase 2: Important data (background)
            Logger.loading('⚡ Loading important data (journeys)...');
            this.loadInBackground(this.config.priorities.important, results.important);
            
            // Phase 3: Optional data (lazy)
            Logger.loading('🔄 Queuing optional data (reviews, media)...');
            this.queueLazyLoad(this.config.priorities.optional, results.optional);
            
            const endTime = performance.now();
            Logger.success(`Progressive loading completed in ${(endTime - startTime).toFixed(2)}ms`);
            
            return results;
            
        } catch (error) {
            Logger.error('Progressive loading failed:', error);
            throw error;
        }
    }
    
    // Optimized data loading with smart caching
    static async loadDataOptimized(dataType, options = {}) {
        const startTime = performance.now();
        
        // Check cache first
        const cached = this.getFromCache(dataType);
        if (cached && !options.forceRefresh) {
            Logger.cache(`📋 Using cached ${dataType} (${cached.data.length || 'N/A'} items)`);
            return cached.data;
        }
        
        // Check for pending request
        if (this.pendingRequests.has(dataType)) {
            Logger.debug(`⏳ Waiting for pending ${dataType} request...`);
            return await this.pendingRequests.get(dataType);
        }
        
        // Create new request
        const requestPromise = this.performDataLoad(dataType, options);
        this.pendingRequests.set(dataType, requestPromise);
        
        try {
            const data = await requestPromise;
            const endTime = performance.now();
            
            // Cache the result
            this.setInCache(dataType, data);
            
            Logger.success(`✅ Loaded ${dataType} in ${(endTime - startTime).toFixed(2)}ms`);
            return data;
            
        } finally {
            this.pendingRequests.delete(dataType);
        }
    }
    
    // Perform actual data loading with retry logic
    static async performDataLoad(dataType, options = {}) {
        const urls = this.getDataUrls(dataType);
        const loadOptions = {
            cache: 'default',
            timeout: 15000,
            retries: 2,
            ...options
        };
        
        // Try multiple URLs if available
        for (const url of urls) {
            try {
                const data = await HttpUtils.fetchJSON(url, loadOptions);
                
                // Process chunked data if needed
                return this.processLoadedData(dataType, data);
                
            } catch (error) {
                Logger.warning(`Failed to load ${dataType} from ${url}:`, error.message);
                if (url === urls[urls.length - 1]) {
                    throw error; // Last URL failed
                }
            }
        }
    }
    
    // Get possible URLs for data type
    static getDataUrls(dataType) {
        const baseUrls = {
            characters: [
                'public/data/characters.json',
                '/data/characters.json',
                './data/characters.json'
            ],
            locations: [
                'public/data/places.geojson',
                '/data/places.geojson', 
                './data/places.geojson'
            ],
            reviews: [
                'public/data/reviews.json',
                '/data/reviews.json',
                './data/reviews.json'
            ],
            'media-library': [
                'public/data/media-library.json',
                '/data/media-library.json',
                './data/media-library.json'
            ],
            journeys: [
                'https://adenai-admin.piogino.ch/api/journey'
            ]
        };
        
        return baseUrls[dataType] || [];
    }
    
    // Process and potentially chunk loaded data
    static processLoadedData(dataType, data) {
        // Apply data transformations if needed
        switch (dataType) {
            case 'characters':
                return this.processCharacterData(data);
            case 'reviews':
                return this.processReviewData(data);
            case 'locations':
                return this.processLocationData(data);
            default:
                return data;
        }
    }
    
    // Character data processing and chunking
    static processCharacterData(data) {
        if (!Array.isArray(data)) return data;
        
        // Sort by importance (characters with movements first)
        const sorted = data.sort((a, b) => {
            const aHasMovement = (a.movementHistory?.length || 0) > 0;
            const bHasMovement = (b.movementHistory?.length || 0) > 0;
            
            if (aHasMovement && !bHasMovement) return -1;
            if (!aHasMovement && bHasMovement) return 1;
            return 0;
        });
        
        Logger.debug(`📊 Processed ${sorted.length} characters (${sorted.filter(c => c.movementHistory?.length > 0).length} with movements)`);
        return sorted;
    }
    
    // Review data processing with pagination
    static processReviewData(data) {
        if (!Array.isArray(data)) return data;
        
        // Sort by date (newest first)
        const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        Logger.debug(`📊 Processed ${sorted.length} reviews`);
        return sorted;
    }
    
    // Location data processing
    static processLocationData(data) {
        if (data.type === 'FeatureCollection') {
            Logger.debug(`📊 Processed ${data.features?.length || 0} location features`);
        }
        return data;
    }
    
    // Background loading for non-critical data
    static loadInBackground(dataTypes, results) {
        dataTypes.forEach(dataType => {
            PerformanceUtils.setTimeout(async () => {
                try {
                    results[dataType] = await this.loadDataOptimized(dataType);
                    
                    // Notify listeners
                    document.dispatchEvent(new CustomEvent(`${dataType}Loaded`, {
                        detail: { data: results[dataType] }
                    }));
                    
                } catch (error) {
                    Logger.error(`Background load failed for ${dataType}:`, error);
                    results[dataType] = null;
                }
            }, 100, `background_load_${dataType}`);
        });
    }
    
    // Queue lazy loading for optional data
    static queueLazyLoad(dataTypes, results) {
        dataTypes.forEach(dataType => {
            this.loadingQueue.push({
                type: dataType,
                priority: 'low',
                loader: async () => {
                    results[dataType] = await this.loadDataOptimized(dataType);
                    return results[dataType];
                }
            });
        });
        
        // Process queue when idle
        this.processLoadingQueue();
    }
    
    // Process loading queue with concurrency control
    static async processLoadingQueue() {
        while (this.loadingQueue.length > 0 && this.activeLoads < this.maxConcurrentLoads) {
            const item = this.loadingQueue.shift();
            if (!item) break;
            
            this.activeLoads++;
            
            PerformanceUtils.setTimeout(async () => {
                try {
                    await item.loader();
                    Logger.debug(`📦 Lazy loaded: ${item.type}`);
                } catch (error) {
                    Logger.warning(`Lazy load failed for ${item.type}:`, error);
                } finally {
                    this.activeLoads--;
                    this.processLoadingQueue(); // Continue processing
                }
            }, 50, `lazy_load_${item.type}`);
        }
    }
    
    // Smart caching with TTL
    static getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        const ttl = this.config.cacheTTL[key] || 300000; // 5 min default
        const isExpired = Date.now() - cached.timestamp > ttl;
        
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }
        
        return cached;
    }
    
    static setInCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            size: JSON.stringify(data).length
        });
    }
    
    // Preload critical data for next session
    static preloadNextSession() {
        // Only preload if we have good network
        if (navigator.connection && navigator.connection.effectiveType === '4g') {
            this.config.priorities.critical.forEach(dataType => {
                this.loadDataOptimized(dataType, { cache: 'force-cache' })
                    .catch(error => Logger.debug(`Preload failed for ${dataType}:`, error));
            });
        }
    }
    
    // Cache management
    static getCacheStats() {
        const stats = {
            entries: this.cache.size,
            totalSize: 0,
            byType: {}
        };
        
        this.cache.forEach((cached, key) => {
            stats.totalSize += cached.size;
            stats.byType[key] = {
                size: cached.size,
                age: Date.now() - cached.timestamp,
                items: Array.isArray(cached.data) ? cached.data.length : 1
            };
        });
        
        return stats;
    }
    
    static clearExpiredCache() {
        let cleared = 0;
        this.cache.forEach((cached, key) => {
            const ttl = this.config.cacheTTL[key] || 300000;
            if (Date.now() - cached.timestamp > ttl) {
                this.cache.delete(key);
                cleared++;
            }
        });
        
        if (cleared > 0) {
            Logger.cleanup(`Cleared ${cleared} expired cache entries`);
        }
    }
    
    // Network-aware loading
    static getNetworkAwareOptions() {
        const connection = navigator.connection;
        if (!connection) return {};
        
        // Adjust loading based on connection quality
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            return {
                timeout: 30000,
                retries: 0,
                cache: 'force-cache'
            };
        } else if (connection.effectiveType === '3g') {
            return {
                timeout: 20000,
                retries: 1
            };
        } else {
            return {
                timeout: 10000,
                retries: 2
            };
        }
    }
    
    // Cleanup
    static cleanup() {
        this.cache.clear();
        this.pendingRequests.clear();
        this.loadingQueue.length = 0;
        this.activeLoads = 0;
        
        Logger.cleanup('AdvancedLoader cleaned up');
    }
}

// Auto-cleanup and network monitoring
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        AdvancedLoader.cleanup();
    });
    
    // Clear expired cache periodically
    PerformanceUtils.setInterval(() => {
        AdvancedLoader.clearExpiredCache();
    }, 5 * 60 * 1000, 'cache_cleanup'); // Every 5 minutes
    
    // Preload on page idle
    document.addEventListener('DOMContentLoaded', () => {
        PerformanceUtils.setTimeout(() => {
            AdvancedLoader.preloadNextSession();
        }, 10000, 'preload_next_session');
    });
}

Logger.loading('🚀 Advanced loading and caching system ready');
