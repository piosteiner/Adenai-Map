require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3001;

// GitHub API setup
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = process.env.GITHUB_USERNAME;
const REPO_NAME = process.env.GITHUB_REPO;

console.log(`Setting up admin for: ${REPO_OWNER}/${REPO_NAME}`);

// Middleware
app.use(cors());
app.use(express.json());

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

app.use(express.static('admin-public'));
app.use('/uploads', express.static('uploads'));

// Authentication middleware for write operations only
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to perform this action'
    });
  }
};

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed!'));
    }
  }
});

// Authentication routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ 
      success: true, 
      message: 'Login successful',
      username: username
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, message: 'Logout failed' });
    } else {
      res.json({ success: true, message: 'Logout successful' });
    }
  });
});

app.get('/api/auth-status', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    username: req.session?.username || null
  });
});

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

//////LOCATION MANAGEMENT//////

// Get current locations (public)
app.get('/api/locations', async (req, res) => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/places.geojson'
    });
    
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
    res.json(content);
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist yet, return empty structure
      res.json({
        type: "FeatureCollection",
        features: []
      });
    } else {
      console.error('Error fetching locations:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
});

// Add new location (protected)
app.post('/api/locations', requireAuth, async (req, res) => {
  try {
    console.log('Adding new location:', req.body.properties?.name);
    
    // Get current content
    let currentContent;
    let currentSha;
    
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'data/places.geojson'
      });
      currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
      currentSha = currentFile.sha;
    } catch (error) {
      if (error.status === 404) {
        // File doesn't exist, create new structure
        currentContent = {
          type: "FeatureCollection",
          features: []
        };
        currentSha = null;
      } else {
        throw error;
      }
    }
    
    // Add new location
    const newFeature = {
      type: "Feature",
      properties: {
        name: req.body.properties.name,
        description: req.body.properties.description || '',
        contentUrl: req.body.properties.contentUrl || null,
        ...req.body.properties
      },
      geometry: {
        type: "Point",
        coordinates: req.body.geometry.coordinates
      }
    };
    
    currentContent.features.push(newFeature);
    
    // Commit to GitHub
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/places.geojson',
      message: `Add location: ${newFeature.properties.name}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64')
    };
    
    if (currentSha) {
      commitData.sha = currentSha;
    }
    
    await octokit.rest.repos.createOrUpdateFileContents(commitData);
    
    res.json({ success: true, feature: newFeature });
  } catch (error) {
    console.error('Error saving location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update location (protected)
app.put('/api/locations/:name', requireAuth, async (req, res) => {
  try {
    const originalName = decodeURIComponent(req.params.name);
    console.log('Updating location:', originalName);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/places.geojson'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find and update the location
    const locationIndex = currentContent.features.findIndex(
      feature => feature.properties.name === originalName
    );
    
    if (locationIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location not found' 
      });
    }
    
    // Update the location data
    const updatedFeature = {
      type: "Feature",
      properties: {
        name: req.body.properties.name,
        description: req.body.properties.description || '',
        contentUrl: req.body.properties.contentUrl || null,
        ...req.body.properties
      },
      geometry: {
        type: "Point",
        coordinates: req.body.geometry.coordinates
      }
    };
    
    currentContent.features[locationIndex] = updatedFeature;
    
    // Commit to GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/places.geojson',
      message: `Update location: ${originalName} → ${updatedFeature.properties.name}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    res.json({ success: true, feature: updatedFeature });
  } catch (error) {
    console.error('Error updating location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete location (protected)
app.delete('/api/locations/:name', requireAuth, async (req, res) => {
  try {
    const locationName = decodeURIComponent(req.params.name);
    console.log('Deleting location:', locationName);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/places.geojson'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find and remove the location
    const locationIndex = currentContent.features.findIndex(
      feature => feature.properties.name === locationName
    );
    
    if (locationIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location not found' 
      });
    }
    
    // Remove the location
    currentContent.features.splice(locationIndex, 1);
    
    // Commit to GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/places.geojson',
      message: `Delete location: ${locationName}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    res.json({ success: true, message: `Location "${locationName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

////// CHARACTER MANAGEMENT //////

// Get all characters (public)
app.get('/api/characters', async (req, res) => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json'
    });
    
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
    res.json(content);
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist yet, return empty structure
      res.json({
        version: "1.0",
        characters: []
      });
    } else {
      console.error('Error fetching characters:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
});

// Add new character (protected)
app.post('/api/characters', requireAuth, async (req, res) => {
  try {
    console.log('Adding new character:', req.body.name);
    
    // Get current content
    let currentContent;
    let currentSha;
    
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'data/characters.json'
      });
      currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
      currentSha = currentFile.sha;
    } catch (error) {
      if (error.status === 404) {
        // File doesn't exist, create new structure
        currentContent = {
          version: "1.0",
          characters: []
        };
        currentSha = null;
      } else {
        throw error;
      }
    }
    
    // Add new character
    const newCharacter = {
      id: req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: req.body.name,
      title: req.body.title || '',
      location: req.body.location || '',
      description: req.body.description || '',
      image: req.body.image || '',
      status: req.body.status || 'alive',
      faction: req.body.faction || '',
      relationship: req.body.relationship || 'neutral',
      firstMet: req.body.firstMet || '',
      notes: req.body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    currentContent.characters.push(newCharacter);
    currentContent.lastUpdated = new Date().toISOString();
    
    // Commit to GitHub
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json',
      message: `Add character: ${newCharacter.name}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64')
    };
    
    if (currentSha) {
      commitData.sha = currentSha;
    }
    
    await octokit.rest.repos.createOrUpdateFileContents(commitData);
    
    res.json({ success: true, character: newCharacter });
  } catch (error) {
    console.error('Error saving character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update character (protected)
app.put('/api/characters/:id', requireAuth, async (req, res) => {
  try {
    const originalId = decodeURIComponent(req.params.id);
    console.log('Updating character:', originalId);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find and update the character
    const characterIndex = currentContent.characters.findIndex(
      character => character.id === originalId
    );
    
    if (characterIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Character not found' 
      });
    }
    
    // Update the character data
    const updatedCharacter = {
      id: req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: req.body.name,
      title: req.body.title || '',
      location: req.body.location || '',
      description: req.body.description || '',
      image: req.body.image || '',
      status: req.body.status || 'alive',
      faction: req.body.faction || '',
      relationship: req.body.relationship || 'neutral',
      firstMet: req.body.firstMet || '',
      notes: req.body.notes || '',
      createdAt: currentContent.characters[characterIndex].createdAt, // Keep original creation date
      updatedAt: new Date().toISOString()
    };
    
    currentContent.characters[characterIndex] = updatedCharacter;
    currentContent.lastUpdated = new Date().toISOString();
    
    // Commit to GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json',
      message: `Update character: ${originalId} → ${updatedCharacter.name}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    res.json({ success: true, character: updatedCharacter });
  } catch (error) {
    console.error('Error updating character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete character (protected)
app.delete('/api/characters/:id', requireAuth, async (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.id);
    console.log('Deleting character:', characterId);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find and remove the character
    const characterIndex = currentContent.characters.findIndex(
      character => character.id === characterId
    );
    
    if (characterIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Character not found' 
      });
    }
    
    const deletedCharacterName = currentContent.characters[characterIndex].name;
    
    // Remove the character
    currentContent.characters.splice(characterIndex, 1);
    currentContent.lastUpdated = new Date().toISOString();
    
    // Commit to GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json',
      message: `Delete character: ${deletedCharacterName}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    res.json({ success: true, message: `Character "${deletedCharacterName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting character:', error.message);
    res.status(500).json({ error: error.message });
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});