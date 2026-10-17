// Journeys were retired on 2026-10-17: the party's route is the VsuzH character's movements, shown over time with
// the map's timeline (src/ui/components/timeline.js). The last journeys.json is in the repo history.
// This stub answers the classic CMS's journeys module, which still asks on start.
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json([]));
router.use((req, res) => res.status(410).json({ error: 'Journeys were retired: use the VsuzH movements and the map timeline' }));

module.exports = router;
