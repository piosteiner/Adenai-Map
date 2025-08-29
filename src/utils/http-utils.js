// http-utils.js - Centralized HTTP Request Utilities
class HttpUtils {
    static defaultOptions = {
        timeout: 10000,
        retries: 1,
        retryDelay: 1000,
        cache: 'default'
    };

    /**
     * Enhanced fetch with timeout, retries, and error handling
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options + custom options
     * @returns {Promise<Response>} Fetch response
     */
    static async fetch(url, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const { timeout, retries, retryDelay, ...fetchOptions } = config;

        let lastError;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                Logger.api(`${attempt > 0 ? `Retry ${attempt}: ` : ''}Fetching: ${url}`);

                const response = await fetch(url, {
                    signal: controller.signal,
                    ...fetchOptions
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                Logger.success(`Successfully fetched: ${url}`);
                return response;

            } catch (error) {
                lastError = error;
                
                if (error.name === 'AbortError') {
                    Logger.error(`Request timeout (${timeout}ms): ${url}`);
                    lastError = new Error(`Request timeout after ${timeout}ms`);
                } else {
                    Logger.error(`Fetch error (attempt ${attempt + 1}): ${error.message}`);
                }

                // Don't retry on timeout or final attempt
                if (error.name === 'AbortError' || attempt === retries) {
                    break;
                }

                // Wait before retry
                if (attempt < retries) {
                    await this.delay(retryDelay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Fetch and parse JSON with error handling
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<any>} Parsed JSON data
     */
    static async fetchJSON(url, options = {}) {
        try {
            const response = await this.fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            Logger.success(`Successfully parsed JSON from: ${url}`);
            return data;

        } catch (error) {
            Logger.error(`Failed to fetch/parse JSON from ${url}:`, error);
            throw new Error(`JSON fetch failed: ${error.message}`);
        }
    }

    /**
     * Fetch local data files with cache busting
     * @param {string} path - Path to local data file
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Parsed JSON data
     */
    static async fetchLocalData(path, options = {}) {
        const cacheBusting = options.cacheBust !== false;
        const url = cacheBusting ? `${path}?t=${Date.now()}` : path;
        
        return this.fetchJSON(url, {
            cache: 'no-cache',
            ...options
        });
    }

    /**
     * Check if a URL is reachable
     * @param {string} url - URL to test
     * @param {Object} options - Test options
     * @returns {Promise<boolean>} True if reachable
     */
    static async isReachable(url, options = {}) {
        try {
            const response = await this.fetch(url, {
                method: 'HEAD',
                timeout: 5000,
                retries: 0,
                ...options
            });
            return true;
        } catch (error) {
            Logger.warning(`URL not reachable: ${url} - ${error.message}`);
            return false;
        }
    }

    /**
     * Download and cache data with localStorage backup
     * @param {string} key - Cache key
     * @param {string} url - URL to fetch
     * @param {Object} options - Options including TTL
     * @returns {Promise<any>} Cached or fresh data
     */
    static async fetchWithCache(key, url, options = {}) {
        const ttl = options.ttl || 300000; // 5 minutes default
        const cacheKey = `http_cache_${key}`;
        
        try {
            // Check cache first
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < ttl) {
                    Logger.info(`Using cached data for: ${key}`);
                    return data;
                }
            }
        } catch (error) {
            Logger.warning(`Cache read error for ${key}:`, error);
        }

        // Fetch fresh data
        const data = await this.fetchJSON(url, options);
        
        // Cache the result
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            Logger.success(`Cached data for: ${key}`);
        } catch (error) {
            Logger.warning(`Cache write error for ${key}:`, error);
        }

        return data;
    }

    /**
     * Clear cache for a specific key or all HTTP cache
     * @param {string} key - Specific key to clear, or null for all
     */
    static clearCache(key = null) {
        if (key) {
            localStorage.removeItem(`http_cache_${key}`);
            Logger.info(`Cleared cache for: ${key}`);
        } else {
            // Clear all HTTP cache entries
            const keys = Object.keys(localStorage).filter(k => k.startsWith('http_cache_'));
            keys.forEach(k => localStorage.removeItem(k));
            Logger.info(`Cleared ${keys.length} HTTP cache entries`);
        }
    }

    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    static getCacheStats() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('http_cache_'));
        const stats = {
            totalEntries: keys.length,
            totalSize: 0,
            entries: []
        };

        keys.forEach(key => {
            const value = localStorage.getItem(key);
            const size = new Blob([value]).size;
            stats.totalSize += size;
            
            try {
                const { timestamp } = JSON.parse(value);
                stats.entries.push({
                    key: key.replace('http_cache_', ''),
                    size,
                    age: Date.now() - timestamp,
                    timestamp: new Date(timestamp).toISOString()
                });
            } catch (error) {
                // Invalid cache entry
            }
        });

        return stats;
    }
}

// Make available globally
window.HttpUtils = HttpUtils;

Logger.success('HTTP utilities loaded successfully');
