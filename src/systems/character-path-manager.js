// character-path-manager.js - Hybrid Character Paths API Integration
// Provides optimized character path data with fallback to local JSON

class CharacterPathManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.apiBaseUrl = 'https://adenai-admin.piogino.ch/api/character-paths';
        this.fallbackData = null;
        this.isDebugMode = false; // Set to true for verbose logging
        
        // Performance tracking
        this.stats = {
            apiCalls: 0,
            cacheHits: 0,
            fallbackUsage: 0,
            dataSizeComparisons: []
        };
        
        // Style mapping from API relationship values to colors
        this.relationshipColors = {
            ally: '#28a745',
            friendly: '#28a745', 
            enemy: '#dc3545',
            hostile: '#dc3545',
            neutral: '#6c757d',
            suspicious: '#ffc107',
            unknown: '#17a2b8',
            party: '#584cffff'
        };
        
        this.init();
    }

    init() {
        console.log('🚀 Character Path Manager initialized');
        if (this.isDebugMode) {
            console.log('🔧 Debug mode enabled for Character Path Manager');
        }
    }

    // Main public method to load character paths
    async loadCharacterPaths() {
        console.log('📊 Loading character paths...');
        const startTime = performance.now();
        
        try {
            // Try API first
            const apiData = await this.fetchFromAPI();
            const processedData = this.processAPIData(apiData);
            
            const loadTime = performance.now() - startTime;
            console.log(`✅ API character paths loaded in ${loadTime.toFixed(2)}ms`);
            this.logPerformanceMetrics(apiData, loadTime, 'api');
            
            return processedData;
            
        } catch (error) {
            console.warn('⚠️ API failed, falling back to JSON:', error.message);
            this.stats.fallbackUsage++;
            
            try {
                const fallbackData = await this.loadFallbackData();
                const loadTime = performance.now() - startTime;
                console.log(`✅ Fallback character data loaded in ${loadTime.toFixed(2)}ms`);
                this.logPerformanceMetrics(fallbackData, loadTime, 'fallback');
                
                return fallbackData;
                
            } catch (fallbackError) {
                console.error('❌ Both API and fallback failed:', fallbackError);
                throw new Error(`Failed to load character data: API (${error.message}) and Fallback (${fallbackError.message})`);
            }
        }
    }

    // Fetch from Character Paths API with caching
    async fetchFromAPI() {
        const cacheKey = 'character-paths-api';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            console.log('📋 Using cached character paths data');
            this.stats.cacheHits++;
            return cached;
        }

        console.log('🌐 Fetching character paths from API...');
        this.stats.apiCalls++;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const response = await fetch(this.apiBaseUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Validate API response structure
            if (!data.paths || typeof data.paths !== 'object') {
                throw new Error('Invalid API response: missing paths object');
            }

            // Cache the successful response
            this.setCachedData(cacheKey, data);
            
            if (this.isDebugMode) {
                console.log('🔍 API Response:', data);
            }

            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('API request timeout');
            }
            
            throw error;
        }
    }

    // Load fallback data from existing JSON system
    async loadFallbackData() {
        console.log('📁 Loading fallback character data from JSON...');
        
        if (this.fallbackData) {
            console.log('📋 Using cached fallback data');
            return this.fallbackData;
        }

        // Use the same URL pattern as the existing character system
        const urls = [
            `/data/characters.json?t=${Date.now()}`,
            `public/data/characters.json?t=${Date.now()}`,
            `./public/data/characters.json?t=${Date.now()}`
        ];

        let response;
        for (const url of urls) {
            try {
                if (this.isDebugMode) {
                    console.log(`🔄 Trying fallback URL: ${url}`);
                }
                
                response = await fetch(url);
                if (response.ok) {
                    console.log(`✅ Fallback loaded from: ${url}`);
                    break;
                }
            } catch (e) {
                if (this.isDebugMode) {
                    console.log(`❌ Failed URL: ${url} - ${e.message}`);
                }
            }
        }

        if (!response || !response.ok) {
            throw new Error('All fallback URLs failed');
        }

        const data = await response.json();
        
        // Convert legacy format to new format
        const convertedData = this.convertLegacyDataToAPIFormat(data);
        this.fallbackData = convertedData;
        
        return convertedData;
    }

    // Convert legacy character.json format to API format
    convertLegacyDataToAPIFormat(legacyData) {
        const paths = {};
        const characters = legacyData.characters || [];

        characters.forEach(character => {
            if (!character.id) return;

            const hasMovement = character.movementHistory && character.movementHistory.length > 0;
            const relationship = character.relationship || 'unknown';
            const status = character.status || 'alive';

            if (hasMovement) {
                // Create movement path
                const coordinates = character.movementHistory
                    .filter(m => m.coordinates && Array.isArray(m.coordinates))
                    .map(m => [m.coordinates[1], m.coordinates[0]]); // Convert [x,y] to [lat,lng]

                if (coordinates.length > 0) {
                    paths[character.id] = {
                        id: character.id,
                        name: character.name,
                        type: 'movement',
                        coordinates: coordinates,
                        currentLocation: coordinates[coordinates.length - 1],
                        style: this.generatePathStyle(relationship, status),
                        metadata: {
                            movementCount: character.movementHistory.length,
                            relationship: relationship,
                            status: status
                        }
                    };
                }
            } else if (character.coordinates) {
                // Create static location
                paths[character.id] = {
                    id: character.id,
                    name: character.name,
                    type: 'static',
                    coordinates: [[character.coordinates[1], character.coordinates[0]]], // Convert [x,y] to [lat,lng]
                    currentLocation: [character.coordinates[1], character.coordinates[0]],
                    style: this.generatePathStyle(relationship, status),
                    metadata: {
                        movementCount: 0,
                        relationship: relationship,
                        status: status
                    }
                };
            }
        });

        return {
            paths: paths,
            metadata: {
                generated: new Date().toISOString(),
                statistics: {
                    totalCharacters: characters.length,
                    pathsGenerated: Object.keys(paths).length
                },
                version: '1.0-fallback',
                source: 'legacy-json'
            }
        };
    }

    // Generate path style based on relationship and status
    generatePathStyle(relationship, status) {
        const baseColor = this.relationshipColors[relationship] || this.relationshipColors.unknown;
        const isDead = status === 'dead' || status === 'undead';
        
        return {
            color: baseColor,
            weight: 2,
            opacity: isDead ? 0.5 : 0.7,
            dashArray: isDead ? '10,5' : null
        };
    }

    // Process API data into format expected by movement system
    processAPIData(apiData) {
        if (!apiData.paths) {
            throw new Error('Invalid API data: missing paths');
        }

        // The API data is already in the correct format, just validate it
        Object.values(apiData.paths).forEach(path => {
            if (!path.id || !path.name || !path.coordinates || !Array.isArray(path.coordinates)) {
                console.warn('⚠️ Invalid path data:', path);
            }
        });

        console.log(`✅ Processed ${Object.keys(apiData.paths).length} character paths from API`);
        return apiData;
    }

    // Cache management
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Performance monitoring
    logPerformanceMetrics(data, loadTime, source) {
        const dataSize = new Blob([JSON.stringify(data)]).size;
        const dataSizeKB = (dataSize / 1024).toFixed(2);
        
        console.log(`📊 Performance Metrics (${source}):`);
        console.log(`  - Load time: ${loadTime.toFixed(2)}ms`);
        console.log(`  - Data size: ${dataSizeKB}KB`);
        console.log(`  - Paths: ${Object.keys(data.paths || {}).length}`);
        
        this.stats.dataSizeComparisons.push({
            source: source,
            size: dataSize,
            loadTime: loadTime,
            timestamp: Date.now()
        });

        // Compare with historical data if available
        const previousData = this.stats.dataSizeComparisons.filter(s => s.source !== source);
        if (previousData.length > 0) {
            const avgPreviousSize = previousData.reduce((sum, s) => sum + s.size, 0) / previousData.length;
            const improvement = ((avgPreviousSize - dataSize) / avgPreviousSize * 100).toFixed(1);
            
            if (improvement > 0) {
                console.log(`  - Size improvement: ${improvement}% smaller than average`);
            }
        }
    }

    // Debug and statistics methods
    getStatistics() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            isDebugMode: this.isDebugMode
        };
    }

    printStatistics() {
        const stats = this.getStatistics();
        console.log('📈 Character Path Manager Statistics:', stats);
        return stats;
    }

    clearCache() {
        this.cache.clear();
        this.fallbackData = null;
        console.log('🧹 Character path cache cleared');
    }

    setDebugMode(enabled) {
        this.isDebugMode = enabled;
        console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Test methods for development
    async testAPIConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/stats`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const stats = await response.json();
                console.log('✅ API connection test successful:', stats);
                return true;
            } else {
                console.error('❌ API connection test failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ API connection test error:', error);
            return false;
        }
    }

    async testFallback() {
        try {
            const data = await this.loadFallbackData();
            console.log('✅ Fallback test successful, paths:', Object.keys(data.paths).length);
            return true;
        } catch (error) {
            console.error('❌ Fallback test failed:', error);
            return false;
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterPathManager;
}

// Make available globally
window.CharacterPathManager = CharacterPathManager;

console.log('📚 Character Path Manager loaded successfully');
