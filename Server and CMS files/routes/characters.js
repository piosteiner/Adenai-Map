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
router.put('/:id', requireAuth, async (req, res) => {
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
router.delete('/:id', requireAuth, async (req, res) => {
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

module.exports = { router, initGitHub };