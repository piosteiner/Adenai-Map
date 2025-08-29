// service-worker.js - Background Data Sync and Offline Support
// Provides intelligent caching, background sync, and offline functionality

const CACHE_NAME = 'adenai-map-v1.4';
const DATA_CACHE_NAME = 'adenai-data-v1.4';
const STATIC_CACHE_NAME = 'adenai-static-v1.4';

// Files to cache for offline use
const STATIC_FILES = [
    '/',
    '/index.html',
    '/public/css/styles.css',
    '/src/core/main.js',
    '/src/core/config.js',
    '/src/utils/logger.js',
    '/src/utils/http-utils.js',
    '/src/utils/advanced-loader.js',
    '/src/utils/data-manager.js'
];

// Data files with different caching strategies
const DATA_FILES = {
    // Critical data - cache aggressively
    critical: [
        '/public/data/characters.json',
        '/public/data/places.geojson'
    ],
    // Dynamic data - cache with TTL
    dynamic: [
        '/public/data/reviews.json',
        '/public/data/media-library.json'
    ],
    // API endpoints
    api: [
        'https://adenai-admin.piogino.ch/api/journey'
    ]
};

class ServiceWorkerManager {
    static install() {
        console.log('🔧 Service Worker: Installing...');
        
        // Cache static files
        return caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('📦 Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .catch(error => {
                console.error('Service Worker: Static cache failed:', error);
            });
    }
    
    static activate() {
        console.log('🚀 Service Worker: Activating...');
        
        // Clean up old caches
        return caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== DATA_CACHE_NAME && 
                            cacheName !== STATIC_CACHE_NAME) {
                            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            });
    }
    
    static async handleFetch(event) {
        const url = new URL(event.request.url);
        
        // Handle different types of requests
        if (url.pathname.includes('/api/')) {
            return this.handleApiRequest(event);
        } else if (url.pathname.includes('/data/')) {
            return this.handleDataRequest(event);
        } else if (url.pathname.includes('.json') || url.pathname.includes('.geojson')) {
            return this.handleDataRequest(event);
        } else {
            return this.handleStaticRequest(event);
        }
    }
    
    // Handle API requests with background sync
    static async handleApiRequest(event) {
        const url = event.request.url;
        
        try {
            // Try network first for API calls
            const networkResponse = await fetch(event.request);
            
            if (networkResponse.ok) {
                // Cache successful API responses
                const cache = await caches.open(DATA_CACHE_NAME);
                cache.put(event.request, networkResponse.clone());
                
                console.log('🌐 Service Worker: API request served from network:', url);
                return networkResponse;
            }
            
        } catch (error) {
            console.log('⚠️ Service Worker: Network failed for API, trying cache:', url);
        }
        
        // Fallback to cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
            console.log('📋 Service Worker: API request served from cache:', url);
            return cachedResponse;
        }
        
        // Return offline response
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'This data is not available offline',
            cached: false
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Handle data file requests with smart caching
    static async handleDataRequest(event) {
        const url = event.request.url;
        const cache = await caches.open(DATA_CACHE_NAME);
        
        // Check if this is critical or dynamic data
        const isCritical = DATA_FILES.critical.some(file => url.includes(file));
        const isDynamic = DATA_FILES.dynamic.some(file => url.includes(file));
        
        if (isCritical) {
            // Critical data: Cache first, update in background
            const cachedResponse = await cache.match(event.request);
            
            if (cachedResponse) {
                console.log('📋 Service Worker: Critical data served from cache:', url);
                
                // Update cache in background
                this.updateCacheInBackground(event.request, cache);
                
                return cachedResponse;
            }
        }
        
        // Try network first for dynamic data or if no cache
        try {
            const networkResponse = await fetch(event.request);
            
            if (networkResponse.ok) {
                // Cache the response
                cache.put(event.request, networkResponse.clone());
                console.log('🌐 Service Worker: Data served from network and cached:', url);
                return networkResponse;
            }
            
        } catch (error) {
            console.log('⚠️ Service Worker: Network failed for data, trying cache:', url);
        }
        
        // Fallback to cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
            console.log('📋 Service Worker: Data served from cache (offline):', url);
            return cachedResponse;
        }
        
        // No cache available
        return new Response(JSON.stringify({
            error: 'Data not available offline',
            url: url
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Handle static file requests
    static async handleStaticRequest(event) {
        const url = event.request.url;
        
        // Check static cache first
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        const cachedResponse = await staticCache.match(event.request);
        
        if (cachedResponse) {
            console.log('📋 Service Worker: Static file served from cache:', url);
            return cachedResponse;
        }
        
        // Try network
        try {
            const networkResponse = await fetch(event.request);
            
            if (networkResponse.ok) {
                // Cache static files
                staticCache.put(event.request, networkResponse.clone());
                console.log('🌐 Service Worker: Static file served from network and cached:', url);
                return networkResponse;
            }
            
        } catch (error) {
            console.log('⚠️ Service Worker: Network failed for static file:', url);
        }
        
        // Return offline page or error
        if (event.request.destination === 'document') {
            const offlineResponse = await staticCache.match('/index.html');
            if (offlineResponse) {
                console.log('📋 Service Worker: Serving offline index.html');
                return offlineResponse;
            }
        }
        
        return new Response('Offline', { status: 503 });
    }
    
    // Update cache in background
    static async updateCacheInBackground(request, cache) {
        try {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response);
                console.log('🔄 Service Worker: Background cache update completed');
                
                // Notify clients of update
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CACHE_UPDATED',
                            url: request.url
                        });
                    });
                });
            }
        } catch (error) {
            console.log('⚠️ Service Worker: Background update failed:', error);
        }
    }
    
    // Handle background sync
    static handleBackgroundSync(event) {
        if (event.tag === 'data-sync') {
            console.log('🔄 Service Worker: Background sync triggered');
            
            event.waitUntil(this.performBackgroundSync());
        }
    }
    
    // Perform background data synchronization
    static async performBackgroundSync() {
        const cache = await caches.open(DATA_CACHE_NAME);
        
        // Update all data files
        const updatePromises = [
            ...DATA_FILES.critical,
            ...DATA_FILES.dynamic,
            ...DATA_FILES.api
        ].map(async (url) => {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                    console.log('✅ Service Worker: Synced:', url);
                }
            } catch (error) {
                console.log('⚠️ Service Worker: Sync failed for:', url, error);
            }
        });
        
        await Promise.all(updatePromises);
        console.log('✅ Service Worker: Background sync completed');
        
        // Notify clients
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'BACKGROUND_SYNC_COMPLETE'
                });
            });
        });
    }
    
    // Cache performance monitoring
    static async getCacheStats() {
        const caches_names = await caches.keys();
        const stats = {};
        
        for (const cacheName of caches_names) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            stats[cacheName] = {
                entries: keys.length,
                urls: keys.map(req => req.url)
            };
        }
        
        return stats;
    }
}

// Service Worker Event Listeners
self.addEventListener('install', event => {
    console.log('🔧 Service Worker: Install event');
    event.waitUntil(ServiceWorkerManager.install());
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
    console.log('🚀 Service Worker: Activate event');
    event.waitUntil(ServiceWorkerManager.activate());
    self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) return;
    
    event.respondWith(ServiceWorkerManager.handleFetch(event));
});

self.addEventListener('sync', event => {
    ServiceWorkerManager.handleBackgroundSync(event);
});

// Handle messages from main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_STATS') {
        ServiceWorkerManager.getCacheStats().then(stats => {
            event.ports[0].postMessage(stats);
        });
    }
    
    if (event.data && event.data.type === 'FORCE_SYNC') {
        ServiceWorkerManager.performBackgroundSync();
    }
});

console.log('🔧 Service Worker: Script loaded');
