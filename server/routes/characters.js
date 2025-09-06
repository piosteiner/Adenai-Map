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

// Helper function to resolve coordinates from location name
async function resolveLocationCoordinates(locationName) {
  if (!locationName) return null;
  
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson'
    });
    
    const placesData = JSON.parse(Buffer.from(data.content, 'base64').toString());
    
    // Find the location by name
    const location = placesData.features.find(
      feature => feature.properties.name === locationName
    );
    
    if (location && location.geometry && location.geometry.coordinates) {
      return location.geometry.coordinates;
    }
    
    console.warn(`⚠️ Location "${locationName}" not found in places.geojson`);
    return null;
  } catch (error) {
    console.error('Error resolving location coordinates:', error);
    return null;
  }
}

// Helper function to resolve coordinates for movement entries
async function resolveMovementCoordinates(locationName, directCoordinates) {
  // If direct coordinates provided, use those
  if (directCoordinates && Array.isArray(directCoordinates) && directCoordinates.length === 2) {
    return directCoordinates;
  }
  
  // Otherwise, resolve from location name
  if (locationName) {
    return await resolveLocationCoordinates(locationName);
  }
  
  return null;
}

// TEST ROUTE - to verify routing works
router.get('/test', async (req, res) => {
  console.log('🔍 TEST route hit successfully!');
  res.json({ message: 'Test route works!' });
});

// Get all characters (public)
router.get('/', async (req, res) => {
  console.log('🔍 Characters route hit!');
  console.log('🔍 GitHub vars:', { octokit: !!octokit, REPO_OWNER, REPO_NAME });
  
  if (!octokit) {
    console.log('❌ Octokit not initialized!');
    return res.status(500).json({ error: 'GitHub client not initialized' });
  }
  
  try {
    console.log('🔍 Fetching characters from GitHub...');
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    console.log('📥 Raw characters data received, size:', data.size);
    const charactersData = JSON.parse(Buffer.from(data.content, 'base64').toString());
    console.log('✅ Characters parsed successfully, count:', charactersData.characters?.length || 0);
    
    res.json(charactersData);
  } catch (error) {
    console.log('❌ Characters route error:', error.message);
    if (error.status === 404) {
      console.log('⚠️ Characters file not found, returning empty structure');
      // File doesn't exist yet, return empty structure
      res.json({
        version: "1.0",
        characters: []
      });
    } else {
      console.error('❌ Error fetching characters:', error.message);
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
    
    // Resolve coordinates for place of origin
    const originCoordinates = await resolveLocationCoordinates(req.body.placeOfOrigin);
    
    // Get current content
    let currentContent;
    let currentSha;
    
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/characters.json'
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
    
    // Add new character with place of origin coordinates
    const newCharacter = {
      id: req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: req.body.name,
      title: req.body.title || '',
      placeOfOrigin: req.body.placeOfOrigin || '',
      coordinates: originCoordinates,
      description: req.body.description || '',
      image: req.body.image || '',
      status: req.body.status || 'alive',
      faction: req.body.faction || '',
      relationship: req.body.relationship || 'neutral',
      firstMet: req.body.firstMet || '',
      notes: req.body.notes || '',
      movementHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Set initial currentLocation based on place of origin only if no movement history
    if (req.body.placeOfOrigin && originCoordinates) {
      newCharacter.currentLocation = {
        location: req.body.placeOfOrigin,
        date: new Date().toISOString().split('T')[0], // Today's date
        dateStart: new Date().toISOString().split('T')[0],
        dateEnd: null,
        coordinates: originCoordinates,
        notes: 'Initial location based on place of origin'
      };
    }
    
    currentContent.characters.push(newCharacter);
    currentContent.lastUpdated = new Date().toISOString();
    
    // Enhanced commit message with user attribution
    const commitMessage = `Create character: ${newCharacter.name} (by ${user}) - Initial character creation`;
    
    // Commit to GitHub
    const commitData = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
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
    
    // Resolve coordinates for place of origin
    const originCoordinates = await resolveLocationCoordinates(req.body.placeOfOrigin);
    
    // Get current content
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
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
    
    // Update the character data with place of origin coordinates
    const updatedCharacter = {
      id: req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: req.body.name,
      title: req.body.title || '',
      placeOfOrigin: req.body.placeOfOrigin || '',
      coordinates: originCoordinates,
      description: req.body.description || '',
      image: req.body.image || '',
      status: req.body.status || 'alive',
      faction: req.body.faction || '',
      relationship: req.body.relationship || 'neutral',
      firstMet: req.body.firstMet || '',
      notes: req.body.notes || '',
      movementHistory: oldCharacter.movementHistory || [],
      currentLocation: oldCharacter.currentLocation || null, // Preserve existing currentLocation
      createdAt: oldCharacter.createdAt, // Keep original creation date
      updatedAt: new Date().toISOString()
    };

    // Only set currentLocation from placeOfOrigin if NO movement history exists
    if (req.body.placeOfOrigin && originCoordinates && 
        (!updatedCharacter.movementHistory || updatedCharacter.movementHistory.length === 0)) {
      updatedCharacter.currentLocation = {
        location: req.body.placeOfOrigin,
        date: new Date().toISOString().split('T')[0],
        dateStart: new Date().toISOString().split('T')[0],
        dateEnd: null,
        coordinates: originCoordinates,
        notes: 'Location set based on place of origin'
      };
    }
    
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
      path: 'public/data/characters.json',
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
      path: 'public/data/characters.json'
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
      path: 'public/data/characters.json',
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

// ENHANCED: Add movement entry to character with date range support
router.post('/:id/movements', requireAuth, async (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.id);
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    
    console.log('Adding movement to character:', characterId, 'by', user);
    
    // Validate custom location requirements
    if (req.body.isCustomLocation === true) {
      // For custom locations, coordinates must be provided and valid
      if (!req.body.coordinates || 
          !Array.isArray(req.body.coordinates) || 
          req.body.coordinates.length !== 2 ||
          req.body.coordinates[0] === null || 
          req.body.coordinates[0] === undefined ||
          req.body.coordinates[1] === null || 
          req.body.coordinates[1] === undefined ||
          isNaN(req.body.coordinates[0]) || 
          isNaN(req.body.coordinates[1])) {
        return res.status(400).json({ 
          success: false, 
          error: 'Custom locations require valid coordinates. Please provide both X and Y coordinates.' 
        });
      }
      
      // Validate location name for custom locations
      if (!req.body.location || req.body.location.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: 'Custom locations require a location name.' 
        });
      }
    }
    
    // Resolve coordinates
    const coordinates = await resolveMovementCoordinates(
      req.body.location, 
      req.body.coordinates
    );
    
    if (!coordinates) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not resolve coordinates for movement' 
      });
    }
    
    // Get current characters data
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find character
    const characterIndex = currentContent.characters.findIndex(
      character => character.id === characterId
    );
    
    if (characterIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Character not found' 
      });
    }
    
    const character = currentContent.characters[characterIndex];
    
    // Initialize movement history if it doesn't exist
    if (!character.movementHistory) {
      character.movementHistory = [];
    }
    
    // ENHANCED: Create new movement entry with date ranges and custom location support
    const newMovement = {
      id: `movement_${Date.now()}`,
      movement_nr: character.movementHistory.length, // Assign next sequence number
      date: req.body.dateStart || req.body.date || new Date().toISOString().split('T')[0], // Legacy support
      dateStart: req.body.dateStart || req.body.date || new Date().toISOString().split('T')[0],
      dateEnd: req.body.dateEnd || null,
      location: req.body.location || null,
      coordinates: coordinates,
      notes: req.body.notes || '',
      type: req.body.type || 'travel',
      isCustomLocation: req.body.isCustomLocation || false,
      createdAt: new Date().toISOString()
    };
    
    // Add to movement history (sorted by date using dateStart)
    character.movementHistory.push(newMovement);
    character.movementHistory.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
    
    // Reassign movement_nr after sorting to maintain chronological order
    character.movementHistory.forEach((movement, index) => {
      movement.movement_nr = index;
    });
    
    // Update current location if this is the most recent movement
    const latestMovement = character.movementHistory[character.movementHistory.length - 1];
    if (latestMovement.id === newMovement.id) {
      character.location = newMovement.location || 'Custom Location';
      character.coordinates = newMovement.coordinates;
      character.currentLocation = {
        date: newMovement.dateStart || newMovement.date,
        dateStart: newMovement.dateStart,
        dateEnd: newMovement.dateEnd,
        location: newMovement.location,
        coordinates: newMovement.coordinates,
        notes: newMovement.notes
      };
    }
    
    character.updatedAt = new Date().toISOString();
    currentContent.lastUpdated = new Date().toISOString();
    
    // ENHANCED: Better commit message with date range info
    const dateInfo = newMovement.dateEnd ? 
      `${newMovement.dateStart} to ${newMovement.dateEnd}` : 
      newMovement.dateStart;
    
    const commitMessage = `Add movement to character: ${character.name} (by ${user}) - ${newMovement.location || 'Custom coordinates'} (${dateInfo})`;
    
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    // Submit for review
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'update', 'character', character.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      movement: newMovement,
      character: character,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error adding movement:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// REORDER MOVEMENTS: Must be defined before generic /:movementId route!
router.put('/:id/movements/reorder', requireAuth, async (req, res) => {
  try {
    console.log('🎯 REORDER ENDPOINT CALLED - Route: PUT /:id/movements/reorder');
    console.log('🎯 Request params:', req.params);
    console.log('🎯 Request body:', JSON.stringify(req.body, null, 2));
    
    const characterId = decodeURIComponent(req.params.id);
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    const { movements } = req.body;
    
    if (!Array.isArray(movements)) {
      console.log('❌ Invalid movements data - not an array');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid movements data - expected array' 
      });
    }
    
    console.log('🔄 Reordering movements for character:', characterId, 'by', user);
    
    // Get current characters data with conflict detection
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find character
    const characterIndex = currentContent.characters.findIndex(
      character => character.id === characterId
    );
    
    if (characterIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Character not found' 
      });
    }
    
    const character = currentContent.characters[characterIndex];
    
    // Conflict detection: check if movement count matches
    if (!character.movementHistory || character.movementHistory.length !== movements.length) {
      return res.status(409).json({
        success: false,
        error: 'Movement conflict detected - data may have been modified by another user',
        currentCount: character.movementHistory ? character.movementHistory.length : 0,
        expectedCount: movements.length
      });
    }
    
    // Validate that all movement IDs exist and match
    const currentIds = new Set(character.movementHistory.map(m => m.id));
    const reorderedIds = new Set(movements.map(m => m.id));
    
    if (currentIds.size !== reorderedIds.size || 
        [...currentIds].some(id => !reorderedIds.has(id))) {
      return res.status(409).json({
        success: false,
        error: 'Movement ID mismatch - movements may have been modified',
        currentIds: [...currentIds],
        reorderedIds: [...reorderedIds]
      });
    }
    
    // Update movement_nr for each movement and preserve all other data
    const updatedMovements = movements.map((reorderedMovement, index) => {
      const originalMovement = character.movementHistory.find(m => m.id === reorderedMovement.id);
      if (!originalMovement) {
        throw new Error(`Movement with ID ${reorderedMovement.id} not found`);
      }
      
      return {
        ...originalMovement,
        movement_nr: index,
        updatedAt: new Date().toISOString()
      };
    });
    
    // Replace movement history with reordered version
    character.movementHistory = updatedMovements;
    character.updatedAt = new Date().toISOString();
    currentContent.lastUpdated = new Date().toISOString();
    
    // Commit to GitHub
    const commitMessage = `Reorder movements for character: ${character.name} (by ${user}) - ${movements.length} movements reordered`;
    
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'update', 'character', character.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true,
      message: 'Movement order updated successfully',
      character: character,
      reorderedCount: movements.length,
      commitSha: commitSha
    });
    
  } catch (error) {
    console.error('Error reordering movements:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reorder movements',
      message: error.message 
    });
  }
});

// ENHANCED: Update movement entry with date range support
router.put('/:id/movements/:movementId', requireAuth, async (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.id);
    const movementId = decodeURIComponent(req.params.movementId);
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    
    // Validate custom location requirements
    if (req.body.isCustomLocation === true) {
      // For custom locations, coordinates must be provided and valid
      if (!req.body.coordinates || 
          !Array.isArray(req.body.coordinates) || 
          req.body.coordinates.length !== 2 ||
          req.body.coordinates[0] === null || 
          req.body.coordinates[0] === undefined ||
          req.body.coordinates[1] === null || 
          req.body.coordinates[1] === undefined ||
          isNaN(req.body.coordinates[0]) || 
          isNaN(req.body.coordinates[1])) {
        return res.status(400).json({ 
          success: false, 
          error: 'Custom locations require valid coordinates. Please provide both X and Y coordinates.' 
        });
      }
      
      // Validate location name for custom locations
      if (!req.body.location || req.body.location.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: 'Custom locations require a location name.' 
        });
      }
    }
    
    // Resolve coordinates
    const coordinates = await resolveMovementCoordinates(
      req.body.location, 
      req.body.coordinates
    );
    
    if (!coordinates) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not resolve coordinates for movement' 
      });
    }
    
    // Get current characters data
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find character and movement
    const character = currentContent.characters.find(c => c.id === characterId);
    if (!character || !character.movementHistory) {
      return res.status(404).json({ success: false, error: 'Character or movement not found' });
    }
    
    const movementIndex = character.movementHistory.findIndex(m => m.id === movementId);
    if (movementIndex === -1) {
      return res.status(404).json({ success: false, error: 'Movement not found' });
    }
    
    // ENHANCED: Update movement with date range support
    const updatedMovement = {
      ...character.movementHistory[movementIndex],
      date: req.body.dateStart || req.body.date || character.movementHistory[movementIndex].date, // Legacy support
      dateStart: req.body.dateStart || req.body.date || character.movementHistory[movementIndex].dateStart,
      dateEnd: req.body.dateEnd || null,
      location: req.body.location || null,
      coordinates: coordinates,
      notes: req.body.notes || '',
      type: req.body.type || character.movementHistory[movementIndex].type,
      isCustomLocation: req.body.isCustomLocation || character.movementHistory[movementIndex].isCustomLocation,
      updatedAt: new Date().toISOString()
    };
    
    character.movementHistory[movementIndex] = updatedMovement;
    
    // Re-sort by date (using dateStart for sorting)
    character.movementHistory.sort((a, b) => new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date));
    
    // Reassign movement_nr after sorting to maintain chronological order
    character.movementHistory.forEach((movement, index) => {
      movement.movement_nr = index;
    });
    
    // Update current location if this was the most recent movement
    const latestMovement = character.movementHistory[character.movementHistory.length - 1];
    if (latestMovement.id === movementId) {
      character.location = latestMovement.location || 'Custom Location';
      character.coordinates = latestMovement.coordinates;
      character.currentLocation = {
        date: latestMovement.dateStart || latestMovement.date,
        dateStart: latestMovement.dateStart,
        dateEnd: latestMovement.dateEnd,
        location: latestMovement.location,
        coordinates: latestMovement.coordinates,
        notes: latestMovement.notes
      };
    }
    
    character.updatedAt = new Date().toISOString();
    currentContent.lastUpdated = new Date().toISOString();
    
    // ENHANCED: Better commit message with date range info
    const dateInfo = updatedMovement.dateEnd ? 
      `${updatedMovement.dateStart} to ${updatedMovement.dateEnd}` : 
      updatedMovement.dateStart;
    
    const commitMessage = `Update character movement: ${character.name} (by ${user}) - Modified ${updatedMovement.location || 'coordinates'} entry (${dateInfo})`;
    
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'update', 'character', character.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      movement: updatedMovement,
      character: character,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error updating movement:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Reorder movements for a character
// Delete movement entry
router.delete('/:id/movements/:movementId', requireAuth, async (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.id);
    const movementId = decodeURIComponent(req.params.movementId);
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';
    
    // Get current characters data
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    // Find character and movement
    const character = currentContent.characters.find(c => c.id === characterId);
    if (!character || !character.movementHistory) {
      return res.status(404).json({ success: false, error: 'Character or movement not found' });
    }
    
    const movementIndex = character.movementHistory.findIndex(m => m.id === movementId);
    if (movementIndex === -1) {
      return res.status(404).json({ success: false, error: 'Movement not found' });
    }
    
    // Remove movement
    const deletedMovement = character.movementHistory[movementIndex];
    character.movementHistory.splice(movementIndex, 1);
    
    // Update current location to the most recent remaining movement
    if (character.movementHistory.length > 0) {
      const latestMovement = character.movementHistory[character.movementHistory.length - 1];
      character.location = latestMovement.location || 'Custom Location';
      character.coordinates = latestMovement.coordinates;
      character.currentLocation = {
        date: latestMovement.dateStart || latestMovement.date,
        dateStart: latestMovement.dateStart,
        dateEnd: latestMovement.dateEnd,
        location: latestMovement.location,
        coordinates: latestMovement.coordinates,
        notes: latestMovement.notes
      };
    } else {
      // No movements left, fall back to place of origin if available
      if (character.placeOfOrigin) {
        const originCoordinates = await resolveLocationCoordinates(character.placeOfOrigin);
        character.location = character.placeOfOrigin;
        character.coordinates = originCoordinates || character.coordinates;
        character.currentLocation = {
          date: new Date().toISOString().split('T')[0],
          dateStart: new Date().toISOString().split('T')[0],
          dateEnd: null,
          location: character.placeOfOrigin,
          coordinates: originCoordinates || character.coordinates,
          notes: 'Fallback to place of origin after movement deletion'
        };
      } else {
        // No place of origin either, keep current location as is
        character.currentLocation = {
          date: new Date().toISOString().split('T')[0],
          dateStart: new Date().toISOString().split('T')[0],
          dateEnd: null,
          location: character.location || 'Unknown',
          coordinates: character.coordinates,
          notes: 'Location after movement deletion'
        };
      }
    }
    
    character.updatedAt = new Date().toISOString();
    currentContent.lastUpdated = new Date().toISOString();
    
    // Commit to GitHub
    const commitMessage = `Delete character movement: ${character.name} (by ${user}) - Removed ${deletedMovement.location || 'coordinates'} entry`;
    
    const commitResponse = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    const commitSha = commitResponse.data.commit.sha;
    await submitChangeForReview(commitSha, 'update', 'character', character.name, commitMessage, user, userRole);
    
    res.json({ 
      success: true, 
      message: 'Movement deleted successfully',
      character: character,
      commitSha: commitSha
    });
  } catch (error) {
    console.error('Error deleting movement:', error.message);
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
  
  // Check place of origin change
  if (oldCharacter.placeOfOrigin !== newCharacter.placeOfOrigin) {
    if (!oldCharacter.placeOfOrigin && newCharacter.placeOfOrigin) {
      changes.push('added place of origin');
    } else if (oldCharacter.placeOfOrigin && !newCharacter.placeOfOrigin) {
      changes.push('removed place of origin');
    } else {
      changes.push('updated place of origin');
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

// Data migration route - ensures all characters have proper structure
router.post('/migrate', requireAuth, async (req, res) => {
  try {
    console.log('🔄 Starting character data migration...');
    
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      ref: 'main'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    let migratedCount = 0;
    let changes = [];
    
    for (const character of currentContent.characters) {
      let characterChanged = false;
      
      // Ensure movementHistory exists first
      if (!character.movementHistory) {
        character.movementHistory = [];
        characterChanged = true;
        changes.push(`Added movementHistory array to ${character.name}`);
      }
      
      // Only set currentLocation from placeOfOrigin if:
      // 1. placeOfOrigin exists
      // 2. currentLocation is missing
      // 3. movementHistory is empty (no existing movements)
      if (character.placeOfOrigin && !character.currentLocation && 
          (!character.movementHistory || character.movementHistory.length === 0)) {
        const originCoordinates = await resolveLocationCoordinates(character.placeOfOrigin);
        if (originCoordinates) {
          character.currentLocation = {
            location: character.placeOfOrigin,
            date: character.createdAt ? character.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            dateStart: character.createdAt ? character.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            dateEnd: null,
            coordinates: originCoordinates,
            notes: 'Migrated from place of origin (no movement history)'
          };
          characterChanged = true;
          changes.push(`Set currentLocation for ${character.name} based on placeOfOrigin (no movement history)`);
        }
      }
      
      // Ensure timestamps exist
      if (!character.createdAt) {
        character.createdAt = new Date().toISOString();
        characterChanged = true;
        changes.push(`Added createdAt timestamp to ${character.name}`);
      }
      
      if (!character.updatedAt) {
        character.updatedAt = new Date().toISOString();
        characterChanged = true;
        changes.push(`Added updatedAt timestamp to ${character.name}`);
      }
      
      if (characterChanged) {
        migratedCount++;
      }
    }
    
    if (migratedCount > 0) {
      currentContent.lastUpdated = new Date().toISOString();
      
      const user = req.session.displayName || req.session.username || 'System';
      const commitMessage = `Data migration: Updated ${migratedCount} characters (by ${user}) - Enhanced structure for popup display`;
      
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/characters.json',
        message: commitMessage,
        content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
        sha: currentFile.sha
      });
      
      console.log(`✅ Migration complete: ${migratedCount} characters updated`);
    }
    
    res.json({ 
      success: true, 
      migratedCount,
      changes,
      message: migratedCount > 0 ? `Successfully migrated ${migratedCount} characters` : 'No migration needed'
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Special one-time reset endpoint to fix incorrectly migrated currentLocation data
router.post('/reset-and-migrate', requireAuth, async (req, res) => {
  try {
    console.log('🔄 Starting character data reset and migration...');
    
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      ref: 'main'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    let resetCount = 0;
    let migratedCount = 0;
    let changes = [];
    
    // STEP 1: Reset all currentLocation fields
    for (const character of currentContent.characters) {
      if (character.currentLocation) {
        delete character.currentLocation;
        resetCount++;
        changes.push(`Reset currentLocation for ${character.name}`);
      }
    }
    
    // STEP 2: Run the corrected migration logic
    for (const character of currentContent.characters) {
      let characterChanged = false;
      
      // Ensure movementHistory exists first
      if (!character.movementHistory) {
        character.movementHistory = [];
        characterChanged = true;
        changes.push(`Added movementHistory array to ${character.name}`);
      }
      
      // Only set currentLocation from placeOfOrigin if:
      // 1. placeOfOrigin exists
      // 2. currentLocation is missing (which it now is after reset)
      // 3. movementHistory is empty (no existing movements)
      if (character.placeOfOrigin && !character.currentLocation && 
          (!character.movementHistory || character.movementHistory.length === 0)) {
        const originCoordinates = await resolveLocationCoordinates(character.placeOfOrigin);
        if (originCoordinates) {
          character.currentLocation = {
            location: character.placeOfOrigin,
            date: character.createdAt ? character.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            dateStart: character.createdAt ? character.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            dateEnd: null,
            coordinates: originCoordinates,
            notes: 'Set from place of origin (no movement history)'
          };
          characterChanged = true;
          changes.push(`Set currentLocation for ${character.name} from placeOfOrigin (no movement history)`);
        }
      }
      
      // Ensure timestamps exist
      if (!character.createdAt) {
        character.createdAt = new Date().toISOString();
        characterChanged = true;
        changes.push(`Added createdAt timestamp to ${character.name}`);
      }
      
      if (!character.updatedAt) {
        character.updatedAt = new Date().toISOString();
        characterChanged = true;
        changes.push(`Added updatedAt timestamp to ${character.name}`);
      }
      
      if (characterChanged) {
        migratedCount++;
      }
    }
    
    // Save the corrected data
    currentContent.lastUpdated = new Date().toISOString();
    
    const user = req.session.displayName || req.session.username || 'System';
    const commitMessage = `Character data reset and migration: Reset ${resetCount} currentLocations, migrated ${migratedCount} characters (by ${user})`;
    
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    console.log(`✅ Reset and migration complete: ${resetCount} reset, ${migratedCount} migrated`);
    
    res.json({ 
      success: true, 
      resetCount,
      migratedCount,
      changes,
      message: `Successfully reset ${resetCount} currentLocations and migrated ${migratedCount} characters`
    });
    
  } catch (error) {
    console.error('❌ Reset and migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add movement_nr to existing movements
router.post('/migrate-movement-numbers', requireAuth, async (req, res) => {
  try {
    const user = req.session.displayName || req.session.username || 'Unknown';
    console.log('🔄 Starting movement_nr migration...');
    
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json',
      ref: 'main'
    });
    
    const currentContent = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    let migratedCharacters = 0;
    let migratedMovements = 0;
    let changes = [];
    
    for (const character of currentContent.characters) {
      if (character.movementHistory && character.movementHistory.length > 0) {
        let characterChanged = false;
        
        // Sort movements chronologically first
        character.movementHistory.sort((a, b) => 
          new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date)
        );
        
        // Add movement_nr to movements that don't have it
        character.movementHistory.forEach((movement, index) => {
          if (typeof movement.movement_nr === 'undefined') {
            movement.movement_nr = index;
            characterChanged = true;
            migratedMovements++;
          }
        });
        
        if (characterChanged) {
          character.updatedAt = new Date().toISOString();
          migratedCharacters++;
          changes.push(`Added movement_nr to ${character.movementHistory.length} movements for ${character.name}`);
        }
      }
    }
    
    if (migratedCharacters > 0) {
      currentContent.lastUpdated = new Date().toISOString();
      
      const commitMessage = `Movement numbering migration: Added movement_nr to ${migratedMovements} movements across ${migratedCharacters} characters (by ${user})`;
      
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/characters.json',
        message: commitMessage,
        content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64'),
        sha: currentFile.sha
      });
      
      console.log(`✅ Movement numbering migration complete: ${migratedMovements} movements across ${migratedCharacters} characters`);
    } else {
      console.log('ℹ️ No movement numbering migration needed');
    }
    
    res.json({
      success: true,
      migratedCharacters,
      migratedMovements,
      changes,
      message: migratedCharacters > 0 ? 
        `Successfully added movement_nr to ${migratedMovements} movements across ${migratedCharacters} characters` : 
        'No movement numbering migration needed'
    });
    
  } catch (error) {
    console.error('❌ Movement numbering migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initGitHub };