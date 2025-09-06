// admin-public/js/core/auth.js - Authentication Management Module

class AdminAuth {
    constructor() {
        this.isAuthenticated = false;
        this.username = null;
        this.displayName = null;
        this.role = null;
        this.ui = window.adminUI;
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.setupEventListeners();
        this.updateAuthUI();
    }

    setupEventListeners() {
        // Login form submission
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        // Login modal close buttons
        const closeLoginBtn = document.querySelector('.close-login-btn');
        if (closeLoginBtn) {
            closeLoginBtn.addEventListener('click', () => {
                this.closeLoginModal();
            });
        }

        // Close login modal on backdrop click
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.addEventListener('click', (e) => {
                if (e.target.id === 'login-modal') {
                    this.closeLoginModal();
                }
            });
        }
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            this.isAuthenticated = data.authenticated;
            this.username = data.username;
            this.displayName = data.username; // Display name is returned as username
            this.role = data.role;
        } catch (error) {
            console.error('Failed to check auth status:', error);
            this.isAuthenticated = false;
            this.username = null;
            this.displayName = null;
            this.role = null;
        }
    }

    updateAuthUI() {
        const authContainer = document.getElementById('auth-container');
        if (!authContainer) return;
        
        if (this.isAuthenticated) {
            authContainer.innerHTML = `
                <span class="welcome-text">Welcome, ${this.displayName || this.username}</span>
                <button id="logout-btn" class="btn-secondary">Logout</button>
            `;
            
            // Show all admin action buttons
            this.ui.toggleAdminActions(true);
        } else {
            authContainer.innerHTML = `
                <button id="login-btn" class="btn-primary">Login</button>
            `;
            
            // Hide admin action buttons
            this.ui.toggleAdminActions(false);
        }
        
        this.setupAuthEventListeners();
    }

    setupAuthEventListeners() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    showLoginModal() {
        this.ui.openModal('login-modal');
    }

    closeLoginModal() {
        this.ui.closeModal('login-modal');
    }

    async login() {
        const formData = this.ui.getFormData('login-form');
        if (!formData) {
            this.ui.showToast('❌ Form data not found', 'error');
            return;
        }

        // Validate form
        const isValid = this.ui.validateForm('login-form', {
            username: { required: true, label: 'Username' },
            password: { required: true, label: 'Password' }
        });

        if (!isValid) {
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    password: formData.password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.isAuthenticated = true;
                this.username = result.username;
                this.displayName = result.username; // Display name is returned as username
                this.role = result.role;
                this.updateAuthUI();
                this.closeLoginModal();
                this.ui.showToast('✅ Login successful!', 'success');
                
                // Notify other modules that auth state changed
                this.notifyAuthChange(true);
            } else {
                this.ui.showToast('❌ Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.ui.showToast('❌ Login failed', 'error');
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.isAuthenticated = false;
                this.username = null;
                this.displayName = null;
                this.role = null;
                this.updateAuthUI();
                this.ui.showToast('✅ Logout successful!', 'success');
                
                // Notify other modules that auth state changed
                this.notifyAuthChange(false);
            }
        } catch (error) {
            console.error('Logout failed:', error);
            this.ui.showToast('❌ Logout failed', 'error');
        }
    }

    // Check if user is authenticated before performing actions
    requireAuth(action) {
        if (!this.isAuthenticated) {
            this.ui.showToast('❌ Please login to perform this action', 'error');
            this.showLoginModal();
            return false;
        }
        return true;
    }

    // Handle session expiration
    handleSessionExpired() {
        this.isAuthenticated = false;
        this.username = null;
        this.displayName = null;
        this.role = null;
        this.updateAuthUI();
        this.ui.showToast('❌ Session expired. Please login again.', 'error');
        this.showLoginModal();
        
        // Notify other modules
        this.notifyAuthChange(false);
    }

    // Notify other modules about auth state changes
    notifyAuthChange(isAuthenticated) {
        // Dispatch custom event
        const event = new CustomEvent('authStateChanged', {
            detail: { 
                isAuthenticated, 
                username: this.username,
                displayName: this.displayName,
                role: this.role
            }
        });
        document.dispatchEvent(event);
    }

    // Check API response for auth errors
    checkApiResponse(response) {
        if (response.status === 401) {
            this.handleSessionExpired();
            return false;
        }
        return true;
    }

    // Utility method for making authenticated API calls
    async authenticatedFetch(url, options = {}) {
        if (!this.requireAuth()) {
            throw new Error('Authentication required');
        }

        const response = await fetch(url, options);
        
        if (!this.checkApiResponse(response)) {
            throw new Error('Session expired');
        }

        return response;
    }

    // Get current auth state
    getAuthState() {
        return {
            isAuthenticated: this.isAuthenticated,
            username: this.username,
            displayName: this.displayName,
            role: this.role
        };
    }
}

// Create global auth instance
window.adminAuth = new AdminAuth();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminAuth;
}