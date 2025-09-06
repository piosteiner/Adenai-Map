const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const TEMPORAL_DATA_PATH = path.join(__dirname, '../data/temporal-features.json');
const CLIENT_TEMPORAL_PATH = path.join(__dirname, '../client-sync/temporal-features.js');

// Initialize temporal features data file if it doesn't exist
async function initializeTemporalData() {
    try {
        await fs.access(TEMPORAL_DATA_PATH);
    } catch (error) {
        const initialData = {
            political_areas: [],
            military_movements: [],
            strategic_markers: [],
            timeline_dates: [] // Available dates for the timeline
        };
        await fs.writeFile(TEMPORAL_DATA_PATH, JSON.stringify(initialData, null, 2));
    }
}

// Get all temporal features
router.get('/', async (req, res) => {
    try {
        await initializeTemporalData();
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        res.json(temporalData);
    } catch (error) {
        console.error('Error fetching temporal features:', error);
        res.status(500).json({ error: 'Failed to fetch temporal features' });
    }
});

// Get features by type
router.get('/:type', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        const type = req.params.type;
        
        if (!temporalData[type]) {
            return res.status(404).json({ error: 'Feature type not found' });
        }
        
        res.json(temporalData[type]);
    } catch (error) {
        console.error('Error fetching features by type:', error);
        res.status(500).json({ error: 'Failed to fetch features' });
    }
});

// Get specific feature
router.get('/:type/:id', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        const { type, id } = req.params;
        
        if (!temporalData[type]) {
            return res.status(404).json({ error: 'Feature type not found' });
        }
        
        const feature = temporalData[type].find(f => f.id === id);
        if (!feature) {
            return res.status(404).json({ error: 'Feature not found' });
        }
        
        res.json(feature);
    } catch (error) {
        console.error('Error fetching feature:', error);
        res.status(500).json({ error: 'Failed to fetch feature' });
    }
});

// Create new temporal feature
router.post('/:type', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        const type = req.params.type;
        
        if (!temporalData[type]) {
            return res.status(404).json({ error: 'Feature type not found' });
        }
        
        const newFeature = {
            id: req.body.id || `${type}_${Date.now()}`,
            name: req.body.name || 'New Feature',
            type: type,
            category: req.body.category || 'default',
            color: req.body.color || '#3366cc',
            opacity: req.body.opacity || 0.6,
            weight: req.body.weight || 3,
            active: req.body.active !== false,
            timeframes: req.body.timeframes || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        temporalData[type].push(newFeature);
        await fs.writeFile(TEMPORAL_DATA_PATH, JSON.stringify(temporalData, null, 2));
        
        // Generate client-side file
        await generateClientTemporalFile(temporalData);
        
        res.status(201).json(newFeature);
    } catch (error) {
        console.error('Error creating temporal feature:', error);
        res.status(500).json({ error: 'Failed to create feature' });
    }
});

// Update temporal feature
router.put('/:type/:id', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        const { type, id } = req.params;
        
        if (!temporalData[type]) {
            return res.status(404).json({ error: 'Feature type not found' });
        }
        
        const featureIndex = temporalData[type].findIndex(f => f.id === id);
        if (featureIndex === -1) {
            return res.status(404).json({ error: 'Feature not found' });
        }
        
        temporalData[type][featureIndex] = {
            ...temporalData[type][featureIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        await fs.writeFile(TEMPORAL_DATA_PATH, JSON.stringify(temporalData, null, 2));
        
        // Generate client-side file
        await generateClientTemporalFile(temporalData);
        
        res.json(temporalData[type][featureIndex]);
    } catch (error) {
        console.error('Error updating temporal feature:', error);
        res.status(500).json({ error: 'Failed to update feature' });
    }
});

// Delete temporal feature
router.delete('/:type/:id', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        const { type, id } = req.params;
        
        if (!temporalData[type]) {
            return res.status(404).json({ error: 'Feature type not found' });
        }
        
        const featureIndex = temporalData[type].findIndex(f => f.id === id);
        if (featureIndex === -1) {
            return res.status(404).json({ error: 'Feature not found' });
        }
        
        const deletedFeature = temporalData[type][featureIndex];
        temporalData[type].splice(featureIndex, 1);
        
        await fs.writeFile(TEMPORAL_DATA_PATH, JSON.stringify(temporalData, null, 2));
        
        // Generate client-side file
        await generateClientTemporalFile(temporalData);
        
        res.json({ message: 'Feature deleted successfully', feature: deletedFeature });
    } catch (error) {
        console.error('Error deleting temporal feature:', error);
        res.status(500).json({ error: 'Failed to delete feature' });
    }
});

// Add timeframe to feature
router.post('/:type/:id/timeframes', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        const { type, id } = req.params;
        
        if (!temporalData[type]) {
            return res.status(404).json({ error: 'Feature type not found' });
        }
        
        const featureIndex = temporalData[type].findIndex(f => f.id === id);
        if (featureIndex === -1) {
            return res.status(404).json({ error: 'Feature not found' });
        }
        
        const newTimeframe = {
            date: req.body.date || new Date().toISOString().split('T')[0],
            description: req.body.description || '',
            coordinates: req.body.coordinates || [],
            start_coords: req.body.start_coords || null,
            end_coords: req.body.end_coords || null,
            properties: req.body.properties || {}
        };
        
        temporalData[type][featureIndex].timeframes.push(newTimeframe);
        temporalData[type][featureIndex].updatedAt = new Date().toISOString();
        
        // Sort timeframes by date
        temporalData[type][featureIndex].timeframes.sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        await fs.writeFile(TEMPORAL_DATA_PATH, JSON.stringify(temporalData, null, 2));
        
        // Generate client-side file
        await generateClientTemporalFile(temporalData);
        
        res.status(201).json(newTimeframe);
    } catch (error) {
        console.error('Error adding timeframe:', error);
        res.status(500).json({ error: 'Failed to add timeframe' });
    }
});

// Generate client-side temporal features file
async function generateClientTemporalFile(temporalData) {
    try {
        let clientCode = `// Auto-generated temporal features file - Do not edit manually
// Generated at: ${new Date().toISOString()}

// Temporal Features Controller
class TemporalFeaturesController {
    constructor(map) {
        this.map = map;
        this.currentDate = null;
        this.activeFeatures = {
            political_areas: [],
            military_movements: [],
            strategic_markers: []
        };
        this.featureData = ${JSON.stringify(temporalData, null, 2)};
    }

    setCurrentDate(dateString) {
        this.currentDate = dateString;
        this.updateMapFeatures();
    }

    updateMapFeatures() {
        if (!this.currentDate) return;
        
        // Clear existing temporal features
        this.clearTemporalFeatures();
        
        // Add political areas for current date
        this.renderPoliticalAreas();
        
        // Add military movements for current date
        this.renderMilitaryMovements();
        
        // Add strategic markers for current date
        this.renderStrategicMarkers();
    }

    clearTemporalFeatures() {
        Object.values(this.activeFeatures).forEach(featureArray => {
            featureArray.forEach(feature => {
                if (feature && this.map.hasLayer(feature)) {
                    this.map.removeLayer(feature);
                }
            });
        });
        this.activeFeatures = {
            political_areas: [],
            military_movements: [],
            strategic_markers: []
        };
    }

    renderPoliticalAreas() {
        this.featureData.political_areas.forEach(area => {
            if (!area.active) return;
            
            const timeframe = this.getTimeframeForDate(area.timeframes, this.currentDate);
            if (!timeframe || !timeframe.coordinates) return;
            
            const polygon = L.polygon(timeframe.coordinates, {
                color: area.color,
                opacity: area.opacity || 0.6,
                fillOpacity: (area.opacity || 0.6) * 0.5,
                weight: area.weight || 2
            }).addTo(this.map);
            
            polygon.bindPopup(\`
                <strong>\${area.name}</strong><br>
                <em>\${timeframe.description}</em><br>
                <small>Date: \${timeframe.date}</small>
            \`);
            
            this.activeFeatures.political_areas.push(polygon);
        });
    }

    renderMilitaryMovements() {
        this.featureData.military_movements.forEach(movement => {
            if (!movement.active) return;
            
            const timeframe = this.getTimeframeForDate(movement.timeframes, this.currentDate);
            if (!timeframe || !timeframe.start_coords || !timeframe.end_coords) return;
            
            const arrow = L.polyline([timeframe.start_coords, timeframe.end_coords], {
                color: movement.color,
                weight: movement.weight || 4,
                opacity: movement.opacity || 0.8
            }).addTo(this.map);
            
            // Add arrowhead (simple implementation)
            const arrowHead = L.circleMarker(timeframe.end_coords, {
                color: movement.color,
                fillColor: movement.color,
                fillOpacity: 1,
                radius: (movement.weight || 4) * 1.5
            }).addTo(this.map);
            
            arrow.bindPopup(\`
                <strong>\${movement.name}</strong><br>
                <em>\${timeframe.description}</em><br>
                <small>Date: \${timeframe.date}</small>
            \`);
            
            this.activeFeatures.military_movements.push(arrow, arrowHead);
        });
    }

    renderStrategicMarkers() {
        this.featureData.strategic_markers.forEach(marker => {
            if (!marker.active) return;
            
            const timeframe = this.getTimeframeForDate(marker.timeframes, this.currentDate);
            if (!timeframe || !timeframe.coordinates) return;
            
            const icon = this.createMarkerIcon(timeframe.properties);
            const mapMarker = L.marker(timeframe.coordinates, { icon }).addTo(this.map);
            
            mapMarker.bindPopup(\`
                <strong>\${marker.name}</strong><br>
                <em>\${timeframe.description}</em><br>
                <small>Date: \${timeframe.date}</small>
            \`);
            
            this.activeFeatures.strategic_markers.push(mapMarker);
        });
    }

    getTimeframeForDate(timeframes, targetDate) {
        if (!timeframes || timeframes.length === 0) return null;
        
        const target = new Date(targetDate);
        let bestTimeframe = null;
        
        for (const timeframe of timeframes) {
            const frameDate = new Date(timeframe.date);
            if (frameDate <= target) {
                bestTimeframe = timeframe;
            } else {
                break;
            }
        }
        
        return bestTimeframe;
    }

    createMarkerIcon(properties) {
        const iconType = properties.icon || 'default';
        const size = properties.size || 'medium';
        
        // You can customize these based on your icon assets
        const iconSizes = {
            small: [16, 16],
            medium: [24, 24],
            large: [32, 32]
        };
        
        return L.divIcon({
            className: \`temporal-marker \${iconType} \${size}\`,
            iconSize: iconSizes[size],
            html: \`<div class="marker-content">\${this.getIconSymbol(iconType)}</div>\`
        });
    }

    getIconSymbol(iconType) {
        const symbols = {
            fortress: '🏰',
            city: '🏙️',
            outpost: '🏕️',
            ruin: '🏛️',
            default: '📍'
        };
        return symbols[iconType] || symbols.default;
    }

    getAllAvailableDates() {
        const dates = new Set();
        
        Object.values(this.featureData).forEach(featureArray => {
            if (Array.isArray(featureArray)) {
                featureArray.forEach(feature => {
                    if (feature.timeframes) {
                        feature.timeframes.forEach(timeframe => {
                            dates.add(timeframe.date);
                        });
                    }
                });
            }
        });
        
        return Array.from(dates).sort();
    }
}

// Initialize temporal features when map is ready
if (typeof map !== 'undefined') {
    window.temporalController = new TemporalFeaturesController(map);
}
`;
        
        await fs.writeFile(CLIENT_TEMPORAL_PATH, clientCode);
        console.log('Client temporal features file generated successfully');
    } catch (error) {
        console.error('Error generating client temporal file:', error);
    }
}

// Sync to client (manual trigger)
router.post('/sync', async (req, res) => {
    try {
        const data = await fs.readFile(TEMPORAL_DATA_PATH, 'utf8');
        const temporalData = JSON.parse(data);
        await generateClientTemporalFile(temporalData);
        res.json({ message: 'Client temporal features file generated successfully' });
    } catch (error) {
        console.error('Error syncing temporal features:', error);
        res.status(500).json({ error: 'Failed to sync to client' });
    }
});

module.exports = router;
