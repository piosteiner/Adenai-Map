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

// Get all characters (public)
router.get('/', async (req, res) => {
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
router.post('/', requireAuth, async (req, res) => {
  try {
    // Get user from session
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    console.log('Adding new character:', req.body.name, 'by', user);
    
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
    
    // Enhanced commit message with user attribution
    const commitMessage = `Create character: ${newCharacter.name} (by ${user}) - Initial character creation`;
    
    // Commit to GitHub
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64')
    };
    
    if (currentSha) {
      commitData.sha = currentSha;
    }
    
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents(commitData);
    
    // Submit for review using the commit SHA
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'create', 'character', newCharacter.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      character: newCharacter,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error saving character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update character (protected)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const originalId = decodeURIComponent(req.params.id);
    // Get user from session
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    console.log('Updating character:', originalId, 'by', user);
    
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
    
    // Get old character for change detection
    const oldCharacter = currentContent.characters[characterIndex];
    
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
      createdAt: oldCharacter.createdAt, // Keep original creation date
      updatedAt: new Date().toISOString()
    };
    
    // Detect what changed
    const changes = detectCharacterChanges(oldCharacter, updatedCharacter);
    const changeDescription = changes.length > 0 ? changes.join(', ') : 'Updated character details';
    
    currentContent.characters[characterIndex] = updatedCharacter;
    currentContent.lastUpdated = new Date().toISOString();
    
    // Enhanced commit message with user attribution and changes
    const commitMessage = `Update character: ${originalId} (by ${user}) - ${changeDescription}`;
    
    // Commit to GitHub
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    // Submit for review using the commit SHA
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'update', 'character', updatedCharacter.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      character: updatedCharacter,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error updating character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete character (protected)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.id);
    // Get user from session
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    console.log('Deleting character:', characterId, 'by', user);
    
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
    
    // Enhanced commit message with user attribution
    const commitMessage = `Delete character: ${deletedCharacterName} (by ${user}) - Removed from campaign`;
    
    // Commit to GitHub
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    // Submit for review using the commit SHA
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'delete', 'character', deletedCharacterName, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      message: `Character "${deletedCharacterName}" deleted successfully`,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error deleting character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to submit change for review
async function submitChangeForReview(commitSha, action, type, itemName, commitMessage, user, userRole) {
  try {
    // Auto-approve for GM/Admin users
    const autoApprove = userRole === 'gm' || userRole === 'admin';
    
    // Load reviews data
    let reviewsData;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'data/reviews.json'
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
    reviewsData.lastUpdated = new Date().toISOString();

    // Save updated reviews
    let currentSha = null;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'data/reviews.json'
      });
      currentSha = currentFile.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const content = JSON.stringify(reviewsData, null, 2);
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'data/reviews.json',
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

// Helper function to detect character changes
function detectCharacterChanges(oldCharacter, newCharacter) {
  const changes = [];
  
  // Check name change
  if (oldCharacter.name !== newCharacter.name) {
    changes.push('updated name');
  }
  
  // Check title change
  if (oldCharacter.title !== newCharacter.title) {
    if (!oldCharacter.title && newCharacter.title) {
      changes.push('added title');
    } else if (oldCharacter.title && !newCharacter.title) {
      changes.push('removed title');
    } else {
      changes.push('updated title');
    }
  }
  
  // Check location change
  if (oldCharacter.location !== newCharacter.location) {
    if (!oldCharacter.location && newCharacter.location) {
      changes.push('added location');
    } else if (oldCharacter.location && !newCharacter.location) {
      changes.push('removed location');
    } else {
      changes.push('updated location');
    }
  }
  
  // Check description change
  if (oldCharacter.description !== newCharacter.description) {
    if (!oldCharacter.description && newCharacter.description) {
      changes.push('added description');
    } else if (oldCharacter.description && !newCharacter.description) {
      changes.push('removed description');
    } else {
      changes.push('updated description');
    }
  }
  
  // Check status change
  if (oldCharacter.status !== newCharacter.status) {
    changes.push(`changed status to ${newCharacter.status}`);
  }
  
  // Check faction change
  if (oldCharacter.faction !== newCharacter.faction) {
    if (!oldCharacter.faction && newCharacter.faction) {
      changes.push('added faction');
    } else if (oldCharacter.faction && !newCharacter.faction) {
      changes.push('removed faction');
    } else {
      changes.push('updated faction');
    }
  }
  
  // Check relationship change
  if (oldCharacter.relationship !== newCharacter.relationship) {
    changes.push(`changed relationship to ${newCharacter.relationship}`);
  }
  
  // Check first met change
  if (oldCharacter.firstMet !== newCharacter.firstMet) {
    if (!oldCharacter.firstMet && newCharacter.firstMet) {
      changes.push('added first met date');
    } else if (oldCharacter.firstMet && !newCharacter.firstMet) {
      changes.push('removed first met date');
    } else {
      changes.push('updated first met date');
    }
  }
  
  // Check notes change
  if (oldCharacter.notes !== newCharacter.notes) {
    if (!oldCharacter.notes && newCharacter.notes) {
      changes.push('added notes');
    } else if (oldCharacter.notes && !newCharacter.notes) {
      changes.push('removed notes');
    } else {
      changes.push('updated notes');
    }
  }
  
  // Check image change
  if (oldCharacter.image !== newCharacter.image) {
    if (!oldCharacter.image && newCharacter.image) {
      changes.push('added image');
    } else if (oldCharacter.image && !newCharacter.image) {
      changes.push('removed image');
    } else {
      changes.push('updated image');
    }
  }
  
  return changes;
}

module.exports = { router, initGitHub };
