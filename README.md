# 🗺️ Adenai Map

An interactive D&D campaign map for the continent of Adenai, featuring character tracking, movement paths, and location management.

## 🚀 **Quick Start**

1. Open `public/index.html` in your browser
2. Explore the map by clicking locations and characters
3. Use the character panel (📖 button) to view and manage characters
4. Test the search functionality in the search bar

## 🏗️ **Project Structure**

```
Adenai-Map/
├── src/                    # 📁 Source Code
│   ├── core/              # Core map systems
│   ├── systems/           # Feature systems (characters, locations, etc.)
│   ├── ui/                # UI components  
│   ├── utils/             # Utilities
│   └── vendor/            # Third-party libraries
├── public/                # 📁 Static Assets & Entry Point
│   ├── index.html         # Main application
│   ├── css/               # Stylesheets
│   ├── data/              # JSON data files
│   ├── images/            # Campaign images
│   ├── icons/             # UI icons
│   └── content/           # Campaign content
└── docs/                  # 📁 Documentation
```

## ✨ **Features**

- **Interactive Map**: Leaflet-based map with custom campaign locations
- **Character System**: Track character locations, relationships, and status  
- **Movement Paths**: Visualize character journeys over time with server-controlled styling
- **Search**: Find characters and locations quickly
- **Character Panel**: Side panel with character management
- **Campaign Content**: Rich location descriptions and lore
- **🐉 Dragon Shadows**: Atmospheric dragon shadows periodically pass over the map for immersive D&D ambiance

### Character Movement Path System

The map features an API-only character path system requiring server connection:

- **API-Only Architecture**: Character paths loaded exclusively from dedicated server API
- **Server-Controlled Styling**: Path appearance controlled server-side via API response
- **Error Handling**: Clear user feedback with developer contact info when API unavailable
- **Performance Optimized**: Caching system with 85% bandwidth reduction
- **Overlapping Marker Consolidation**: Smart marker grouping when multiple characters visit same location
- **Cross-Character Support**: View multiple character paths simultaneously

**Note**: The character movement system requires server connectivity. If unavailable, users will see an error message with contact information.

**Path Design System (Server-Side):**
- **Color**: Determined by character relationship (`#4CAF50` for ally, `#FFC107` for neutral, etc.)
- **Weight**: Always `2px` for consistent line thickness
- **Opacity**: `0.7` for living characters, `0.4` for deceased characters
- **DashArray**: `'5,2'` for all paths (5px dashes, 2px gaps)

**Testing Commands:**
```javascript
await testCharacterPaths()           // Full system test
showCharacterPathDebug()             // Show debug panel
compareCharacterPathPerformance()    // Performance comparison
testServerSideStyling()              // Analyze server-side path design
```

**Design Philosophy:**
- **Paths**: Server-controlled styling for consistency and centralized design management
- **Markers**: CSS-controlled styling for theme compatibility and client-side customization
- **Separation of Concerns**: Visual design managed server-side, UI behavior managed client-side

### Dragon Shadow System

The map features an atmospheric dragon shadow overlay that creates immersive D&D campaign ambiance:

- **Automatic**: Dragon shadows appear randomly every 30-75 seconds
- **Dynamic**: Each shadow has unique flight paths, timing, and direction
- **Three Variants**: Different shadow sizes and intensities for variety
- **Theme Compatible**: Works in both light and dark themes
- **Non-intrusive**: Shadows don't interfere with map interactions

**Controls:**
- Toggle on/off: `window.dragonShadows.toggle()` in browser console
- Status check: `window.dragonShadows.isActive`

## 🧪 **Testing Configuration**

Run this in the browser console after loading:
```javascript
testAdenaiConfig()
```

## 🎯 **Technical Stack**

- **Frontend**: Vanilla JavaScript (ES6+)
- **Mapping**: Leaflet.js with custom extensions
- **Architecture**: Modular class-based systems
- **Data**: JSON files for characters and locations
- **Styling**: CSS3 with custom campaign theming

---

*Campaign website for the D&D group VsuzH*
