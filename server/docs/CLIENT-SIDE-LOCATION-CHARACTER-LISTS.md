# Client-Side Implementation: Location-Based Character Lists

## 🎯 Task Overview
Implement a feature that displays lists of characters for each location when a location is selected. The server-side API has been enhanced to provide location-grouped character data.

## 📡 Server API Changes (Already Implemented)

### Enhanced `/api/characters` Response
The characters endpoint now includes location groupings:

```json
{
  "version": "1.0",
  "characters": [
    {
      "id": "char_001",
      "name": "Thorin Ironbeard",
      "computedCurrentLocation": "Silbergrat",
      "computedPosition": [1041, 1240],
      "computedMovementCount": 3,
      "computedLastMovementDate": "2024-01-20"
      // ... other character fields
    }
  ],
  "locationGroups": {
    "Silbergrat": [
      {
        "id": "char_001",
        "name": "Thorin Ironbeard",
        "status": "alive",
        "relationship": "ally",
        "image": "/uploads/thorin.jpg",
        "title": "Dwarf Warrior",
        "computedPosition": [1041, 1240],
        "lastMovementDate": "2024-01-20",
        "movementCount": 3
      }
    ],
    "Toftgard": [
      {
        "id": "char_002",
        "name": "Elara Moonwhisper"
        // ... character summary
      }
    ]
  }
}
```

### New Location-Specific Endpoint
`GET /api/characters/location/:locationName` returns:

```json
{
  "success": true,
  "location": "Silbergrat",
  "characters": [
    {
      "id": "char_001",
      "name": "Thorin Ironbeard",
      "status": "alive",
      "relationship": "ally",
      "image": "/uploads/thorin.jpg",
      "title": "Dwarf Warrior",
      "computedPosition": [1041, 1240],
      "lastMovementDate": "2024-01-20",
      "movementCount": 3,
      "description": "Veteran warrior",
      "faction": "Ironforge Clan"
    }
  ],
  "totalCharacters": 1
}
```

## 🔧 Required Changes

### 1. Update Location Operations Module
**File**: `/admin-interface/js/modules/locations/operations.js`

Add location groups data management:

```javascript
class LocationOperations {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.locations = [];
        this.locationGroups = {}; // NEW: Store character groups
        this.apiBaseUrl = '/api/locations';
    }

    // NEW: Load locations with character data
    async loadLocationsWithCharacters() {
        try {
            console.log('📡 Loading locations and character data...');
            
            // Load locations
            await this.loadLocations();
            
            // Load character groups
            const response = await fetch('/api/characters');
            const characterData = await response.json();
            
            if (characterData.locationGroups) {
                this.locationGroups = characterData.locationGroups;
                console.log(`👥 Loaded character groups for ${Object.keys(this.locationGroups).length} locations`);
            }
            
            return { locations: this.locations, locationGroups: this.locationGroups };
        } catch (error) {
            console.error('❌ Failed to load locations with characters:', error);
            throw error;
        }
    }

    // NEW: Get characters for specific location
    async getCharactersForLocation(locationName) {
        try {
            // First try cached data
            if (this.locationGroups[locationName]) {
                return {
                    success: true,
                    location: locationName,
                    characters: this.locationGroups[locationName],
                    totalCharacters: this.locationGroups[locationName].length,
                    cached: true
                };
            }
            
            // Fallback to API call
            const response = await fetch(`/api/characters/location/${encodeURIComponent(locationName)}`);
            const data = await response.json();
            
            // Update cache
            if (data.success && data.characters) {
                this.locationGroups[locationName] = data.characters;
            }
            
            return data;
        } catch (error) {
            console.error('❌ Failed to get characters for location:', error);
            return { success: false, error: error.message };
        }
    }

    // NEW: Get character count for location
    getCharacterCountForLocation(locationName) {
        return this.locationGroups[locationName] ? this.locationGroups[locationName].length : 0;
    }

    // NEW: Update character groups when character data changes
    updateLocationGroups(newLocationGroups) {
        this.locationGroups = newLocationGroups || {};
        console.log('🔄 Updated location groups cache');
    }
}
```

### 2. Update Location UI Module
**File**: `/admin-interface/js/modules/locations/ui.js`

Enhance location cards with character lists:

```javascript
class LocationUI {
    // ... existing methods ...

    renderLocationCard(location) {
        const props = location.properties;
        const coords = location.geometry.coordinates;
        
        // Get character count for this location
        const characterCount = this.locationOps.getCharacterCountForLocation(props.name);
        
        return `
            <div class="location-card" data-location="${props.name}">
                <div class="location-header">
                    <div class="location-info">
                        ${props.image ? `<div class="location-image">
                            <img src="${props.image}" alt="${props.name}" />
                        </div>` : ''}
                        <div class="location-text">
                            <h3>${props.name}</h3>
                            <span class="location-type">${this.formatType(props.type)}</span>
                            <span class="location-region">${this.formatRegion(props.region)}</span>
                        </div>
                    </div>
                    <div class="location-meta">
                        <span class="coordinates">${coords[0]}, ${coords[1]}</span>
                        ${props.visited ? '<span class="visited-badge">✓ Visited</span>' : ''}
                    </div>
                </div>
                
                <!-- NEW: Character section -->
                <div class="location-characters-section">
                    <button class="location-characters-toggle" data-location="${props.name}">
                        👥 Characters (${characterCount})
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="location-characters-list" data-location="${props.name}" style="display: none;">
                        <div class="characters-loading">Loading characters...</div>
                    </div>
                </div>

                ${props.description ? `<p class="location-description">${props.description}</p>` : ''}
                
                <div class="location-actions">
                    <button class="btn-secondary location-edit-btn" data-location="${props.name}">✏️ Edit</button>
                    <button class="btn-danger location-delete-btn" data-location="${props.name}">🗑️ Delete</button>
                </div>
            </div>
        `;
    }

    // NEW: Render character list for location
    renderLocationCharacters(characters, locationName) {
        if (!characters || characters.length === 0) {
            return `
                <div class="location-characters-empty">
                    <span class="empty-icon">👻</span>
                    <p>No characters currently at this location</p>
                </div>
            `;
        }

        const characterCards = characters.map(character => this.renderCharacterMiniCard(character)).join('');
        
        return `
            <div class="location-characters-grid">
                ${characterCards}
            </div>
        `;
    }

    // NEW: Render compact character card
    renderCharacterMiniCard(character) {
        const statusEmoji = this.getStatusEmoji(character.status);
        const relationshipEmoji = this.getRelationshipEmoji(character.relationship);
        
        return `
            <div class="character-mini-card" data-character-id="${character.id}">
                <div class="character-mini-header">
                    ${character.image ? `
                        <div class="character-mini-image">
                            <img src="${character.image}" alt="${character.name}" />
                        </div>
                    ` : '<div class="character-mini-placeholder">👤</div>'}
                    <div class="character-mini-info">
                        <h4 class="character-mini-name">${character.name}</h4>
                        ${character.title ? `<p class="character-mini-title">${character.title}</p>` : ''}
                    </div>
                </div>
                <div class="character-mini-badges">
                    <span class="status-badge mini status-${character.status}" title="Status: ${character.status}">
                        ${statusEmoji}
                    </span>
                    <span class="relationship-badge mini relationship-${character.relationship}" title="Relationship: ${character.relationship}">
                        ${relationshipEmoji}
                    </span>
                </div>
                <div class="character-mini-meta">
                    ${character.movementCount ? `<span class="movement-count">🛤️ ${character.movementCount}</span>` : ''}
                    ${character.lastMovementDate ? `<span class="last-movement" title="Last movement">${character.lastMovementDate}</span>` : ''}
                </div>
            </div>
        `;
    }

    // NEW: Helper methods for character display
    getStatusEmoji(status) {
        const statusMap = {
            'alive': '😊',
            'dead': '💀',
            'undead': '🧟',
            'missing': '❓',
            'unknown': '🤷'
        };
        return statusMap[status] || '🤷';
    }

    getRelationshipEmoji(relationship) {
        const relationshipMap = {
            'ally': '😊',
            'friendly': '🙂',
            'neutral': '😐',
            'suspicious': '🤨',
            'hostile': '😠',
            'enemy': '⚔️',
            'party': '👥'
        };
        return relationshipMap[relationship] || '😐';
    }

    // NEW: Toggle character list display
    async toggleLocationCharacters(locationName) {
        const toggleButton = document.querySelector(`[data-location="${locationName}"].location-characters-toggle`);
        const charactersList = document.querySelector(`[data-location="${locationName}"].location-characters-list`);
        const toggleIcon = toggleButton.querySelector('.toggle-icon');
        
        if (!charactersList) return;

        const isVisible = charactersList.style.display !== 'none';
        
        if (isVisible) {
            // Hide characters
            charactersList.style.display = 'none';
            toggleIcon.textContent = '▼';
        } else {
            // Show characters
            charactersList.style.display = 'block';
            toggleIcon.textContent = '▲';
            
            // Load characters if not already loaded
            if (charactersList.querySelector('.characters-loading')) {
                await this.loadCharactersForLocation(locationName);
            }
        }
    }

    // NEW: Load and display characters for location
    async loadCharactersForLocation(locationName) {
        const charactersList = document.querySelector(`[data-location="${locationName}"].location-characters-list`);
        if (!charactersList) return;

        try {
            charactersList.innerHTML = '<div class="characters-loading">Loading characters...</div>';
            
            const result = await this.locationOps.getCharactersForLocation(locationName);
            
            if (result.success) {
                const charactersHtml = this.renderLocationCharacters(result.characters, locationName);
                charactersList.innerHTML = charactersHtml;
                
                // Add click handlers for character mini-cards
                this.setupCharacterMiniCardHandlers(charactersList);
            } else {
                charactersList.innerHTML = `<div class="characters-error">Failed to load characters: ${result.error}</div>`;
            }
        } catch (error) {
            console.error('❌ Error loading characters for location:', error);
            charactersList.innerHTML = '<div class="characters-error">Error loading characters</div>';
        }
    }

    // NEW: Setup click handlers for character mini-cards
    setupCharacterMiniCardHandlers(container) {
        container.querySelectorAll('.character-mini-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const characterId = e.currentTarget.dataset.characterId;
                this.showCharacterDetails(characterId);
            });
        });
    }

    // NEW: Show character details (integration with character module)
    showCharacterDetails(characterId) {
        // Trigger character detail view if character module is available
        if (window.adminCharacters && typeof window.adminCharacters.showCharacterDetail === 'function') {
            window.adminCharacters.showCharacterDetail(characterId);
        } else {
            console.log('📍 Show character details for:', characterId);
            // Could implement a simple modal or navigate to character page
        }
    }
}
```

### 3. Update Location Index Module
**File**: `/admin-interface/js/modules/locations/index.js`

Add character list functionality:

```javascript
class AdminLocations {
    // ... existing methods ...

    setupEventListeners() {
        // ... existing event listeners ...

        // NEW: Character toggle button handler
        this.ui.addDelegatedListener('locations-list', '.location-characters-toggle', 'click', (e) => {
            e.preventDefault();
            const locationName = e.target.dataset.location;
            this.uiManager.toggleLocationCharacters(locationName);
        });

        // NEW: Listen for character data changes
        document.addEventListener('dataChanged', (e) => {
            if (e.detail.type === 'characters') {
                this.refreshCharacterData();
            }
        });

        // NEW: Listen for character movement updates
        document.addEventListener('characterMovementUpdated', (e) => {
            this.refreshCharacterData();
        });
    }

    async loadLocations() {
        try {
            console.log('🔄 Starting location reload with characters...');
            this.ui.showLoading('locations-list', 'Loading locations and characters...');
            
            // Use enhanced loader that includes character data
            const { locations, locationGroups } = await this.operations.loadLocationsWithCharacters();
            console.log(`🔄 Received ${locations.length} locations and ${Object.keys(locationGroups).length} location groups`);
            
            this.uiManager.renderLocations(locations);
            console.log('✅ Location and character rendering complete');
            
        } catch (error) {
            console.error('❌ Failed to load locations:', error);
            this.uiManager.renderLocations([]);
        }
    }

    // NEW: Refresh character data when characters change
    async refreshCharacterData() {
        try {
            console.log('🔄 Refreshing character data for locations...');
            
            const response = await fetch('/api/characters');
            const characterData = await response.json();
            
            if (characterData.locationGroups) {
                this.operations.updateLocationGroups(characterData.locationGroups);
                
                // Update character counts in UI
                this.updateCharacterCounts();
            }
        } catch (error) {
            console.error('❌ Failed to refresh character data:', error);
        }
    }

    // NEW: Update character counts in location cards
    updateCharacterCounts() {
        document.querySelectorAll('.location-characters-toggle').forEach(button => {
            const locationName = button.dataset.location;
            const count = this.operations.getCharacterCountForLocation(locationName);
            button.innerHTML = `👥 Characters (${count}) <span class="toggle-icon">▼</span>`;
        });
    }
}
```

## 🎨 CSS Styling Requirements

Add these styles to your location CSS files:

```css
/* Location Characters Section */
.location-characters-section {
    margin-top: 1rem;
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
}

.location-characters-toggle {
    width: 100%;
    background: var(--secondary-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
}

.location-characters-toggle:hover {
    background: var(--hover-bg);
    border-color: var(--primary-color);
}

.location-characters-toggle .toggle-icon {
    transition: transform 0.2s ease;
    font-size: 0.8rem;
}

.location-characters-list {
    margin-top: 0.5rem;
    padding: 1rem;
    background: var(--tertiary-bg);
    border-radius: 6px;
    border: 1px solid var(--border-color);
}

/* Character Mini Cards */
.location-characters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
}

.character-mini-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.character-mini-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.character-mini-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.character-mini-image {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
}

.character-mini-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.character-mini-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--secondary-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
}

.character-mini-info {
    flex: 1;
    min-width: 0;
}

.character-mini-name {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.character-mini-title {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.character-mini-badges {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
}

.character-mini-badges .status-badge.mini,
.character-mini-badges .relationship-badge.mini {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
}

.character-mini-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.movement-count {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.last-movement {
    font-style: italic;
}

/* Empty and Loading States */
.location-characters-empty {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
}

.location-characters-empty .empty-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
}

.characters-loading,
.characters-error {
    text-align: center;
    padding: 1rem;
    color: var(--text-muted);
    font-style: italic;
}

.characters-error {
    color: var(--error-color);
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .location-characters-grid {
        grid-template-columns: 1fr;
    }
    
    .character-mini-card {
        padding: 0.5rem;
    }
    
    .location-characters-toggle {
        font-size: 0.8rem;
        padding: 0.5rem;
    }
}
```

## 🔄 Integration Points

### Character Module Integration
Listen for these events to keep location character lists updated:

```javascript
// When character movements are updated
document.addEventListener('characterMovementUpdated', (e) => {
    window.adminLocations?.refreshCharacterData();
});

// When characters are added/edited/deleted
document.addEventListener('dataChanged', (e) => {
    if (e.detail.type === 'characters') {
        window.adminLocations?.refreshCharacterData();
    }
});
```

### Real-time Updates
The system will automatically update location character lists when:
- Characters are moved between locations
- Character data is modified
- New characters are added
- Characters are deleted

## ✅ Expected Behavior

1. **Location Cards Enhancement**:
   - ✅ Each location shows "👥 Characters (X)" button with current count
   - ✅ Click to expand/collapse character list
   - ✅ Smooth animations for expand/collapse

2. **Character Mini-Cards**:
   - ✅ Show character image, name, title, status, and relationship
   - ✅ Display movement count and last movement date
   - ✅ Click to view full character details

3. **Real-time Updates**:
   - ✅ Character counts update when movements change
   - ✅ Character lists refresh when character data changes
   - ✅ Smooth transitions and loading states

4. **Performance**:
   - ✅ Uses cached location groups data
   - ✅ Lazy loading of character details
   - ✅ Efficient DOM updates

## 🧪 Testing Checklist

- [ ] Test locations with 0, 1, and multiple characters
- [ ] Test character list expand/collapse functionality
- [ ] Test character movement updates in real-time
- [ ] Test mobile responsive design
- [ ] Test character mini-card click handling
- [ ] Test error states and loading indicators
- [ ] Test performance with many characters/locations

## 🚀 Implementation Priority

**Priority**: High - This is a core enhancement that bridges location and character management.

Start with the LocationOperations class updates, then move to UI enhancements, and finally add the CSS styling. Test incrementally as you implement each component.