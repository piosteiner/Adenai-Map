// performance-utils.js - Performance and State Management Utilities
// Optimizes timing, scheduling, and memory usage patterns

class PerformanceUtils {
    static timers = new Map();
    static rafCallbacks = new Map();
    static observers = new Map();
    
    // Enhanced timeout with automatic cleanup tracking
    static setTimeout(callback, delay, id = null) {
        const timerId = id || `timeout_${Date.now()}_${Math.random()}`;
        
        const timeoutId = setTimeout(() => {
            this.timers.delete(timerId);
            callback();
        }, delay);
        
        this.timers.set(timerId, {
            type: 'timeout',
            id: timeoutId,
            callback,
            delay,
            created: Date.now()
        });
        
        return timerId;
    }
    
    // Enhanced interval with automatic cleanup tracking
    static setInterval(callback, delay, id = null) {
        const timerId = id || `interval_${Date.now()}_${Math.random()}`;
        
        const intervalId = setInterval(callback, delay);
        
        this.timers.set(timerId, {
            type: 'interval',
            id: intervalId,
            callback,
            delay,
            created: Date.now()
        });
        
        return timerId;
    }
    
    // Clear specific timer
    static clearTimer(timerId) {
        const timer = this.timers.get(timerId);
        if (timer) {
            if (timer.type === 'timeout') {
                clearTimeout(timer.id);
            } else if (timer.type === 'interval') {
                clearInterval(timer.id);
            }
            this.timers.delete(timerId);
            return true;
        }
        return false;
    }
    
    // Clear all tracked timers (useful for cleanup)
    static clearAllTimers() {
        this.timers.forEach((timer, timerId) => {
            this.clearTimer(timerId);
        });
        Logger.cleanup(`Cleared ${this.timers.size} tracked timers`);
    }
    
    // Optimized requestAnimationFrame with cleanup tracking
    static requestAnimationFrame(callback, id = null) {
        const rafId = id || `raf_${Date.now()}_${Math.random()}`;
        
        const animationId = requestAnimationFrame((timestamp) => {
            this.rafCallbacks.delete(rafId);
            callback(timestamp);
        });
        
        this.rafCallbacks.set(rafId, {
            id: animationId,
            callback,
            created: Date.now()
        });
        
        return rafId;
    }
    
    // Cancel animation frame
    static cancelAnimationFrame(rafId) {
        const raf = this.rafCallbacks.get(rafId);
        if (raf) {
            cancelAnimationFrame(raf.id);
            this.rafCallbacks.delete(rafId);
            return true;
        }
        return false;
    }
    
    // Batch DOM operations for better performance
    static batchDOMOperations(operations) {
        return new Promise(resolve => {
            this.requestAnimationFrame(() => {
                const startTime = performance.now();
                
                try {
                    operations.forEach(op => {
                        if (typeof op === 'function') {
                            op();
                        }
                    });
                    
                    const endTime = performance.now();
                    Logger.debug(`Batched ${operations.length} DOM operations in ${(endTime - startTime).toFixed(2)}ms`);
                    
                } catch (error) {
                    Logger.error('Error in batched DOM operations:', error);
                }
                
                resolve();
            });
        });
    }
    
    // Debounced function creator with cleanup
    static createDebouncedFunction(func, wait, id = null) {
        const debouncedId = id || `debounced_${Date.now()}_${Math.random()}`;
        let timeoutId;
        
        const debouncedFunc = (...args) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, wait);
        };
        
        // Store for cleanup
        debouncedFunc.cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        
        debouncedFunc.id = debouncedId;
        
        return debouncedFunc;
    }
    
    // Throttled function creator with cleanup
    static createThrottledFunction(func, limit, id = null) {
        const throttledId = id || `throttled_${Date.now()}_${Math.random()}`;
        let inThrottle = false;
        
        const throttledFunc = (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
        
        throttledFunc.id = throttledId;
        
        return throttledFunc;
    }
    
    // Memory usage monitoring
    static getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100,
                unit: 'MB'
            };
        }
        return null;
    }
    
    // Performance timing measurement
    static measurePerformance(name, func) {
        return new Promise(async (resolve) => {
            const startTime = performance.now();
            
            try {
                const result = await func();
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                Logger.debug(`⏱️ Performance [${name}]: ${duration.toFixed(2)}ms`);
                
                resolve({
                    result,
                    duration,
                    memory: this.getMemoryUsage()
                });
                
            } catch (error) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                Logger.error(`⏱️ Performance [${name}] failed after ${duration.toFixed(2)}ms:`, error);
                
                resolve({
                    error,
                    duration,
                    memory: this.getMemoryUsage()
                });
            }
        });
    }
    
    // Lazy loading utility
    static createLazyLoader(loader, condition = () => true) {
        let loaded = false;
        let loading = false;
        let result = null;
        
        return async () => {
            if (loaded) {
                return result;
            }
            
            if (loading) {
                // Wait for ongoing load
                while (loading) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                return result;
            }
            
            if (!condition()) {
                throw new Error('Lazy load condition not met');
            }
            
            loading = true;
            
            try {
                result = await loader();
                loaded = true;
                loading = false;
                return result;
            } catch (error) {
                loading = false;
                throw error;
            }
        };
    }
    
    // Intersection Observer wrapper for lazy loading
    static createIntersectionObserver(callback, options = {}) {
        const observerId = `observer_${Date.now()}_${Math.random()}`;
        
        const observer = new IntersectionObserver(callback, {
            rootMargin: '50px',
            threshold: 0.1,
            ...options
        });
        
        this.observers.set(observerId, observer);
        
        return {
            observer,
            id: observerId,
            cleanup: () => {
                observer.disconnect();
                this.observers.delete(observerId);
            }
        };
    }
    
    // Get performance statistics
    static getPerformanceStats() {
        return {
            timers: {
                active: this.timers.size,
                types: Array.from(this.timers.values()).reduce((acc, timer) => {
                    acc[timer.type] = (acc[timer.type] || 0) + 1;
                    return acc;
                }, {})
            },
            animations: {
                active: this.rafCallbacks.size
            },
            observers: {
                active: this.observers.size
            },
            memory: this.getMemoryUsage()
        };
    }
    
    // Cleanup all tracked resources
    static cleanup() {
        const stats = this.getPerformanceStats();
        
        this.clearAllTimers();
        
        this.rafCallbacks.forEach((raf, rafId) => {
            this.cancelAnimationFrame(rafId);
        });
        
        this.observers.forEach((observer, observerId) => {
            observer.disconnect();
        });
        this.observers.clear();
        
        Logger.cleanup(`Performance cleanup: ${stats.timers.active} timers, ${stats.animations.active} animations, ${stats.observers.active} observers`);
    }
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        PerformanceUtils.cleanup();
    });
}

Logger.loading('⚡ Performance utilities loaded successfully');
