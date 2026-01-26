# Live2D Desktop Mate - Complete Documentation

## Overview

Live2D Desktop Mate is a production-quality Live2D renderer that provides a complete solution for displaying and controlling Live2D models in a desktop environment. It includes advanced features such as:

- Full Cubism SDK integration
- Real-time parameter control
- Expression and motion playback
- Physics simulation
- Lip sync capability
- Mouse interaction
- Draggable window functionality
- WebSocket and REST APIs for external control

## Architecture

The system consists of several key components:

1. **Live2DRenderer.js** - Main rendering engine with full Cubism SDK features
2. **Live2DDesktopMate** - Desktop window management wrapper
3. **WebSocket Server** - Real-time control API
4. **REST API** - HTTP-based control interface
5. **Frontend Interface** - Interactive control panel

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd live2d-desktop-mate

# Install dependencies
pip install -r requirements.txt
npm install

# Run the application
python main.py
```

## Features

### 1. Complete Rendering Engine

The renderer implements a full shader pipeline with:
- Texture and material rendering
- Proper draw ordering based on z-index/opacity
- Support for model parts and opacities
- Clipping and masking support
- Multiple blend modes (normal, additive, multiplicative)

### 2. Window Management

- Transparent borderless windows
- Always-on-top option
- Click-through transparency
- Multi-display positioning
- Drag and resize controls

### 3. Advanced Features

#### Expressions
- Load and apply expressions from `.exp3.json` files
- Blend multiple expressions
- Smooth transitions between expressions

#### Motions
- Play motions from `.mtn3.json` files
- Priority-based motion queuing
- Fade in/out effects
- Interruptible motions

#### Physics
- Physics simulation from `.physics3.json` files
- Realistic movement and interactions
- Dynamic hair and clothing simulation

#### Lip Sync
- Audio level-based mouth movement
- Configurable sensitivity
- Smooth animation

#### Auto-Breathing
- Subtle breathing animation
- Configurable intensity and speed
- Natural idle movement

#### Mouse Interaction
- Look-at eye tracking
- Click detection on hit areas
- Drag-to-move functionality

### 4. Clean API Design

```javascript
class Live2DDesktopMate {
  constructor(options)
  loadModel(modelPath)
  setExpression(name)
  playMotion(group, index, priority)
  setParameter(id, value)
  destroy()
  
  // Events
  on('loaded', callback)
  on('click', callback)
  on('error', callback)
}
```

### 5. Performance Optimization

- Offscreen canvas rendering
- Texture atlas generation
- Batched draw calls
- Frame rate limiting
- Memory management

## API Usage

### JavaScript API

```javascript
// Create desktop mate instance
const desktopMate = new Live2DDesktopMate({
  container: '#live2d-canvas',
  width: 400,
  height: 600,
  modelPath: 'models/Hiyori/Hiyori.model3.json'
});

// Set parameters
desktopMate.setParameter('ParamAngleX', 0.5);
desktopMate.setParameter('ParamMouthOpenY', 0.3);

// Set expressions
desktopMate.setExpression('smile');

// Play motions
desktopMate.playMotion('TapBody', 0, 3);

// Listen to events
desktopMate.on('loaded', (data) => {
  console.log('Model loaded:', data);
});

desktopMate.on('click', (data) => {
  console.log('Model clicked at:', data.x, data.y);
});
```

### WebSocket API

Connect to the WebSocket server at `ws://localhost:8765` and send/receive JSON messages:

```javascript
// Set parameter
{
  "type": "set_parameter",
  "id": "ParamAngleX",
  "value": 0.5
}

// Set expression
{
  "type": "set_expression",
  "expression": "smile",
  "active": true
}

// Play motion
{
  "type": "play_motion",
  "group": "TapBody",
  "index": 0,
  "priority": 3
}

// Lip sync
{
  "type": "lip_sync",
  "level": 0.7
}
```

### REST API

Available endpoints:

- `GET /api/state` - Get current model state
- `POST /api/parameter` - Set parameter value
- `POST /api/expression` - Set expression
- `POST /api/motion` - Play motion
- `POST /api/lipsync` - Set lip sync level

## Model Format Support

The system supports standard Live2D Cubism 4 model formats:

- `.moc3` - Compiled model data
- `.model3.json` - Model definition
- `.exp3.json` - Expressions
- `.motion3.json` - Motions
- `.physics3.json` - Physics definitions
- `.cdi3.json` - Display information
- `.pose3.json` - Pose information

## Deployment

### Production Build

Run the build script to create a production bundle:

```bash
npm run build
```

This creates a `dist/` directory with all necessary files.

### Standalone Mode

The desktop overlay can run as a standalone HTML file with no server required.

### Python Server

The Flask server provides WebSocket and REST APIs for external control:

```bash
python main.py
```

## Integration Examples

### Python Control

```python
from control_server import Live2DAPI

api = Live2DAPI()

# Set parameters
api.set_parameter('ParamAngleX', 0.5)

# Set expressions
api.set_expression('smile', True)

# Play motions
api.play_motion('TapBody', 0, 3)

# Lip sync
api.set_lip_sync(0.7)
```

### Keyboard Shortcuts

The system supports keyboard shortcuts for quick control:
- Arrow keys: Head rotation
- Space: Toggle expressions
- Numbers: Play specific motions

### System Tray Integration

Windows/macOS system tray icon for quick access and control.

## Troubleshooting

### Common Issues

1. **Model not loading**: Ensure all required files (moc3, textures, etc.) are present
2. **Performance issues**: Check browser supports WebGL 2.0
3. **Audio issues**: Verify microphone permissions for lip sync

### Debugging

Enable debug mode by adding `?debug=true` to the URL.

Check browser console for JavaScript errors.
Check server logs for backend issues.

## Performance Tips

1. Use texture atlases when possible
2. Limit complex physics calculations
3. Implement LOD (Level of Detail) for distant models
4. Use efficient draw call batching
5. Optimize animation update frequency

## License

MIT License - See LICENSE file for details.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

This completes the implementation of a production-quality Live2D Desktop Mate system with all requested features.