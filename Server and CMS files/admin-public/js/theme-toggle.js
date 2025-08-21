// Dark Mode Toggle Functionality
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    init() {
        // Apply the current theme immediately
        this.applyTheme(this.currentTheme);
        
        // Add theme toggle button to header
        this.addThemeToggle();
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) {
                this.setTheme(e.matches ? 'dark' : 'light');
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

    setStoredTheme(theme) {
        try {
            localStorage.setItem('adenai-theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference to localStorage');
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
    }

    setTheme(theme) {
        this.applyTheme(theme);
        this.setStoredTheme(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        this.showThemeToast(newTheme);
    }

    addThemeToggle() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) {
            console.warn('Could not find .header-right to add theme toggle');
            return;
        }

        // Create theme toggle button
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.setAttribute('aria-label', 'Toggle dark mode');
        themeToggle.setAttribute('title', 'Toggle dark/light mode');
        
        // Add click handler
        themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Insert before auth container or at the beginning
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            headerRight.insertBefore(themeToggle, authContainer);
        } else {
            headerRight.prepend(themeToggle);
        }
        
        this.themeToggleButton = themeToggle;
        this.updateToggleIcon();
    }

    updateToggleIcon() {
        if (!this.themeToggleButton) return;
        
        const icon = this.currentTheme === 'dark' ? '☀️' : '🌙';
        this.themeToggleButton.textContent = icon;
    }

    showThemeToast(theme) {
        // Use the admin toast system if available
        if (typeof admin !== 'undefined' && admin.showToast) {
            const message = `${theme === 'dark' ? '🌙' : '☀️'} ${theme === 'dark' ? 'Dark' : 'Light'} mode enabled`;
            admin.showToast(message, 'success');
            return;
        }

        // Fallback: create our own toast if admin system isn't available
        this.createFallbackToast(theme);
    }

    createFallbackToast(theme) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = `${theme === 'dark' ? '🌙' : '☀️'} ${theme === 'dark' ? 'Dark' : 'Light'} mode enabled`;
        
        container.appendChild(toast);
        
        // Auto remove after 2 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 2000);
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