# 🗺️ Adenai Map - Project Structure

## 📁 **New Organized Structure**

```
Adenai-Map/
├── 📁 src/                    # Source Code
│   ├── 📁 core/              # Core Systems (3 files)
│   │   ├── config.js         # Shared configuration & labels
│   │   ├── map-core.js       # Leaflet map initialization 
│   │   └── main.js           # Application orchestration
│   ├── 📁 systems/           # Feature Systems (4 files)
│   │   ├── character-system.js    # Character data & display
│   │   ├── location-system.js     # Location loading & management
│   │   ├── movement-system.js     # Character movement paths
│   │   └── search-system.js       # Global search functionality
│   ├── 📁 ui/                # UI Components (3 files)
│   │   ├── character-panel.js     # Character panel & controls
│   │   ├── coordinate-copy.js     # Coordinate copying utility
│   │   └── gallery.js             # Image gallery system
│   ├── 📁 utils/             # Utilities (2 files)
│   │   ├── icons.js          # Icon management
│   │   └── journey.js        # Journey/timeline functionality
│   └── 📁 vendor/            # Third-party Libraries (1 file)
│       └── leaflet.curve.js  # Leaflet curve extension
├── 📁 public/                # Static Assets & Entry Point
│   ├── index.html            # Main HTML file
│   ├── 📁 css/              # Stylesheets
│   ├── 📁 images/           # Campaign images
│   ├── 📁 icons/            # UI icons
│   ├── 📁 data/             # JSON data files
│   └── 📁 content/          # Campaign content
│       └── 📁 locations/    # Location HTML descriptions
└── 📁 docs/                 # Documentation
    └── STRUCTURE.md         # This file
```

## 🎯 **File Responsibilities**

### **Core Systems** (`src/core/`)
- **config.js**: Centralized configuration (labels, types, relationships)
- **map-core.js**: Leaflet map setup and base functionality
- **main.js**: Application initialization and system coordination

### **Feature Systems** (`src/systems/`)
- **character-system.js**: Character data loading, display, and interaction
- **location-system.js**: Location data loading and map marker management
- **movement-system.js**: Character movement paths and timeline visualization
- **search-system.js**: Global search across characters and locations

### **UI Components** (`src/ui/`)
- **character-panel.js**: Side panel with character list and controls
- **coordinate-copy.js**: Click-to-copy coordinate functionality
- **gallery.js**: Image viewing and gallery functionality

### **Utilities** (`src/utils/`)
- **icons.js**: Icon management and rendering
- **journey.js**: Journey/campaign timeline functionality

### **Vendor Libraries** (`src/vendor/`)
- **leaflet.curve.js**: Third-party Leaflet extension for curved paths

## 📋 **Load Order & Dependencies**

```html
<!-- 1. Core Configuration -->
<script src="../src/core/config.js"></script>

<!-- 2. External Libraries -->
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script src="../src/vendor/leaflet.curve.js"></script>

<!-- 3. UI Systems -->
<script src="../src/ui/gallery.js"></script>

<!-- 4. Core Map -->
<script src="../src/core/map-core.js"></script>

<!-- 5. Utilities -->
<script src="../src/utils/icons.js"></script>

<!-- 6. Feature Systems -->
<script src="../src/systems/character-system.js"></script>
<script src="../src/systems/movement-system.js"></script>
<script src="../src/systems/location-system.js"></script>
<script src="../src/systems/search-system.js"></script>

<!-- 7. UI Components -->
<script src="../src/ui/character-panel.js"></script>
<script src="../src/ui/coordinate-copy.js"></script>

<!-- 8. Additional Features -->
<script src="../src/utils/journey.js"></script>

<!-- 9. Main Application -->
<script src="../src/core/main.js"></script>
```

## 🏗️ **Architecture Benefits**

### **Separation of Concerns**
- **Core**: Essential map functionality
- **Systems**: Feature-specific logic
- **UI**: User interface components
- **Utils**: Helper functions
- **Vendor**: External dependencies

### **Maintainability**
- Each file has a single, clear responsibility
- Easy to locate and modify specific features
- Clean dependency chain

### **Scalability**
- Easy to add new systems in appropriate folders
- Clear patterns for new functionality
- Modular architecture allows for future splits

## 🎯 **File Size Analysis**

| File | Lines | Size | Status |
|------|-------|------|--------|
| movement-system.js | 636 | 26KB | 🟡 Could be split |
| main.js | 446 | 17.6KB | ✅ Good size |
| character-system.js | 381 | 17KB | ✅ Good size |
| character-panel.js | 333 | 12.9KB | ✅ Good size |
| coordinate-copy.js | 310 | 11.5KB | ✅ Good size |

## 🚀 **Next Steps**

1. ✅ **Phase 1 Complete**: New folder structure created
2. ✅ **Phase 2 Complete**: Files moved and HTML updated
3. 🔄 **Phase 3**: Test functionality with new structure
4. 🔄 **Phase 4**: Consider splitting large files if needed
5. 🔄 **Phase 5**: Add documentation and comments

## 🎮 **Testing the New Structure**

1. Open `public/index.html` in browser
2. Check browser console for errors
3. Test all functionality (character panel, search, movement paths)
4. Verify all scripts load correctly

## 📝 **Naming Conventions Applied**

- **Files**: kebab-case (character-system.js)
- **Classes**: PascalCase (CharacterSystem)
- **Functions**: camelCase (loadCharacters)
- **Constants**: UPPER_SNAKE_CASE (MAX_ZOOM_LEVEL)
- **CSS Classes**: kebab-case (character-panel)
