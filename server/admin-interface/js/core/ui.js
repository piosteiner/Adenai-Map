// admin-public/js/core/ui.js UI Utilities and Helper Functions

class AdminUI {
    constructor() {
        this.toastContainer = this.ensureToastContainer();
        this.initializeTabSystem();
        this.initRouting();
    }

    // Initialize tab system with event listeners
    initializeTabSystem() {
        document.addEventListener('DOMContentLoaded', () => {
            // Setup tab button listeners
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabName = btn.dataset.tab;
                    this.switchTab(tabName);
                });
            });

            // Handle initial route on page load
            this.handleRouteChange();
        });
    }

    // Initialize URL hash routing
    initRouting() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRouteChange());
        
        // Handle initial route when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            // Small delay to ensure all elements are ready
            setTimeout(() => this.handleRouteChange(), 100);
        });
    }

    handleRouteChange() {
        const hash = window.location.hash.slice(2); // Remove '#/'
        const route = hash || 'locations'; // Default to locations
        
        // Map routes to tab names
        const routeMap = {
            'locations': 'locations',
            'characters': 'characters',
            'media': 'media',
            'journeys': 'journeys',
            'overview': 'overview',
            'backup': 'backup',
            'changelog': 'changelog'
        };
        
        const tabName = routeMap[route];
        if (tabName) {
            this.switchTabWithoutHashUpdate(tabName);
            this.updateActiveTab(tabName);
        } else {
            // Invalid route, redirect to default
            window.location.hash = '#/locations';
        }
    }

    // Update active tab visual state
    updateActiveTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    // Toast Notification System
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);

        console.log(`📢 Toast: ${message}`);
    }

    ensureToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 2000;';
            document.body.appendChild(container);
        }
        return container;
    }

    // Modal Management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            document.body.classList.add('modal-open');
            
            // Focus first input if available
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            document.body.classList.remove('modal-open');
            
            // Reset form if it exists
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
        }
    }

    // Loading States
    showLoading(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading">${message} 🔄</div>
            `;
        }
    }

    showEmptyState(containerId, title, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>${title}</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    // Enhanced Tab Management with Journey Integration
    switchTab(tabName) {
        // Update the URL hash
        if (window.location.hash !== `#/${tabName}`) {
            window.location.hash = `#/${tabName}`;
        }

        this.switchTabWithoutHashUpdate(tabName);
    }

    // Switch tab without updating hash (prevents infinite loops)
    switchTabWithoutHashUpdate(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        console.log(`🔄 Switched to ${tabName} tab`);

        // Special handling for journeys tab
        if (tabName === 'journeys') {
            setTimeout(() => this.initializeJourneyTab(), 200);
        }

        // Special handling for media tab
        if (tabName === 'media') {
            setTimeout(() => this.initializeMediaTab(), 200);
        }

        // Notify admin core of tab change (for stats updates, etc.)
        if (window.admin && typeof window.admin.onTabChanged === 'function') {
            window.admin.onTabChanged(tabName);
        }
    }

    // Journey Tab Integration
    initializeJourneyTab() {
        console.log('🗺️ Initializing journey tab from AdminUI');
        
        try {
            // Check if Journey Manager exists
            if (window.journeyManager) {
                console.log('✅ Found existing Journey Manager, initializing...');
                window.journeyManager.initializeJourneyTab();
            } else if (typeof JourneyManager !== 'undefined') {
                console.log('🔧 Creating new Journey Manager...');
                window.journeyManager = new JourneyManager();
                window.journeyManager.initializeJourneyTab();
            } else {
                console.error('❌ JourneyManager class not found - check if js/modules/journeys/index.js is loaded');
                this.showJourneyError('Journey Manager not loaded. Please refresh the page.');
            }
        } catch (error) {
            console.error('❌ Error initializing journey tab:', error);
            this.showJourneyError(`Failed to initialize journeys: ${error.message}`);
        }
    }

    // Media Tab Integration
    initializeMediaTab() {
        console.log('🖼️ Initializing media tab from AdminUI');
        
        try {
            // Check if Media module exists
            if (window.media) {
                console.log('✅ Found existing Media module, activating...');
                window.media.onTabActivated();
            } else {
                console.error('❌ Media module not found - check if js/modules/media/index.js is loaded');
                this.showMediaError('Media module not loaded. Please refresh the page.');
            }
        } catch (error) {
            console.error('❌ Error initializing media tab:', error);
            this.showMediaError(`Failed to initialize media: ${error.message}`);
        }
    }

    // Show journey-specific error
    showJourneyError(message) {
        const journeysList = document.getElementById('journeys-list');
        if (journeysList) {
            journeysList.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 40px 20px;">
                    <p style="color: #dc3545; font-weight: bold;">❌ Journey Loading Error</p>
                    <p style="color: #666; margin: 10px 0;">${message}</p>
                    <button onclick="adminUI.initializeJourneyTab()" class="btn-primary" style="margin-top: 15px;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
        this.showToast(message, 'error');
    }

    // Show media-specific error
    showMediaError(message) {
        const mediaGrid = document.getElementById('media-grid');
        if (mediaGrid) {
            mediaGrid.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 40px 20px; grid-column: 1 / -1;">
                    <p style="color: #dc3545; font-weight: bold;">❌ Media Loading Error</p>
                    <p style="color: #666; margin: 10px 0;">${message}</p>
                    <button onclick="adminUI.initializeMediaTab()" class="btn-primary" style="margin-top: 15px;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
        this.showToast(message, 'error');
    }

    // Force map resize (utility for journey management)
    forceMapResize() {
        if (window.journeyManager && window.journeyManager.map) {
            setTimeout(() => {
                window.journeyManager.map.invalidateSize(true);
                console.log('🗺️ Forced map resize from AdminUI');
            }, 100);
        }
    }

    // Form Utilities
    getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return null;
        
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }

    populateForm(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = !!data[key];
                } else {
                    field.value = data[key] || '';
                }
            }
        });
    }

    resetForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            
            // Also clear any custom validation states
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.classList.remove('error', 'valid');
            });
            
            // Clear any error messages
            const errorMessages = form.querySelectorAll('.error-message');
            errorMessages.forEach(msg => msg.remove());
            
            console.log(`🔄 Form "${formId}" reset`);
        } else {
            console.warn(`⚠️ Form "${formId}" not found for reset`);
        }
    }

    // Validation
    validateForm(formId, rules = {}) {
        const form = document.getElementById(formId);
        if (!form) return false;
        
        let isValid = true;
        const formData = this.getFormData(formId);
        
        // Clear previous errors
        form.querySelectorAll('.form-error-message').forEach(error => error.remove());
        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('has-error', 'has-success');
        });
        
        // Validate required fields
        Object.keys(rules).forEach(fieldName => {
            const rule = rules[fieldName];
            const field = form.querySelector(`[name="${fieldName}"]`);
            const group = field?.closest('.form-group');
            const value = formData[fieldName];
            
            if (rule.required && (!value || value.trim() === '')) {
                this.showFieldError(group, `${rule.label || fieldName} is required`);
                isValid = false;
            } else if (value && rule.minLength && value.length < rule.minLength) {
                this.showFieldError(group, `${rule.label || fieldName} must be at least ${rule.minLength} characters`);
                isValid = false;
            } else if (value && rule.pattern && !rule.pattern.test(value)) {
                this.showFieldError(group, rule.message || `${rule.label || fieldName} format is invalid`);
                isValid = false;
            } else if (group) {
                group.classList.add('has-success');
            }
        });
        
        return isValid;
    }

    showFieldError(group, message) {
        if (!group) return;
        
        group.classList.add('has-error');
        const errorMessage = document.createElement('span');
        errorMessage.className = 'form-error-message';
        errorMessage.textContent = message;
        group.appendChild(errorMessage);
    }

    // Event Delegation
    addDelegatedListener(container, selector, event, handler) {
        const containerElement = typeof container === 'string' 
            ? document.getElementById(container) 
            : container;
            
        if (containerElement) {
            containerElement.addEventListener(event, (e) => {
                if (e.target.matches(selector)) {
                    handler(e);
                }
            });
        }
    }

    // Confirmation Dialog
    confirm(message, onConfirm, onCancel) {
        const result = window.confirm(message);
        if (result && onConfirm) {
            onConfirm();
        } else if (!result && onCancel) {
            onCancel();
        }
        return result;
    }

    // Utility: Safe Element Selection
    $(selector) {
        return document.querySelector(selector);
    }

    $$(selector) {
        return document.querySelectorAll(selector);
    }

    // Utility: Show/Hide Admin Actions
    toggleAdminActions(show) {
        document.querySelectorAll('.admin-action').forEach(btn => {
            btn.style.display = show ? 'inline-block' : 'none';
        });
    }

    // Utility: Format Numbers
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    // Utility: Debounce Function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Data Export Utility
    exportJson(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showToast('📤 Data exported successfully!', 'success');
    }

    // View Raw JSON in New Window
    viewRawJson(data, title = 'Raw JSON Data') {
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: monospace; padding: 1rem; background: #f5f5f5; }
                        pre { background: white; padding: 1rem; border-radius: 4px; overflow: auto; }
                    </style>
                </head>
                <body>
                    <h2>${title}</h2>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </body>
            </html>
        `);
    }

    // Debug utility for Journey Management
    debugJourneySystem() {
        console.group('🔧 Journey System Debug Info');
        console.log('Journey Manager exists:', !!window.journeyManager);
        console.log('JourneyManager class defined:', typeof JourneyManager !== 'undefined');
        console.log('Journey tab element:', document.querySelector('[data-tab="journeys"]'));
        console.log('Journey map container:', document.getElementById('journeys-map'));
        console.log('Journey list container:', document.getElementById('journeys-list'));
        
        if (window.journeyManager) {
            console.log('Journey Manager state:', {
                journeys: window.journeyManager.journeys?.length || 0,
                map: !!window.journeyManager.map,
                currentJourney: !!window.journeyManager.currentJourney
            });
        }
        console.groupEnd();
    }
}

// Create global UI instance
window.adminUI = new AdminUI();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminUI;
}