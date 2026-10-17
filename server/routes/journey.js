// Journeys (the party's routes drawn on the map). Stored in the repo as public/data/journeys.json, like locations and
// characters: versioned, backed up by GitHub, and the map can load it as a static file. Until 2026-10-17 it was a
// local file (server/data/journeys.json) that only this server had. Reads come from the shared cache (lib/github.js).
const express = require('express');
const router = express.Router();
const { octokit } = require('../lib/github');

const OWNER = process.env.GITHUB_USERNAME;
const REPO = process.env.GITHUB_REPO;
const PATH = 'public/data/journeys.json';

async function load() {
    try {
        const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        return { journeyData: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')), sha: data.sha };
    } catch (error) {
        if (error.status === 404) return { journeyData: { journeys: [] }, sha: undefined };
        throw error;
    }
}

async function save(journeyData, sha, message, req) {
    const user = req.session?.displayName || req.session?.username || 'Unknown';
    journeyData.lastUpdated = new Date().toISOString();
    await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: PATH, sha,
        message: `${message} (by ${user})`,
        content: Buffer.from(JSON.stringify(journeyData, null, 2)).toString('base64'),
    });
}

const fail = (res, what) => (error) => {
    console.error(`Error ${what}:`, error.message);
    res.status(error.status === 409 ? 409 : 500).json({ error: error.status === 409 ? 'Journeys were changed meanwhile — reload and try again' : `Failed to ${what}` });
};

// Get all journeys
router.get('/', async (req, res) => {
    try {
        const { journeyData } = await load();
        res.json(journeyData.journeys);
    } catch (error) { fail(res, 'fetch journeys')(error); }
});

// Get specific journey
router.get('/:id', async (req, res) => {
    try {
        const { journeyData } = await load();
        const journey = journeyData.journeys.find(j => j.id === req.params.id);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        res.json(journey);
    } catch (error) { fail(res, 'fetch journey')(error); }
});

// Create new journey
router.post('/', async (req, res) => {
    try {
        const { journeyData, sha } = await load();
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
        await save(journeyData, sha, `Create journey: ${newJourney.name}`, req);
        res.status(201).json(newJourney);
    } catch (error) { fail(res, 'create journey')(error); }
});

// Update journey
router.put('/:id', async (req, res) => {
    try {
        const { journeyData, sha } = await load();
        const i = journeyData.journeys.findIndex(j => j.id === req.params.id);
        if (i === -1) return res.status(404).json({ error: 'Journey not found' });
        journeyData.journeys[i] = { ...journeyData.journeys[i], ...req.body, updatedAt: new Date().toISOString() };
        await save(journeyData, sha, `Update journey: ${journeyData.journeys[i].name}`, req);
        res.json(journeyData.journeys[i]);
    } catch (error) { fail(res, 'update journey')(error); }
});

// Delete journey
router.delete('/:id', async (req, res) => {
    try {
        const { journeyData, sha } = await load();
        const i = journeyData.journeys.findIndex(j => j.id === req.params.id);
        if (i === -1) return res.status(404).json({ error: 'Journey not found' });
        const [deletedJourney] = journeyData.journeys.splice(i, 1);
        await save(journeyData, sha, `Delete journey: ${deletedJourney.name}`, req);
        res.json({ message: 'Journey deleted successfully', journey: deletedJourney });
    } catch (error) { fail(res, 'delete journey')(error); }
});

// Add segment to journey
router.post('/:id/segments', async (req, res) => {
    try {
        const { journeyData, sha } = await load();
        const journey = journeyData.journeys.find(j => j.id === req.params.id);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        const newSegment = {
            type: req.body.type || 'L',
            coords: req.body.coords || [0, 0],
            control: req.body.control || null,
            description: req.body.description || ''
        };
        journey.segments.push(newSegment);
        journey.updatedAt = new Date().toISOString();
        await save(journeyData, sha, `Add segment to journey: ${journey.name}`, req);
        res.status(201).json(newSegment);
    } catch (error) { fail(res, 'add segment')(error); }
});

// Delete segment from journey
router.delete('/:id/segments/:segmentIndex', async (req, res) => {
    try {
        const { journeyData, sha } = await load();
        const journey = journeyData.journeys.find(j => j.id === req.params.id);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        const segmentIndex = parseInt(req.params.segmentIndex);
        if (!(segmentIndex >= 0 && segmentIndex < journey.segments.length)) return res.status(404).json({ error: 'Segment not found' });
        journey.segments.splice(segmentIndex, 1);
        journey.updatedAt = new Date().toISOString();
        await save(journeyData, sha, `Delete segment ${segmentIndex + 1} of journey: ${journey.name}`, req);
        res.json({ message: 'Segment deleted successfully' });
    } catch (error) { fail(res, 'delete segment')(error); }
});

// Formerly wrote a client-side journey.js no page used; kept so older admin code gets an answer
router.post('/sync', (req, res) => res.json({ message: 'Nothing to sync: the map reads public/data/journeys.json' }));

module.exports = router;
