// map-utils.js - Centralized Map Access Utilities

class MapUtils {
    static getMap() {
        return window.mapCore?.getMap?.() || null;
    }

    static isMapAvailable() {
        const map = this.getMap();
        return map && typeof map.addLayer === 'function';
    }

    static withMap(callback, errorMessage = 'Map not available') {
        const map = this.getMap();
        if (!map) {
            Logger.error(errorMessage);
            return false;
        }
        return callback(map);
    }

    static addToMap(layer) {
        return this.withMap(map => {
            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
                return true;
            }
            return false;
        }, 'Cannot add layer to map');
    }

    static removeFromMap(layer) {
        return this.withMap(map => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
                return true;
            }
            return false;
        }, 'Cannot remove layer from map');
    }

    static toggleLayerOnMap(layer) {
        return this.withMap(map => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
                return false; // removed
            } else {
                map.addLayer(layer);
                return true; // added
            }
        }, 'Cannot toggle layer on map');
    }
}

// Make available globally
window.MapUtils = MapUtils;

Logger.loading('🗺️ Map utilities loaded successfully');
