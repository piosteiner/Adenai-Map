// event-utils.js - Reusable Event Handling Utilities

class EventUtils {
    // Reusable hover behavior with timers
    static setupHoverBehavior(element, options = {}) {
        const config = {
            enterDelay: options.enterDelay || 300,
            leaveDelay: options.leaveDelay || 1000,
            onEnter: options.onEnter || (() => {}),
            onLeave: options.onLeave || (() => {}),
            onEnterImmediate: options.onEnterImmediate || (() => {}),
            onLeaveImmediate: options.onLeaveImmediate || (() => {}),
            ...options
        };

        let enterTimer = null;
        let leaveTimer = null;

        const clearEnterTimer = () => {
            if (enterTimer) {
                clearTimeout(enterTimer);
                enterTimer = null;
            }
        };

        const clearLeaveTimer = () => {
            if (leaveTimer) {
                clearTimeout(leaveTimer);
                leaveTimer = null;
            }
        };

        element.addEventListener('mouseenter', () => {
            clearLeaveTimer();
            config.onEnterImmediate();
            
            if (config.enterDelay > 0) {
                clearEnterTimer();
                enterTimer = setTimeout(() => {
                    config.onEnter();
                }, config.enterDelay);
            } else {
                config.onEnter();
            }
        });

        element.addEventListener('mouseleave', () => {
            clearEnterTimer();
            config.onLeaveImmediate();
            
            if (config.leaveDelay > 0) {
                clearLeaveTimer();
                leaveTimer = setTimeout(() => {
                    config.onLeave();
                }, config.leaveDelay);
            } else {
                config.onLeave();
            }
        });

        // Return cleanup function
        return () => {
            clearEnterTimer();
            clearLeaveTimer();
        };
    }

    // Reusable auto-dismiss behavior
    static setupAutoDismiss(element, delay = 10000, onDismiss = null) {
        const timer = setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
                if (onDismiss) onDismiss();
            }
        }, delay);

        // Return function to cancel auto-dismiss
        return () => clearTimeout(timer);
    }

    // Reusable error display
    static showError(message, duration = 10000) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 2000;
            max-width: 400px;
            font-family: sans-serif;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        return this.setupAutoDismiss(errorDiv, duration);
    }

    // Debounce utility
    static debounce(func, wait) {
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

    // Throttle utility
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
}

// Make available globally
window.EventUtils = EventUtils;

Logger.loading('🎛️ Event utilities loaded successfully');
