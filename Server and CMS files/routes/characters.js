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

// Get all characters (public)
router.get('/', async (req, res) => {
  try {
    const content = await githubHelper.loadFromGitHub('data', 'characters.json');
    
    if (!content) {
      // File doesn't exist yet, return empty structure
      res.json({
        version: "1.0",
        characters: []
      });
    } else {
      res.json(content);
    }
  } catch (error) {
    console.error('Error fetching characters:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add new character (protected)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user?.username || 'Unknown';
    console.log('Adding new character:', req.body.name, 'by', user);
    
    // Get current content
    let currentContent = await githubHelper.loadFromGitHub('data', 'characters.json');
    
    if (!currentContent) {
      // File doesn't exist, create new structure
      currentContent = {
        version: "1.0",
        characters: []
      };
    }
    
    // Create new character
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
    
    // Add new character
    currentContent.characters.push(newCharacter);
    currentContent.lastUpdated = new Date().toISOString();
    
    // Save with enhanced commit message
    const changes = ['Initial character creation with all details'];
    await githubHelper.saveToGitHub(
      'data', 
      'characters.json', 
      currentContent, 
      'create',
      user,
      changes
    );
    
    res.json({ success: true, character: newCharacter });
  } catch (error) {
    console.error('Error saving character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update character (protected)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const originalId = decodeURIComponent(req.params.id);
    const user = req.session.user?.username || 'Unknown';
    console.log('Updating character:', originalId, 'by', user);
    
    // Get current content
    const currentContent = await githubHelper.loadFromGitHub('data', 'characters.json');
    
    if (!currentContent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Characters file not found' 
      });
    }
    
    // Find the character to update
    const characterIndex = currentContent.characters.findIndex(
      character => character.id === originalId
    );
    
    if (characterIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Character not found' 
      });
    }
    
    // Get old data for change detection
    const oldCharacter = currentContent.characters[characterIndex];
    
    // Create updated character
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
    
    // Detect changes for better commit message
    const changes = detectCharacterChanges(oldCharacter, updatedCharacter);
    
    // Update the character
    currentContent.characters[characterIndex] = updatedCharacter;
    currentContent.lastUpdated = new Date().toISOString();
    
    // Save with enhanced commit message
    await githubHelper.saveToGitHub(
      'data', 
      'characters.json', 
      currentContent, 
      'update',
      user,
      changes
    );
    
    res.json({ success: true, character: updatedCharacter });
  } catch (error) {
    console.error('Error updating character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete character (protected)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.id);
    const user = req.session.user?.username || 'Unknown';
    const reason = req.body?.reason || 'Removed from campaign';
    console.log('Deleting character:', characterId, 'by', user);
    
    // Get current content
    const currentContent = await githubHelper.loadFromGitHub('data', 'characters.json');
    
    if (!currentContent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Characters file not found' 
      });
    }
    
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
    
    // Save with enhanced commit message
    await githubHelper.saveToGitHub(
      'data', 
      'characters.json', 
      currentContent, 
      'delete',
      user,
      [reason]
    );
    
    res.json({ success: true, message: `Character "${deletedCharacterName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting character:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
  
  return changes.length > 0 ? changes : ['updated character details'];
}

module.exports = { router, initGitHub };