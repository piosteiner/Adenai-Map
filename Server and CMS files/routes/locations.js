const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const githubHelper = require('../utils/githubHelper');

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
    const content = await githubHelper.loadFromGitHub('data', 'places.geojson');
    
    if (!content) {
      // File doesn't exist yet, return empty structure
      res.json({
        type: "FeatureCollection",
        features: []
      });
    } else {
      res.json(content);
    }
  } catch (error) {
    console.error('Error fetching locations:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add new location (protected)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user?.username || 'Unknown';
    console.log('Adding new location:', req.body.properties?.name, 'by', user);
    
    // Get current content
    let currentContent = await githubHelper.loadFromGitHub('data', 'places.geojson');
    
    if (!currentContent) {
      // File doesn't exist, create new structure
      currentContent = {
        type: "FeatureCollection",
        features: []
      };
    }
    
    // Create new location feature
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
    
    // Add new location
    currentContent.features.push(newFeature);
    
    // Save with enhanced commit message
    const changes = ['Initial location creation with all details'];
    await githubHelper.saveToGitHub(
      'data', 
      'places.geojson', 
      currentContent, 
      'create',
      user,
      changes
    );
    
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
    const user = req.session.user?.username || 'Unknown';
    console.log('Updating location:', originalName, 'by', user);
    
    // Get current content
    const currentContent = await githubHelper.loadFromGitHub('data', 'places.geojson');
    
    if (!currentContent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Locations file not found' 
      });
    }
    
    // Find the location to update
    const locationIndex = currentContent.features.findIndex(
      feature => feature.properties.name === originalName
    );
    
    if (locationIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location not found' 
      });
    }
    
    // Get old data for change detection
    const oldLocation = currentContent.features[locationIndex];
    
    // Create updated feature
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
    
    // Detect changes for better commit message
    const changes = detectLocationChanges(oldLocation, updatedFeature);
    
    // Update the location
    currentContent.features[locationIndex] = updatedFeature;
    
    // Save with enhanced commit message
    await githubHelper.saveToGitHub(
      'data', 
      'places.geojson', 
      currentContent, 
      'update',
      user,
      changes
    );
    
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
    const user = req.session.user?.username || 'Unknown';
    const reason = req.body?.reason || 'Removed from campaign';
    console.log('Deleting location:', locationName, 'by', user);
    
    // Get current content
    const currentContent = await githubHelper.loadFromGitHub('data', 'places.geojson');
    
    if (!currentContent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Locations file not found' 
      });
    }
    
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
    
    // Save with enhanced commit message
    await githubHelper.saveToGitHub(
      'data', 
      'places.geojson', 
      currentContent, 
      'delete',
      user,
      [reason]
    );
    
    res.json({ success: true, message: `Location "${locationName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to detect location changes
function detectLocationChanges(oldLocation, newLocation) {
  const changes = [];
  
  // Check name change
  if (oldLocation.properties.name !== newLocation.properties.name) {
    changes.push('updated name');
  }
  
  // Check description change
  if (oldLocation.properties.description !== newLocation.properties.description) {
    if (!oldLocation.properties.description && newLocation.properties.description) {
      changes.push('added description');
    } else if (oldLocation.properties.description && !newLocation.properties.description) {
      changes.push('removed description');
    } else {
      changes.push('updated description');
    }
  }
  
  // Check region change
  if (oldLocation.properties.region !== newLocation.properties.region) {
    changes.push('updated region');
  }
  
  // Check type change
  if (oldLocation.properties.type !== newLocation.properties.type) {
    changes.push('updated type');
  }
  
  // Check visited status change
  if (oldLocation.properties.visited !== newLocation.properties.visited) {
    changes.push(newLocation.properties.visited ? 'marked as visited' : 'marked as unvisited');
  }
  
  // Check coordinates change
  const oldCoords = oldLocation.geometry.coordinates;
  const newCoords = newLocation.geometry.coordinates;
  if (oldCoords[0] !== newCoords[0] || oldCoords[1] !== newCoords[1]) {
    changes.push('updated coordinates');
  }
  
  return changes.length > 0 ? changes : ['updated location details'];
}

module.exports = { router, initGitHub };