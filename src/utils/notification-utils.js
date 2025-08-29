// notification-utils.js - Centralized Notification System
// Consolidates all notification, error display, and user feedback patterns

class NotificationUtils {
    // Standard notification display with auto-dismiss
    static showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const styles = this.getNotificationStyles(type);
        notification.style.cssText = styles;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Add entrance animation
        setTimeout(() => notification.classList.add('notification-show'), 10);
        
        // Auto-dismiss
        const dismissTimer = setTimeout(() => {
            this.dismissNotification(notification);
        }, duration);
        
        // Manual dismiss on click
        notification.addEventListener('click', () => {
            clearTimeout(dismissTimer);
            this.dismissNotification(notification);
        });
        
        return {
            element: notification,
            dismiss: () => {
                clearTimeout(dismissTimer);
                this.dismissNotification(notification);
            }
        };
    }
    
    // Success notifications
    static showSuccess(message, duration = 3000) {
        return this.showNotification(`✅ ${message}`, 'success', duration);
    }
    
    // Error notifications
    static showError(message, duration = 8000) {
        return this.showNotification(`❌ ${message}`, 'error', duration);
    }
    
    // Warning notifications
    static showWarning(message, duration = 5000) {
        return this.showNotification(`⚠️ ${message}`, 'warning', duration);
    }
    
    // Info notifications  
    static showInfo(message, duration = 4000) {
        return this.showNotification(`ℹ️ ${message}`, 'info', duration);
    }
    
    // Loading notifications (longer duration, can be dismissed manually)
    static showLoading(message, duration = 10000) {
        return this.showNotification(`⏳ ${message}`, 'loading', duration);
    }
    
    // Copy success notification
    static showCopySuccess(coordinates) {
        return this.showSuccess(`Copied: ${coordinates}`, 2000);
    }
    
    // Copy error notification
    static showCopyError() {
        return this.showError('Failed to copy coordinates', 3000);
    }
    
    // Journey system error with detailed message
    static showJourneyError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'journey-error-notification';
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 12px 16px; border-radius: 4px; z-index: 10000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <strong>⚠️ Journey Loading Failed</strong><br>
                <small>${this.escapeHtml(message)}</small>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
        
        Logger.warn('🚫 Journey loading failed:', message);
        
        return errorDiv;
    }
    
    // Dismiss notification with animation
    static dismissNotification(notification) {
        notification.classList.add('notification-hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    // Get styles for different notification types
    static getNotificationStyles(type) {
        const baseStyles = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            cursor: pointer;
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
        `;
        
        const typeStyles = {
            success: 'background: #4CAF50; color: white;',
            error: 'background: #f44336; color: white;',
            warning: 'background: #ff9800; color: white;',
            info: 'background: #2196F3; color: white;',
            loading: 'background: #9c27b0; color: white;'
        };
        
        return baseStyles + typeStyles[type];
    }
    
    // HTML escaping for security
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Setup notification styles (call once on app init)
    static setupStyles() {
        if (document.querySelector('#notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-show {
                transform: translateX(0) !important;
            }
            
            .notification-hide {
                transform: translateX(100%) !important;
                opacity: 0;
            }
            
            .notification:hover {
                transform: translateX(-5px) !important;
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Initialize styles when script loads
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NotificationUtils.setupStyles());
    } else {
        NotificationUtils.setupStyles();
    }
}

Logger.loading('🔔 Notification utilities loaded successfully');
