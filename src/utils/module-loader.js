// module-loader.js - Dynamic Module Loading and Code Splitting Implementation
// Implements progressive module loading with fallbacks and dependency management

class ModuleLoader {
    static loadedModules = new Set();
    static loadingModules = new Map();
    static dependencyGraph = new Map();
    static moduleRegistry = new Map();
    static loadQueues = {
        critical: [],
        important: [],
        optional: []
    };
    
    // Module dependency configuration
    static dependencies = {
        'main.js': ['map-core.js', 'logger.js', 'data-manager.js'],
        'character-system.js': ['map-core.js', 'http-utils.js', 'data-manager.js'],
        'movement-system.js': ['character-system.js', 'map-utils.js'],
        'location-system.js': ['map-core.js', 'http-utils.js'],
        'search-system.js': ['character-system.js', 'location-system.js'],
        'character-panel.js': ['character-system.js', 'movement-system.js'],
        'coordinate-copy.js': ['map-core.js', 'map-utils.js'],
        'gallery.js': ['map-core.js'],
        'github-version.js': ['http-utils.js'],
        'journey.js': ['http-utils.js', 'character-system.js']
    };
    
    // Module loading priorities and strategies
    static loadingStrategy = {
        // Critical: Must load before app starts (blocking)
        critical: {
            modules: [
                'src/utils/logger.js',
                'src/core/config.js', 
                'src/core/map-core.js',
                'src/utils/http-utils.js'
            ],
            loadType: 'sequential',
            timeout: 5000
        },
        
        // Important: Load early but don't block (async)
        important: {
            modules: [
                'src/utils/map-utils.js',
                'src/utils/data-manager.js',
                'src/systems/character-system.js',
                'src/systems/location-system.js',
                'src/systems/movement-system.js'
            ],
            loadType: 'parallel',
            timeout: 10000
        },
        
        // Optional: Load when idle or on-demand (lazy)
        optional: {
            modules: [
                'src/ui/gallery.js',
                'src/utils/coordinate-copy.js',
                'src/utils/github-version.js',
                'src/utils/journey.js',
                'src/systems/search-system.js'
            ],
            loadType: 'lazy',
            timeout: 15000
        }
    };
    
    /**
     * Initialize progressive module loading
     */
    static async initializeProgressiveLoading() {
        Logger.loading('🚀 Starting progressive module loading...');
        
        try {
            const startTime = performance.now();
            
            // Phase 1: Critical modules (blocking)
            await this.loadCriticalModules();
            
            // Phase 2: Important modules (parallel)
            this.loadImportantModules();
            
            // Phase 3: Optional modules (lazy/on-demand)
            this.scheduleOptionalModules();
            
            const loadTime = performance.now() - startTime;
            Logger.success(`✅ Progressive loading initialized in ${loadTime.toFixed(2)}ms`);
            
            // Dispatch event for main app initialization
            document.dispatchEvent(new CustomEvent('criticalModulesLoaded'));
            
        } catch (error) {
            Logger.error('Progressive loading initialization failed:', error);
            // Fallback to traditional loading
            this.fallbackToTraditionalLoading();
        }
    }
    
    /**
     * Load critical modules sequentially (blocking)
     */
    static async loadCriticalModules() {
        Logger.loading('📦 Loading critical modules...');
        
        const { modules, timeout } = this.loadingStrategy.critical;
        
        for (const module of modules) {
            try {
                await this.loadModuleWithTimeout(module, timeout);
                Logger.debug(`✅ Critical module loaded: ${module.split('/').pop()}`);
            } catch (error) {
                Logger.error(`❌ Critical module failed: ${module}`, error);
                throw error; // Critical modules must load
            }
        }
        
        Logger.success('✅ All critical modules loaded');
    }
    
    /**
     * Load important modules in parallel (non-blocking)
     */
    static loadImportantModules() {
        Logger.loading('📦 Loading important modules...');
        
        const { modules, timeout } = this.loadingStrategy.important;
        
        // Load all important modules in parallel
        const loadPromises = modules.map(async (module) => {
            try {
                await this.loadModuleWithTimeout(module, timeout);
                Logger.debug(`✅ Important module loaded: ${module.split('/').pop()}`);
                
                // Dispatch individual module loaded events
                document.dispatchEvent(new CustomEvent('moduleLoaded', {
                    detail: { module, category: 'important' }
                }));
                
            } catch (error) {
                Logger.warning(`⚠️ Important module failed: ${module}`, error);
                // Important modules can fail without breaking the app
            }
        });
        
        // Don't await - let them load in background
        Promise.all(loadPromises).then(() => {
            Logger.success('✅ All important modules loaded');
            document.dispatchEvent(new CustomEvent('importantModulesLoaded'));
        });
    }
    
    /**
     * Schedule optional modules for lazy loading
     */
    static scheduleOptionalModules() {
        Logger.loading('📦 Scheduling optional modules...');
        
        const { modules } = this.loadingStrategy.optional;
        
        // Schedule lazy loading based on different triggers
        modules.forEach((module, index) => {
            const delay = index * 500; // Stagger loading
            
            // Load when browser is idle
            this.loadModuleWhenIdle(module, delay);
        });
        
        Logger.debug(`📦 ${modules.length} optional modules scheduled for lazy loading`);
    }
    
    /**
     * Load module with timeout protection
     */
    static async loadModuleWithTimeout(src, timeout = 10000) {
        // Check if already loaded
        if (this.loadedModules.has(src)) {
            return Promise.resolve();
        }
        
        // Check if currently loading
        if (this.loadingModules.has(src)) {
            return this.loadingModules.get(src);
        }
        
        // Create loading promise
        const loadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            // Timeout handling
            const timeoutId = setTimeout(() => {
                reject(new Error(`Module loading timeout: ${src}`));
            }, timeout);
            
            script.onload = () => {
                clearTimeout(timeoutId);
                this.loadedModules.add(src);
                this.loadingModules.delete(src);
                resolve();
            };
            
            script.onerror = () => {
                clearTimeout(timeoutId);
                this.loadingModules.delete(src);
                reject(new Error(`Failed to load module: ${src}`));
            };
            
            document.head.appendChild(script);
        });
        
        this.loadingModules.set(src, loadingPromise);
        return loadingPromise;
    }
    
    /**
     * Load module when browser is idle
     */
    static loadModuleWhenIdle(src, delay = 0) {
        const loadFunction = () => {
            setTimeout(async () => {
                try {
                    await this.loadModuleWithTimeout(src, 15000);
                    Logger.debug(`✅ Lazy loaded: ${src.split('/').pop()}`);
                    
                    document.dispatchEvent(new CustomEvent('moduleLoaded', {
                        detail: { module: src, category: 'optional' }
                    }));
                    
                } catch (error) {
                    Logger.warning(`⚠️ Lazy load failed: ${src}`, error);
                }
            }, delay);
        };
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadFunction, { timeout: 5000 });
        } else {
            loadFunction();
        }
    }
    
    /**
     * Load module on-demand with dependency resolution
     */
    static async loadModuleOnDemand(moduleName) {
        Logger.loading(`📦 Loading on-demand: ${moduleName}`);
        
        try {
            // Find full path
            const fullPath = this.findModulePath(moduleName);
            if (!fullPath) {
                throw new Error(`Module not found: ${moduleName}`);
            }
            
            // Check and load dependencies first
            await this.loadDependencies(moduleName);
            
            // Load the module
            await this.loadModuleWithTimeout(fullPath);
            
            Logger.success(`✅ On-demand module loaded: ${moduleName}`);
            
            document.dispatchEvent(new CustomEvent('moduleLoaded', {
                detail: { module: fullPath, category: 'on-demand' }
            }));
            
        } catch (error) {
            Logger.error(`❌ On-demand loading failed: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * Load module dependencies
     */
    static async loadDependencies(moduleName) {
        const deps = this.dependencies[moduleName];
        if (!deps || deps.length === 0) return;
        
        Logger.debug(`📦 Loading dependencies for ${moduleName}: ${deps.join(', ')}`);
        
        for (const dep of deps) {
            const depPath = this.findModulePath(dep);
            if (depPath && !this.loadedModules.has(depPath)) {
                await this.loadModuleWithTimeout(depPath);
            }
        }
    }
    
    /**
     * Find full path for module name
     */
    static findModulePath(moduleName) {
        // Check all loading strategies
        for (const strategy of Object.values(this.loadingStrategy)) {
            const found = strategy.modules.find(path => path.includes(moduleName));
            if (found) return found;
        }
        
        // Try common patterns
        const commonPaths = [
            `src/utils/${moduleName}`,
            `src/systems/${moduleName}`,
            `src/ui/${moduleName}`,
            `src/core/${moduleName}`
        ];
        
        // Return first that might exist (simplified)
        return commonPaths[0];
    }
    
    /**
     * Feature-based module loading
     */
    static async loadFeature(featureName) {
        Logger.loading(`🎯 Loading feature: ${featureName}`);
        
        const featureModules = {
            'character-paths': [
                'src/systems/character-system.js',
                'src/systems/movement-system.js',
                'src/ui/components/character-panel.js'
            ],
            'search': [
                'src/systems/search-system.js'
            ],
            'coordinates': [
                'src/ui/components/coordinate-copy.js'
            ],
            'gallery': [
                'src/ui/gallery.js'
            ],
            'journey-tracking': [
                'src/utils/journey.js'
            ]
        };
        
        const modules = featureModules[featureName];
        if (!modules) {
            throw new Error(`Unknown feature: ${featureName}`);
        }
        
        try {
            // Load all feature modules in parallel
            await Promise.all(
                modules.map(module => this.loadModuleWithTimeout(module))
            );
            
            Logger.success(`✅ Feature loaded: ${featureName}`);
            
            document.dispatchEvent(new CustomEvent('featureLoaded', {
                detail: { feature: featureName, modules }
            }));
            
        } catch (error) {
            Logger.error(`❌ Feature loading failed: ${featureName}`, error);
            throw error;
        }
    }
    
    /**
     * Preload modules for next user action
     */
    static preloadForAction(action) {
        const actionModules = {
            'open-character-panel': ['src/ui/components/character-panel.js'],
            'search-locations': ['src/systems/search-system.js'],
            'copy-coordinates': ['src/ui/components/coordinate-copy.js'],
            'view-gallery': ['src/ui/gallery.js']
        };
        
        const modules = actionModules[action];
        if (modules) {
            Logger.debug(`🔮 Preloading for action: ${action}`);
            
            modules.forEach(module => {
                this.loadModuleWhenIdle(module, 100);
            });
        }
    }
    
    /**
     * Fallback to traditional loading if progressive fails
     */
    static fallbackToTraditionalLoading() {
        Logger.warning('🔄 Falling back to traditional module loading...');
        
        // This would reload the page with traditional script tags
        // In a real implementation, you might have a fallback script list
        const fallbackModules = [
            'src/utils/logger.js',
            'src/core/config.js',
            'src/core/map-core.js',
            'src/utils/http-utils.js',
            'src/utils/data-manager.js',
            'src/systems/character-system.js',
            'src/systems/location-system.js',
            'src/core/main.js'
        ];
        
        // Load essential modules synchronously
        fallbackModules.forEach(module => {
            const script = document.createElement('script');
            script.src = module;
            script.async = false; // Load synchronously
            document.head.appendChild(script);
        });
    }
    
    /**
     * Get loading statistics
     */
    static getLoadingStats() {
        return {
            loaded: this.loadedModules.size,
            loading: this.loadingModules.size,
            loadedModules: Array.from(this.loadedModules),
            failedModules: [], // Could track failures
            loadingTime: {
                // Could track timing per module
            }
        };
    }
    
    /**
     * Module health check
     */
    static checkModuleHealth() {
        const health = {
            criticalLoaded: 0,
            importantLoaded: 0,
            optionalLoaded: 0,
            total: 0,
            status: 'unknown'
        };
        
        // Check each category
        Object.entries(this.loadingStrategy).forEach(([category, strategy]) => {
            const loaded = strategy.modules.filter(module => 
                this.loadedModules.has(module)
            ).length;
            
            health[`${category}Loaded`] = loaded;
            health.total += loaded;
        });
        
        // Determine overall status
        if (health.criticalLoaded === this.loadingStrategy.critical.modules.length) {
            if (health.total === this.getTotalModuleCount()) {
                health.status = 'excellent';
            } else if (health.importantLoaded > 0) {
                health.status = 'good';
            } else {
                health.status = 'minimal';
            }
        } else {
            health.status = 'critical-missing';
        }
        
        return health;
    }
    
    /**
     * Get total module count
     */
    static getTotalModuleCount() {
        return Object.values(this.loadingStrategy)
            .reduce((total, strategy) => total + strategy.modules.length, 0);
    }
}

// Event listeners for performance monitoring
if (typeof window !== 'undefined') {
    // Monitor module loading events
    document.addEventListener('moduleLoaded', (event) => {
        Logger.debug(`📊 Module loaded: ${event.detail.module} (${event.detail.category})`);
    });
    
    document.addEventListener('criticalModulesLoaded', () => {
        Logger.success('🎯 Critical modules ready - app can start');
    });
    
    document.addEventListener('importantModulesLoaded', () => {
        Logger.success('🎯 Important modules ready - full functionality available');
    });
    
    // Performance monitoring
    window.addEventListener('load', () => {
        setTimeout(() => {
            const health = ModuleLoader.checkModuleHealth();
            Logger.info(`📊 Module loading health: ${health.status} (${health.total} modules loaded)`);
        }, 2000);
    });
}

Logger.loading('🔧 Module loader and code splitting system ready');
