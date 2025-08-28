# Media Library Management Guide

## How media-library.json Gets Populated

### 1. Manual Method (Current)
Edit the JSON file directly:
```json
{
  "characters": {
    "character-id": {
      "name": "Character Name",
      "image": "public/images/character.png", 
      "status": "alive",
      "relationship": "ally",
      "description": "Character background..."
    }
  }
}
```

### 2. CMS Web Interface (Recommended)

#### Character Creation Form:
```html
<form id="character-form">
  <input type="text" name="id" placeholder="character-id" required>
  <input type="text" name="name" placeholder="Character Name" required>
  <input type="file" name="image" accept="image/*" required>
  <select name="status">
    <option value="alive">Alive</option>
    <option value="dead">Dead</option>
    <option value="missing">Missing</option>
  </select>
  <select name="relationship">
    <option value="ally">Ally</option>
    <option value="neutral">Neutral</option>
    <option value="enemy">Enemy</option>
  </select>
  <textarea name="description" placeholder="Character description..."></textarea>
  <button type="submit">Add Character</button>
</form>
```

#### Gallery Creation Form:
```html
<form id="gallery-form">
  <input type="text" name="id" placeholder="gallery-id" required>
  <input type="text" name="title" placeholder="Gallery Title" required>
  <textarea name="description" placeholder="Gallery description..."></textarea>
  <div id="image-uploads">
    <input type="file" name="images[]" multiple accept="image/*">
  </div>
  <button type="submit">Create Gallery</button>
</form>
```

### 3. API Endpoints for CMS Integration

#### POST /api/media/character
```javascript
// Request body
{
  "id": "new-character",
  "name": "Character Name",
  "image": "uploaded-image.png",
  "status": "alive", 
  "relationship": "ally",
  "description": "Character description"
}

// Response - Updates media-library.json
{
  "success": true,
  "message": "Character added successfully",
  "linkSyntax": "[Character Name:character:new-character]"
}
```

#### POST /api/media/gallery
```javascript
// Request body
{
  "id": "new-gallery",
  "title": "Gallery Title",
  "description": "Gallery description",
  "images": [
    {
      "src": "image1.png",
      "alt": "Image 1",
      "caption": "First image"
    }
  ]
}
```

### 4. File Upload Process

1. **Image Upload**: 
   - User selects image file
   - CMS uploads to `public/images/`
   - Returns file path: `public/images/uploaded-file.png`

2. **Data Entry**:
   - User fills form with character/gallery details
   - CMS validates required fields
   - CMS generates unique ID if not provided

3. **JSON Update**:
   - CMS reads current `media-library.json`
   - Adds new entry to appropriate section
   - Writes updated JSON back to file
   - Optionally triggers website refresh

### 5. Using the Content

After adding to media library, use in location descriptions:

```json
{
  "name": "Location Name",
  "description": "This location is ruled by [King Arthur:character:king-arthur].",
  "details": [
    "See the [castle gallery:gallery:castle-photos] for images.",
    "The [great battle:event:battle-of-camlann] happened here."
  ]
}
```

### 6. Content Validation

The CMS should validate:
- **Unique IDs**: No duplicate IDs across types
- **Image Files**: Valid image formats, reasonable file sizes
- **Required Fields**: All mandatory fields completed
- **Link References**: Check that referenced IDs exist

### 7. Bulk Import Example

For migrating existing content:

```javascript
// Import from CSV or database
const characters = [
  {
    id: 'arthur',
    name: 'King Arthur', 
    image: 'arthur.png',
    status: 'alive',
    relationship: 'ally',
    description: 'Noble king of Camelot'
  },
  // ... more characters
];

// Bulk update media-library.json
await updateMediaLibrary('characters', characters);
```

### 8. Link Generation Helper

The CMS could provide a "Generate Link" feature:

```javascript
function generateMediaLink(type, id, displayText) {
  return `[${displayText}:${type}:${id}]`;
}

// Example usage:
generateMediaLink('character', 'arthur', 'King Arthur');
// Returns: "[King Arthur:character:arthur]"
```

This makes it easy for content editors to create proper link syntax without memorizing the format.
