// coordinate-utils.js - Centralized Coordinate Management
// Consolidates coordinate validation, formatting, and conversion utilities

class CoordinateUtils {
    // Format coordinates for display
    static formatCoordinates(coords, precision = 0) {
        if (!DataUtils.isValidCoordinate(coords)) {
            return 'Invalid coordinates';
        }
        // Format as requested: x-coordinate y-coordinate
        const x = Math.round(coords[0]);
        const y = Math.round(coords[1]);
        return `${x} ${y}`;
    }
    
    // Copy coordinates to clipboard with user feedback
    static async copyToClipboard(coords) {
        if (!DataUtils.isValidCoordinate(coords)) {
            NotificationUtils.showError('Invalid coordinates to copy');
            return false;
        }
        
        const coordString = this.formatCoordinates(coords);
        
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(coordString);
                NotificationUtils.showCopySuccess(coordString);
                Logger.success('Copied coordinates:', coordString);
                return true;
            } else {
                // Fallback for older browsers
                return this.fallbackCopyToClipboard(coordString);
            }
        } catch (error) {
            Logger.error('Failed to copy coordinates:', error);
            NotificationUtils.showCopyError();
            return false;
        }
    }
    
    // Fallback clipboard method for older browsers
    static fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                NotificationUtils.showCopySuccess(text);
                Logger.success('Copied coordinates (fallback):', text);
                return true;
            } else {
                throw new Error('Fallback copy failed');
            }
        } catch (error) {
            Logger.error('Fallback copy failed:', error);
            NotificationUtils.showCopyError();
            return false;
        }
    }
    
    // Get coordinate from event (mouse or touch)
    static getCoordinateFromEvent(event, map) {
        if (!map) {
            Logger.error('Map not available for coordinate extraction');
            return null;
        }
        
        try {
            const latLng = map.mouseEventToLatLng(event);
            return [latLng.lat, latLng.lng];
        } catch (error) {
            Logger.error('Failed to extract coordinates from event:', error);
            return null;
        }
    }
    
    // Calculate zoom level for coordinate bounds
    static calculateOptimalZoom(coords, map, padding = 0.1) {
        if (!DataUtils.isValidCoordinate(coords) || !map) {
            return 16; // Default zoom
        }
        
        // For single coordinate, return a good zoom level
        return 16;
    }
    
    // Calculate bounds for multiple coordinates
    static calculateBounds(coordsArray) {
        const validCoords = DataUtils.filterValidCoordinates(coordsArray);
        
        if (validCoords.length === 0) {
            return null;
        }
        
        if (validCoords.length === 1) {
            const coord = validCoords[0];
            return {
                north: coord[0] + 0.01,
                south: coord[0] - 0.01,
                east: coord[1] + 0.01,
                west: coord[1] - 0.01
            };
        }
        
        const lats = validCoords.map(c => c[0]);
        const lngs = validCoords.map(c => c[1]);
        
        return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
        };
    }
    
    // Calculate center point of coordinates
    static calculateCenter(coordsArray) {
        const validCoords = DataUtils.filterValidCoordinates(coordsArray);
        
        if (validCoords.length === 0) {
            return null;
        }
        
        if (validCoords.length === 1) {
            return validCoords[0];
        }
        
        const sumLat = validCoords.reduce((sum, coord) => sum + coord[0], 0);
        const sumLng = validCoords.reduce((sum, coord) => sum + coord[1], 0);
        
        return [sumLat / validCoords.length, sumLng / validCoords.length];
    }
    
    // Distance calculation between two coordinates (Haversine formula)
    static calculateDistance(coord1, coord2, unit = 'km') {
        if (!DataUtils.isValidCoordinate(coord1) || !DataUtils.isValidCoordinate(coord2)) {
            return null;
        }
        
        const R = unit === 'km' ? 6371 : 3959; // Earth's radius in km or miles
        const dLat = this.toRadians(coord2[0] - coord1[0]);
        const dLng = this.toRadians(coord2[1] - coord1[1]);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(coord1[0])) * Math.cos(this.toRadians(coord2[0])) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return parseFloat(distance.toFixed(2));
    }
    
    // Convert degrees to radians
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    // Parse coordinate string into array
    static parseCoordinateString(coordString) {
        if (!coordString || typeof coordString !== 'string') {
            return null;
        }
        
        // Support various formats: "lat lng", "lat,lng", "[lat,lng]"
        const cleaned = coordString.replace(/[\[\]]/g, '').trim();
        const parts = cleaned.split(/[,\s]+/).map(parseFloat);
        
        if (parts.length === 2 && parts.every(num => !isNaN(num))) {
            return parts;
        }
        
        return null;
    }
    
    // Validate and clean coordinate array
    static validateAndCleanPath(coordinates, minLength = 2) {
        return DataUtils.validateCoordinatePath(coordinates, minLength);
    }
}

Logger.loading('📍 Coordinate utilities loaded successfully');
