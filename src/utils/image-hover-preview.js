// image-hover-preview.js - Image Hover Preview System
// Enlarges images on hover with smooth animations

class ImageHoverPreview {
    constructor() {
        this.previewElement = null;
        this.isPreviewVisible = false;
        this.hoverTimeout = null;
        this.mediaLibrary = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        // Load media library first
        await this.loadMediaLibrary();
        
        this.createPreviewElement();
        this.setupGlobalImageHandlers();
        
        // Listen for enhanced popup events to hide hover preview
        if (window.imagePopupManager) {
            // If enhanced popup manager exists, listen for its events
            document.addEventListener('image-popup-opened', () => {
                this.hidePreview();
            });
        }
        
        this.isInitialized = true;
        Logger.loading('🖼️ Image hover preview system loaded');
    }

    async loadMediaLibrary() {
        try {
            console.log('📚 Loading media library for hover preview...');
            const response = await fetch('/public/data/media-library.json');
            if (response.ok) {
                const data = await response.json();
                this.mediaLibrary = data;
                console.log('✅ Media library loaded for hover preview:', Object.keys(data.images || {}).length, 'images');
                
                // Debug: Log first few entries
                const firstKeys = Object.keys(data.images || {}).slice(0, 3);
                firstKeys.forEach(key => {
                    const img = data.images[key];
                    console.log(`📋 Sample image "${key}":`, {
                        title: img.title,
                        caption: img.caption,
                        credits: img.credits,
                        tags: img.tags
                    });
                });
            } else {
                console.warn('⚠️ Could not load media library for hover preview - Response:', response.status);
            }
        } catch (error) {
            console.warn('⚠️ Error loading media library for hover preview:', error);
        }
    }

    findImageMetadata(imageSrc) {
        console.log('🔍 Looking for metadata for image:', imageSrc);
        
        if (!this.mediaLibrary || !this.mediaLibrary.images) {
            console.warn('📚 No media library available');
            return null;
        }

        // Extract filename from URL
        const filename = imageSrc.split('/').pop().split('?')[0];
        console.log('📄 Extracted filename:', filename);

        // Try to find the image in the media library by URL first
        for (const [id, imageData] of Object.entries(this.mediaLibrary.images)) {
            if (imageData.sizes) {
                // Check all size variants
                for (const [sizeKey, sizeData] of Object.entries(imageData.sizes)) {
                    console.log(`🔍 Comparing "${imageSrc}" with "${sizeData.url}"`);
                    console.log(`📄 Also checking if src includes filename "${sizeData.filename}"`);
                    
                    if (sizeData.url === imageSrc) {
                        console.log('✅ Found EXACT URL match for:', id, 'in size:', sizeKey);
                        return {
                            id: id,
                            title: imageData.title || imageData.caption || 'Untitled',
                            caption: imageData.caption || '',
                            credits: imageData.credits || '',
                            tags: imageData.tags || [],
                            uploadDate: imageData.uploadDate,
                            category: imageData.category,
                            ...imageData
                        };
                    }
                    
                    if (imageSrc.includes(sizeData.filename)) {
                        console.log('✅ Found filename match for:', id, 'in size:', sizeKey);
                        return {
                            id: id,
                            title: imageData.title || imageData.caption || 'Untitled',
                            caption: imageData.caption || '',
                            credits: imageData.credits || '',
                            tags: imageData.tags || [],
                            uploadDate: imageData.uploadDate,
                            category: imageData.category,
                            ...imageData
                        };
                    }
                }
            }
        }

        // If no exact match, try filename matching with ID extraction
        console.log('🔍 No exact match, trying filename patterns...');
        
        // Extract the base ID from filename (e.g., "6jugrtuo6jq5" from "6jugrtuo6jq5-medium.webp")
        const baseId = filename.replace(/-(thumb|small|medium|large|original)\.(webp|jpg|jpeg|png)$/, '');
        console.log('🆔 Extracted base ID:', baseId);
        
        for (const [id, imageData] of Object.entries(this.mediaLibrary.images)) {
            // Check if the ID contains the base ID
            if (id.includes(baseId) || baseId === id) {
                console.log('✅ Found ID match for:', id);
                return {
                    id: id,
                    title: imageData.title || imageData.caption || 'Untitled',
                    caption: imageData.caption || '',
                    credits: imageData.credits || '',
                    tags: imageData.tags || [],
                    uploadDate: imageData.uploadDate,
                    category: imageData.category,
                    ...imageData
                };
            }
        }

        console.warn('❌ No metadata found for image:', imageSrc, 'with filename:', filename, 'and base ID:', baseId);
        return null;
    }

    createPreviewElement() {
        // Create the preview overlay element
        this.previewElement = document.createElement('div');
        this.previewElement.id = 'image-hover-preview';
        this.previewElement.innerHTML = `
            <div class="preview-backdrop"></div>
            <div class="preview-container">
                <img class="preview-image" src="" alt="">
                <div class="preview-info">
                    <div class="preview-caption"></div>
                    <div class="preview-tags"></div>
                    <div class="preview-credits"></div>
                </div>
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
                background: rgba(255, 255, 255, 0.95);
                padding: 8px 12px;
                border-radius: 6px 6px 0 0;
                color: #333;
                font-size: 13px;
                font-weight: 500;
                line-height: 1.3;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                backdrop-filter: blur(10px);
                text-shadow: none;
                margin: 0;
            }

            .preview-info {
                position: absolute;
                bottom: -120px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.95);
                border-radius: 8px;
                color: #333;
                max-width: 400px;
                min-width: 280px;
                backdrop-filter: blur(10px);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(0, 0, 0, 0.1);
            }

            .preview-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px 12px;
                margin: 0;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            }

            .preview-tag {
                background: rgba(99, 102, 241, 0.1);
                color: #4f46e5;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 500;
                border: 1px solid rgba(99, 102, 241, 0.2);
            }

            .preview-credits {
                padding: 6px 12px;
                font-size: 11px;
                color: #666;
                font-style: italic;
                margin: 0;
            }
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
                border-bottom-color: rgba(255, 255, 255, 0.1);
            }

            [data-theme="dark"] .preview-info {
                background: rgba(30, 30, 30, 0.95);
                color: #f0f0f0;
                border-color: rgba(255, 255, 255, 0.1);
            }

            [data-theme="dark"] .preview-tag {
                background: rgba(139, 92, 246, 0.2);
                color: #a78bfa;
                border-color: rgba(139, 92, 246, 0.3);
            }

            [data-theme="dark"] .preview-credits {
                color: #999;
                border-top-color: rgba(255, 255, 255, 0.1);
            }

            [data-theme="dark"] .preview-tags {
                border-bottom-color: rgba(255, 255, 255, 0.1);
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
        // Don't show preview if system isn't fully initialized
        if (!this.isInitialized || !this.mediaLibrary) {
            console.log('⏳ System not ready for hover preview, waiting...');
            return;
        }

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
        
        // Always open image in background tab (don't use enhanced popup)
        // Create a temporary link element to open image
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

        console.log('🖼️ showPreview called for image:', originalImage.src);
        console.log('📚 Media library status:', this.mediaLibrary ? 'loaded' : 'not loaded');
        console.log('🔧 System initialized:', this.isInitialized);

        const previewImage = this.previewElement.querySelector('.preview-image');
        const caption = this.previewElement.querySelector('.preview-caption');
        const tags = this.previewElement.querySelector('.preview-tags');
        const credits = this.previewElement.querySelector('.preview-credits');
        const container = this.previewElement.querySelector('.preview-container');

        // Set image source
        previewImage.src = originalImage.src;
        previewImage.alt = originalImage.alt || '';

        // Get metadata from media library
        const mediaMetadata = this.findImageMetadata(originalImage.src);
        console.log('📋 Media metadata found:', mediaMetadata);
        
        // Set caption (title or main description)
        let captionText = '';
        if (mediaMetadata) {
            console.log('✅ Using media metadata for caption');
            // Use title as the main caption, but add caption if it's different
            if (mediaMetadata.title) {
                captionText = mediaMetadata.title;
                // If caption exists and is different from title, add it
                if (mediaMetadata.caption && 
                    mediaMetadata.caption !== mediaMetadata.title && 
                    mediaMetadata.caption.toLowerCase() !== mediaMetadata.title.toLowerCase()) {
                    captionText += ` - ${mediaMetadata.caption}`;
                }
            } else if (mediaMetadata.caption) {
                captionText = mediaMetadata.caption;
            }
        }
        
        if (!captionText) {
            console.log('⚠️ No media metadata, falling back to character extraction');
            // Fallback to character extraction
            captionText = this.generateEnhancedCaption(originalImage);
        }
        
        console.log('📝 Final caption text:', captionText);
        
        if (captionText) {
            caption.textContent = captionText;
            caption.style.display = 'block';
        } else {
            caption.style.display = 'none';
        }

        // Set tags
        tags.innerHTML = '';
        if (mediaMetadata && mediaMetadata.tags && mediaMetadata.tags.length > 0) {
            console.log('🏷️ Adding tags:', mediaMetadata.tags);
            mediaMetadata.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'preview-tag';
                tagElement.textContent = tag;
                tags.appendChild(tagElement);
            });
            tags.style.display = 'flex';
        } else {
            console.log('📝 No tags to display');
            tags.style.display = 'none';
        }

        // Set credits - ALWAYS show if available
        if (mediaMetadata && mediaMetadata.credits) {
            console.log('💳 Using media credits:', mediaMetadata.credits);
            credits.textContent = mediaMetadata.credits;
            credits.style.display = 'block';
        } else {
            console.log('💳 Using fallback credits');
            // Fallback credits for images without metadata
            credits.textContent = 'Source: Adenai Campaign';
            credits.style.display = 'block';
        }

        // Debug: Check if elements are properly created
        console.log('🔍 Debug element check:');
        console.log('- Caption element:', caption, 'display:', caption?.style.display, 'text:', caption?.textContent);
        console.log('- Tags element:', tags, 'display:', tags?.style.display, 'children:', tags?.children.length);
        console.log('- Credits element:', credits, 'display:', credits?.style.display, 'text:', credits?.textContent);

        // Show preview
        this.previewElement.style.display = 'flex';
        
        // Trigger animation
        requestAnimationFrame(() => {
            this.previewElement.classList.add('visible');
        });

        this.isPreviewVisible = true;
        console.log('🎯 Preview shown with metadata:', !!mediaMetadata);
    }

    generateEnhancedCaption(image) {
        // This method now serves as fallback for character popup extraction
        // when media library metadata is not available
        
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
