// Enhanced Image Popup System - Based on CMS Design
// Provides beautiful full-screen image popups with metadata

class ImagePopupManager {
    constructor() {
        this.currentPopup = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // Create popup container
        this.createPopupContainer();
        
        // Set up event listeners
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('✅ Enhanced Image Popup System initialized');
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
                    <div class="image-popup-credits"></div>
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

        const image = this.overlay.querySelector('.image-popup-image');
        const title = this.overlay.querySelector('.image-popup-title');
        const characterInfo = this.overlay.querySelector('.image-popup-character-info');
        const caption = this.overlay.querySelector('.image-popup-caption');
        const credits = this.overlay.querySelector('.image-popup-credits');

        // Set image
        image.src = imageSrc;
        image.alt = data.title || 'Character Portrait';

        // Set title
        title.textContent = data.title || 'Character Portrait';

        // Set character info badges
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

        // Set caption
        caption.textContent = data.caption || '';

        // Set credits
        credits.textContent = data.credits || 'Source: Adenai Campaign';

        // Show popup
        this.overlay.classList.add('active');
        this.currentPopup = data;
        
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';

        console.log('🖼️ Showing enhanced image popup for:', data.title || 'character');
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
