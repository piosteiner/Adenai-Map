const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const JOURNEY_DATA_PATH = path.join(__dirname, '../data/journeys.json');
const CLIENT_JOURNEY_PATH = path.join(__dirname, '../client-sync/journey.js');

// Initialize journey data file if it doesn't exist
async function initializeJourneyData() {
    try {
        await fs.access(JOURNEY_DATA_PATH);
    } catch (error) {
        const initialData = {
            journeys: [
                {
                    id: 'vsuzh_journey',
                    name: 'VsuzH Reise',
                    description: 'Die Hauptreise der Abenteurer',
                    color: 'orange',
                    weight: 4,
                    weightMobile: 6,
                    dashArray: '10,6',
                    dashArrayMobile: '16,10',
                    opacity: 0.7,
                    active: true,
                    segments: [
                        { type: 'M', coords: [1041, 1240], description: 'Start in Silbergrat' },
                        { type: 'Q', coords: [1062, 1287], control: [1044, 1338], description: 'Weg nach Toftgard' },
                        { type: 'Q', coords: [1054, 1371], control: [1083, 1392], description: 'Ankunft in Toftgard' },
                        { type: 'Q', coords: [1106, 1340], control: [1094, 1310], description: 'In den Toftgarder Forst' },
                        { type: 'Q', coords: [1112, 1316], control: [1128, 1344], description: 'Ankunft zu Fitchers Turm' },
                        { type: 'Q', coords: [1125, 1333], control: [1163, 1291], description: 'In die Ruine von Zurak\'thar' },
                        { type: 'Q', coords: [1166, 1301], control: [1128, 1344], description: 'Zurück zu Fitcher' },
                        { type: 'Q', coords: [1105, 1338], control: [1083, 1392], description: 'Zurück nach Toftgard' },
                        { type: 'Q', coords: [1080, 1456], control: [1084, 1488], description: 'Flussreise Teil 1' },
                        { type: 'L', coords: [1061, 1508], description: 'Flussreise Teil 2' },
                        { type: 'L', coords: [1053, 1481], description: 'Landung' },
                        { type: 'L', coords: [1040, 1472], description: 'Zum Goblin Loch' },
                        { type: 'L', coords: [1053, 1481], description: 'Zurück zur Landung' },
                        { type: 'L', coords: [1061, 1508], description: 'Zurück auf den Fluss' },
                        { type: 'L', coords: [1034, 1569], description: 'Flussreise Teil 3' },
                        { type: 'L', coords: [1008, 1608], description: 'Flussreise Teil 4' },
                        { type: 'Q', coords: [1010, 1648], control: [1008, 1700], description: 'Ankunft in Valaris' },
                        { type: 'Q', coords: [989, 1693], control: [985, 1724], description: 'Ausfahrt von Valaris' },
                        { type: 'L', coords: [1025, 2005], description: 'Fahrt nach Motu Motu' },
                        { type: 'Q', coords: [1046, 2010], control: [1070, 2106], description: 'Fahrt zur Sternenzirkel Insel' },
                        { type: 'Q', coords: [1046, 2103], control: [1025, 2005], description: 'Fahrt zurück nach Motu Motu' },
                        { type: 'L', coords: [992, 2126], description: 'Fahrt nach Luvatu' },
                        { type: 'L', coords: [975, 2210], description: 'Fahrt zum Unterwasserparadies' },
                        { type: 'L', coords: [1200, 2210], description: 'Aufstieg von Atlantis' },
                        { type: 'Q', coords: [1140, 2340], control: [888, 2275], description: 'Rückkehr aufs Meer' },
                        { type: 'Q', coords: [723, 2041], control: [708, 1983], description: 'Fahrt an die Küste von Upeto' },
                        { type: 'Q', coords: [564, 2014], control: [488, 1957], description: 'Fahrt nach Basapo' },
                        { type: 'Q', coords: [489, 1867], control: [556, 1869], description: 'Reise nach Ako' }
                    ],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]
        };
        await fs.writeFile(JOURNEY_DATA_PATH, JSON.stringify(initialData, null, 2));
    }
}

// Get all journeys
router.get('/', async (req, res) => {
    try {
        await initializeJourneyData();
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        res.json(journeyData.journeys);
    } catch (error) {
        console.error('Error fetching journeys:', error);
        res.status(500).json({ error: 'Failed to fetch journeys' });
    }
});

// Get specific journey
router.get('/:id', async (req, res) => {
    try {
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        const journey = journeyData.journeys.find(j => j.id === req.params.id);
        
        if (!journey) {
            return res.status(404).json({ error: 'Journey not found' });
        }
        
        res.json(journey);
    } catch (error) {
        console.error('Error fetching journey:', error);
        res.status(500).json({ error: 'Failed to fetch journey' });
    }
});

// Create new journey
router.post('/', async (req, res) => {
    try {
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        
        const newJourney = {
            id: req.body.id || `journey_${Date.now()}`,
            name: req.body.name || 'Neue Reise',
            description: req.body.description || '',
            color: req.body.color || 'blue',
            weight: req.body.weight || 4,
            weightMobile: req.body.weightMobile || 6,
            dashArray: req.body.dashArray || '10,6',
            dashArrayMobile: req.body.dashArrayMobile || '16,10',
            opacity: req.body.opacity || 0.7,
            active: req.body.active !== undefined ? req.body.active : true,
            segments: req.body.segments || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        journeyData.journeys.push(newJourney);
        await fs.writeFile(JOURNEY_DATA_PATH, JSON.stringify(journeyData, null, 2));
        
        // Generate client-side file
        await generateClientJourneyFile(journeyData);
        
        res.status(201).json(newJourney);
    } catch (error) {
        console.error('Error creating journey:', error);
        res.status(500).json({ error: 'Failed to create journey' });
    }
});

// Update journey
router.put('/:id', async (req, res) => {
    try {
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        const journeyIndex = journeyData.journeys.findIndex(j => j.id === req.params.id);
        
        if (journeyIndex === -1) {
            return res.status(404).json({ error: 'Journey not found' });
        }
        
        journeyData.journeys[journeyIndex] = {
            ...journeyData.journeys[journeyIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        await fs.writeFile(JOURNEY_DATA_PATH, JSON.stringify(journeyData, null, 2));
        
        // Generate client-side file
        await generateClientJourneyFile(journeyData);
        
        res.json(journeyData.journeys[journeyIndex]);
    } catch (error) {
        console.error('Error updating journey:', error);
        res.status(500).json({ error: 'Failed to update journey' });
    }
});

// Add segment to journey
router.post('/:id/segments', async (req, res) => {
    try {
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        const journeyIndex = journeyData.journeys.findIndex(j => j.id === req.params.id);
        
        if (journeyIndex === -1) {
            return res.status(404).json({ error: 'Journey not found' });
        }
        
        const newSegment = {
            type: req.body.type || 'L',
            coords: req.body.coords || [0, 0],
            control: req.body.control || null,
            description: req.body.description || ''
        };
        
        journeyData.journeys[journeyIndex].segments.push(newSegment);
        journeyData.journeys[journeyIndex].updatedAt = new Date().toISOString();
        
        await fs.writeFile(JOURNEY_DATA_PATH, JSON.stringify(journeyData, null, 2));
        
        // Generate client-side file
        await generateClientJourneyFile(journeyData);
        
        res.status(201).json(newSegment);
    } catch (error) {
        console.error('Error adding segment:', error);
        res.status(500).json({ error: 'Failed to add segment' });
    }
});

// Delete segment from journey
router.delete('/:id/segments/:segmentIndex', async (req, res) => {
    try {
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        const journeyIndex = journeyData.journeys.findIndex(j => j.id === req.params.id);
        
        if (journeyIndex === -1) {
            return res.status(404).json({ error: 'Journey not found' });
        }
        
        const segmentIndex = parseInt(req.params.segmentIndex);
        if (segmentIndex < 0 || segmentIndex >= journeyData.journeys[journeyIndex].segments.length) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        
        journeyData.journeys[journeyIndex].segments.splice(segmentIndex, 1);
        journeyData.journeys[journeyIndex].updatedAt = new Date().toISOString();
        
        await fs.writeFile(JOURNEY_DATA_PATH, JSON.stringify(journeyData, null, 2));
        
        // Generate client-side file
        await generateClientJourneyFile(journeyData);
        
        res.json({ message: 'Segment deleted successfully' });
    } catch (error) {
        console.error('Error deleting segment:', error);
        res.status(500).json({ error: 'Failed to delete segment' });
    }
});

// Generate client-side journey.js file
async function generateClientJourneyFile(journeyData) {
    try {
        let clientCode = `// Auto-generated journey file - Do not edit manually
// Generated at: ${new Date().toISOString()}

`;

        for (const journey of journeyData.journeys) {
            if (!journey.active) continue;
            
            const varName = journey.id.replace(/[^a-zA-Z0-9]/g, '_');
            
            clientCode += `const ${varName} = L.curve(
  [
`;
            
            for (const segment of journey.segments) {
                if (segment.type === 'Q' && segment.control) {
                    clientCode += `    '${segment.type}', [${segment.coords[0]}, ${segment.coords[1]}], [${segment.control[0]}, ${segment.control[1]}], //${segment.description}\n`;
                } else {
                    clientCode += `    '${segment.type}', [${segment.coords[0]}, ${segment.coords[1]}], //${segment.description}\n`;
                }
            }
            
            clientCode += `  ],
  {
    color: '${journey.color}',
    weight: isMobile ? ${journey.weightMobile} : ${journey.weight},
    dashArray: isMobile ? '${journey.dashArrayMobile}' : '${journey.dashArray}',
    opacity: ${journey.opacity},
  }
).addTo(map);

${varName}.bindPopup("${journey.name}");

`;
        }
        
        // Create client-sync directory if it doesn't exist
        const clientSyncDir = path.dirname(CLIENT_JOURNEY_PATH);
        try {
            await fs.access(clientSyncDir);
        } catch {
            await fs.mkdir(clientSyncDir, { recursive: true });
        }
        
        await fs.writeFile(CLIENT_JOURNEY_PATH, clientCode);
        console.log('Client journey file generated successfully');
    } catch (error) {
        console.error('Error generating client journey file:', error);
    }
}

// Sync to client (manual trigger)
router.post('/sync', async (req, res) => {
    try {
        const data = await fs.readFile(JOURNEY_DATA_PATH, 'utf8');
        const journeyData = JSON.parse(data);
        await generateClientJourneyFile(journeyData);
        res.json({ message: 'Client file generated successfully' });
    } catch (error) {
        console.error('Error syncing to client:', error);
        res.status(500).json({ error: 'Failed to sync to client' });
    }
});

module.exports = router;