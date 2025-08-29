// data-utils.js - Data Processing and Validation Utilities

class DataUtils {
    // Coordinate validation
    static isValidCoordinate(coord) {
        return coord && 
               Array.isArray(coord) &&
               coord.length === 2 && 
               coord[0] !== null && 
               coord[1] !== null &&
               typeof coord[0] === 'number' && 
               typeof coord[1] === 'number' &&
               !isNaN(coord[0]) &&
               !isNaN(coord[1]);
    }

    static filterValidCoordinates(coordinates) {
        if (!Array.isArray(coordinates)) return [];
        return coordinates.filter(coord => this.isValidCoordinate(coord));
    }

    static validateCoordinatePath(coordinates, minLength = 2) {
        const validCoords = this.filterValidCoordinates(coordinates);
        return {
            valid: validCoords.length >= minLength,
            coordinates: validCoords,
            originalCount: coordinates.length,
            validCount: validCoords.length
        };
    }

    // Array utilities
    static groupBy(array, property) {
        return array.reduce((acc, item) => {
            const key = item[property] || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }

    static groupByFunction(array, keyFunction) {
        return array.reduce((acc, item) => {
            const key = keyFunction(item);
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});
    }

    // Object utilities
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static mergeDeep(target, source) {
        const output = Object.assign({}, target);
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target))
                        Object.assign(output, { [key]: source[key] });
                    else
                        output[key] = this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    static isObject(item) {
        return (item && typeof item === "object" && !Array.isArray(item));
    }

    // String utilities
    static sanitizeFilename(name) {
        return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    static matchesSearchQuery(item, query, searchFields = ['name', 'title', 'description']) {
        const lowerQuery = query.toLowerCase();
        return searchFields.some(field => {
            const value = item[field];
            return value && value.toString().toLowerCase().includes(lowerQuery);
        });
    }

    // Statistics utilities
    static calculateStats(array, property) {
        const values = array.map(item => item[property]).filter(val => val !== null && val !== undefined);
        if (values.length === 0) return { count: 0 };

        return {
            count: values.length,
            total: array.length,
            percentage: Math.round((values.length / array.length) * 100),
            unique: [...new Set(values)].length
        };
    }

    // Date utilities
    static formatDate(dateString) {
        if (!dateString) return 'Unknown';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (e) {
            return dateString;
        }
    }

    static isValidDate(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }
}

// Make available globally
window.DataUtils = DataUtils;

console.log('📊 Data utilities loaded successfully');
