// routes/character-paths.js - Character Movement Paths API
// Generates pre-computed path data for hybrid client-side rendering

const express = require('express');
const router = express.Router();

// Initialize GitHub API (passed from main server)
let octokit, REPO_OWNER, REPO_NAME;

const initGitHub = (octokitInstance, repoOwner, repoName) => {
  octokit = octokitInstance;
  REPO_OWNER = repoOwner;
  REPO_NAME = repoName;
};

// Cache for computed paths (invalidate when character data changes)
let pathCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to resolve location coordinates
async function resolveLocationCoordinates(locationName) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/locations.json'
    });
    
    const locationsContent = JSON.parse(Buffer.from(data.content, 'base64').toString());
    const location = locationsContent.locations.find(loc => 
      loc.name.toLowerCase() === locationName.toLowerCase()
    );
    
    return location ? [location.y, location.x] : null; // [lat, lng] format for Leaflet
  } catch (error) {
    console.error('Error resolving location coordinates:', error);
    return null;
  }
}

// Main function to generate character paths
async function generateCharacterPaths() {
  try {
    console.log('🔄 Generating character paths...');
    
    // Load character data from GitHub
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    const charactersContent = JSON.parse(Buffer.from(data.content, 'base64').toString());
    const paths = {};
    const stats = {
      totalCharacters: 0,
      charactersWithPaths: 0,
      totalMovements: 0,
      pathsGenerated: 0
    };
    
    for (const character of charactersContent.characters) {
      stats.totalCharacters++;

      if (!character.movementHistory || character.movementHistory.length === 0) {
        // Character has no movement history, use current location or place of origin
        const coordinates = await resolveCurrentLocation(character);
        if (coordinates) {
          paths[character.id] = {
            id: character.id,
            name: character.name,
            type: 'static', // No movement history
            coordinates: [coordinates], // Single point
            currentLocation: coordinates,
            style: getPathStyleForCharacter(character),
            metadata: {
              movementCount: 0,
              relationship: character.relationship || 'unknown',
              status: character.status || 'unknown'
            }
          };
          stats.pathsGenerated++;
        }
        continue;
      }

      // Process character with movement history
      const pathCoordinates = [];
      // Assign movement_nr to each movement in movementHistory
      const movements = character.movementHistory
        .sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart))
        .map((movement, idx) => ({
          ...movement,
          movement_nr: idx
        }));

      stats.totalMovements += movements.length;

      for (const movement of movements) {
        let coordinates = null;

        if (movement.coordinates && Array.isArray(movement.coordinates)) {
          // Direct coordinates provided
          coordinates = [movement.coordinates[1], movement.coordinates[0]]; // [lat, lng]
        } else if (movement.location) {
          // Resolve location name to coordinates
          coordinates = await resolveLocationCoordinates(movement.location);
        }

        if (coordinates) {
          pathCoordinates.push(coordinates);
        }
      }

      if (pathCoordinates.length > 0) {
        paths[character.id] = {
          id: character.id,
          name: character.name,
          type: 'movement', // Has movement history
          coordinates: pathCoordinates,
          currentLocation: pathCoordinates[pathCoordinates.length - 1], // Last position
          style: getPathStyleForCharacter(character),
          metadata: {
            movementCount: movements.length,
            relationship: character.relationship || 'unknown',
            status: character.status || 'unknown',
            firstMovement: movements[0]?.dateStart,
            lastMovement: movements[movements.length - 1]?.dateStart,
            movementHistory: movements // Now includes id for each movement
          }
        };
        stats.charactersWithPaths++;
        stats.pathsGenerated++;
      }
    }
    
    console.log('✅ Character paths generated:', stats);
    
    return {
      paths,
      metadata: {
        generated: new Date().toISOString(),
        statistics: stats,
        version: '1.0'
      }
    };
    
  } catch (error) {
    console.error('❌ Error generating character paths:', error);
    throw error;
  }
}

// Helper function to resolve current location for character
async function resolveCurrentLocation(character) {
  // Priority: currentLocation > placeOfOrigin coordinates
  if (character.currentLocation && Array.isArray(character.currentLocation)) {
    return [character.currentLocation[1], character.currentLocation[0]]; // [lat, lng]
  }
  
  if (character.placeOfOrigin) {
    return await resolveLocationCoordinates(character.placeOfOrigin);
  }
  
  return null;
}

// Generate path style based on character properties
function getPathStyleForCharacter(character) {
  const relationship = character.relationship || 'unknown';
  const status = character.status || 'unknown';
  
  // Base style configuration
  let style = {
    color: '#999999', // Default gray
    weight: 5,
    opacity: 0.7,
    dashArray: '10,13' // All paths dashed: dash 10, space 10
  };
  
  // Color by relationship
  switch (relationship.toLowerCase()) {
    case 'ally':
      style.color = '#00ff0dff'; // Green
      break;
    case 'friendly':
      style.color = '#35ffcdff'; // Teal
      break;
    case 'neutral':
      style.color = '#ffffffff'; // White
      break;
    case 'suspicious':
      style.color = '#ffc107'; // Yellow
      break;
      case 'hostile':
      style.color = '#f87c17ff'; // Orange
      break;
    case 'enemy':
      style.color = '#f31439ff'; // Red
      break;
    case 'unknown':
      style.color = '#000000ff'; // Black
      break;
    case 'party':
      style.color = 'rgba(212, 0, 255, 1)'; // Pink for Player Party
      break
  }
  
  // Modify style based on status
  if (status.toLowerCase() === 'dead' || status.toLowerCase() === 'deceased') {
    style.opacity = 0.4;
    style.weight = 3;
  }
  
  return style;
}

// API Endpoints

// GET /api/character-paths - Main endpoint for pre-computed paths
router.get('/', async (req, res) => {
  try {
    // Check cache validity
    const now = Date.now();
    if (pathCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving cached character paths');
      return res.json(pathCache);
    }
    
    // Generate fresh paths
    const pathData = await generateCharacterPaths();
    
    // Update cache
    pathCache = pathData;
    cacheTimestamp = now;
    
    res.json(pathData);
    
  } catch (error) {
    console.error('❌ Error in character-paths API:', error);
    res.status(500).json({ 
      error: 'Failed to generate character paths',
      message: error.message 
    });
  }
});

// POST /api/character-paths/invalidate - Force cache invalidation
router.post('/invalidate', async (req, res) => {
  try {
    console.log('🗑️ Invalidating character paths cache');
    pathCache = null;
    cacheTimestamp = null;
    
    res.json({ 
      success: true, 
      message: 'Cache invalidated successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error invalidating cache:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate cache',
      message: error.message 
    });
  }
});

// GET /api/character-paths/stats - Get generation statistics
router.get('/stats', async (req, res) => {
  try {
    if (!pathCache) {
      return res.json({ 
        cached: false, 
        message: 'No cached data available' 
      });
    }
    
    res.json({
      cached: true,
      cacheAge: Date.now() - cacheTimestamp,
      metadata: pathCache.metadata,
      pathCount: Object.keys(pathCache.paths).length
    });
    
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({ 
      error: 'Failed to get stats',
      message: error.message 
    });
  }
});

module.exports = { router, initGitHub };
