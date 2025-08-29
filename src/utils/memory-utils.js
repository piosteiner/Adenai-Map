// memory-utils.js - Memory Optimization and Leak Prevention
// Manages event listeners, DOM references, and memory cleanup

class MemoryUtils {
    static eventListeners = new Map();
    static weakRefs = new WeakMap();
    static intervals = new Set();
    static observers = new Set();
    
    // Enhanced event listener with automatic cleanup tracking
    static addEventListener(element, event, handler, options = {}) {
        const listenerId = `${Date.now()}_${Math.random()}`;
        
        // Wrap handler to enable cleanup
        const wrappedHandler = (e) => {
            try {
                handler(e);
            } catch (error) {
                Logger.error(`Event handler error (${event}):`, error);
            }
        };
        
        // Add listener
        element.addEventListener(event, wrappedHandler, options);
        
        // Track for cleanup
        this.eventListeners.set(listenerId, {
            element,
            event,
            handler: wrappedHandler,
            options,
            created: Date.now()
        });
        
        return {
            id: listenerId,
            remove: () => this.removeEventListener(listenerId)
        };
    }
    
    // Remove tracked event listener
    static removeEventListener(listenerId) {
        const listener = this.eventListeners.get(listenerId);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            this.eventListeners.delete(listenerId);
            return true;
        }
        return false;
    }
    
    // Throttled event listener for performance-critical events
    static addThrottledEventListener(element, event, handler, delay = 16, options = {}) {
        const throttledHandler = PerformanceUtils.createThrottledFunction(handler, delay);
        return this.addEventListener(element, event, throttledHandler, options);
    }
    
    // Debounced event listener for input events
    static addDebouncedEventListener(element, event, handler, delay = 300, options = {}) {
        const debouncedHandler = PerformanceUtils.createDebouncedFunction(handler, delay);
        return this.addEventListener(element, event, debouncedHandler, options);
    }
    
    // Resize observer with cleanup
    static createResizeObserver(callback, options = {}) {
        const observer = new ResizeObserver((entries) => {
            try {
                callback(entries);
            } catch (error) {
                Logger.error('ResizeObserver callback error:', error);
            }
        });
        
        this.observers.add(observer);
        
        return {
            observer,
            observe: (element) => observer.observe(element, options),
            unobserve: (element) => observer.unobserve(element),
            disconnect: () => {
                observer.disconnect();
                this.observers.delete(observer);
            }
        };
    }
    
    // Intersection observer with cleanup
    static createIntersectionObserver(callback, options = {}) {
        const observer = new IntersectionObserver((entries) => {
            try {
                callback(entries);
            } catch (error) {
                Logger.error('IntersectionObserver callback error:', error);
            }
        }, {
            rootMargin: '0px',
            threshold: 0.1,
            ...options
        });
        
        this.observers.add(observer);
        
        return {
            observer,
            observe: (element) => observer.observe(element),
            unobserve: (element) => observer.unobserve(element),
            disconnect: () => {
                observer.disconnect();
                this.observers.delete(observer);
            }
        };
    }
    
    // Create weak reference for large objects
    static createWeakRef(object, id = null) {
        const refId = id || `weakref_${Date.now()}_${Math.random()}`;
        const weakRef = new WeakRef(object);
        
        this.weakRefs.set(object, {
            ref: weakRef,
            id: refId,
            created: Date.now()
        });
        
        return {
            get: () => weakRef.deref(),
            id: refId
        };
    }
    
    // Monitor DOM mutations with cleanup
    static createMutationObserver(callback, options = {}) {
        const observer = new MutationObserver((mutations) => {
            try {
                callback(mutations);
            } catch (error) {
                Logger.error('MutationObserver callback error:', error);
            }
        });
        
        this.observers.add(observer);
        
        return {
            observer,
            observe: (element, config) => observer.observe(element, {
                childList: true,
                subtree: true,
                ...config
            }),
            disconnect: () => {
                observer.disconnect();
                this.observers.delete(observer);
            }
        };
    }
    
    // Clean up DOM nodes and their event listeners
    static cleanupDOMNode(node) {
        if (!node || !node.nodeType) return;
        
        try {
            // Remove all child nodes
            while (node.firstChild) {
                this.cleanupDOMNode(node.firstChild);
                node.removeChild(node.firstChild);
            }
            
            // Clear any data attributes
            if (node.dataset) {
                Object.keys(node.dataset).forEach(key => {
                    delete node.dataset[key];
                });
            }
            
            // Clear references
            node.onclick = null;
            node.onmouseover = null;
            node.onmouseout = null;
            
        } catch (error) {
            Logger.warning('Error cleaning up DOM node:', error);
        }
    }
    
    // Memory usage monitoring
    static getMemoryStats() {
        const stats = {
            eventListeners: this.eventListeners.size,
            observers: this.observers.size,
            weakRefs: this.weakRefs.size,
            performance: PerformanceUtils.getMemoryUsage()
        };
        
        // Check for potential leaks
        const oldListeners = Array.from(this.eventListeners.values())
            .filter(l => Date.now() - l.created > 300000); // 5 minutes
        
        if (oldListeners.length > 0) {
            Logger.warning(`Potential memory leak: ${oldListeners.length} old event listeners`);
        }
        
        return stats;
    }
    
    // Force garbage collection if available
    static forceGC() {
        if (window.gc) {
            window.gc();
            Logger.debug('Forced garbage collection');
        } else if (performance.memory) {
            // Trigger some operations that might help GC
            const temp = new Array(1000).fill(null);
            temp.length = 0;
        }
    }
    
    // Image optimization utilities
    static optimizeImage(img, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate dimensions
            const { width, height } = img;
            const ratio = Math.min(maxWidth / width, maxWidth / height);
            
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(resolve, 'image/jpeg', quality);
        });
    }
    
    // Lazy load images with intersection observer
    static setupLazyImages(selector = 'img[data-src]') {
        const images = document.querySelectorAll(selector);
        
        const observer = this.createIntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });
        
        images.forEach(img => observer.observe(img));
        
        return observer;
    }
    
    // Cleanup all tracked resources
    static cleanup() {
        Logger.cleanup('Starting memory cleanup...');
        
        const stats = this.getMemoryStats();
        
        // Remove all event listeners
        this.eventListeners.forEach((listener, id) => {
            this.removeEventListener(id);
        });
        
        // Disconnect all observers
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        
        // Clear weak references
        this.weakRefs.clear();
        
        // Force GC
        this.forceGC();
        
        Logger.cleanup(`Memory cleanup complete. Freed: ${stats.eventListeners} listeners, ${stats.observers} observers`);
    }
    
    // Periodic memory monitoring
    static startMemoryMonitoring(interval = 30000) {
        return PerformanceUtils.setInterval(() => {
            const stats = this.getMemoryStats();
            
            if (stats.performance && stats.performance.used > 100) { // 100MB threshold
                Logger.warning('High memory usage detected:', stats);
            }
            
            if (stats.eventListeners > 100) {
                Logger.warning('High number of event listeners:', stats.eventListeners);
            }
            
        }, interval, 'memory_monitoring');
    }
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        MemoryUtils.cleanup();
    });
}

Logger.loading('🧠 Memory optimization utilities loaded successfully');
