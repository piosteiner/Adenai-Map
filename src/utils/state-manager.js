// state-manager.js - Centralized Application State Management
// Manages character, location, and system states with optimized updates

class StateManager {
    static instance = null;
    
    constructor() {
        if (StateManager.instance) {
            return StateManager.instance;
        }
        
        this.state = {
            characters: {
                data: [],
                visible: new Set(),
                focused: null,
                loading: false,
                lastUpdate: null
            },
            locations: {
                data: [],
                visible: new Set(),
                loading: false,
                lastUpdate: null
            },
            map: {
                ready: false,
                zoom: null,
                center: null,
                bounds: null
            },
            systems: {
                initialized: new Set(),
                loading: new Set(),
                errors: new Map()
            },
            ui: {
                panelOpen: false,
                searchQuery: '',
                notifications: []
            }
        };
        
        this.subscribers = new Map();
        this.debounceTimers = new Map();
        
        StateManager.instance = this;
    }
    
    static getInstance() {
        if (!StateManager.instance) {
            new StateManager();
        }
        return StateManager.instance;
    }
    
    // Subscribe to state changes
    subscribe(key, callback, options = {}) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        const subscriber = {
            callback,
            immediate: options.immediate !== false,
            debounce: options.debounce || 0,
            id: `${key}_${Date.now()}_${Math.random()}`
        };
        
        this.subscribers.get(key).add(subscriber);
        
        // Call immediately if requested
        if (subscriber.immediate) {
            callback(this.getState(key));
        }
        
        // Return unsubscribe function
        return () => {
            this.subscribers.get(key)?.delete(subscriber);
        };
    }
    
    // Get state value
    getState(key = null) {
        if (!key) {
            return this.state;
        }
        
        const keys = key.split('.');
        let value = this.state;
        
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) {
                return undefined;
            }
        }
        
        return value;
    }
    
    // Update state with optimized notifications
    setState(key, value, options = {}) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        
        let target = this.state;
        for (const k of keys) {
            if (!target[k]) {
                target[k] = {};
            }
            target = target[k];
        }
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // Add timestamp
        if (keys[0] === 'characters' || keys[0] === 'locations') {
            target.lastUpdate = Date.now();
        }
        
        // Notify subscribers
        this.notifySubscribers(key, value, oldValue, options);
        
        Logger.debug(`State updated: ${key}`, { old: oldValue, new: value });
    }
    
    // Batch multiple state updates
    batchUpdate(updates, options = {}) {
        const changedKeys = new Set();
        
        // Apply all updates
        for (const [key, value] of Object.entries(updates)) {
            const keys = key.split('.');
            const lastKey = keys.pop();
            
            let target = this.state;
            for (const k of keys) {
                if (!target[k]) {
                    target[k] = {};
                }
                target = target[k];
            }
            
            target[lastKey] = value;
            changedKeys.add(key);
        }
        
        // Notify all subscribers after updates
        changedKeys.forEach(key => {
            this.notifySubscribers(key, this.getState(key), undefined, options);
        });
        
        Logger.debug(`Batch state update: ${changedKeys.size} keys changed`);
    }
    
    // Notify subscribers with debouncing
    notifySubscribers(key, newValue, oldValue, options = {}) {
        const subscribers = this.subscribers.get(key);
        if (!subscribers) return;
        
        subscribers.forEach(subscriber => {
            if (subscriber.debounce > 0) {
                // Clear existing timer
                const timerId = `${subscriber.id}_${key}`;
                if (this.debounceTimers.has(timerId)) {
                    PerformanceUtils.clearTimer(this.debounceTimers.get(timerId));
                }
                
                // Set new timer
                const newTimerId = PerformanceUtils.setTimeout(() => {
                    subscriber.callback(newValue, oldValue);
                    this.debounceTimers.delete(timerId);
                }, subscriber.debounce, timerId);
                
                this.debounceTimers.set(timerId, newTimerId);
            } else {
                // Immediate notification
                subscriber.callback(newValue, oldValue);
            }
        });
    }
    
    // Character state management
    setCharacters(characters) {
        this.setState('characters.data', characters);
    }
    
    getCharacters() {
        return this.getState('characters.data') || [];
    }
    
    toggleCharacterVisibility(characterId, visible = null) {
        const currentVisible = this.getState('characters.visible');
        const isVisible = visible !== null ? visible : !currentVisible.has(characterId);
        
        if (isVisible) {
            currentVisible.add(characterId);
        } else {
            currentVisible.delete(characterId);
        }
        
        this.setState('characters.visible', new Set(currentVisible));
        return isVisible;
    }
    
    setFocusedCharacter(characterId) {
        this.setState('characters.focused', characterId);
    }
    
    // Location state management
    setLocations(locations) {
        this.setState('locations.data', locations);
    }
    
    getLocations() {
        return this.getState('locations.data') || [];
    }
    
    // Map state management
    updateMapState(mapState) {
        this.batchUpdate({
            'map.zoom': mapState.zoom,
            'map.center': mapState.center,
            'map.bounds': mapState.bounds,
            'map.ready': true
        });
    }
    
    // System state management
    markSystemInitialized(systemName) {
        const initialized = this.getState('systems.initialized');
        initialized.add(systemName);
        this.setState('systems.initialized', new Set(initialized));
    }
    
    markSystemLoading(systemName, loading = true) {
        const loadingSystems = this.getState('systems.loading');
        
        if (loading) {
            loadingSystems.add(systemName);
        } else {
            loadingSystems.delete(systemName);
        }
        
        this.setState('systems.loading', new Set(loadingSystems));
    }
    
    setSystemError(systemName, error) {
        const errors = this.getState('systems.errors');
        if (error) {
            errors.set(systemName, error);
        } else {
            errors.delete(systemName);
        }
        this.setState('systems.errors', new Map(errors));
    }
    
    // UI state management
    setPanelOpen(open) {
        this.setState('ui.panelOpen', open);
    }
    
    setSearchQuery(query) {
        this.setState('ui.searchQuery', query);
    }
    
    // Performance monitoring
    getStateStats() {
        return {
            characters: {
                total: this.getCharacters().length,
                visible: this.getState('characters.visible').size,
                focused: !!this.getState('characters.focused'),
                lastUpdate: this.getState('characters.lastUpdate')
            },
            locations: {
                total: this.getLocations().length,
                visible: this.getState('locations.visible').size,
                lastUpdate: this.getState('locations.lastUpdate')
            },
            systems: {
                initialized: this.getState('systems.initialized').size,
                loading: this.getState('systems.loading').size,
                errors: this.getState('systems.errors').size
            },
            subscribers: {
                total: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
                keys: this.subscribers.size
            }
        };
    }
    
    // Cleanup
    cleanup() {
        this.debounceTimers.forEach(timerId => {
            PerformanceUtils.clearTimer(timerId);
        });
        this.debounceTimers.clear();
        this.subscribers.clear();
        
        Logger.cleanup('StateManager cleaned up');
    }
}

// Global instance
window.StateManager = StateManager.getInstance();

Logger.loading('🗃️ State management utilities loaded successfully');
