// char-path-api.js - Character paths
// Computed here from the static data files (characters.json, places.geojson), the same way the CMS's
// /api/character-paths does (server/routes/character-paths.js): the map no longer needs the CMS server for them.
// The API stays as a fallback if the files can't be read.

class CharPathAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.apiBaseUrl = 'https://adenai-admin.piogino.ch/api/character-paths';
        this.isDebugMode = false; // Set to true for verbose logging
        
        // Performance tracking
        this.stats = {
            apiCalls: 0,
            cacheHits: 0,
            dataSizeComparisons: []
        };
        
        this.init();
    }

    init() {
        Logger.init('🚀 Character Path API Client initialized');
        if (this.isDebugMode) {
            Logger.debug('🔧 Debug mode enabled for Character Path API');
        }
    }

    // Main public method to load character paths
    async loadCharacterPaths() {
        Logger.api('📊 Loading character paths from API...');
        const startTime = performance.now();
        
        try {
            const apiData = await this.fetchFromAPI();
            const processedData = this.processAPIData(apiData);
            
            const loadTime = performance.now() - startTime;
            Logger.success(`✅ API character paths loaded in ${loadTime.toFixed(2)}ms`);
            this.logPerformanceMetrics(apiData, loadTime, 'api');
            
            return processedData;
            
        } catch (error) {
            Logger.error('❌ Character Paths API unavailable:', error.message);
            
            // Show user-friendly error message
            this.showAPIError(error);
            
            throw new Error(`Character data unavailable. Please contact the developer through GitHub: https://github.com/piosteiner`);
        }
    }

    // Show user-friendly error message
    showAPIError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 500px;
            text-align: center;
            font-family: Arial, sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">⚠️ Character Data Unavailable</h3>
            <p style="margin: 0 0 10px 0;">The character movement system requires server connection.</p>
            <p style="margin: 0 0 15px 0;"><strong>Please contact the developer:</strong></p>
            <a href="https://github.com/piosteiner" target="_blank" style="color: #fff; text-decoration: underline;">
                🐙 GitHub: @piosteiner
            </a>
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
                Error: ${error.message}
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }

    // ---------- computed in the browser (port of generateCharacterPaths in server/routes/character-paths.js) ----------

    async computeFromData() {
        const [chars, places] = await Promise.all(['public/data/characters.json', 'public/data/places.geojson'].map(async (url) => {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
            return res.json();
        }));
        const byName = new Map((places.features || []).map((f) => [String(f.properties?.name || '').toLowerCase(), f.geometry?.coordinates]));
        const resolve = (name) => {
            const c = name ? byName.get(String(name).toLowerCase()) : null;
            return Array.isArray(c) ? [c[1], c[0]] : null; // GeoJSON [x, y] → [lat, lng]
        };

        const paths = {};
        const stats = { totalCharacters: 0, charactersWithPaths: 0, totalMovements: 0, pathsGenerated: 0 };
        for (const character of chars.characters || []) {
            stats.totalCharacters++;
            const style = CharPathAPI.styleFor(character);
            const meta = { relationship: character.relationship || 'unknown', status: character.status || 'unknown' };

            if (!character.movementHistory || character.movementHistory.length === 0) {
                const at = Array.isArray(character.currentLocation)
                    ? [character.currentLocation[1], character.currentLocation[0]]
                    : resolve(character.placeOfOrigin);
                if (at) {
                    paths[character.id] = { id: character.id, name: character.name, type: 'static', coordinates: [at], currentLocation: at, style, metadata: { movementCount: 0, ...meta } };
                    stats.pathsGenerated++;
                }
                continue;
            }

            const movements = [...character.movementHistory]
                .sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart))
                .map((m, idx) => ({ ...m, movement_nr: idx }));
            stats.totalMovements += movements.length;
            const coordinates = movements
                .map((m) => (Array.isArray(m.coordinates) ? [m.coordinates[1], m.coordinates[0]] : resolve(m.location)))
                .filter(Boolean);
            if (coordinates.length) {
                paths[character.id] = {
                    id: character.id, name: character.name, type: 'movement', coordinates,
                    currentLocation: coordinates[coordinates.length - 1], style,
                    metadata: { movementCount: movements.length, ...meta, firstMovement: movements[0]?.dateStart, lastMovement: movements[movements.length - 1]?.dateStart, movementHistory: movements },
                };
                stats.charactersWithPaths++;
                stats.pathsGenerated++;
            }
        }
        return { paths, metadata: { generated: new Date().toISOString(), statistics: stats, version: '1.0', source: 'browser' } };
    }

    static styleFor(character) {
        const colors = {
            ally: '#00ff0dff', friendly: '#35ffcdff', neutral: '#ffffffff', suspicious: '#ffc107',
            hostile: '#f87c17ff', enemy: '#f31439ff', unknown: '#000000ff', party: 'rgba(212, 0, 255, 1)',
        };
        const style = { color: colors[String(character.relationship || 'unknown').toLowerCase()] || '#999999', weight: 5, opacity: 0.7, dashArray: '10,13' };
        const status = String(character.status || 'unknown').toLowerCase();
        if (status === 'dead' || status === 'deceased') { style.opacity = 0.4; style.weight = 3; }
        return style;
    }

    // Paths: computed from the data files, the CMS API only if that fails
    async fetchFromAPI() {
        const cacheKey = 'character-paths-api';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            Logger.cache('📋 Using cached character paths data');
            this.stats.cacheHits++;
            return cached;
        }

        try {
            const computed = await this.computeFromData();
            this.setCachedData(cacheKey, computed);
            Logger.success(`🧮 Character paths computed in the browser (${Object.keys(computed.paths).length})`);
            return computed;
        } catch (err) {
            Logger.warning(`Computing character paths failed (${err.message}), asking the CMS`);
        }

        Logger.api('🌐 Fetching character paths from API...');
        this.stats.apiCalls++;

        try {
            Logger.api(`Attempting fetch to: ${this.apiBaseUrl}`);
            
            const response = await HttpUtils.fetch(this.apiBaseUrl, {
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache', // Force fresh request
                timeout: 10000,
                retries: 0 // Handle retries manually if needed
            });

            Logger.api(`API Response - Status: ${response.status}, StatusText: ${response.statusText}`);
            Logger.api(`API Response Headers:`, [...response.headers.entries()]);

            const data = await response.json();
            
            // Validate API response structure
            if (!data.paths || typeof data.paths !== 'object') {
                throw new Error('Invalid API response: missing paths object');
            }

            // Cache the successful response
            this.setCachedData(cacheKey, data);
            
            if (this.isDebugMode) {
                Logger.debug('🔍 API Response:', data);
            }

            return data;

        } catch (error) {
            Logger.error('🚨 Detailed fetch error:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                url: this.apiBaseUrl,
                timestamp: new Date().toISOString()
            });
            
            if (error.name === 'AbortError') {
                throw new Error('API request timeout (10 seconds)');
            }
            
            // Check for common network errors
            if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
                throw new Error(`Network error: Unable to connect to ${this.apiBaseUrl}`);
            }
            
            throw error;
        }
    }

    // Process API data into format expected by movement system
    processAPIData(apiData) {
        if (!apiData.paths) {
            throw new Error('Invalid API data: missing paths');
        }

        // The API data is already in the correct format, just validate it
        Object.values(apiData.paths).forEach(path => {
            if (!path.id || !path.name || !path.coordinates || !Array.isArray(path.coordinates)) {
                Logger.warn('⚠️ Invalid path data:', path);
            }
        });

        Logger.success(`✅ Processed ${Object.keys(apiData.paths).length} character paths from API`);
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
        
        Logger.debug(`📊 Performance Metrics (${source}):`);
        Logger.debug(`  - Load time: ${loadTime.toFixed(2)}ms`);
        Logger.debug(`  - Data size: ${dataSizeKB}KB`);
        Logger.debug(`  - Paths: ${Object.keys(data.paths || {}).length}`);
        
        this.stats.dataSizeComparisons.push({
            source: source,
            size: dataSize,
            loadTime: loadTime,
            timestamp: Date.now()
        });
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
        Logger.debug('📈 Character Path Manager Statistics:', stats);
        return stats;
    }

    clearCache() {
        this.cache.clear();
        Logger.cache('🧹 Character path cache cleared');
    }

    setDebugMode(enabled) {
        this.isDebugMode = enabled;
        Logger.debug(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Test methods for development
    async testAPIConnection() {
        try {
            const response = await HttpUtils.fetch(`${this.apiBaseUrl}/stats`, {
                headers: { 'Accept': 'application/json' }
            });
            
            const stats = await response.json();
            Logger.success('✅ API connection test successful:', stats);
            return true;
        } catch (error) {
            Logger.error('❌ API connection test error:', error);
            return false;
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharPathAPI;
}

// Make available globally
window.CharPathAPI = CharPathAPI;
// Legacy alias for backward compatibility
window.CharacterPathManager = CharPathAPI;

Logger.loading('📚 Character Path API Client loaded successfully');