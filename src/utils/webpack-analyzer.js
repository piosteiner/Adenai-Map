// webpack-analyzer.js - Advanced Bundle Analysis and Tree Shaking Simulation
// Simulates webpack bundle analysis for identifying optimization opportunities

class WebpackAnalyzer {
    static moduleGraph = new Map();
    static chunks = new Map();
    static unusedExports = new Set();
    static duplicatedCode = new Map();
    
    // Bundle configuration simulation
    static bundleConfig = {
        entry: {
            // Critical chunk - must load first
            critical: [
                'src/utils/logger.js',
                'src/core/config.js',
                'src/core/map-core.js',
                'src/utils/http-utils.js'
            ],
            
            // Main application chunk
            main: [
                'src/utils/data-manager.js',
                'src/systems/character-system.js',
                'src/systems/location-system.js',
                'src/core/main.js'
            ],
            
            // Character features chunk
            characters: [
                'src/systems/movement-system.js',
                'src/ui/components/character-panel.js',
                'src/utils/char-path-api.js'
            ],
            
            // UI features chunk
            ui: [
                'src/ui/gallery.js',
                'src/ui/components/coordinate-copy.js',
                'src/systems/search-system.js'
            ],
            
            // Utilities chunk
            utils: [
                'src/utils/map-utils.js',
                'src/utils/coordinate-utils.js',
                'src/utils/data-utils.js',
                'src/utils/event-utils.js',
                'src/utils/notification-utils.js'
            ],
            
            // Optional features chunk
            optional: [
                'src/utils/github-version.js',
                'src/utils/journey.js'
            ]
        },
        
        // Optimization rules
        optimization: {
            splitChunks: {
                chunks: 'all',
                minSize: 10000,      // 10KB minimum
                maxSize: 100000,     // 100KB maximum
                cacheGroups: {
                    vendor: {
                        test: /[\\/]vendor[\\/]/,
                        name: 'vendor',
                        priority: 10
                    },
                    utils: {
                        test: /[\\/]utils[\\/]/,
                        name: 'utils',
                        priority: 5
                    },
                    systems: {
                        test: /[\\/]systems[\\/]/,
                        name: 'systems',
                        priority: 5
                    }
                }
            },
            
            // Tree shaking configuration
            usedExports: true,
            sideEffects: [
                '**/*.css',
                'src/utils/logger.js', // Has side effects (console output)
                'src/core/config.js'   // Has side effects (global config)
            ]
        }
    };
    
    /**
     * Analyze bundle composition and suggest optimizations
     */
    static async analyzeBundleComposition() {
        Logger.loading('🔍 Analyzing bundle composition...');
        
        const analysis = {
            chunks: {},
            totalSize: 0,
            duplications: [],
            unusedCode: [],
            optimizations: [],
            cacheGroups: {}
        };
        
        try {
            // Analyze each chunk
            for (const [chunkName, modules] of Object.entries(this.bundleConfig.entry)) {
                const chunkAnalysis = await this.analyzeChunk(chunkName, modules);
                analysis.chunks[chunkName] = chunkAnalysis;
                analysis.totalSize += chunkAnalysis.size;
            }
            
            // Find duplicated modules
            analysis.duplications = this.findDuplicatedModules();
            
            // Simulate tree shaking
            analysis.unusedCode = await this.simulateTreeShaking();
            
            // Generate optimization suggestions
            analysis.optimizations = this.generateOptimizations(analysis);
            
            Logger.success(`🔍 Bundle composition analyzed: ${Object.keys(analysis.chunks).length} chunks, ${(analysis.totalSize / 1024).toFixed(1)}KB total`);
            
            return analysis;
            
        } catch (error) {
            Logger.error('Bundle composition analysis failed:', error);
            throw error;
        }
    }
    
    /**
     * Analyze individual chunk
     */
    static async analyzeChunk(chunkName, modules) {
        const chunkData = {
            name: chunkName,
            modules: [],
            size: 0,
            dependencies: new Set(),
            exports: new Set(),
            imports: new Set()
        };
        
        for (const modulePath of modules) {
            try {
                const moduleInfo = await this.analyzeModuleForChunk(modulePath);
                chunkData.modules.push(moduleInfo);
                chunkData.size += moduleInfo.size;
                
                // Collect dependencies
                moduleInfo.dependencies.forEach(dep => chunkData.dependencies.add(dep));
                moduleInfo.exports.forEach(exp => chunkData.exports.add(exp));
                moduleInfo.imports.forEach(imp => chunkData.imports.add(imp));
                
            } catch (error) {
                Logger.warning(`Could not analyze module ${modulePath}:`, error.message);
            }
        }
        
        return chunkData;
    }
    
    /**
     * Analyze module for chunk inclusion
     */
    static async analyzeModuleForChunk(modulePath) {
        try {
            const response = await fetch(modulePath);
            const source = await response.text();
            
            const moduleInfo = {
                path: modulePath,
                size: new Blob([source]).size,
                dependencies: this.extractModuleDependencies(source),
                exports: this.extractModuleExports(source),
                imports: this.extractModuleImports(source),
                sideEffects: this.hasSideEffects(source, modulePath),
                complexity: this.calculateModuleComplexity(source)
            };
            
            this.moduleGraph.set(modulePath, moduleInfo);
            return moduleInfo;
            
        } catch (error) {
            return {
                path: modulePath,
                size: 0,
                dependencies: [],
                exports: [],
                imports: [],
                sideEffects: true,
                complexity: 0
            };
        }
    }
    
    /**
     * Extract module dependencies
     */
    static extractModuleDependencies(source) {
        const dependencies = [];
        
        // Look for various dependency patterns
        const patterns = [
            // Class usage: new SomeClass(), SomeClass.method()
            /(?:new\s+|\.)?([A-Z][a-zA-Z0-9]*(?:Utils|Manager|System|API|Core))/g,
            // Direct method calls: SomeModule.method()
            /([A-Z][a-zA-Z0-9]*)\./g,
            // Function calls that look like module usage
            /await\s+([A-Z][a-zA-Z0-9]*)\./g
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
     * Extract module exports
     */
    static extractModuleExports(source) {
        const exports = [];
        
        // Find class definitions
        const classMatches = source.matchAll(/class\s+([A-Z][a-zA-Z0-9]*)/g);
        for (const match of classMatches) {
            exports.push({ type: 'class', name: match[1], line: this.getLineNumber(source, match.index) });
        }
        
        // Find function definitions
        const functionMatches = source.matchAll(/(?:function\s+([a-zA-Z][a-zA-Z0-9]*)|const\s+([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(?:async\s+)?function)/g);
        for (const match of functionMatches) {
            const name = match[1] || match[2];
            if (name) {
                exports.push({ type: 'function', name, line: this.getLineNumber(source, match.index) });
            }
        }
        
        // Find variable exports
        const varMatches = source.matchAll(/(?:const|let|var)\s+([a-zA-Z][a-zA-Z0-9]*)\s*=/g);
        for (const match of varMatches) {
            exports.push({ type: 'variable', name: match[1], line: this.getLineNumber(source, match.index) });
        }
        
        return exports;
    }
    
    /**
     * Extract module imports
     */
    static extractModuleImports(source) {
        const imports = [];
        
        // Find usage of external modules/classes
        const usageMatches = source.matchAll(/(?:new\s+|await\s+)?([A-Z][a-zA-Z0-9]*(?:Utils|Manager|System|API|Core))/g);
        for (const match of usageMatches) {
            if (!imports.includes(match[1])) {
                imports.push(match[1]);
            }
        }
        
        return imports;
    }
    
    /**
     * Check if module has side effects
     */
    static hasSideEffects(source, modulePath) {
        // Check against side effects configuration
        const sideEffectPatterns = this.bundleConfig.optimization.sideEffects;
        
        for (const pattern of sideEffectPatterns) {
            if (pattern.includes('**') && pattern.includes('.css')) {
                if (modulePath.endsWith('.css')) return true;
            } else if (modulePath.includes(pattern.replace('src/', ''))) {
                return true;
            }
        }
        
        // Look for side effect patterns in code
        const sideEffectIndicators = [
            /console\./g,                    // Console output
            /document\.addEventListener/g,   // Event listeners
            /window\./g,                     // Window modifications
            /localStorage\./g,               // Storage modifications
            /sessionStorage\./g,             // Storage modifications
            /\.innerHTML\s*=/g,              // DOM modifications
            /\.style\./g                     // Style modifications
        ];
        
        return sideEffectIndicators.some(pattern => pattern.test(source));
    }
    
    /**
     * Calculate module complexity
     */
    static calculateModuleComplexity(source) {
        let complexity = 0;
        
        // Count control structures
        complexity += (source.match(/\b(if|for|while|switch|try|catch|else)\b/g) || []).length;
        
        // Count functions
        complexity += (source.match(/\bfunction\b/g) || []).length;
        
        // Count async operations
        complexity += (source.match(/\b(async|await|Promise)\b/g) || []).length;
        
        // Count event handling
        complexity += (source.match(/addEventListener|on\w+\s*=/g) || []).length;
        
        // Count DOM operations
        complexity += (source.match(/document\.|querySelector|getElementById/g) || []).length;
        
        return complexity;
    }
    
    /**
     * Find duplicated modules across chunks
     */
    static findDuplicatedModules() {
        const moduleUsage = new Map();
        const duplications = [];
        
        // Track module usage across chunks
        for (const [chunkName, modules] of Object.entries(this.bundleConfig.entry)) {
            modules.forEach(modulePath => {
                if (!moduleUsage.has(modulePath)) {
                    moduleUsage.set(modulePath, []);
                }
                moduleUsage.get(modulePath).push(chunkName);
            });
        }
        
        // Find modules used in multiple chunks
        moduleUsage.forEach((chunks, modulePath) => {
            if (chunks.length > 1) {
                const moduleInfo = this.moduleGraph.get(modulePath);
                duplications.push({
                    module: modulePath,
                    chunks: chunks,
                    size: moduleInfo ? moduleInfo.size : 0,
                    savings: moduleInfo ? (moduleInfo.size * (chunks.length - 1)) : 0
                });
            }
        });
        
        return duplications.sort((a, b) => b.savings - a.savings);
    }
    
    /**
     * Simulate tree shaking to find unused code
     */
    static async simulateTreeShaking() {
        const unusedCode = [];
        const usedExports = new Set();
        
        // Collect all used exports by analyzing dependencies
        this.moduleGraph.forEach((moduleInfo, modulePath) => {
            moduleInfo.imports.forEach(importName => {
                usedExports.add(importName);
            });
        });
        
        // Find unused exports
        this.moduleGraph.forEach((moduleInfo, modulePath) => {
            moduleInfo.exports.forEach(exportInfo => {
                if (!usedExports.has(exportInfo.name)) {
                    unusedCode.push({
                        module: modulePath,
                        export: exportInfo.name,
                        type: exportInfo.type,
                        line: exportInfo.line,
                        estimatedSize: this.estimateExportSize(exportInfo.type)
                    });
                }
            });
        });
        
        return unusedCode;
    }
    
    /**
     * Estimate the size of an unused export
     */
    static estimateExportSize(type) {
        const averageSizes = {
            'class': 2000,      // 2KB average class
            'function': 500,    // 500B average function
            'variable': 100     // 100B average variable
        };
        
        return averageSizes[type] || 200;
    }
    
    /**
     * Generate optimization suggestions
     */
    static generateOptimizations(analysis) {
        const optimizations = [];
        
        // Check chunk sizes
        Object.values(analysis.chunks).forEach(chunk => {
            const sizeKB = chunk.size / 1024;
            const maxSize = this.bundleConfig.optimization.splitChunks.maxSize / 1024;
            
            if (sizeKB > maxSize) {
                optimizations.push({
                    type: 'chunk-size',
                    priority: 'high',
                    chunk: chunk.name,
                    currentSize: sizeKB.toFixed(1) + 'KB',
                    maxSize: maxSize + 'KB',
                    suggestion: `Split ${chunk.name} chunk - it's ${(sizeKB - maxSize).toFixed(1)}KB over the limit`,
                    action: 'Consider moving some modules to a separate chunk'
                });
            }
        });
        
        // Check duplications
        if (analysis.duplications.length > 0) {
            const totalSavings = analysis.duplications.reduce((total, dup) => total + dup.savings, 0);
            optimizations.push({
                type: 'duplication',
                priority: 'medium',
                duplicatedModules: analysis.duplications.length,
                potentialSavings: (totalSavings / 1024).toFixed(1) + 'KB',
                suggestion: 'Extract common modules into shared chunks',
                action: 'Create vendor or common chunk for duplicated modules'
            });
        }
        
        // Check unused code
        if (analysis.unusedCode.length > 0) {
            const totalUnusedSize = analysis.unusedCode.reduce((total, unused) => total + unused.estimatedSize, 0);
            optimizations.push({
                type: 'tree-shaking',
                priority: 'low',
                unusedExports: analysis.unusedCode.length,
                potentialSavings: (totalUnusedSize / 1024).toFixed(1) + 'KB',
                suggestion: 'Remove unused exports and enable tree shaking',
                action: 'Clean up unused code and use ES6 modules'
            });
        }
        
        return optimizations;
    }
    
    /**
     * Generate optimal chunk configuration
     */
    static generateOptimalChunks(analysis) {
        const optimalConfig = {
            entry: {},
            recommendations: []
        };
        
        // Create vendor chunk for common dependencies
        const commonDeps = this.findCommonDependencies(analysis);
        if (commonDeps.length > 0) {
            optimalConfig.entry.vendor = commonDeps;
            optimalConfig.recommendations.push({
                type: 'vendor-chunk',
                modules: commonDeps,
                benefit: 'Reduces duplication and improves caching'
            });
        }
        
        // Optimize chunk sizes
        Object.entries(analysis.chunks).forEach(([chunkName, chunk]) => {
            if (chunk.size > this.bundleConfig.optimization.splitChunks.maxSize) {
                // Split large chunks
                const splitModules = this.suggestChunkSplit(chunk);
                optimalConfig.entry[chunkName] = splitModules.primary;
                optimalConfig.entry[`${chunkName}-secondary`] = splitModules.secondary;
                
                optimalConfig.recommendations.push({
                    type: 'chunk-split',
                    originalChunk: chunkName,
                    newChunks: [chunkName, `${chunkName}-secondary`],
                    benefit: 'Reduces initial bundle size'
                });
            } else {
                optimalConfig.entry[chunkName] = chunk.modules.map(m => m.path);
            }
        });
        
        return optimalConfig;
    }
    
    /**
     * Find common dependencies across chunks
     */
    static findCommonDependencies(analysis) {
        const dependencyCount = new Map();
        const totalChunks = Object.keys(analysis.chunks).length;
        
        // Count dependency usage
        Object.values(analysis.chunks).forEach(chunk => {
            chunk.dependencies.forEach(dep => {
                dependencyCount.set(dep, (dependencyCount.get(dep) || 0) + 1);
            });
        });
        
        // Find dependencies used in 50% or more chunks
        const commonDeps = [];
        dependencyCount.forEach((count, dep) => {
            if (count >= Math.ceil(totalChunks * 0.5)) {
                // Try to find the corresponding module path
                const modulePath = this.findModulePathForDependency(dep);
                if (modulePath) {
                    commonDeps.push(modulePath);
                }
            }
        });
        
        return commonDeps;
    }
    
    /**
     * Find module path for dependency name
     */
    static findModulePathForDependency(depName) {
        for (const [modulePath, moduleInfo] of this.moduleGraph) {
            if (moduleInfo.exports.some(exp => exp.name === depName)) {
                return modulePath;
            }
        }
        return null;
    }
    
    /**
     * Suggest how to split a large chunk
     */
    static suggestChunkSplit(chunk) {
        const modules = chunk.modules.sort((a, b) => b.size - a.size);
        const targetSize = this.bundleConfig.optimization.splitChunks.maxSize / 2;
        
        let primarySize = 0;
        const primary = [];
        const secondary = [];
        
        modules.forEach(module => {
            if (primarySize < targetSize && primary.length < modules.length / 2) {
                primary.push(module.path);
                primarySize += module.size;
            } else {
                secondary.push(module.path);
            }
        });
        
        return { primary, secondary };
    }
    
    /**
     * Get line number for match index
     */
    static getLineNumber(source, index) {
        return source.substring(0, index).split('\n').length;
    }
    
    /**
     * Generate bundle report
     */
    static generateBundleReport(analysis) {
        return {
            summary: {
                totalChunks: Object.keys(analysis.chunks).length,
                totalSize: (analysis.totalSize / 1024).toFixed(1) + 'KB',
                duplications: analysis.duplications.length,
                unusedExports: analysis.unusedCode.length,
                optimizations: analysis.optimizations.length
            },
            
            chunks: Object.values(analysis.chunks).map(chunk => ({
                name: chunk.name,
                size: (chunk.size / 1024).toFixed(1) + 'KB',
                modules: chunk.modules.length,
                dependencies: chunk.dependencies.size,
                exports: chunk.exports.size
            })),
            
            topOptimizations: analysis.optimizations
                .sort((a, b) => {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                })
                .slice(0, 5),
            
            duplicatedModules: analysis.duplications.slice(0, 10).map(dup => ({
                module: dup.module.split('/').pop(),
                chunks: dup.chunks,
                savings: (dup.savings / 1024).toFixed(1) + 'KB'
            })),
            
            unusedCode: analysis.unusedCode.slice(0, 10).map(unused => ({
                module: unused.module.split('/').pop(),
                export: unused.export,
                type: unused.type,
                size: (unused.estimatedSize / 1024).toFixed(1) + 'KB'
            }))
        };
    }
}

Logger.loading('🔧 Webpack-style bundle analyzer ready');
