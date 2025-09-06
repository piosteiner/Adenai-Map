// js/config.js - Shared configuration for Adenai campaign
// Auto-synced from admin CMS - DO NOT EDIT MANUALLY  
// Last updated: 2025-08-26T16:28:03.574Z
// This file provides consistent labels and values across the entire campaign

const AdenaiConfig = {
    // Location Types - both value and display format
    locationTypes: {
        city: { value: 'city', label: '🏙️ Stadt' },
        town: { value: 'town', label: '🏘️ Dorf' },
        village: { value: 'village', label: '🏡 Weiler' },
        camp: { value: 'camp', label: '⛺ Lager' },
        landmark: { value: 'landmark', label: '🗿 Orientierungspunkt' },
        ruin: { value: 'ruin', label: '🏛️ Ruine' },
        dungeon: { value: 'dungeon', label: '☠️ Dungeon' },
        monster: { value: 'monster', label: '🐉 Monster' },
        environment: { value: 'environment', label: '🌳 Umgebung' },
        mountain: { value: 'mountain', label: '⛰️ Berg/Gebirge' },
        lake: { value: 'lake', label: '💧 Gewässer' },
        island: { value: 'island', label: '🏝️ Insel' },
        unknown: { value: 'unknown', label: '❓ Unbekannt' }
    },

    // Location Regions
    locationRegions: {
        north_adenai: { value: 'north_adenai', label: 'Nord-Adenai' },
        eastern_adenai: { value: 'eastern_adenai', label: 'Ost-Adenai' },
        south_adenai: { value: 'south_adenai', label: 'Süd-Adenai' },
        western_adenai: { value: 'western_adenai', label: 'West-Adenai' },
        valaris_region: { value: 'valaris_region', label: 'Valaris Region' },
        upeto: { value: 'upeto', label: 'Upeto' },
        harak: { value: 'harak', label: 'Harak' },
        tua_danar: { value: 'tua_danar', label: 'Tua Danar' },
        rena_region: { value: 'rena_region', label: 'Rena Region' },
        arcane_heights: { value: 'arcane_heights', label: 'Arkane Höhen' },
        sun_peaks: { value: 'sun_peaks', label: 'Sonnenspitzen' },
        cinnabar_fields: { value: 'cinnabar_fields', label: 'Zinnober Felder' },
        ewige_donnerkluefte: { value: 'ewige_donnerkluefte', label: 'Ewige Donnerklüfte' },
        east_sea: { value: 'east_sea', label: 'Östliche See' },
        west_sea: { value: 'west_sea', label: 'Westliche See' },
        heaven: { value: 'heaven', label: 'Himmel' },
        underdark: { value: 'underdark', label: 'Underdark' },
        feywild: { value: 'feywild', label: 'Feywild' },
        unknown: { value: 'unknown', label: 'Unbekannt' },
        other: { value: 'other', label: 'Andere' }
    },

    // Character Status options (since I saw these in the HTML too)
    characterStatus: {
        alive: { value: 'alive', label: '😊 Lebend' },
        dead: { value: 'dead', label: '💀 Verstorben' },
        undead: { value: 'undead', label: '🧟 Untot' },
        missing: { value: 'missing', label: '❓ Vermisst' },
        unknown: { value: 'unknown', label: '🤷 Unbekannt' }
    },

    // Character Relationship options
    characterRelationships: {
        ally: { value: 'ally', label: '😊 Verbündet' },
        friendly: { value: 'friendly', label: '🙂 Freundlich' },
        neutral: { value: 'neutral', label: '😐 Neutral' },
        suspicious: { value: 'suspicious', label: '🤨 Suspekt' },
        hostile: { value: 'hostile', label: '😠 Ablehenend' },
        enemy: { value: 'enemy', label: '⚔️ Feindlich' },
        unknown: { value: 'unknown', label: '🤷 Unbekannt' },
        party: { value: 'party', label: '👩‍👩‍👧‍👦 Gruppe' }
    },

    // Movement Types
    movementTypes: {
        stay: { value: 'stay', label: '🏡 Aufenthalt' },
        travel: { value: 'travel', label: '🚶 Reise' },
        return: { value: 'return', label: '🔄 Rückkehr' },
        meeting: { value: 'meeting', label: '🤝 Treffen' },
        mission: { value: 'mission', label: '⚔️ Mission' },
        exile: { value: 'exile', label: '🚪 Exil' },
        capture: { value: 'capture', label: '⛓️ Gefangenschaft' },
        escape: { value: 'escape', label: '🏃 Flucht' },
        other: { value: 'other', label: '❓ Andere' }
    },

    // Utility functions to get formatted labels
    getLocationTypeLabel: function(type) {
        return this.locationTypes[type]?.label || type;
    },

    getLocationRegionLabel: function(region) {
        return this.locationRegions[region]?.label || region;
    },

    getCharacterStatusLabel: function(status) {
        return this.characterStatus[status]?.label || status;
    },

    getCharacterRelationshipLabel: function(relationship) {
        return this.characterRelationships[relationship]?.label || relationship;
    },

    getMovementTypeLabel: function(type) {
        return this.movementTypes[type]?.label || type;
    },

    // Generate HTML option elements
    generateSelectOptions: function(configKey, selectedValue = null) {
        const config = this[configKey];
        if (!config) return '';
        
        return Object.values(config)
            .map(item => `<option value="${item.value}"${selectedValue === item.value ? ' selected' : ''}>${item.label}</option>`)
            .join('');
    },

    // Generate select options as an array for dynamic creation
    getSelectOptionsArray: function(configKey) {
        const config = this[configKey];
        if (!config) return [];
        
        return Object.values(config);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdenaiConfig;
}

// Make available globally
window.AdenaiConfig = AdenaiConfig;
