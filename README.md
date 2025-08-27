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
- **Movement Paths**: Visualize character journeys over time
- **Search**: Find characters and locations quickly
- **Character Panel**: Side panel with character management
- **Campaign Content**: Rich location descriptions and lore
- **🐉 Dragon Shadows**: Atmospheric dragon shadows periodically pass over the map for immersive D&D ambiance

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
