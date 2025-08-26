# VS Code Prompt: Adenai Map CMS Integration

## Project Overview
I have a D&D campaign mapping website with a new link-based content management system. I need help integrating this system with my server-side CMS for easy content editing.

## Current Implementation

### Link-Based Content System
The website now uses a special syntax to embed interactive media links within text content:

**Syntax:** `[Display Text:type:id]`

**Types Available:**
- `character` - Character profiles with images and details
- `gallery` - Image galleries with multiple photos
- `event` - Historical events with dates and descriptions  
- `image` - Individual images with descriptions

**Examples:**
```
[Petrel Kormorant:character:petrel-kormorant] - Shows character popup
[Steckbriefe gefährlicher Krimineller:gallery:basapo-wanted] - Shows image gallery
[Ermittlung in Basapo:event:basapo-visit] - Shows event details
[Stadtplan von Valaris:image:valaris-map-detail] - Shows single image
```

### Data Structure

#### Media Library (`public/data/media-library.json`)
```json
{
  "galleries": {
    "valaris-map": {
      "title": "Valaris Stadtplan",
      "description": "Detaillierte Karte der Stadt Valaris",
      "images": [
        {
          "src": "public/images/map_valaris.png",
          "alt": "Valaris Übersichtskarte",
          "title": "Hauptkarte"
        }
      ]
    }
  },
  "characters": {
    "petrel-kormorant": {
      "name": "Petrel Kormorant",
      "image": "public/images/petrel.png",
      "status": "alive",
      "relationship": "ally",
      "description": "Bürgermeister von Valaris..."
    }
  },
  "events": {
    "basapo-visit": {
      "title": "Ermittlungen in Basapo",
      "date": "3. Woche, 2. Monat",
      "description": "Abu und Tasbor untersuchten...",
      "image": "public/images/basapo_investigation.png"
    }
  },
  "images": {
    "valaris-map-detail": {
      "title": "Valaris Detailkarte",
      "src": "public/images/map_valaris.png",
      "alt": "Detaillierte Karte von Valaris",
      "description": "Zeigt alle wichtigen Gebäude"
    }
  }
}
```

#### Location Data (`public/data/places.geojson`)
```json
{
  "type": "Feature", 
  "properties": {
    "name": "Valaris",
    "description": "Die grösste Stadt im Osten von Adenai. Regiert von [Petrel Kormorant:character:petrel-kormorant].",
    "details": [
      "[Tasbor:character:tasbor] und [Abu Sasion:character:abu-sasion] haben hier ihre Detektei.",
      "Die Stadt hat eine [detaillierte Karte:gallery:valaris-map] die alle wichtigen Gebäude zeigt."
    ]
  }
}
```

## CMS Integration Requirements

### 1. Media Library Management System

#### Core Functionality
I need a CMS interface that manages the `media-library.json` file with these capabilities:

**Character Management:**
- Form fields: Name, Image Upload, Status (alive/dead/missing/undead), Relationship (ally/friendly/neutral/hostile/enemy), Description
- Auto-generate character ID from name (e.g., "Petrel Kormorant" → "petrel-kormorant")
- Image upload with automatic path assignment to `public/images/characters/`
- Integration with AdenaiConfig status/relationship labels (German with emojis)

**Gallery Management:**
- Form fields: Gallery ID, Title, Description, Multiple Image Uploads
- Organized folder structure: `public/images/galleries/[gallery-id]/`
- Batch image upload with individual alt text and captions
- Image reordering within galleries
- Gallery preview functionality

**Event Management:**
- Form fields: Event ID, Title, Date, Description, Optional Image
- Date handling for campaign timeline
- Event categorization (battles, discoveries, meetings, etc.)
- Link to related characters/locations

**Image Management:**
- Individual image uploads for single-use media
- Metadata: Title, Alt text, Description, Categories
- Automatic file optimization and naming
- Usage tracking (which locations reference this image)

#### Media Library Population Workflow

**Manual Population (Current):**
```json
// Direct JSON editing
{
  "characters": {
    "new-character-id": {
      "name": "Character Name",
      "image": "public/images/characters/character.png",
      "status": "alive",
      "relationship": "ally", 
      "description": "Character background..."
    }
  }
}
```

**CMS Population (Target):**
```javascript
// Automated via web interface
const addCharacter = async (formData) => {
  // 1. Process uploaded image
  const optimizedImage = await processImageUpload(formData.image);
  const imagePath = `public/images/characters/${optimizedImage.filename}`;
  
  // 2. Update media-library.json
  const mediaLib = await readMediaLibrary();
  mediaLib.characters[formData.id] = {
    name: formData.name,
    image: imagePath,
    status: formData.status,
    relationship: formData.relationship,
    description: formData.description
  };
  
  // 3. Save and commit to Git
  await writeMediaLibrary(mediaLib);
  await gitCommitChanges(`Add character: ${formData.name}`);
  
  // 4. Return link syntax for copy/paste
  return `[${formData.name}:character:${formData.id}]`;
};
```

### 2. Hybrid Image Storage Strategy

#### Git-Based Storage with CMS Integration
**Recommended Approach:** Keep images in Git repository with automated CMS workflow

**Benefits:**
- ✅ Simple GitHub Pages deployment (no changes needed)
- ✅ Version control for all campaign assets
- ✅ Free hosting and CDN via GitHub
- ✅ Zero risk of broken image links
- ✅ Automatic backups through Git history

**File Organization Structure:**
```
public/images/
├── characters/          # Character portraits
│   ├── petrel-kormorant.png
│   ├── tasbor.png
│   └── abu-sasion.png
├── galleries/           # Gallery collections
│   ├── valaris-map/
│   │   ├── overview.png
│   │   └── districts.png
│   └── basapo-wanted/
│       ├── poster1.png
│       └── poster2.png
├── events/              # Event illustrations
│   ├── kunos-defeat.png
│   └── basapo-visit.png
├── icons/               # UI icons (existing)
└── maps/                # Map assets (existing)
```

#### CMS Upload & Git Integration Workflow
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User uploads  │───▶│ CMS processes &  │───▶│ Git commit &    │
│   via web form  │    │ optimizes image  │    │ auto-deploy     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Save to correct  │    │ GitHub Pages    │
                       │ folder structure │    │ serves new image│
                       └──────────────────┘    └─────────────────┘
```

**Implementation Details:**
```javascript
// Image processing pipeline
const processImageUpload = async (uploadedFile, category) => {
  // 1. Optimize image (resize if > 800px width, compress to < 500KB)
  const optimized = await optimizeImage(uploadedFile, {
    maxWidth: category === 'characters' ? 400 : 800,
    quality: 0.8,
    maxFileSize: 500000 // 500KB
  });
  
  // 2. Generate safe filename
  const filename = generateSafeFilename(uploadedFile.name);
  const relativePath = `public/images/${category}/${filename}`;
  
  // 3. Save to filesystem
  await fs.writeFile(path.join(REPO_PATH, relativePath), optimized.buffer);
  
  // 4. Git commit
  await execAsync(`cd ${REPO_PATH} && git add ${relativePath}`);
  await execAsync(`cd ${REPO_PATH} && git commit -m "Add ${category} image: ${filename}"`);
  await execAsync(`cd ${REPO_PATH} && git push origin main`);
  
  return { filename, relativePath };
};
```

**File Size Management:**
- Character portraits: 200KB max, 400x400px recommended
- Gallery images: 500KB max, 800px max width  
- Event illustrations: 300KB max, 600px max width
- Total repository: Monitor to stay under 500MB for optimal performance

**Git LFS Option:** If repository grows large, implement Git LFS for image files:
```bash
git lfs track "*.png" "*.jpg" "*.jpeg"
git add .gitattributes
```

### 3. Content Editor with Media Link Assistant
I need an enhanced text editor for location descriptions that:
- **Shows available media:** Dropdown/autocomplete showing all characters, galleries, events, images
- **Auto-generates links:** Select media item → automatically inserts `[Display Text:type:id]` 
- **Live preview:** Shows how links will appear (highlighted, clickable in preview)
- **Link validation:** Warns if referenced media doesn't exist

**Editor UI Mockup:**
```
┌─ Location Description Editor ─────────────────────────┐
│ Description: [text area]                              │
│ Die Stadt wird von regiert.                           │
│              ↑ cursor                                 │
│                                                       │
│ Insert Media: [Dropdown: Characters ▼] [Insert]      │
│                                                       │
│ Available Media:                                      │
│ 👤 Petrel Kormorant (character)                      │
│ 👤 Tasbor (character)                                │
│ 🖼️ Valaris Stadtplan (gallery)                       │
│ 📅 Basapo Ermittlungen (event)                       │
│                                                       │
│ Preview: [Shows formatted text with clickable links] │
└───────────────────────────────────────────────────────┘
```

### 3. Bulk Content Migration
Help me convert existing HTML content files to link-based format:
- Scan `contentUrl/` folder for existing HTML files
- Identify text that could become character/gallery/event links
- Generate migration suggestions
- Create conversion tools

### 4. Advanced Media Library Features

#### Link Generation Helper
```javascript
// Automatic link syntax generation
const generateMediaLink = (type, id, displayText) => {
  return `[${displayText}:${type}:${id}]`;
};

// Smart suggestions based on context
const suggestLinks = (textContent) => {
  const suggestions = [];
  
  // Find character names in text
  mediaLibrary.characters.forEach((char, id) => {
    if (textContent.includes(char.name)) {
      suggestions.push({
        type: 'character',
        id: id,
        displayText: char.name,
        linkSyntax: `[${char.name}:character:${id}]`
      });
    }
  });
  
  return suggestions;
};
```

#### Content Validation System
```javascript
// Validate media references
const validateMediaReferences = (locationData) => {
  const errors = [];
  const warnings = [];
  
  // Check all [text:type:id] patterns
  const linkPattern = /\[([^\]]+):([^:]+):([^\]]+)\]/g;
  const content = locationData.description + ' ' + locationData.details.join(' ');
  
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const [fullMatch, displayText, type, id] = match;
    
    if (!mediaLibrary[type] || !mediaLibrary[type][id]) {
      errors.push({
        link: fullMatch,
        issue: `Referenced ${type} "${id}" does not exist`,
        suggestion: `Create ${type} or remove link`
      });
    }
  }
  
  return { errors, warnings };
};
```

#### Bulk Operations & Migration Tools
```javascript
// Convert existing HTML content to link-based format
const migrateHtmlContent = async () => {
  const htmlFiles = await scanDirectory('contentUrl/');
  const migrations = [];
  
  for (const file of htmlFiles) {
    const content = await fs.readFile(file, 'utf8');
    
    // Extract potential character references
    const characterMatches = extractCharacterReferences(content);
    const suggestions = characterMatches.map(match => ({
      original: match.text,
      suggested: generateMediaLink('character', match.id, match.name),
      confidence: match.confidence
    }));
    
    migrations.push({
      file: file,
      suggestions: suggestions
    });
  }
  
  return migrations;
};
```

### 5. API Integration Points

**Enhanced Endpoints with Git Integration:**
```javascript
// Media Library Management with Git commits
POST /api/media/characters
{
  "name": "Character Name",
  "image": "base64ImageData", // or file upload
  "status": "alive",
  "relationship": "ally", 
  "description": "Background..."
}
// Response: { success: true, linkSyntax: "[Character Name:character:char-id]", imagePath: "public/images/characters/char.png" }

POST /api/media/galleries  
{
  "id": "gallery-id",
  "title": "Gallery Title",
  "description": "Description",
  "images": [
    {
      "file": "base64ImageData",
      "alt": "Alt text",
      "caption": "Caption"
    }
  ]
}

// Git integration endpoints
POST /api/git/commit
{
  "message": "Add new character: John Doe",
  "files": ["public/data/media-library.json", "public/images/characters/john-doe.png"]
}

GET /api/git/status
// Response: { pendingChanges: [...], lastCommit: "...", deployStatus: "..." }

// Content validation
POST /api/validate/content
{
  "description": "Text with [Character:character:char-id] links",
  "details": ["More text with links..."]
}
// Response: { valid: true, errors: [], warnings: [], suggestions: [] }
```

### 6. Database Schema Considerations

**Option A: Keep JSON Files (Simpler)**
- Continue using `media-library.json` for all media data
- Add validation layer in CMS
- Simple file-based operations
- Easy to backup and version control

**Option B: Hybrid SQLite + JSON (Recommended for CMS)**
```sql
-- CMS database for management
CREATE TABLE media_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'character', 'gallery', 'event', 'image'
  data JSON NOT NULL, -- Full media data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media_usage (
  media_id TEXT,
  location_name TEXT,
  context TEXT, -- 'description' or 'details'
  FOREIGN KEY (media_id) REFERENCES media_items(id)
);
```

**Sync Strategy:**
- CMS uses SQLite for rich queries and management
- Export to `media-library.json` on every change
- Git commits include both SQLite backup and JSON export

### 5. Development Environment
- **Frontend:** HTML/CSS/JavaScript (no framework)
- **Backend:** Node.js with Express
- **Database:** JSON files (current) or SQLite (preferred for CMS)
- **File Uploads:** Local filesystem with automatic path generation
- **Authentication:** Simple login system for CMS access

## Current File Structure
```
public/
├── data/
│   ├── media-library.json
│   ├── places.geojson
│   └── characters.json
├── images/ (upload destination)
├── icons/
└── css/

src/
├── systems/
│   └── location-system.js (handles link parsing)
└── core/

Server and CMS files/ (backup/reference)
├── server.js
├── admin-public/
└── routes/
```

## Questions for Implementation

1. **Content Editor:** Should I use a rich text editor library (TinyMCE, Quill) or build a custom solution with live link preview?

2. **Database Strategy:** Should I implement the hybrid SQLite + JSON approach for better CMS functionality while maintaining JSON export compatibility?

3. **Image Optimization:** What level of automatic image processing should I implement (resize, compress, format conversion)?

4. **Git Integration:** Should the CMS auto-commit changes immediately or batch commits? How should I handle merge conflicts?

5. **User Management:** Do I need role-based access (admin, editor) or simple password protection?

6. **Link Validation:** How should I handle orphaned links when media is deleted? Auto-remove, warn user, or convert to plain text?

7. **Preview System:** Should the CMS have a full embedded map preview or just text preview of the formatted links?

8. **Migration Strategy:** What's the best approach to convert existing `contentUrl/*.html` files to the new link-based format?

9. **Performance:** How should I handle media library growth? Pagination, search, filtering?

10. **Backup & Recovery:** Besides Git history, what additional backup mechanisms should I implement for the CMS data?

## Implementation Priority

**Phase 1: Core Media Management**
1. Basic CRUD operations for characters, galleries, events
2. Image upload with Git integration
3. Simple link generation helpers

**Phase 2: Content Integration** 
1. Location editor with media link insertion
2. Content validation and preview
3. Migration tools for existing HTML content

**Phase 3: Advanced Features**
1. Bulk operations and batch editing
2. Usage tracking and analytics
3. Advanced search and filtering

**Phase 4: Polish & Optimization**
1. Image optimization pipeline
2. Performance monitoring
3. User experience improvements

## Success Criteria
- CMS allows easy creation and editing of media items
- Content editor makes link insertion intuitive  
- All existing content can be migrated to new system
- Website performance remains optimal
- System is maintainable for future updates

Please provide a step-by-step implementation plan with code examples for the CMS integration, starting with the most critical components.
