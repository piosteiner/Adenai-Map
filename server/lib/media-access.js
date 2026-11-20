// The pictures are not public (2026-11-20) — most come from artists who never allowed showing them on an open website;
// the owner's own and AI pictures are (lib/media-open.js). Since the same day they live in the Grimoire's image
// library (lib/grimoire-images.js), which keeps them behind its own gate: for Adenai's players, the minutes password
// opens them — the map hands the minutes token to the Grimoire, which asks here whether it is valid
// (GET /api/protocols/media-access/check) and keeps it as its cookie. The CMS gets a token for the GM's session
// (GET /api/protocols/media-token) and does the same.
// Here: the CORS of the routes the map calls with credentials, and the old picture addresses leading to the Grimoire.
const cors = require('cors');

// the map's addresses: they may send the password (credentials need a named origin)
const MAP_ORIGINS = (process.env.MAP_ORIGINS || 'https://adenai.piogino.ch').split(',').map((s) => s.trim()).filter(Boolean);
const CREDENTIAL_PATHS = ['/api/protocols/unlock', '/api/protocols/media-access'];
const plainCors = cors();
const credentialCors = cors({ origin: MAP_ORIGINS, credentials: true });
const corsFor = (req, res, next) => (CREDENTIAL_PATHS.includes(req.path) ? credentialCors : plainCors)(req, res, next);

// an old address here (/media/<file>: in texts, links, old copies of the map) leads to the Grimoire
const GRIMOIRE_FILES = `${(process.env.GRIMOIRE_PUBLIC_URL || 'https://grimoire.piogino.ch').replace(/\/+$/, '')}/api/media/files/`;
function toGrimoire(req, res) {
    const file = req.path.replace(/^\//, '');
    if (!/^[A-Za-z0-9_-]+\.(webp|jpe?g|png|gif)$/.test(file)) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400');
    return res.redirect(301, GRIMOIRE_FILES + file);
}

module.exports = { corsFor, toGrimoire, MAP_ORIGINS, GRIMOIRE_FILES };
