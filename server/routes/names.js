// The names: the list lives in the Grimoire (grimoire.piogino.ch, its names section) as the clean master copy; what
// Adenai did with them — which name was given to whom, which belong to a major character, which are wanted — is
// Adenai's record there, kept through Adenai's project key. This route passes the CMS's requests on with the key, so
// the key stays on the server (GRIMOIRE_URL, GRIMOIRE_KEY in .env). GM only, like all of /api (middleware/auth.js).
//   GET    /api/names                   every name with Adenai's uses and wish
//   POST   /api/names/:id/uses          { usedFor, major, note, force }  → 409 with { conflict } when a major
//                                        character already has the name (or a major use would join others)
//   PUT    /api/names/uses/:useId       { usedFor, major, note, force }
//   DELETE /api/names/uses/:useId
//   PUT    /api/names/:id/wanted        { wanted: true|false, note }
const express = require('express');

const router = express.Router();
const BASE = (process.env.GRIMOIRE_URL || 'http://127.0.0.1:3005').replace(/\/+$/, '');
const PROJECT = 'adenai';

async function pass(res, method, path, body) {
    if (!process.env.GRIMOIRE_KEY) return res.status(503).json({ error: 'The Grimoire key is not set on the server (GRIMOIRE_KEY)' });
    try {
        const r = await fetch(`${BASE}/api/projects/${PROJECT}${path}`, {
            method,
            headers: { Authorization: `Bearer ${process.env.GRIMOIRE_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(10000),
        });
        const text = await r.text();
        res.status(r.status);
        return text ? res.type('json').send(text) : res.end();
    } catch (err) {
        return res.status(502).json({ error: `The Grimoire did not answer: ${err.message}` });
    }
}

const id = (v) => (/^\d+$/.test(String(v)) ? v : null);

router.get('/', (req, res) => pass(res, 'GET', '/names'));
router.post('/:id/uses', (req, res) => (id(req.params.id) ? pass(res, 'POST', `/names/${req.params.id}/uses`, req.body || {}) : res.status(400).json({ error: 'Bad name id' })));
router.put('/uses/:useId', (req, res) => (id(req.params.useId) ? pass(res, 'PUT', `/uses/${req.params.useId}`, req.body || {}) : res.status(400).json({ error: 'Bad use id' })));
router.delete('/uses/:useId', (req, res) => (id(req.params.useId) ? pass(res, 'DELETE', `/uses/${req.params.useId}`) : res.status(400).json({ error: 'Bad use id' })));
router.put('/:id/wanted', (req, res) => (id(req.params.id) ? pass(res, 'PUT', `/names/${req.params.id}/wanted`, req.body || {}) : res.status(400).json({ error: 'Bad name id' })));

module.exports = router;
