// bundle-analyzer.js - Bundle Size Analysis and Code Splitting Utilities
// Analyzes module dependencies, identifies optimization opportunities, and implements dynamic loading

class BundleAnalyzer {
    static dependencies = new Map();
    static loadTimes = new Map();
    static sizeMeasurements = new Map();
    static criticalPath = new Set();
    static nonCriticalModules = new Set();
    
    // Configuration for code splitting
    static config = {
        // Critical modules that must load immediately
        critical: [
            'logger.js',
            'map-core.js',
            'http-utils.js',
            'config.js'
        ],
        
        // Important modules that can load early but not blocking
        important: [
            'character-system.js',
            'location-system.js',
            'movement-system.js',
            'data-manager.js'
        ],
        
        // Optional modules that can be lazy-loaded
        optional: [
            'gallery.js',
            'coordinate-copy.js',
            'github-version.js',
            'journey.js',
            'search-system.js'
        ],
        
        // Heavy modules that should be split
        heavy: [
            'movement-system.js', // 636 lines, 26KB
            'character-panel.js',
            'coordinate-copy.js'
        ],
        
        // Bundle size thresholds (in KB)
        thresholds: {
            critical: 50,   // Critical bundle should be < 50KB
            important: 100, // Important bundle should be < 100KB
            warning: 200    // Warn if any bundle > 200KB
        }
    };
    
    /**
     * Analyze current bundle structure and dependencies
     */
    static async analyzeBundleStructure() {
        Logger.loading('📊 Analyzing bundle structure...');
        
        const analysis = {
            totalModules: 0,
            totalSize: 0,
            bundles: {
                critical: { modules: [], size: 0 },
                important: { modules: [], size: 0 },
                optional: { modules: [], size: 0 }
            },
            recommendations: [],
            loadOrder: []
        };
        
        try {
            // Analyze script tags in document
            const scripts = document.querySelectorAll('script[src]');
            
            for (const script of scripts) {
                const src = script.getAttribute('src');
                if (!src || src.startsWith('http')) continue; // Skip external scripts
                
                const moduleInfo = await this.analyzeModule(src);
                analysis.totalModules++;
                analysis.totalSize += moduleInfo.size;
                
                // Categorize module
                const category = this.categorizeModule(src);
                analysis.bundles[category].modules.push(moduleInfo);
                analysis.bundles[category].size += moduleInfo.size;
                
                analysis.loadOrder.push({
                    module: src,
                    category,
                    size: moduleInfo.size,
                    loadTime: moduleInfo.loadTime
                });
            }
            
            // Generate recommendations
            analysis.recommendations = this.generateOptimizationRecommendations(analysis);
            
            Logger.success(`📊 Bundle analysis complete: ${analysis.totalModules} modules, ${(analysis.totalSize / 1024).toFixed(1)}KB total`);
            
            return analysis;
            
        } catch (error) {
            Logger.error('Bundle analysis failed:', error);
            throw error;
        }
    }
    
    /**
     * Analyze individual module
     */
    static async analyzeModule(src) {
        const startTime = performance.now();
        
        try {
            // Estimate module size from source
            const response = await fetch(src);
            const text = await response.text();
            const size = new Blob([text]).size;
            
            const loadTime = performance.now() - startTime;
            
            // Analyze dependencies (simple heuristic)
            const dependencies = this.extractDependencies(text);
            
            const moduleInfo = {
                src,
                size,
                loadTime,
                dependencies,
                lines: text.split('\n').length,
                exports: this.extractExports(text),
                complexity: this.calculateComplexity(text)
            };
            
            this.sizeMeasurements.set(src, moduleInfo);
            return moduleInfo;
            
        } catch (error) {
            Logger.warning(`Could not analyze module ${src}:`, error.message);
            return {
                src,
                size: 0,
                loadTime: 0,
                dependencies: [],
                lines: 0,
                exports: [],
                complexity: 0
            };
        }
    }
    
    /**
     * Categorize module by importance
     */
    static categorizeModule(src) {
        const filename = src.split('/').pop();
        
        if (this.config.critical.some(critical => src.includes(critical))) {
            return 'critical';
        }
        
        if (this.config.important.some(important => src.includes(important))) {
            return 'important';
        }
        
        return 'optional';
    }
    
    /**
     * Extract dependencies from module source
     */
    static extractDependencies(source) {
        const dependencies = [];
        
        // Look for common dependency patterns
        const patterns = [
            /(?:new\s+|\.)?(\w+(?:Utils|Manager|System|API))/g,
            /(\w+)\.(?:get|load|fetch|init)/g,
            /(?:await\s+)?(\w+)\.(?:load|fetch|init)/g
        ];
        
        patterns.forEach(pattern => {
            const matches = source.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && !dependencies.includes(match[1])) {
                    dependencies.push(match[1]);
                }
            }
        });
        
        return dependencies;
    }
    
    /**
     * Extract exports from module
     */
    static extractExports(source) {
        const exports = [];
        
        // Look for class definitions
        const classMatches = source.matchAll(/class\s+(\w+)/g);
        for (const match of classMatches) {
            exports.push({ type: 'class', name: match[1] });
        }
        
        // Look for function definitions
        const functionMatches = source.matchAll(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\())/g);
        for (const match of functionMatches) {
            const name = match[1] || match[2];
            if (name) {
                exports.push({ type: 'function', name });
            }
        }
        
        return exports;
    }
    
    /**
     * Calculate module complexity score
     */
    static calculateComplexity(source) {
        let complexity = 0;
        
        // Count control flow statements
        complexity += (source.match(/\b(if|for|while|switch|try|catch)\b/g) || []).length;
        
        // Count function definitions
        complexity += (source.match(/\bfunction\b/g) || []).length;
        
        // Count class methods
        complexity += (source.match(/^\s*(?:async\s+)?[\w$]+\s*\(/gm) || []).length;
        
        // Count event listeners
        complexity += (source.match(/addEventListener|on\w+\s*=/g) || []).length;
        
        return complexity;
    }
    
    /**
     * Generate optimization recommendations
     */
    static generateOptimizationRecommendations(analysis) {
        const recommendations = [];
        
        // Check bundle sizes
        Object.entries(analysis.bundles).forEach(([category, bundle]) => {
            const sizeKB = bundle.size / 1024;
            const threshold = this.config.thresholds[category] || this.config.thresholds.warning;
            
            if (sizeKB > threshold) {
                recommendations.push({
                    type: 'size-warning',
                    category,
                    message: `${category} bundle is ${sizeKB.toFixed(1)}KB (threshold: ${threshold}KB)`,
                    priority: 'high',
                    action: 'Consider code splitting or lazy loading'
                });
            }
        });
        
        // Identify heavy modules
        analysis.loadOrder
            .filter(module => module.size > 20 * 1024) // > 20KB
            .forEach(module => {
                recommendations.push({
                    type: 'heavy-module',
                    module: module.module,
                    size: (module.size / 1024).toFixed(1) + 'KB',
                    message: `Large module: ${module.module}`,
                    priority: 'medium',
                    action: 'Consider splitting into smaller modules'
                });
            });
        
        // Check load order optimization
        const criticalAfterOptional = analysis.loadOrder.some((module, index) => {
            if (module.category === 'critical') {
                return analysis.loadOrder.slice(0, index).some(prev => prev.category === 'optional');
            }
            return false;
        });
        
        if (criticalAfterOptional) {
            recommendations.push({
                type: 'load-order',
                message: 'Critical modules loading after optional modules',
                priority: 'medium',
                action: 'Reorder script tags for better performance'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Create optimized loading strategy
     */
    static createOptimizedLoadingStrategy() {
        return {
            // Phase 1: Critical path (blocking)
            critical: async () => {
                Logger.loading('📦 Loading critical modules...');
                
                const criticalModules = [
                    'src/utils/logger.js',
                    'src/core/config.js',
                    'src/core/map-core.js',
                    'src/utils/http-utils.js'
                ];
                
                for (const module of criticalModules) {
                    await this.loadModuleDynamic(module);
                }
            },
            
            // Phase 2: Important modules (async)
            important: async () => {
                Logger.loading('📦 Loading important modules...');
                
                const importantModules = [
                    'src/utils/data-manager.js',
                    'src/systems/character-system.js',
                    'src/systems/location-system.js'
                ];
                
                // Load in parallel
                await Promise.all(
                    importantModules.map(module => this.loadModuleDynamic(module))
                );
            },
            
            // Phase 3: Optional modules (lazy)
            optional: () => {
                Logger.loading('📦 Queuing optional modules...');
                
                const optionalModules = [
                    'src/ui/gallery.js',
                    'src/utils/github-version.js',
                    'src/utils/journey.js'
                ];
                
                // Load when idle
                optionalModules.forEach(module => {
                    this.loadModuleWhenIdle(module);
                });
            }
        };
    }
    
    /**
     * Dynamically load a module
     */
    static async loadModuleDynamic(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => {
                Logger.debug(`✅ Loaded: ${src}`);
                resolve();
            };
            
            script.onerror = () => {
                Logger.error(`❌ Failed to load: ${src}`);
                reject(new Error(`Failed to load ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load module when browser is idle
     */
    static loadModuleWhenIdle(src) {
        const loadWhenIdle = () => {
            this.loadModuleDynamic(src).catch(error => {
                Logger.warning(`Lazy load failed for ${src}:`, error);
            });
        };
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadWhenIdle, { timeout: 5000 });
        } else {
            setTimeout(loadWhenIdle, 100);
        }
    }
    
    /**
     * Generate bundle report
     */
    static generateBundleReport(analysis) {
        const report = {
            summary: {
                totalModules: analysis.totalModules,
                totalSize: `${(analysis.totalSize / 1024).toFixed(1)}KB`,
                bundleSizes: {}
            },
            recommendations: analysis.recommendations,
            heaviestModules: analysis.loadOrder
                .sort((a, b) => b.size - a.size)
                .slice(0, 5)
                .map(m => ({
                    module: m.module.split('/').pop(),
                    size: `${(m.size / 1024).toFixed(1)}KB`,
                    category: m.category
                })),
            loadOrder: analysis.loadOrder.map(m => ({
                module: m.module.split('/').pop(),
                category: m.category,
                size: `${(m.size / 1024).toFixed(1)}KB`
            }))
        };
        
        // Calculate bundle sizes
        Object.entries(analysis.bundles).forEach(([category, bundle]) => {
            report.summary.bundleSizes[category] = `${(bundle.size / 1024).toFixed(1)}KB`;
        });
        
        return report;
    }
    
    /**
     * Tree shaking simulation (identify unused code)
     */
    static simulateTreeShaking(analysis) {
        const unusedCode = {
            functions: [],
            classes: [],
            variables: []
        };
        
        // This is a simplified simulation
        // In a real scenario, you'd use tools like webpack-bundle-analyzer
        
        analysis.loadOrder.forEach(module => {
            const moduleInfo = this.sizeMeasurements.get(module.module);
            if (moduleInfo && moduleInfo.exports) {
                moduleInfo.exports.forEach(exp => {
                    // Simple heuristic: if export name doesn't appear in other modules
                    const isUsed = analysis.loadOrder.some(otherModule => {
                        if (otherModule.module === module.module) return false;
                        const otherInfo = this.sizeMeasurements.get(otherModule.module);
                        return otherInfo && otherInfo.dependencies.includes(exp.name);
                    });
                    
                    if (!isUsed) {
                        unusedCode[exp.type + 's'].push({
                            name: exp.name,
                            module: module.module.split('/').pop(),
                            type: exp.type
                        });
                    }
                });
            }
        });
        
        return unusedCode;
    }
    
    /**
     * Performance monitoring for bundle loading
     */
    static monitorBundlePerformance() {
        const startTime = performance.now();
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (entry.entryType === 'resource' && entry.name.includes('.js')) {
                    const moduleName = entry.name.split('/').pop();
                    this.loadTimes.set(moduleName, {
                        duration: entry.duration,
                        transferSize: entry.transferSize || 0,
                        size: entry.decodedBodySize || 0
                    });
                }
            });
        });
        
        observer.observe({ entryTypes: ['resource'] });
        
        // Stop observing after 30 seconds
        setTimeout(() => observer.disconnect(), 30000);
    }
    
    /**
     * Get performance stats
     */
    static getPerformanceStats() {
        const stats = {
            loadTimes: Object.fromEntries(this.loadTimes),
            averageLoadTime: 0,
            totalTransferSize: 0,
            compressionRatio: 0
        };
        
        if (this.loadTimes.size > 0) {
            const times = Array.from(this.loadTimes.values());
            stats.averageLoadTime = times.reduce((acc, t) => acc + t.duration, 0) / times.length;
            stats.totalTransferSize = times.reduce((acc, t) => acc + t.transferSize, 0);
            
            const totalSize = times.reduce((acc, t) => acc + t.size, 0);
            if (totalSize > 0) {
                stats.compressionRatio = stats.totalTransferSize / totalSize;
            }
        }
        
        return stats;
    }
}

// Auto-start performance monitoring
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        BundleAnalyzer.monitorBundlePerformance();
    });
}

Logger.loading('📦 Bundle analyzer and code splitting utilities loaded');
