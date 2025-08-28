# Adenai Map - File Structure Documentation

## Overview
This document outlines the organized file structure for the Adenai Map project, following a modular component-based architecture.

## CSS Architecture

### `public/css/`
```
├── base/                    # Foundation styles
│   ├── reset.css           # CSS reset/normalize
│   ├── typography.css      # Font and text styles
│   └── variables.css       # CSS custom properties
├── layout/                 # Layout-specific styles
│   ├── grid.css           # Grid system
│   └── responsive.css     # Responsive utilities
├── themes/                # Theme variations
│   ├── dark.css           # Dark theme
│   └── light.css          # Light theme
├── animations/            # Animation definitions
│   └── effects.css        # Transition and animation effects
├── components/            # Component-specific styles
│   ├── map/              # Map-related components
│   │   ├── map-core.css  # Core map styling
│   │   └── coordinates.css # Coordinate display system
│   ├── characters/       # Character system components
│   │   ├── character-paths.css    # Character path lines
│   │   ├── character-panel.css    # Character control panel
│   │   └── character-system.css   # Character markers and info
│   ├── movement/         # Movement system components
│   │   └── movement-markers.css   # Movement markers, clustering, popups
│   ├── ui/              # UI components
│   │   ├── controls.css  # Control elements
│   │   ├── modals.css    # Modal dialogs
│   │   ├── popups.css    # Popup components
│   │   └── badges.css    # Badge elements
│   └── features/        # Feature-specific components
│       ├── search.css    # Search functionality
│       └── gallery.css   # Image gallery
└── styles.css            # Main CSS entry point
```

## JavaScript Architecture

### `src/`
```
├── core/                  # Core system files
│   ├── config.js         # Configuration settings
│   ├── main.js           # Main initialization
│   └── map-core.js       # Core Leaflet map setup
├── systems/              # Major system modules
│   ├── character-system.js    # Character data management
│   ├── movement-system.js     # Character movement paths
│   ├── location-system.js     # Location management
│   └── search-system.js       # Search functionality
├── ui/                   # User interface components
│   ├── components/       # Reusable UI components
│   │   ├── character-panel.js    # Character control panel
│   │   ├── movement-markers.js   # Movement marker system
│   │   └── coordinate-copy.js    # Coordinate copying utility
│   └── gallery.js        # Image gallery (legacy location)
├── utils/                # Utility functions
│   ├── icons.js          # Icon management
│   ├── journey.js        # Journey calculations
│   ├── char-path-api.js  # Character path API client
│   └── github-version.js # Version checking
└── vendor/               # Third-party libraries
    └── leaflet.curve.js  # Leaflet curve extension
```

## Component Relationships

### Character System
- **CSS**: `components/characters/*`
- **JS**: `systems/character-system.js`, `ui/components/character-panel.js`
- **Purpose**: Manages character data, display, and user controls

### Movement System  
- **CSS**: `components/movement/*`
- **JS**: `systems/movement-system.js`, `ui/components/movement-markers.js`
- **Purpose**: Handles character movement paths and location markers

### Map System
- **CSS**: `components/map/*`  
- **JS**: `core/map-core.js`, `ui/components/coordinate-copy.js`
- **Purpose**: Core map functionality and coordinate display

### Search System
- **CSS**: `components/features/search.css`
- **JS**: `systems/search-system.js`
- **Purpose**: Location and content searching

## File Loading Order

The files are loaded in this specific order in `index.html`:

1. **Base CSS**: Foundation styles, variables, layout
2. **Component CSS**: Feature-specific styles (organized by module)
3. **Core JS**: Map core and essential utilities
4. **System JS**: Major functionality modules
5. **UI Components**: User interface elements
6. **Utilities**: Helper functions and integrations

## Benefits of This Structure

✅ **Modularity**: Each feature has its own dedicated space  
✅ **Maintainability**: Related files are grouped together  
✅ **Scalability**: Easy to add new features without cluttering  
✅ **Performance**: Granular loading and caching  
✅ **Developer Experience**: Intuitive file organization  
✅ **Consistency**: Clear patterns and naming conventions  

## Development Guidelines

### Adding New Features
1. Create appropriate folder in `components/`
2. Add CSS files to the feature folder
3. Add JS files to appropriate `src/` subfolder
4. Update `index.html` with new file references
5. Follow existing naming conventions

### Naming Conventions
- **CSS**: kebab-case (e.g., `character-panel.css`)
- **JS**: kebab-case (e.g., `movement-markers.js`)
- **Classes**: Descriptive, component-prefixed names
- **Folders**: Lowercase, descriptive names

### File Organization Rules
- Keep related CSS and JS in parallel folder structures
- Group by feature/functionality, not by file type
- Use consistent naming across CSS and JS files
- Maintain clear separation of concerns
