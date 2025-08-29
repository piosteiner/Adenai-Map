# Movement Visibility Control System

## Overview

The Movement Visibility Control provides a global toggle for managing the appearance of movement paths and markers across the entire map. This control acts as an overlay filter on top of the existing character panel selections, allowing users to reduce visual clutter without losing their character selections.

## Features

### 🎛️ **Three Visibility Modes**
1. **Default** (👁️ All) - Shows both movement paths and markers
2. **Paths Only** (📍 Paths) - Shows paths but hides markers and clusters  
3. **Hidden** (🚫 None) - Hides both paths and markers completely

### 🎯 **Smart Filtering**
- **Preserves Selection State**: Character panel selections remain intact
- **Overlay Logic**: Visibility control acts as a filter on top of character selections
- **Real-time Updates**: Changes apply immediately to all visible elements

### 🎨 **Visual Design**
- **Fixed Position**: Top-center of screen for easy access
- **Smooth Transitions**: Animated slider with visual feedback
- **Theme Support**: Adapts to light/dark themes
- **Compact Design**: Minimal screen real estate usage

## Technical Implementation

### Core Components

#### 1. **MovementVisibilityControl Class**
```javascript
// Initialize the control
const control = new MovementVisibilityControl();
control.init();

// Set visibility mode
control.setMode('paths-only');

// Get current mode
const currentMode = control.getCurrentMode(); // 'default', 'paths-only', 'hidden'
```

#### 2. **Integration Points**
- **Character Panel**: Notifies control when selections change
- **Movement System**: Provides character and marker data
- **Event System**: Dispatches `movementVisibilityChanged` events

### File Structure

```
src/ui/components/
├── movement-visibility-control.js    # Main control logic
public/css/components/movement/
├── movement-visibility-control.css   # Styling and animations
test/
├── movement-visibility-control-test.html  # Testing interface
```

## Usage

### Basic Integration

1. **Include CSS**:
```html
<link rel="stylesheet" href="public/css/components/movement/movement-visibility-control.css">
```

2. **Include JavaScript**:
```html
<script src="src/ui/components/movement-visibility-control.js"></script>
```

3. **Auto-initialization**: Control initializes automatically when DOM is ready

### API Methods

#### Core Methods
- `setMode(mode)` - Set visibility mode ('default', 'paths-only', 'hidden')
- `getCurrentMode()` - Get current visibility mode
- `updateVisibility()` - Manually trigger visibility update
- `onCharacterSelectionChanged()` - Notify of character panel changes

#### Integration Methods
- `applyVisibilityToCharacter(characterId)` - Apply rules to specific character
- `setCharacterPathVisibility(pathData, visible)` - Control path visibility
- `setCharacterMarkersVisibility(markerData, visible)` - Control marker visibility

### Events

#### movementVisibilityChanged
Dispatched when visibility mode changes:
```javascript
window.addEventListener('movementVisibilityChanged', (e) => {
    console.log('New mode:', e.detail.mode);
});
```

## Styling

### CSS Classes

#### Base Structure
- `.movement-visibility-control` - Main container
- `.visibility-slider` - Slider component
- `.slider-options` - Option buttons container
- `.slider-option` - Individual option buttons
- `.slider-thumb` - Animated position indicator

#### States
- `.slider-option.active` - Currently selected option
- `[data-theme="dark"]` - Dark mode styling

### Customization

#### Colors
```css
/* Light mode */
.slider-thumb {
    background: #6366f1; /* Primary color */
}

/* Dark mode */
[data-theme="dark"] .slider-thumb {
    background: #8b5cf6; /* Dark mode primary */
}
```

#### Positioning
```css
.movement-visibility-control {
    position: fixed;
    top: 20px;           /* Distance from top */
    left: 50%;           /* Center horizontally */
    transform: translateX(-50%);
}
```

## Behavior Logic

### Visibility Rules

#### Default Mode
- **Paths**: Show if character is selected in panel
- **Markers**: Show if character is selected in panel

#### Paths Only Mode  
- **Paths**: Show if character is selected in panel
- **Markers**: Hide regardless of selection

#### Hidden Mode
- **Paths**: Hide regardless of selection
- **Markers**: Hide regardless of selection

### Integration Flow

1. **Character Panel Change**: User toggles character in panel
2. **Notification**: Panel notifies visibility control
3. **Rule Application**: Control applies current mode rules
4. **Map Update**: Elements show/hide according to combined rules

## Testing

### Manual Testing
Open `test/movement-visibility-control-test.html` to test:
- Mode switching functionality
- Visual feedback and animations
- Dark/light theme compatibility
- Responsive behavior

### Integration Testing
Verify in main application:
- Character panel integration
- Real movement data handling
- Performance with many characters
- State preservation across mode changes

## Browser Compatibility

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+
- **CSS Features**: CSS Grid, Custom Properties, Backdrop Filter
- **JavaScript**: ES6+ features (Classes, Arrow Functions, Template Literals)

## Performance Considerations

- **Lightweight**: Minimal DOM manipulation
- **Efficient**: Direct layer show/hide operations
- **Responsive**: Smooth transitions without layout thrashing
- **Memory**: No data duplication, references existing systems

## Future Enhancements

- **Keyboard Shortcuts**: Hotkeys for quick mode switching
- **Animation Options**: Configurable transition effects  
- **Persistence**: Remember mode across sessions
- **Advanced Filters**: Per-character type visibility rules
