# Global Clustering System

## Overview

The Global Clustering System is an advanced feature that intelligently groups overlapping markers from different sources into unified clusters. Unlike the basic clustering that only handles movement markers from the same character path, this system handles overlapping between:

- Different character movement paths
- Character movement markers and location markers  
- Multiple clusters from different systems

## Features

### Smart Proximity Detection
- Uses pixel-based distance calculation (30px threshold)
- Works regardless of zoom level
- Handles markers from different coordinate systems

### Mixed Marker Types
- Combines location markers (orange dots) and movement markers (numbered circles)
- Preserves original marker styling in fan-out view
- Maintains individual click behaviors

### Enhanced Visual Feedback
- Distinctive cluster marker with gradient background
- Lightning bolt indicator showing mixed marker types
- Bounce animation on cluster click
- Smooth fan-out/fan-in animations

### Intelligent Fan-Out
- Spiral arrangement for optimal spacing
- Maintains visual hierarchy
- Preserves original marker interactions
- Auto-collapse after mouse leave

## Technical Implementation

### Core Components

1. **GlobalClusterSystem** (`src/systems/global-cluster-system.js`)
   - Main clustering logic
   - Marker registration and tracking
   - Distance calculation and grouping
   - Event handling

2. **CSS Styles** (`public/css/components/clustering/global-cluster-system.css`)
   - Cluster marker styling
   - Animation definitions
   - Responsive design

3. **UI Integration** (`src/ui/components/character-panel.js`)
   - Toggle button in character panel
   - Real-time enable/disable
   - Visual state indicators

### Event-Driven Architecture

The system listens for:
- `locationsLoaded` - When location markers are added
- `movementMarkersLoaded` - When movement markers are created
- `characterPathVisibilityChanged` - When character paths are shown/hidden

### Performance Optimizations

- Lazy clustering (only when needed)
- Efficient proximity calculations
- Minimal DOM manipulation
- Proper cleanup of temporary elements

## Usage

### User Interface

1. **Toggle Button**: Located in the character panel movement controls
   - 🎯 Green button = Clustering enabled
   - 🔘 Gray button = Clustering disabled

2. **Cluster Interaction**:
   - Hover over cluster → Fan out individual markers
   - Click cluster → Bounce animation (visual cue)
   - Click individual fan markers → Show original popup/interaction

### Programmatic Control

```javascript
// Access the system
const clusterSystem = window.adenaiMap.systems.globalClusterSystem;

// Enable/disable clustering
clusterSystem.enable();
clusterSystem.disable();

// Get statistics
const stats = clusterSystem.getStats();
console.log(stats); // Shows marker counts, active clusters, etc.

// Manual rebuild (usually not needed)
clusterSystem.rebuildClusters();
```

### Testing

Run the test script in browser console:
```javascript
testGlobalClustering();
```

## Configuration

### Clustering Distance
Default: 30 pixels. Can be modified in the constructor:
```javascript
this.clusterDistance = 30; // pixels
```

### Animation Timing
- Fan-out: 0.4s ease-out
- Fan-in: 0.2s ease-in  
- Bounce: 0.6s ease-in-out
- Stagger delay: 100ms between markers

### Visual Settings
- Cluster marker size: 36x36px
- Spiral radius: 40px base + 20px per revolution
- Items per revolution: 6

## Integration Points

### Character Panel
- Added clustering toggle button
- Visual state management
- Integrated with existing movement controls

### Movement System
- Event emission on marker changes
- Path visibility tracking
- Coordinate system compatibility

### Location System  
- Marker registration integration
- Popup content preservation
- Icon compatibility

## Browser Compatibility

- Modern browsers with ES6 support
- Leaflet.js 1.x
- CSS Grid and Flexbox support
- Transform animations

## Troubleshooting

### Common Issues

1. **Clustering not working**
   - Check browser console for errors
   - Verify systems are loaded: `window.adenaiMap.systems`
   - Run test script: `testGlobalClustering()`

2. **Markers not appearing in clusters**
   - Check marker visibility with movement system
   - Verify proximity threshold (30px default)
   - Ensure markers are properly registered

3. **Fan-out not working**
   - Check for JavaScript errors
   - Verify CSS animations are loaded
   - Test with simplified marker set

### Debug Commands

```javascript
// Get detailed system status
window.adenaiMap.getMapStats();

// Check clustering statistics
window.adenaiMap.systems.globalClusterSystem.getStats();

// Force cluster rebuild
window.adenaiMap.systems.globalClusterSystem.rebuildClusters();
```

## Future Enhancements

- Custom clustering algorithms
- Configurable distance thresholds
- Advanced marker prioritization
- Cluster size optimization
- Performance monitoring
- A/B testing framework

## Dependencies

- Leaflet.js (mapping library)
- Modern browser with ES6 support
- CSS transform and animation support
- AdenaiConfig system (for labels)
- Movement and Location systems
