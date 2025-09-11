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
        
        // Create subtle preview element (not full screen)
        this.createSubtlePreviewElement();
        this.setupGlobalImageHandlers();
        
        // Listen for enhanced popup events to hide hover preview
        if (window.imagePopupManager) {
            // If enhanced popup manager exists, listen for its events
            document.addEventListener('image-popup-opened', () => {
                this.hidePreview();
            });
        }
        
        this.isInitialized = true;
        Logger.loading('🖼️ Image hover preview system loaded (subtle mode)');
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

    createSubtlePreviewElement() {
        // Create a small popup next to the hovered image
        this.previewElement = document.createElement('div');
        this.previewElement.id = 'image-hover-preview';
        this.previewElement.className = 'subtle-image-popup';
        this.previewElement.innerHTML = `
            <img class="preview-image" src="" alt="">
            <div class="preview-info">
                <div class="preview-caption"></div>
                <div class="preview-credits"></div>
            </div>
        `;
        
        document.body.appendChild(this.previewElement);
        this.addSubtleStyles();
    }

    addSubtleStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .subtle-image-popup {
                position: fixed;
                z-index: 9999;
                pointer-events: none;
                opacity: 0;
                transform: scale(0.8);
                transition: opacity 0.3s ease, transform 0.3s ease;
                border-radius: 8px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                border: 3px solid var(--card-bg, #fff);
                background: var(--card-bg, #fff);
                padding: 4px;
                max-width: 300px;
                max-height: 400px;
                display: none;
            }

            .subtle-image-popup.show {
                opacity: 1;
                transform: scale(1);
                display: block;
            }

            .subtle-image-popup .preview-image {
                width: 100%;
                height: auto;
                border-radius: 4px;
                display: block;
                max-height: 350px;
                object-fit: cover;
            }

            .subtle-image-popup .preview-info {
                padding: 8px;
                background: var(--card-bg, #fff);
                border-radius: 0 0 4px 4px;
            }

            .subtle-image-popup .preview-caption {
                font-size: 12px;
                font-weight: 600;
                color: var(--text-color, #333);
                margin-bottom: 4px;
                line-height: 1.3;
            }

            .subtle-image-popup .preview-credits {
                font-size: 10px;
                color: var(--text-muted, #666);
                font-style: italic;
            }

            /* Dark theme support */
            [data-theme="dark"] .subtle-image-popup {
                border-color: var(--border-color, #444);
                background: var(--modal-bg, #2a2a2a);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
            }

            [data-theme="dark"] .subtle-image-popup .preview-info {
                background: var(--modal-bg, #2a2a2a);
            }

            [data-theme="dark"] .subtle-image-popup .preview-caption {
                color: var(--text-color, #f0f0f0);
            }

            [data-theme="dark"] .subtle-image-popup .preview-credits {
                color: var(--text-muted, #999);
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .subtle-image-popup {
                    max-width: 250px;
                    max-height: 350px;
                }
            }

            @media (max-width: 480px) {
                .subtle-image-popup {
                    max-width: 200px;
                    max-height: 300px;
                }
            }

            /* Enhanced hover effects for images */
            .hover-preview-enabled {
                transition: transform 0.2s ease, filter 0.2s ease;
                cursor: pointer;
            }

            .hover-preview-enabled:hover {
                transform: scale(1.05);
                filter: brightness(1.1);
            }
        `;

        document.head.appendChild(style);
    }

    setupGlobalImageHandlers() {
        // Use event delegation to handle all images with subtle previews
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

        // Keep the preview visible when hovering over the popup itself
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('.subtle-image-popup')) {
                // Clear the hide timeout when hovering over popup
                if (this.hoverTimeout) {
                    clearTimeout(this.hoverTimeout);
                    this.hoverTimeout = null;
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.subtle-image-popup')) {
                // Hide when leaving the popup
                this.hidePreview();
            }
        });

        // Close preview when clicking anywhere
        document.addEventListener('click', (e) => {
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
            this.showSubtlePreview(image, event);
        }, 300); // 300ms delay to prevent accidental triggers
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
        
        // Get metadata for the image
        const mediaMetadata = this.findImageMetadata(image.src);
        
        // Get caption text using the same logic as showPreview
        let captionText = '';
        if (mediaMetadata) {
            if (mediaMetadata.title) {
                captionText = mediaMetadata.title;
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
            captionText = this.generateEnhancedCaption(image);
        }
        
        // Get optimal image size for full view
        let fullViewImageUrl = image.src;
        if (mediaMetadata) {
            const fullViewSize = this.getOptimalImageSize(mediaMetadata, 'fullview');
            if (fullViewSize && fullViewSize.url) {
                fullViewImageUrl = fullViewSize.url;
            }
        }
        
        // Create HTML content for the new tab
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${captionText || 'Image Viewer'}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #ffffff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            box-sizing: border-box;
        }
        .image-container {
            max-width: 95vw;
            max-height: 80vh;
            margin-bottom: 20px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        .image-container img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }
        .metadata {
            max-width: 800px;
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .metadata h1 {
            margin: 0 0 15px 0;
            font-size: 1.8em;
            font-weight: 600;
            color: #ffffff;
        }
        .metadata .caption {
            margin: 0 0 15px 0;
            font-size: 1.1em;
            line-height: 1.5;
            color: #e0e0e0;
        }
        .metadata .credits {
            margin: 0;
            font-size: 0.9em;
            color: #b0b0b0;
            font-style: italic;
        }
        .metadata .section {
            margin-bottom: 10px;
        }
        .metadata .section:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
    <div class="image-container">
        <img src="${fullViewImageUrl}" alt="${image.alt || ''}" />
    </div>
    <div class="metadata">
        ${captionText ? `<h1>${captionText}</h1>` : ''}
        ${mediaMetadata && mediaMetadata.credits ? `<div class="section"><div class="credits">${mediaMetadata.credits}</div></div>` : ''}
    </div>
</body>
</html>`;
        
        // Open the HTML content in a new tab
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        }
        
        Logger.debug('🖼️ Image opened with metadata in new tab:', image.src);
    }

    showSubtlePreview(originalImage, event) {
        if (this.isPreviewVisible) return;

        const previewImage = this.previewElement.querySelector('.preview-image');
        const caption = this.previewElement.querySelector('.preview-caption');
        const credits = this.previewElement.querySelector('.preview-credits');

        // Get metadata from media library
        const mediaMetadata = this.findImageMetadata(originalImage.src);
        
        // Set optimal image source
        if (mediaMetadata) {
            const previewSize = this.getOptimalImageSize(mediaMetadata, 'popup');
            if (previewSize) {
                previewImage.src = previewSize.url;
            } else {
                previewImage.src = originalImage.src;
            }
        } else {
            previewImage.src = originalImage.src;
        }
        
        previewImage.alt = originalImage.alt || '';
        
        // Set caption (title or main description)
        let captionText = '';
        if (mediaMetadata) {
            if (mediaMetadata.title) {
                captionText = mediaMetadata.title;
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
            captionText = this.generateEnhancedCaption(originalImage);
        }
        
        if (captionText) {
            caption.textContent = captionText;
            caption.style.display = 'block';
        } else {
            caption.style.display = 'none';
        }

        // Set credits
        if (mediaMetadata && mediaMetadata.credits) {
            credits.textContent = mediaMetadata.credits;
            credits.style.display = 'block';
        } else {
            credits.textContent = 'Source: Adenai Campaign';
            credits.style.display = 'block';
        }

        // Position popup next to the original image
        this.positionPopupNearImage(originalImage);

        // Show popup
        this.previewElement.classList.add('show');
        this.isPreviewVisible = true;

        console.log('🖼️ Showing subtle image preview:', captionText || 'image');
    }

    positionPopupNearImage(image) {
        const rect = image.getBoundingClientRect();
        const popup = this.previewElement;
        const margin = 20;
        const popupWidth = 300; // max-width from CSS
        const popupHeight = 400; // estimated max-height
        
        let left = rect.right + margin;
        let top = rect.top;
        
        // Check if popup would go off the right edge
        if (left + popupWidth > window.innerWidth) {
            left = rect.left - popupWidth - margin;
        }
        
        // Check if popup would go off the bottom edge  
        if (top + popupHeight > window.innerHeight) {
            top = window.innerHeight - popupHeight - margin;
        }
        
        // Ensure popup doesn't go off the left or top edges
        left = Math.max(margin, left);
        top = Math.max(margin, top);
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    getOptimalImageSize(mediaMetadata, context = 'preview') {
        if (!mediaMetadata || !mediaMetadata.sizes) {
            return null;
        }

        const sizes = mediaMetadata.sizes;
        const screenWidth = window.innerWidth;
        
        switch (context) {
            case 'thumbnail':
                // For very small previews or loading states
                return sizes.thumbnail || sizes.small || sizes.medium;
                
            case 'preview':
                // For hover previews - balance quality and speed, responsive to screen size
                if (screenWidth < 768) {
                    return sizes.thumbnail || sizes.small || sizes.medium;
                } else {
                    return sizes.small || sizes.medium || sizes.thumbnail;
                }
                
            case 'popup':
                // For character popups - responsive quality
                if (screenWidth < 768) {
                    return sizes.small || sizes.medium || sizes.thumbnail;
                } else {
                    return sizes.medium || sizes.large || sizes.small;
                }
                
            case 'fullview':
                // For new tab full viewing - high quality, responsive
                if (screenWidth < 1024) {
                    return sizes.medium || sizes.large || sizes.small;
                } else {
                    return sizes.large || sizes.original || sizes.medium;
                }
                
            case 'original':
                // When original quality is needed
                return sizes.original || sizes.large || sizes.medium;
                
            default:
                return sizes.medium || sizes.small || sizes.large;
        }
    }

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
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

        this.previewElement.classList.remove('show');
        this.isPreviewVisible = false;
        
        console.log('🖼️ Image preview hidden');
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
