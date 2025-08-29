// sw-manager.js - Service Worker Registration and Management
// Handles service worker lifecycle, updates, and communication

class SWManager {
    static instance = null;
    static registration = null;
    static isSupported = 'serviceWorker' in navigator;
    static updateAvailable = false;
    
    static get() {
        if (!this.instance) {
            this.instance = new SWManager();
        }
        return this.instance;
    }
    
    constructor() {
        this.callbacks = {
            ready: [],
            update: [],
            offline: [],
            online: []
        };
        
        this.isOnline = navigator.onLine;
        this.setupNetworkListeners();
    }
    
    // Register service worker
    async register() {
        if (!SWManager.isSupported) {
            Logger.warning('Service Worker not supported in this browser');
            return null;
        }
        
        try {
            Logger.loading('🔧 Registering service worker...');
            
            const registration = await navigator.serviceWorker.register('/public/service-worker.js', {
                scope: '/'
            });
            
            SWManager.registration = registration;
            
            // Handle updates
            registration.addEventListener('updatefound', () => {
                this.handleUpdate(registration.installing);
            });
            
            // Handle controller changes
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                Logger.success('🔄 Service Worker: New controller activated');
                window.location.reload();
            });
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleMessage(event.data);
            });
            
            // Check for existing service worker
            if (registration.active) {
                Logger.success('✅ Service Worker: Already active');
                this.notifyReady();
            }
            
            if (registration.waiting) {
                Logger.info('🔄 Service Worker: Update available');
                this.notifyUpdate();
            }
            
            Logger.success('✅ Service Worker registered successfully');
            return registration;
            
        } catch (error) {
            Logger.error('Service Worker registration failed:', error);
            return null;
        }
    }
    
    // Handle service worker updates
    handleUpdate(installingWorker) {
        Logger.info('🔄 Service Worker: Update found, installing...');
        SWManager.updateAvailable = true;
        
        installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                    Logger.success('🎉 Service Worker: Update ready');
                    this.notifyUpdate();
                } else {
                    Logger.success('✅ Service Worker: First install complete');
                    this.notifyReady();
                }
            }
        });
    }
    
    // Handle messages from service worker
    handleMessage(data) {
        switch (data.type) {
            case 'CACHE_UPDATED':
                Logger.debug(`📋 Cache updated for: ${data.url}`);
                // Optionally refresh data in DataManager
                if (window.DataManager) {
                    const dataType = this.getDataTypeFromUrl(data.url);
                    if (dataType) {
                        window.DataManager.get().refreshData(dataType);
                    }
                }
                break;
                
            case 'BACKGROUND_SYNC_COMPLETE':
                Logger.success('✅ Background sync completed');
                document.dispatchEvent(new CustomEvent('backgroundSyncComplete'));
                break;
                
            default:
                Logger.debug('Service Worker message:', data);
        }
    }
    
    // Extract data type from URL
    getDataTypeFromUrl(url) {
        if (url.includes('characters.json')) return 'characters';
        if (url.includes('places.geojson')) return 'locations';
        if (url.includes('reviews.json')) return 'reviews';
        if (url.includes('media-library.json')) return 'media-library';
        if (url.includes('/api/journey')) return 'journeys';
        return null;
    }
    
    // Activate waiting service worker
    async activateUpdate() {
        if (!SWManager.registration || !SWManager.registration.waiting) {
            Logger.warning('No service worker update available to activate');
            return;
        }
        
        Logger.loading('🔄 Activating service worker update...');
        
        // Tell waiting service worker to skip waiting
        SWManager.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        SWManager.updateAvailable = false;
    }
    
    // Force background sync
    async forceSync() {
        if (!SWManager.registration || !SWManager.registration.active) {
            Logger.warning('No active service worker for sync');
            return;
        }
        
        try {
            // Register background sync
            await SWManager.registration.sync.register('data-sync');
            Logger.success('🔄 Background sync requested');
        } catch (error) {
            Logger.warning('Background sync not supported, using message instead');
            SWManager.registration.active.postMessage({ type: 'FORCE_SYNC' });
        }
    }
    
    // Get cache statistics
    async getCacheStats() {
        if (!SWManager.registration || !SWManager.registration.active) {
            Logger.warning('No active service worker for cache stats');
            return null;
        }
        
        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
                resolve(event.data);
            };
            
            SWManager.registration.active.postMessage(
                { type: 'GET_CACHE_STATS' },
                [messageChannel.port2]
            );
        });
    }
    
    // Network status monitoring
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            Logger.success('🌐 Network: Back online');
            this.notifyOnline();
            
            // Trigger background sync when back online
            this.forceSync();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            Logger.warning('📡 Network: Gone offline');
            this.notifyOffline();
        });
    }
    
    // Event subscription system
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
            
            // Call immediately for current state
            if (event === 'ready' && SWManager.registration?.active) {
                callback();
            }
            if (event === 'update' && SWManager.updateAvailable) {
                callback();
            }
            if (event === 'online' && this.isOnline) {
                callback();
            }
            if (event === 'offline' && !this.isOnline) {
                callback();
            }
        }
        
        // Return unsubscribe function
        return () => {
            const index = this.callbacks[event]?.indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        };
    }
    
    // Notification methods
    notifyReady() {
        this.callbacks.ready.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error('Ready callback error:', error);
            }
        });
    }
    
    notifyUpdate() {
        this.callbacks.update.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error('Update callback error:', error);
            }
        });
    }
    
    notifyOnline() {
        this.callbacks.online.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error('Online callback error:', error);
            }
        });
    }
    
    notifyOffline() {
        this.callbacks.offline.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error('Offline callback error:', error);
            }
        });
    }
    
    // Get current status
    getStatus() {
        return {
            supported: SWManager.isSupported,
            registered: !!SWManager.registration,
            active: !!SWManager.registration?.active,
            updateAvailable: SWManager.updateAvailable,
            online: this.isOnline,
            scope: SWManager.registration?.scope
        };
    }
    
    // Show update notification to user
    showUpdateNotification() {
        if (!SWManager.updateAvailable) return;
        
        // Create simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 350px;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>🎉 App Update Available!</strong><br>
                New features and improvements are ready.
            </div>
            <button onclick="this.parentElement.style.display='none'; window.SWManager.get().activateUpdate();" 
                    style="background: white; color: #4CAF50; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer; margin-right: 10px;">
                Update Now
            </button>
            <button onclick="this.parentElement.style.display='none';" 
                    style="background: transparent; color: white; border: 1px solid white; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                Later
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-hide after 10 seconds
        PerformanceUtils.setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000, 'update_notification_timeout');
    }
    
    // Initialize service worker and show update UI
    async initialize() {
        await this.register();
        
        // Set up update notification
        this.on('update', () => {
            this.showUpdateNotification();
        });
        
        Logger.success('🎯 Service Worker Manager initialized');
    }
    
    // Cleanup
    cleanup() {
        this.callbacks = {
            ready: [],
            update: [],
            offline: [],
            online: []
        };
        
        Logger.cleanup('SWManager cleaned up');
    }
}

// Global instance
window.SWManager = SWManager;

// Auto-cleanup
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        SWManager.get().cleanup();
    });
}

Logger.loading('🔧 Service Worker Manager ready');
