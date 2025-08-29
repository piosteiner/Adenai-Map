// popup-utils.js - Unified popup creation utilities

/**
 * Popup Utilities for the Unified Popup System
 * 
 * This module provides utilities to create consistent popups across the application.
 * All popup types use the same base styling and structure for consistency.
 */

class PopupUtils {
    
    /**
     * Create a Leaflet popup with unified styling
     * @param {string} type - Type of popup ('character', 'location', 'movement', 'panel')
     * @param {Object} options - Additional popup options
     * @returns {L.Popup} Configured Leaflet popup
     */
    static createLeafletPopup(type, options = {}) {
        const defaultOptions = {
            closeButton: true,
            autoClose: false,
            closeOnClick: false,
            closeOnEscapeKey: true,
            autoPan: false,
            keepInView: true,
            offset: [0, -25]
        };

        // Merge options with defaults
        const popupOptions = { ...defaultOptions, ...options };

        // Set appropriate CSS class based on type
        switch (type) {
            case 'character':
                popupOptions.className = 'character-focus-popup';
                popupOptions.maxWidth = 350;
                break;
            case 'location':
                popupOptions.className = 'custom-popup';
                popupOptions.maxWidth = 400;
                break;
            case 'movement':
                popupOptions.className = 'movement-detail-popup';
                popupOptions.maxWidth = 300;
                break;
            default:
                popupOptions.className = 'character-focus-popup';
                popupOptions.maxWidth = 350;
        }

        return L.popup(popupOptions);
    }

    /**
     * Create a panel-anchored popup element with unified styling
     * @param {string} title - Popup title
     * @param {string} content - Popup content HTML
     * @returns {HTMLElement} Configured popup element
     */
    static createPanelPopup(title, content) {
        const popup = document.createElement('div');
        popup.className = 'panel-anchored-popup';
        popup.innerHTML = `
            <div class="panel-popup-header">
                <h3>${title}</h3>
                <button class="panel-popup-close" onclick="window.characterSystem?.closePanelAnchoredPopup?.()">×</button>
            </div>
            <div class="panel-popup-content">
                ${content}
            </div>
        `;
        return popup;
    }

    /**
     * Wrap content in unified popup content structure
     * @param {string} content - The main content HTML
     * @param {string} wrapperClass - Optional wrapper class (defaults to 'character-popup')
     * @returns {string} Wrapped HTML content
     */
    static wrapContent(content, wrapperClass = 'character-popup') {
        return `<div class="${wrapperClass}">${content}</div>`;
    }

    /**
     * Create a unified popup title
     * @param {string} title - Title text
     * @param {string} color - Optional title color
     * @returns {string} Title HTML
     */
    static createTitle(title, color = '#6366f1') {
        return `<div class="popup-title" style="color: ${color}; margin-bottom: 8px;">${title}</div>`;
    }

    /**
     * Create a character popup content section
     * @param {string} type - Section type (faction, notes, description, etc.)
     * @param {string} icon - Emoji icon
     * @param {string} label - Section label
     * @param {string} content - Section content
     * @returns {string} Section HTML
     */
    static createContentSection(type, icon, label, content) {
        return `<div class="character-popup-${type}"><strong>${icon} ${label}:</strong> ${content}</div>`;
    }

    /**
     * Create a character header info section
     * @param {Object} character - Character data
     * @returns {string} Header HTML
     */
    static createCharacterHeader(character) {
        const image = character.image ? 
            `<img src="${character.image}" alt="${character.name}" class="character-popup-avatar">` : '';
        
        const title = character.title ? 
            `<div class="character-popup-title">${character.title}</div>` : '';

        const statusEmoji = this.getStatusEmoji(character.status);
        const statusLabel = character.status || 'unknown';
        const relationship = character.relationship || 'neutral';

        return `
            <div class="character-popup-header-info">
                ${image}
                <div class="character-popup-details">
                    ${title}
                    <div class="character-popup-status">
                        ${statusEmoji} <strong>Status:</strong> ${statusLabel}
                    </div>
                    <div class="character-popup-relationship relationship-${relationship}">
                        <strong>Relationship:</strong> ${relationship}
                    </div>
                    <div class="character-popup-location">
                        📍 <strong>Last Seen:</strong> ${character.location || '<span class="location-unknown">Unknown</span>'}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get status emoji for character
     * @param {string} status - Character status
     * @returns {string} Status emoji
     */
    static getStatusEmoji(status) {
        const statusEmojis = {
            alive: '✅',
            dead: '💀',
            missing: '❓',
            unconscious: '😵',
            injured: '🤕',
            unknown: '🤷'
        };
        return statusEmojis[status] || '🤷';
    }

    /**
     * Position a popup element next to the character panel
     * @param {HTMLElement} popup - Popup element to position
     * @param {number} topOffset - Top position offset (default: 30)
     */
    static positionPanelPopup(popup, topOffset = 30) {
        const panel = document.getElementById('character-panel');
        if (!panel) return;

        popup.style.position = 'fixed';
        popup.style.right = (panel.offsetWidth + 20) + 'px';
        popup.style.top = topOffset + 'px';
        popup.style.zIndex = '10001';
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopupUtils;
}

// Make available globally
window.PopupUtils = PopupUtils;
