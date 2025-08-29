// image-hover-preview.js - Image Hover Preview System
// Enlarges images on hover with smooth animations

class ImageHoverPreview {
    constructor() {
        this.previewElement = null;
        this.isPreviewVisible = false;
        this.hoverTimeout = null;
        this.init();
    }

    init() {
        this.createPreviewElement();
        this.setupGlobalImageHandlers();
        Logger.loading('🖼️ Image hover preview system loaded');
    }

    createPreviewElement() {
        // Create the preview overlay element
        this.previewElement = document.createElement('div');
        this.previewElement.id = 'image-hover-preview';
        this.previewElement.innerHTML = `
            <div class="preview-backdrop"></div>
            <div class="preview-container">
                <img class="preview-image" src="" alt="">
                <div class="preview-caption"></div>
            </div>
        `;
        
        // Add styles
        this.previewElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: none;
            pointer-events: none;
        `;

        document.body.appendChild(this.previewElement);
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #image-hover-preview {
                transition: opacity 0.2s ease;
            }

            #image-hover-preview.visible {
                display: flex !important;
                align-items: center;
                justify-content: center;
                opacity: 1;
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
            }

            .preview-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(2px);
            }

            .preview-container {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                z-index: 1;
            }

            .preview-image {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                transform: scale(0.9);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            #image-hover-preview.visible .preview-image {
                transform: scale(1);
            }

            .preview-caption {
                margin-top: 12px;
                padding: 8px 16px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border-radius: 16px;
                font-size: 0.9em;
                text-align: center;
                backdrop-filter: blur(4px);
                max-width: 400px;
                word-wrap: break-word;
            }

            /* Dark theme adjustments */
            [data-theme="dark"] .preview-backdrop {
                background: rgba(0, 0, 0, 0.8);
            }

            [data-theme="dark"] .preview-caption {
                background: rgba(255, 255, 255, 0.1);
                color: #f1f5f9;
            }

            /* Hover-enabled images styling */
            .hover-preview-enabled {
                transition: transform 0.2s ease, opacity 0.2s ease;
                cursor: pointer;
            }

            .hover-preview-enabled:hover {
                transform: scale(1.05);
                opacity: 0.9;
            }
        `;

        document.head.appendChild(style);
    }

    setupGlobalImageHandlers() {
        // Use event delegation to handle all images
        document.addEventListener('mouseover', (e) => {
            if (this.shouldPreviewImage(e.target)) {
                this.handleImageHover(e.target, e);
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (this.shouldPreviewImage(e.target)) {
                this.handleImageLeave(e.target, e);
            }
        });

        // Handle image clicks to open in new tab
        document.addEventListener('click', (e) => {
            if (this.shouldPreviewImage(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                this.handleImageClick(e.target);
                return;
            }
            // Close preview when clicking anywhere else
            this.hidePreview();
        });

        // Close preview with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePreview();
            }
        });
    }

    shouldPreviewImage(element) {
        // Check if element is an image and should be previewed
        if (element.tagName !== 'IMG') return false;
        
        // Skip if already has preview disabled
        if (element.hasAttribute('data-no-hover-preview')) return false;
        
        // Skip very small images (likely icons)
        if (element.offsetWidth < 32 || element.offsetHeight < 32) return false;
        
        // Skip if image is already large (no need to preview)
        if (element.offsetWidth > 400 && element.offsetHeight > 400) return false;
        
        // Skip if image is in excluded containers
        const excludedSelectors = [
            '.leaflet-control',
            '.search-container',
            '.notification',
            '#version-info'
        ];
        
        for (const selector of excludedSelectors) {
            if (element.closest(selector)) return false;
        }
        
        return true;
    }

    handleImageHover(image, event) {
        // Clear any existing timeout
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
        }

        // Add hover styling
        image.classList.add('hover-preview-enabled');

        // Show preview after delay
        this.hoverTimeout = setTimeout(() => {
            this.showPreview(image);
        }, 500); // 500ms delay to prevent accidental triggers
    }

    handleImageLeave(image, event) {
        // Clear timeout
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }

        // Remove hover styling
        image.classList.remove('hover-preview-enabled');

        // Hide preview immediately
        this.hidePreview();
    }

    handleImageClick(image) {
        // Create a temporary link element to open image without switching tabs
        const link = document.createElement('a');
        link.href = image.src;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // Add the link to the document temporarily
        document.body.appendChild(link);
        
        // Override the default behavior to prevent tab switching
        const clickEvent = new MouseEvent('click', {
            ctrlKey: true,  // Ctrl+click behavior (background tab)
            bubbles: true,
            cancelable: true
        });
        
        link.dispatchEvent(clickEvent);
        
        // Clean up
        document.body.removeChild(link);
        
        // Hide any visible preview
        this.hidePreview();
        
        Logger.debug('🖼️ Image opened in background tab:', image.src);
    }

    showPreview(originalImage) {
        if (this.isPreviewVisible) return;

        const previewImage = this.previewElement.querySelector('.preview-image');
        const caption = this.previewElement.querySelector('.preview-caption');
        const container = this.previewElement.querySelector('.preview-container');

        // Set image source
        previewImage.src = originalImage.src;
        previewImage.alt = originalImage.alt || '';

        // Calculate optimal size - limit to 25% of viewport for small preview
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Set container to use 25% of viewport for both dimensions
        // The image will scale proportionally within these constraints
        container.style.maxWidth = `${viewportWidth * 0.25}px`;
        container.style.maxHeight = `${viewportHeight * 0.25}px`;

        // Set caption
        const captionText = originalImage.alt || 
                           originalImage.title || 
                           originalImage.getAttribute('data-caption') || 
                           '';
        
        if (captionText) {
            caption.textContent = captionText;
            caption.style.display = 'block';
        } else {
            caption.style.display = 'none';
        }

        // Show preview
        this.previewElement.style.display = 'flex';
        
        // Trigger animation
        requestAnimationFrame(() => {
            this.previewElement.classList.add('visible');
        });

        this.isPreviewVisible = true;
        Logger.debug('🖼️ Image preview shown');
    }

    hidePreview() {
        if (!this.isPreviewVisible) return;

        this.previewElement.classList.remove('visible');
        
        // Hide after animation
        setTimeout(() => {
            this.previewElement.style.display = 'none';
        }, 200);

        this.isPreviewVisible = false;
        Logger.debug('🖼️ Image preview hidden');
    }

    // Public methods for manual control
    enableForImage(image) {
        image.removeAttribute('data-no-hover-preview');
    }

    disableForImage(image) {
        image.setAttribute('data-no-hover-preview', 'true');
    }

    enableForContainer(container) {
        const images = container.querySelectorAll('img[data-no-hover-preview]');
        images.forEach(img => this.enableForImage(img));
    }

    disableForContainer(container) {
        const images = container.querySelectorAll('img');
        images.forEach(img => this.disableForImage(img));
    }

    // Cleanup method
    cleanup() {
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
        }
        
        if (this.previewElement && this.previewElement.parentNode) {
            this.previewElement.parentNode.removeChild(this.previewElement);
        }

        Logger.cleanup('Image hover preview cleaned up');
    }
}

// Create global instance
window.imageHoverPreview = new ImageHoverPreview();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (window.imageHoverPreview) {
            window.imageHoverPreview.cleanup();
        }
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageHoverPreview;
}
