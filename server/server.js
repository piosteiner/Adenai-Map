require('dotenv').config();
const express = require('express');
const compression = require('compression');
const github = require('./lib/github');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

// Import route modules
const authRoutes = require('./routes/auth');
const { router: locationsRouter, initGitHub: initLocationsGitHub } = require('./routes/locations');
const { router: charactersRouter, initGitHub: initCharactersGitHub } = require('./routes/characters');
const { router: characterPathsRouter, initGitHub: initCharacterPathsGitHub } = require('./routes/character-paths');
const { router: mediaRouter, initGitHub: initMediaGitHub } = require('./routes/media');
const changelogRoutes = require('./routes/changelog');
const journeyRoutes = require('./routes/journey');
const dynamicsRoutes = require('./routes/dynamics');
const configRoutes = require('./routes/config');
const protocolRoutes = require('./routes/protocols');
const glossaryRoutes = require('./routes/glossary');

// Import middleware
const { requireAuth, authenticateJourneyAPI, authenticateDynamicsAPI } = require('./middleware/auth');

// Import activity routes (optional - only if you have the activity routes file)
// const activityRoutes = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3001;

// Fail fast if a real session secret hasn't been configured
if (!process.env.SESSION_SECRET) {
  console.error('❌ SESSION_SECRET is not set. Define it in .env before starting the server.');
  process.exit(1);
}

// Trust the nginx reverse proxy so secure cookies and client IPs work correctly
app.set('trust proxy', 1);

// GitHub API setup
// One shared client for all routes (lib/github.js)
const octokit = github.octokit;

const REPO_OWNER = process.env.GITHUB_USERNAME;
const REPO_NAME = process.env.GITHUB_REPO;

// Data files are answered from memory and written through to GitHub (lib/github-cache.js): the CMS no longer waits
// 0.2–0.6 s for GitHub on every read.
github.cache.warm(REPO_OWNER, REPO_NAME, ['public/data/places.geojson', 'public/data/characters.json', 'public/data/media-library.json', 'public/data/reviews.json', 'public/data/glossary.json', 'public/data/emotes.json']);

console.log(`Setting up admin for: ${REPO_OWNER}/${REPO_NAME}`);

// Initialize GitHub for route modules
initLocationsGitHub(octokit, REPO_OWNER, REPO_NAME);
initCharactersGitHub(octokit, REPO_OWNER, REPO_NAME);
initCharacterPathsGitHub(octokit, REPO_OWNER, REPO_NAME);
initMediaGitHub(octokit, REPO_OWNER, REPO_NAME);
// older tags in lower case, once (nothing is written when they are already)
require('./routes/media').normalizeLibraryTags().catch((err) => console.error('media: tags not normalised:', err.message));

// Middleware
app.use(compression()); // gzip: the admin's scripts and the JSON lists are a third of the size on the wire
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session management - sessions are persisted to disk so they survive server restarts
const sessionMiddleware = session({
  store: new FileStore({
    path: path.join(__dirname, 'sessions'),
    ttl: 24 * 60 * 60, // 24 hours, in seconds
    retries: 0,
    logFn: () => {} // silence session-file-store's noisy default logging
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS-only in production, behind nginx TLS termination
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});
app.use(sessionMiddleware);

// The CMS is the one at /v2/ (server/editor-src/cms); the classic one is retired — its address leads there
app.get(['/', '/index.html'], (req, res) => res.redirect(302, '/v2/'));
app.use(express.static('admin-interface'));
app.use('/uploads', express.static('uploads'));
app.use('/media', express.static('uploads/optimized')); // Serve optimized media files

// File upload configuration
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${timestamp}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed!'));
    }
  }
});

// API Routes
app.use('/api', authRoutes);
app.use('/api/locations', locationsRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/character-paths', authenticateJourneyAPI, characterPathsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/changelog', changelogRoutes);
app.use('/api/journey', authenticateJourneyAPI, journeyRoutes);
app.use('/api/dynamics', authenticateDynamicsAPI, dynamicsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/protocols', protocolRoutes); // session minutes, behind the protocol password
app.use('/api/glossary', glossaryRoutes); // terms that are neither characters nor locations
app.use('/api/emotes', require('./routes/emotes')); // :name: images (7TV sets and our own)
app.use('/api/data', require('./routes/data')); // the map's data files from the cache, and a live channel for changes
app.use('/api/pending', require('./routes/pending')); // entries proposed by the players, confirmed in the CMS
app.use('/api/quality', require('./routes/quality')); // the Quality page's "OK" marks

// Activity routes (uncomment when you have the activity routes file)
// app.use('/api/activity', requireAuth, activityRoutes);

// Test GitHub connection (public)
// The admin checks this on every page load: a good answer is kept for 5 minutes
let repoCheck = null;
app.get('/api/test', async (req, res) => {
  try {
    if (!repoCheck || Date.now() - repoCheck.at > 5 * 60 * 1000) {
      const { data } = await octokit.rest.repos.get({ owner: REPO_OWNER, repo: REPO_NAME });
      repoCheck = { data, at: Date.now() };
    }
    const { data } = repoCheck;
    res.json({
      success: true,
      message: 'GitHub connection successful!',
      repo: data.full_name
    });
  } catch (error) {
    console.error('GitHub test failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'GitHub connection failed',
      details: error.message
    });
  }
});

// Health check (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Start server
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Adenai Admin Server running on port ${PORT}`);
  console.log(`📁 Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`🌐 Access admin at: http://your-vps-ip:${PORT}`);
  console.log(`🔄 GitHub sync available via: ./sync-to-github.sh`);
  console.log(`📥 GitHub deploy available via: ./deploy-from-github.sh`);
  console.log(`🧪 Script testing: Both workflows operational`);
});

// Writing the session minutes together: WebSocket at /api/protocols/live (lib/protocol-live.js)
const protocolLive = require('./lib/protocol-live');
protocolLive.attach(httpServer, sessionMiddleware);
// pm2 restarts with SIGINT: write the open live documents first, and commit the files waiting for GitHub (what doesn't
// make it in time stays in data/github-pending and is committed after the start)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, async () => {
    const giveUp = new Promise((r) => setTimeout(r, 6000));
    try { await Promise.race([Promise.all([protocolLive.flushAll(), github.cache.flush().catch(() => {})]), giveUp]); } finally { process.exit(0); }
  });
}
