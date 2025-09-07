// Media Module - Main coordinator for media management functionality
window.media = {
    // Initialize the media module
    init() {
        console.log('🖼️ Initializing Media module...');
        
        // Initialize UI components
        if (window.mediaUI) {
            window.mediaUI.init();
        }
        
        console.log('✅ Media module initialized');
    },
    
    // Public API methods for external access
    openUploadModal() {
        if (window.mediaUI) {
            window.mediaUI.openUploadModal();
        }
    },
    
    closeUploadModal() {
        if (window.mediaUI) {
            window.mediaUI.closeUploadModal();
        }
    },
    
    refreshMediaLibrary() {
        if (window.mediaUI) {
            window.mediaUI.loadMedia();
        }
    },
    
    // Handle tab activation
    onTabActivated() {
        console.log('🖼️ Media tab activated');
        
        // Load media if not already loaded
        if (window.mediaUI) {
            window.mediaUI.loadMedia();
        }
    },
    
    // Handle tab deactivation
    onTabDeactivated() {
        console.log('🖼️ Media tab deactivated');
        
        // Close any open modals
        this.closeUploadModal();
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.media.init();
    });
} else {
    window.media.init();
}
