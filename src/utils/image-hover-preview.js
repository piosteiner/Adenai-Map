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
        
        // Listen for enhanced popup events to hide hover preview
        if (window.imagePopupManager) {
            // If enhanced popup manager exists, listen for its events
            document.addEventListener('image-popup-opened', () => {
                this.hidePreview();
            });
        }
        
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
        
        // Add styles - ensure it doesn't conflict with enhanced popup (lower z-index)
        this.previewElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 998;
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
                transition: opacity 0.3s ease, visibility 0.3s ease;
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
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
            }

            .preview-container {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                z-index: 1;
                max-width: 90vw;
                max-height: 90vh;
            }

            .preview-image {
                max-width: 100%;
                max-height: 70vh;
                width: auto;
                height: auto;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                transform: scale(0.8);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            #image-hover-preview.visible .preview-image {
                transform: scale(1);
            }

            .preview-caption {
                position: absolute;
                bottom: -60px;
                left: 0;
                right: 0;
                background: rgba(255, 255, 255, 0.95);
                padding: 12px 16px;
                border-radius: 8px;
                color: #333;
                font-size: 14px;
                text-align: center;
                backdrop-filter: blur(10px);
                min-width: 200px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                font-weight: 500;
                line-height: 1.4;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }

            #image-hover-preview.visible .preview-caption {
                opacity: 1;
                transform: translateY(0);
            }

            /* Dark theme adjustments */
            [data-theme="dark"] .preview-backdrop {
                background: rgba(0, 0, 0, 0.9);
            }

            [data-theme="dark"] .preview-caption {
                background: rgba(30, 30, 30, 0.95);
                color: #f0f0f0;
            }

            /* Hover-enabled images styling */
            .hover-preview-enabled {
                transition: transform 0.2s ease, filter 0.2s ease;
                cursor: pointer;
            }

            .hover-preview-enabled:hover {
                transform: scale(1.05);
                filter: brightness(1.1);
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .preview-image {
                    max-height: 60vh;
                }
                
                .preview-caption {
                    bottom: -80px;
                    padding: 10px 12px;
                    font-size: 13px;
                    min-width: auto;
                    left: 10px;
                    right: 10px;
                }
            }

            @media (max-width: 480px) {
                .preview-image {
                    max-height: 50vh;
                }
                
                .preview-caption {
                    bottom: -100px;
                    padding: 8px 10px;
                    font-size: 12px;
                }
            }

            /* Hover instruction hint */
            #image-hover-preview::before {
                content: "Hover to preview • Click for full size";
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 11px;
                opacity: 0;
                animation: fadeInOut 3s ease-in-out;
                pointer-events: none;
            }

            @keyframes fadeInOut {
                0%, 100% { opacity: 0; }
                20%, 80% { opacity: 0.8; }
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
        // Hide hover preview immediately
        this.hidePreview();
        
        // Check if enhanced image popup manager is available
        if (window.imagePopupManager) {
            // Let the enhanced popup manager handle the click
            return; // Don't prevent default - let the enhanced popup handle it
        }
        
        // Fallback behavior: Create a temporary link element to open image
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

        // Extract enhanced caption information
        const captionText = this.generateEnhancedCaption(originalImage);
        
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
        Logger.debug('🖼️ Enhanced image preview shown');
    }

    generateEnhancedCaption(image) {
        // Check if image is in a character popup
        const popup = image.closest('.character-popup') || 
                     image.closest('.leaflet-popup-content') || 
                     image.closest('.panel-anchored-popup');
        
        if (popup) {
            // Extract character information
            const titleElement = popup.querySelector('.popup-title') || 
                               popup.querySelector('h3') ||
                               popup.querySelector('.character-popup-title');
            
            const title = titleElement ? titleElement.textContent.trim() : '';
            
            if (title) {
                // Parse additional info from popup
                const content = popup.textContent;
                let location = '';
                
                // Extract location info
                const locationMatch = content.match(/(?:Last Seen|Aktueller Ort|Current Location):\s*([^\n\(]+)/i);
                if (locationMatch) {
                    location = locationMatch[1].trim();
                }
                
                // Generate enhanced caption
                let caption = `Portrait of ${title}`;
                if (location && location !== '❓ Unbekannt' && location !== 'Unknown') {
                    caption += ` - Last seen in ${location}`;
                }
                
                return caption;
            }
        }
        
        // Fall back to original caption methods
        return image.alt || 
               image.title || 
               image.getAttribute('data-caption') || 
               'Character Portrait';
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
