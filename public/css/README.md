# CSS Architecture Documentation

## Overview
The CSS has been restructured from a single 2,400+ line file into a modular, maintainable architecture. This improves development speed, reduces conflicts, and makes the codebase much easier to work with.

## Structure

```
css/
├── styles.css              # Main import file
├── base/                   # Foundation styles
│   ├── reset.css          # CSS reset and base HTML styles
│   ├── variables.css      # CSS custom properties (themes, colors)
│   └── typography.css     # Font definitions and text styles
├── layout/                 # Layout and positioning
│   ├── grid.css          # Grid systems and layout utilities
│   └── responsive.css    # Media queries and mobile styles
├── components/             # UI components
│   ├── map.css           # Leaflet map specific styles
│   ├── search.css        # Search container and dropdown
│   ├── popups.css        # All popup-related styles
│   ├── character-panel.css # Character panel sidebar
│   ├── character-system.css # Character markers and movement
│   ├── modals.css        # Modal dialogs and overlays
│   ├── controls.css      # UI controls (zoom, theme toggle)
│   └── badges.css        # Status and relationship badges
├── themes/                 # Theme-specific overrides
│   ├── light.css         # Light theme specific styles
│   └── dark.css          # Dark theme specific styles
└── animations/             # Visual effects
    └── effects.css       # Dragon shadows, transitions, animations
```

## Benefits

### 1. **Better Organization**
- Each file has a single, clear responsibility
- Related styles are grouped together
- Easy to find specific styles quickly

### 2. **Improved Maintainability**
- Smaller files are easier to work with
- Changes are isolated to relevant modules
- Less risk of accidentally breaking unrelated styles

### 3. **Better Development Workflow**
- Multiple developers can work on different components simultaneously
- Merge conflicts are reduced significantly
- Code reviews are more focused and manageable

### 4. **Performance Optimizations**
- Conditional loading possible (load only needed stylesheets)
- Better browser caching (unchanged components don't need re-downloading)
- Easier to identify and remove unused styles

### 5. **Clear Dependencies**
- Import order in `styles.css` shows component relationships
- Base styles load first, then layout, then components
- Themes and effects load last to allow proper overrides

## File Descriptions

### Base Files
- **reset.css**: CSS reset, base HTML element styles
- **variables.css**: CSS custom properties for themes and colors
- **typography.css**: Font families, text styles, popup typography

### Layout Files
- **grid.css**: Grid systems, flexbox layouts, positioning
- **responsive.css**: All media queries and mobile-specific styles

### Component Files
- **map.css**: Leaflet map, popup wrappers, map-specific styles
- **search.css**: Search container, dropdown, result styling
- **popups.css**: Character popups, panel-anchored popups, popup content
- **character-panel.css**: Sidebar panel, character cards, controls
- **character-system.css**: Movement markers, paths, character markers
- **modals.css**: Modal dialogs, overlays, loading states
- **controls.css**: Theme toggle, zoom control, UI controls
- **badges.css**: Status badges, relationship badges, all badge variants

### Theme Files
- **light.css**: Light theme specific overrides (currently minimal)
- **dark.css**: Dark theme specific overrides (currently minimal)

### Animation Files
- **effects.css**: Dragon shadow animations, visual effects

## Usage

The main `styles.css` file imports all modules in the correct order:

```css
/* Base Styles */
@import 'base/reset.css';
@import 'base/variables.css';
@import 'base/typography.css';

/* Layout */
@import 'layout/grid.css';
@import 'layout/responsive.css';

/* Components */
@import 'components/map.css';
@import 'components/search.css';
@import 'components/popups.css';
@import 'components/character-panel.css';
@import 'components/character-system.css';
@import 'components/modals.css';
@import 'components/controls.css';
@import 'components/badges.css';

/* Themes */
@import 'themes/light.css';
@import 'themes/dark.css';

/* Effects */
@import 'animations/effects.css';
```

## Development Guidelines

### 1. **Adding New Styles**
- Identify which component the style belongs to
- Add to the appropriate component file
- If it's a new component, create a new file and add the import to `styles.css`

### 2. **Modifying Existing Styles**
- Find the relevant component file
- Make changes in the appropriate module
- Test to ensure no unintended side effects

### 3. **Theme Support**
- Use CSS custom properties defined in `variables.css`
- Add `[data-theme="dark"]` selectors for dark theme overrides
- Keep theme-specific styles in the component files where possible

### 4. **Responsive Design**
- All mobile styles go in `layout/responsive.css`
- Use consistent breakpoints
- Mobile-first approach where possible

## Migration Benefits

- **Before**: 2,473 lines in a single file
- **After**: ~25 lines in main file + organized modules
- **Reduced complexity**: Each module is focused and manageable
- **Better collaboration**: Multiple developers can work simultaneously
- **Easier debugging**: Issues are isolated to specific components
- **Future-proof**: Easy to add new components or refactor existing ones
