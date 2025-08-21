const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Initialize GitHub API (passed from main server)
let octokit, REPO_OWNER, REPO_NAME;

const initGitHub = (octokitInstance, repoOwner, repoName) => {
  octokit = octokitInstance;
  REPO_OWNER = repoOwner;
  REPO_NAME = repoName;
};

// Get current locations (public)
router.get('/', async (req, res) => {
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
router.post('/', requireAuth, async (req, res) => {
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
router.put('/:name', requireAuth, async (req, res) => {
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
router.delete('/:name', requireAuth, async (req, res) => {
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

module.exports = { router, initGitHub };