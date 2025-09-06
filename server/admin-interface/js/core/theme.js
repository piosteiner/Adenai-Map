// admin-public/js/core/theme.js Dark Mode Toggle Functionality

class ThemeManager {
    constructor() {
        // Check if user wants to follow system theme (default: true)
        this.followSystemTheme = this.getFollowSystemTheme();
        this.currentTheme = this.followSystemTheme ? this.getSystemTheme() : (this.getStoredTheme() || this.getSystemTheme());
        this.init();
    }

    init() {
        // Apply the current theme immediately
        this.applyTheme(this.currentTheme);
        
        // Add theme toggle button to header
        this.addThemeToggle();
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.followSystemTheme) {
                this.setTheme(e.matches ? 'dark' : 'light', false); // Don't store when following system
            }
        });
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('adenai-theme');
        } catch (e) {
            console.warn('localStorage not available for theme storage');
            return null;
        }
    }

    getFollowSystemTheme() {
        try {
            const stored = localStorage.getItem('adenai-follow-system-theme');
            return stored === null ? true : stored === 'true'; // Default to true
        } catch (e) {
            console.warn('localStorage not available for theme storage');
            return true;
        }
    }

    setStoredTheme(theme) {
        try {
            localStorage.setItem('adenai-theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference to localStorage');
        }
    }

    setFollowSystemTheme(follow) {
        try {
            localStorage.setItem('adenai-follow-system-theme', follow.toString());
            this.followSystemTheme = follow;
        } catch (e) {
            console.warn('Could not save system theme preference to localStorage');
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
    }

    setTheme(theme, storePreference = true) {
        this.applyTheme(theme);
        if (storePreference) {
            this.setStoredTheme(theme);
            this.setFollowSystemTheme(false); // User manually set theme, stop following system
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme, true); // Store manual preference
        this.showThemeToast(newTheme);
    }

    // New method to reset to system theme
    resetToSystemTheme() {
        this.setFollowSystemTheme(true);
        const systemTheme = this.getSystemTheme();
        this.applyTheme(systemTheme);
        this.showThemeToast(systemTheme, true);
        
        // Clear stored manual preference
        try {
            localStorage.removeItem('adenai-theme');
        } catch (e) {
            console.warn('Could not clear stored theme');
        }
    }

    addThemeToggle() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) {
            console.warn('Could not find .header-right to add theme toggle');
            return;
        }

        // Create theme toggle container
        const themeContainer = document.createElement('div');
        themeContainer.className = 'theme-container';

        // Create main theme toggle button
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.setAttribute('aria-label', 'Toggle dark mode');
        themeToggle.setAttribute('title', this.followSystemTheme ? 
            `Following system theme (${this.currentTheme})` : 
            'Toggle dark/light mode');
        
        // Add click handler
        themeToggle.addEventListener('click', () => this.toggleTheme());

        // Create system preference indicator/button
        const systemIndicator = document.createElement('button');
        systemIndicator.className = 'system-theme-indicator';
        systemIndicator.setAttribute('aria-label', 'Theme preference settings');
        systemIndicator.setAttribute('title', this.followSystemTheme ? 
            'Following system theme (click to use manual mode)' : 
            'Using manual theme (click to follow system)');
        systemIndicator.textContent = this.followSystemTheme ? '🔄' : '📌';
        
        // Add click handler for system preference toggle
        systemIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.followSystemTheme) {
                // Currently following system, switch to manual
                this.setFollowSystemTheme(false);
                this.setStoredTheme(this.currentTheme);
                this.showThemeToast(this.currentTheme, false, 'Manual mode enabled');
            } else {
                // Currently manual, switch to follow system
                this.resetToSystemTheme();
            }
            this.updateToggleIcon();
        });

        themeContainer.appendChild(themeToggle);
        themeContainer.appendChild(systemIndicator);
        
        // Insert before auth container or at the beginning
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            headerRight.insertBefore(themeContainer, authContainer);
        } else {
            headerRight.prepend(themeContainer);
        }
        
        this.themeToggleButton = themeToggle;
        this.systemIndicatorButton = systemIndicator;
        this.updateToggleIcon();
    }

    updateToggleIcon() {
        if (!this.themeToggleButton) return;
        
        const icon = this.currentTheme === 'dark' ? '☀️' : '🌙';
        this.themeToggleButton.textContent = icon;
        
        if (this.systemIndicatorButton) {
            this.systemIndicatorButton.textContent = this.followSystemTheme ? '🔄' : '📌';
            this.systemIndicatorButton.setAttribute('title', this.followSystemTheme ? 
                'Following system theme (click to use manual mode)' : 
                'Using manual theme (click to follow system)');
            
            this.themeToggleButton.setAttribute('title', this.followSystemTheme ? 
                `Following system theme (${this.currentTheme})` : 
                'Toggle dark/light mode');
        }
    }

    showThemeToast(theme, isSystemReset = false, customMessage = null) {
        let message;
        if (customMessage) {
            message = `${this.followSystemTheme ? '🔄' : '📌'} ${customMessage}`;
        } else if (isSystemReset) {
            message = `🔄 Following system theme (${theme === 'dark' ? '🌙 Dark' : '☀️ Light'})`;
        } else {
            message = `${theme === 'dark' ? '🌙' : '☀️'} ${theme === 'dark' ? 'Dark' : 'Light'} mode enabled`;
        }

        // Use the admin toast system if available
        if (typeof admin !== 'undefined' && admin.showToast) {
            admin.showToast(message, 'success');
            return;
        }

        // Fallback: create our own toast if admin system isn't available
        this.createFallbackToast(message);
    }

    createFallbackToast(message) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 3 seconds (increased for longer messages)
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 2000;';
        document.body.appendChild(container);
        return container;
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other scripts are loaded
    setTimeout(() => {
        window.themeManager = new ThemeManager();
        console.log('🌙 Theme manager initialized');
    }, 100);
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}