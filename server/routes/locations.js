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

// Helper function to submit change for review
async function submitForReview(commitSha, action, type, itemName, commitMessage, user) {
  try {
    // Load review system
    const reviewSystem = require('./changelog');
    
    // Create review data
    const reviewData = {
      commitSha,
      action,
      type,
      itemName,
      commitMessage,
      user
    };

    // Submit for review (this will auto-approve for GM/Admin)
    await reviewSystem.submitReview(reviewData);
  } catch (error) {
    console.error('Error submitting for review:', error);
    // Don't fail the main operation if review submission fails
  }
}

// Get current locations (public)
router.get('/', async (req, res) => {
  console.log('🔥 DEBUG: This route is being called!');
  try {
    console.log('🗺️ Fetching locations from GitHub...');
    
    // Add ref parameter to get latest commit and avoid caching
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      ref: 'main' // Force getting from main branch, not cache
    });
    
    console.log('✅ Got data from GitHub, parsing...');
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
    console.log(`📍 Found ${content.features?.length || 0} locations`);
    res.json(content);
  } catch (error) {
    console.error('❌ Error fetching locations:', error.status, error.message);
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
    // Get user from session
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    console.log('Adding new location:', req.body.properties?.name, 'by', user);
    
    // Get current content
    let currentContent;
    let currentSha;
    
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/places.geojson',
        ref: 'main'
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
    
    // Enhanced commit message with user attribution
    const commitMessage = `Create location: ${newFeature.properties.name} (by ${user}) - Initial location creation`;
    
    // Commit to GitHub
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64')
    };
    
    if (currentSha) {
      commitData.sha = currentSha;
    }
    
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents(commitData);
    
    // Submit for review using the commit SHA
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'create', 'location', newFeature.properties.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      feature: newFeature,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error saving location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update location (protected)
router.put('/:name', requireAuth, async (req, res) => {
  try {
    const originalName = decodeURIComponent(req.params.name);
    // Get user from session
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    console.log('Updating location:', originalName, 'by', user);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      ref: 'main'
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
    
    // Get old location for change detection
    const oldLocation = currentContent.features[locationIndex];
    
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
    
    // Detect what changed
    const changes = detectLocationChanges(oldLocation, updatedFeature);
    const changeDescription = changes.length > 0 ? changes.join(', ') : 'Updated location details';
    
    currentContent.features[locationIndex] = updatedFeature;
    
    // Enhanced commit message with user attribution and changes
    const commitMessage = `Update location: ${originalName} (by ${user}) - ${changeDescription}`;
    
    // Commit to GitHub
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    // Submit for review using the commit SHA
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'update', 'location', updatedFeature.properties.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      feature: updatedFeature,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error updating location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete location (protected)
router.delete('/:name', requireAuth, async (req, res) => {
  try {
    const locationName = decodeURIComponent(req.params.name);
    // Get user from session
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    console.log('Deleting location:', locationName, 'by', user);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      ref: 'main'
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
    
    // Enhanced commit message with user attribution
    const commitMessage = `Delete location: ${locationName} (by ${user}) - Removed from campaign`;
    
    // Commit to GitHub
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    // Submit for review using the commit SHA
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'delete', 'location', locationName, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      message: `Location "${locationName}" deleted successfully`,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error deleting location:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to submit change for review
async function submitChangeForReview(commitSha, action, type, itemName, commitMessage, user, userRole) {
  try {
    // Skip creating review entirely for GM self-actions
    if (userRole === 'gm' && user === 'gm') {
      console.log(`🎯 Skipping review creation for GM self-action: ${itemName} (${action} ${type})`);
      return;
    }
    
    // Auto-approve for GM/Admin users (but still create the review for audit trail)
    const autoApprove = userRole === 'gm' || userRole === 'admin';
    
    // Load reviews data
    let reviewsData;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/reviews.json'
      });
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      reviewsData = JSON.parse(content);
    } catch (error) {
      if (error.status === 404) {
        // File doesn't exist, create new structure
        reviewsData = {
          version: "1.0",
          reviews: [],
          lastUpdated: new Date().toISOString()
        };
      } else {
        throw error;
      }
    }

    // Check if review already exists
    const existingReview = reviewsData.reviews.find(r => r.commitSha === commitSha);
    if (existingReview) {
      return; // Review already exists
    }

    // Create new review entry
    const newReview = {
      commitSha,
      action,
      type,
      itemName,
      user,
      timestamp: new Date().toISOString(),
      status: autoApprove ? 'approved' : 'pending',
      reviewedBy: autoApprove ? user : null,
      reviewedAt: autoApprove ? new Date().toISOString() : null,
      reviewNotes: autoApprove ? 'Auto-approved (GM/Admin)' : '',
      commitMessage
    };

    reviewsData.reviews.unshift(newReview); // Add to beginning for chronological order
    
    // Clean up old approved reviews (configurable retention period)
    const retentionDays = 30; // TODO: Make this configurable from frontend config
    const cleanupCutoff = new Date();
    cleanupCutoff.setDate(cleanupCutoff.getDate() - retentionDays);
    
    const beforeCleanup = reviewsData.reviews.length;
    reviewsData.reviews = reviewsData.reviews.filter(review => {
      // NEVER delete pending, rejected, or any unapproved entries
      if (review.status !== 'approved') {
        return true;
      }
      
      // For approved reviews, only keep if newer than retention period
      const reviewDate = new Date(review.reviewedAt || review.timestamp);
      return reviewDate > cleanupCutoff;
    });
    
    const afterCleanup = reviewsData.reviews.length;
    const removedCount = beforeCleanup - afterCleanup;
    
    if (removedCount > 0) {
      console.log(`🧹 Auto-cleanup: Removed ${removedCount} old approved reviews (retention: ${retentionDays} days)`);
    }
    
    reviewsData.lastUpdated = new Date().toISOString();

    // Save updated reviews
    let currentSha = null;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/reviews.json'
      });
      currentSha = currentFile.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const content = JSON.stringify(reviewsData, null, 2);
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/reviews.json',
      message: 'Update review status',
      content: Buffer.from(content).toString('base64')
    };

    if (currentSha) {
      commitData.sha = currentSha;
    }

    await octokit.rest.repos.createOrUpdateFileContents(commitData);
  } catch (error) {
    console.error('Error submitting change for review:', error);
    // Don't fail the main operation if review submission fails
  }
}

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
  
  return changes;
}

module.exports = { router, initGitHub };