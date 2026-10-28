// routes/config.js - Serve configuration data for client consumption

const express = require('express');
const router = express.Router();

// Import the config (you'd need to convert it to a module or define it here)
const AdenaiConfig = {
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
    characterStatus: {
        alive: { value: 'alive', label: '😊 Lebend' },
        dead: { value: 'dead', label: '💀 Verstorben' },
        undead: { value: 'undead', label: '🧟 Untot' },
        missing: { value: 'missing', label: '❓ Vermisst' },
        unknown: { value: 'unknown', label: '🤷 Unbekannt' }
    },
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
    movementTypes: {
        stay: { value: 'stay', label: '🏡 Aufenthalt' },
        travel: { value: 'travel', label: '🚶 Reise' },
        return: { value: 'return', label: '🔄 Rückkehr' },
        meeting: { value: 'meeting', label: '🤝 Treffen' },
        mission: { value: 'mission', label: '⚔️ Mission' },
        exile: { value: 'exile', label: '🚪 Exil' },
        capture: { value: 'capture', label: '⛓️ Gefangenschaft' },
        escape: { value: 'escape', label: '🏃 Flucht' },
        teleport: { value: 'teleport', label: '✨ Teleport' }, // drawn as a dotted arc, an instant jump on the timeline
        other: { value: 'other', label: '❓ Andere' }
    }
};

// Get all configuration
// with the media tag lists, which are edited in the CMS (routes/tag-groups.js)
const { loadGroups } = require('./tag-groups');

router.get('/', async (req, res) => {
    try {
        res.json({
            success: true,
            config: { ...AdenaiConfig, mediaTagGroups: await loadGroups() }
        });
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch configuration'
        });
    }
});

// Get specific config section
router.get('/:section', (req, res) => {
    try {
        const section = req.params.section;
        const configSection = AdenaiConfig[section];
        
        if (!configSection) {
            return res.status(404).json({
                success: false,
                message: `Configuration section '${section}' not found`
            });
        }
        
        res.json({
            success: true,
            section: section,
            data: configSection
        });
    } catch (error) {
        console.error('Error fetching config section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch configuration section'
        });
    }
});

module.exports = router;
