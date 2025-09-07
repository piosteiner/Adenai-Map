// Enhanced Image Popup System - Based on CMS Design
// Provides beautiful full-screen image popups with metadata

class ImagePopupManager {
    constructor() {
        this.currentPopup = null;
        this.isInitialized = false;
        this.mediaLibrary = null;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        // Load media library first
        await this.loadMediaLibrary();
        
        // Create popup container
        this.createPopupContainer();
        
        // Set up event listeners
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('✅ Enhanced Image Popup System initialized');
    }

    async loadMediaLibrary() {
        try {
            console.log('📚 Loading media library for popup manager...');
            const response = await fetch('/public/data/media-library.json');
            if (response.ok) {
                const data = await response.json();
                this.mediaLibrary = data;
                console.log('✅ Media library loaded for popup manager:', Object.keys(data.images || {}).length, 'images');
            } else {
                console.warn('⚠️ Could not load media library for popup manager - Response:', response.status);
            }
        } catch (error) {
            console.warn('⚠️ Error loading media library for popup manager:', error);
        }
    }

    findImageMetadata(imageSrc) {
        if (!this.mediaLibrary || !this.mediaLibrary.images) {
            return null;
        }

        // Extract filename from URL
        const filename = imageSrc.split('/').pop().split('?')[0];

        // Try to find the image in the media library by URL first
        for (const [id, imageData] of Object.entries(this.mediaLibrary.images)) {
            if (imageData.sizes) {
                // Check all size variants
                for (const [sizeKey, sizeData] of Object.entries(imageData.sizes)) {
                    if (sizeData.url === imageSrc || imageSrc.includes(sizeData.filename)) {
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
        // Extract the base ID from filename (e.g., "6jugrtuo6jq5" from "6jugrtuo6jq5-medium.webp")
        const baseId = filename.replace(/-(thumb|small|medium|large|original)\.(webp|jpg|jpeg|png)$/, '');
        
        for (const [id, imageData] of Object.entries(this.mediaLibrary.images)) {
            // Check if the ID contains the base ID
            if (id.includes(baseId) || baseId === id) {
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

        return null;
    }

    createPopupContainer() {
        const overlay = document.createElement('div');
        overlay.className = 'image-popup-overlay';
        overlay.id = 'imagePopupOverlay';
        
        overlay.innerHTML = `
            <div class="image-popup-content">
                <button class="image-popup-close" onclick="window.imagePopupManager.closePopup()">×</button>
                <img class="image-popup-image" src="" alt="">
                <div class="image-popup-info">
                    <div class="image-popup-title"></div>
                    <div class="image-popup-character-info"></div>
                    <div class="image-popup-caption"></div>
                    <div class="image-popup-tags"></div>
                    <div class="image-popup-credits"></div>
                    <div class="image-popup-metadata"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    setupEventListeners() {
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentPopup) {
                this.closePopup();
            }
        });

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closePopup();
            }
        });

        // Enhance existing character images
        this.enhanceCharacterImages();
    }

    enhanceCharacterImages() {
        // Find all character images in popups and make them clickable
        document.addEventListener('click', (e) => {
            const img = e.target;
            
            // Check if it's a character image in a popup
            if (img.tagName === 'IMG' && 
                (img.closest('.character-popup') || 
                 img.closest('.leaflet-popup-content') ||
                 img.classList.contains('character-popup-avatar'))) {
                
                e.preventDefault();
                e.stopPropagation();
                
                // Extract character data
                const characterData = this.extractCharacterData(img);
                this.showImagePopup(img.src, characterData);
            }
        });
    }

    extractCharacterData(img) {
        const popup = img.closest('.character-popup') || 
                     img.closest('.leaflet-popup-content') || 
                     img.closest('.panel-anchored-popup');
        
        if (!popup) return {};

        // Try to extract character information from the popup
        const titleElement = popup.querySelector('.popup-title') || 
                           popup.querySelector('h3') ||
                           popup.querySelector('.character-popup-title');
        
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        // Extract other information
        const content = popup.textContent;
        let location = '';
        let status = '';
        let faction = '';
        
        // Parse location info
        const locationMatch = content.match(/(?:Last Seen|Aktueller Ort|Current Location):\s*([^\n]+)/i);
        if (locationMatch) {
            location = locationMatch[1].trim().replace(/\([^)]*\)/, '').trim();
        }
        
        // Parse status info
        const statusMatch = content.match(/(?:Status|alive|dead|unknown)/i);
        if (statusMatch) {
            status = statusMatch[0];
        }
        
        // Parse faction info
        const factionMatch = content.match(/(?:Fraktion|Faction):\s*([^\n]+)/i);
        if (factionMatch) {
            faction = factionMatch[1].trim();
        }

        return {
            title: title,
            location: location,
            status: status,
            faction: faction,
            caption: this.generateCaption(title, location, status),
            credits: 'Portrait from Adenai Campaign'
        };
    }

    generateCaption(title, location, status) {
        let caption = '';
        if (title) {
            caption = `Portrait of ${title}`;
            if (location && location !== '❓ Unbekannt' && location !== 'Unknown') {
                caption += ` - Last seen in ${location}`;
            }
            if (status && status !== 'unknown') {
                caption += ` (${status})`;
            }
        }
        return caption;
    }

    showImagePopup(imageSrc, data = {}) {
        if (!this.overlay) return;

        // First, try to get metadata from media library
        const mediaMetadata = this.findImageMetadata(imageSrc);
        
        // Merge character data with media metadata, prioritizing media metadata
        const combinedData = {
            ...data, // Character data from popup
            ...(mediaMetadata || {}) // Media library metadata (takes priority)
        };

        const image = this.overlay.querySelector('.image-popup-image');
        const title = this.overlay.querySelector('.image-popup-title');
        const characterInfo = this.overlay.querySelector('.image-popup-character-info');
        const caption = this.overlay.querySelector('.image-popup-caption');
        const credits = this.overlay.querySelector('.image-popup-credits');
        const tags = this.overlay.querySelector('.image-popup-tags');
        const metadata = this.overlay.querySelector('.image-popup-metadata');

        // Set image
        image.src = imageSrc;
        image.alt = combinedData.title || 'Image';

        // Set title - prefer media library title, fallback to character name
        title.textContent = combinedData.title || data.title || 'Untitled';

        // Set character info badges (only for character data)
        characterInfo.innerHTML = '';
        if (data.location && data.location !== '❓ Unbekannt' && data.location !== 'Unknown') {
            const locationBadge = document.createElement('span');
            locationBadge.className = 'image-popup-location';
            locationBadge.textContent = `📍 ${data.location}`;
            characterInfo.appendChild(locationBadge);
        }
        
        if (data.status && data.status !== 'unknown') {
            const statusBadge = document.createElement('span');
            statusBadge.className = 'image-popup-status';
            statusBadge.textContent = `${this.getStatusEmoji(data.status)} ${this.formatStatus(data.status)}`;
            characterInfo.appendChild(statusBadge);
        }

        // Set caption - prefer media library caption, fallback to generated caption
        caption.textContent = combinedData.caption || data.caption || '';

        // Set tags - HIDE THEM (user doesn't want tags shown)
        tags.innerHTML = '';
        tags.style.display = 'none';

        // Set credits
        credits.textContent = combinedData.credits || 'Source: Adenai Campaign';

        // Set metadata
        metadata.innerHTML = '';
        if (combinedData.category) {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'image-popup-metadata-item';
            categoryItem.innerHTML = `
                <span class="image-popup-metadata-label">Category:</span>
                <span class="image-popup-metadata-value">${combinedData.category}</span>
            `;
            metadata.appendChild(categoryItem);
        }

        if (combinedData.uploadDate) {
            const dateItem = document.createElement('div');
            dateItem.className = 'image-popup-metadata-item';
            const uploadDate = new Date(combinedData.uploadDate).toLocaleDateString();
            dateItem.innerHTML = `
                <span class="image-popup-metadata-label">Added:</span>
                <span class="image-popup-upload-date">${uploadDate}</span>
            `;
            metadata.appendChild(dateItem);
        }

        // Show popup
        this.overlay.classList.add('active');
        this.currentPopup = combinedData;
        
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';

        // Dispatch event for other systems
        document.dispatchEvent(new CustomEvent('image-popup-opened', { detail: combinedData }));

        console.log('🖼️ Showing enhanced image popup:', combinedData.title || 'image', mediaMetadata ? '(with metadata)' : '(character data only)');
    }

    closePopup() {
        if (!this.overlay || !this.currentPopup) return;

        this.overlay.classList.remove('active');
        this.currentPopup = null;
        
        // Restore body scrolling
        document.body.style.overflow = '';

        console.log('❌ Closed image popup');
    }

    getStatusEmoji(status) {
        const statusEmojis = {
            'alive': '💚',
            'dead': '💀',
            'unknown': '❓',
            'missing': '❓',
            'injured': '🤕'
        };
        return statusEmojis[status.toLowerCase()] || '❓';
    }

    formatStatus(status) {
        const statusLabels = {
            'alive': 'Alive',
            'dead': 'Dead',
            'unknown': 'Unknown',
            'missing': 'Missing',
            'injured': 'Injured'
        };
        return statusLabels[status.toLowerCase()] || status;
    }

    // Method to show popup with custom data (for future use)
    showCustomImagePopup(imageSrc, title, caption, credits, additionalData = {}) {
        const data = {
            title: title,
            caption: caption,
            credits: credits,
            ...additionalData
        };
        this.showImagePopup(imageSrc, data);
    }

    // Method to enhance location images (for future expansion)
    enhanceLocationImages() {
        document.addEventListener('click', (e) => {
            const img = e.target;
            
            if (img.tagName === 'IMG' && img.classList.contains('popup-location-image')) {
                e.preventDefault();
                e.stopPropagation();
                
                const locationData = {
                    title: img.alt || 'Location Image',
                    caption: `View of ${img.alt || 'this location'}`,
                    credits: 'Adenai Campaign - Location Reference'
                };
                
                this.showImagePopup(img.src, locationData);
            }
        });
    }
}

// Initialize the image popup manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.imagePopupManager = new ImagePopupManager();
});

// Also initialize if DOM is already loaded
if (document.readyState !== 'loading') {
    window.imagePopupManager = new ImagePopupManager();
}
