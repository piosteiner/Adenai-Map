// char-path-api.js - Character Paths API Client
// Provides character path data from server API

import { HttpUtils } from './http-utils.js';
import { Logger } from './logger.js';

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

    // Fetch from Character Paths API with caching
    async fetchFromAPI() {
        const cacheKey = 'character-paths-api';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            Logger.cache('📋 Using cached character paths data');
            this.stats.cacheHits++;
            return cached;
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

console.log('📚 Character Path API Client loaded successfully');