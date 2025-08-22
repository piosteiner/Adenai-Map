// UI Utilities and Helper Functions
class AdminUI {
    constructor() {
        this.toastContainer = this.ensureToastContainer();
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

    // Tab Management
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        console.log(`🔄 Switched to ${tabName} tab`);
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
}

// Create global UI instance
window.adminUI = new AdminUI();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminUI;
}