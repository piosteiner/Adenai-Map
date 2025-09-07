require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const session = require('express-session');

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

// Import middleware
const { requireAuth, authenticateJourneyAPI, authenticateDynamicsAPI } = require('./middleware/auth');

// Import activity routes (optional - only if you have the activity routes file)
// const activityRoutes = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3001;

// GitHub API setup
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = process.env.GITHUB_USERNAME;
const REPO_NAME = process.env.GITHUB_REPO;

console.log(`Setting up admin for: ${REPO_OWNER}/${REPO_NAME}`);

// Initialize GitHub for route modules
initLocationsGitHub(octokit, REPO_OWNER, REPO_NAME);
initCharactersGitHub(octokit, REPO_OWNER, REPO_NAME);
initCharacterPathsGitHub(octokit, REPO_OWNER, REPO_NAME);
initMediaGitHub(octokit, REPO_OWNER, REPO_NAME);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'adenai-campaign-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

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

// Activity routes (uncomment when you have the activity routes file)
// app.use('/api/activity', requireAuth, activityRoutes);

// Test GitHub connection (public)
app.get('/api/test', async (req, res) => {
  try {
    const { data } = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME
    });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Adenai Admin Server running on port ${PORT}`);
  console.log(`📁 Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`🌐 Access admin at: http://your-vps-ip:${PORT}`);
  console.log(`🔄 GitHub sync available via: ./sync-to-github.sh`);
  console.log(`📥 GitHub deploy available via: ./deploy-from-github.sh`);
  console.log(`🧪 Script testing: Both workflows operational`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});
