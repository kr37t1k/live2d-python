# Live2D Model Renderer - Technical Documentation

## Overview

The Live2D Model Renderer is a Python application that provides a framework for loading, rendering, and interacting with Live2D models. It features a real-time OpenGL-based renderer with an interactive GUI for parameter control.

## Architecture

### Core Components

1. **Live2DModel Class**
   - Handles loading of Live2D model data from JSON
   - Manages textures and model parameters
   - Stores model structure information

2. **Live2DRenderer Class**
   - Main rendering engine using OpenGL
   - Handles user interaction (mouse, keyboard)
   - Manages camera transformations
   - Controls animation and parameter updates

3. **GUI System**
   - Dynamic slider controls for model parameters
   - Real-time parameter adjustment
   - Visual feedback for interactions

## Features Implemented

### 1. Model Loading
- Loads model structure from `model.json`
- Handles multiple textures
- Parses parameters, parts, and motions
- Creates placeholder textures for missing assets

### 2. Rendering Pipeline
- OpenGL-based rendering system
- Texture management
- Camera controls (position, scale, rotation)
- Real-time model updates

### 3. Interactive Controls
- Mouse-based camera panning
- Mouse wheel zooming
- Parameter sliders for real-time adjustments
- Mouse look functionality (model follows cursor)

### 4. Animation System
- Time-based animation updates
- Blinking simulation
- Parameter-driven animations
- Mouse tracking for eye/head movement

## File Structure

```
/workspace/
├── live2d_renderer.py      # Main application code
├── run_live2d.py           # Launcher script
├── setup.py                # Installation script
├── requirements.txt        # Python dependencies
├── README.md              # User documentation
├── DOCUMENTATION.md       # Technical documentation
├── models/                # Model storage directory
│   └── default/           # Default sample model
│       ├── model.json     # Model definition
│       └── textures/      # Model textures
│           ├── texture_00.png
│           └── texture_01.png
└── LICENSE
```

## Key Classes and Methods

### Live2DModel
- `__init__(model_path)`: Initialize model from directory
- `load_model()`: Load model data from JSON
- `load_textures()`: Load all model textures
- `initialize_parameters()`: Set up model parameters

### Live2DRenderer
- `__init__(width, height)`: Initialize renderer with screen dimensions
- `load_model(model_path)`: Load a model into the renderer
- `handle_event(event)`: Process pygame events
- `update(dt)`: Update animation state
- `render()`: Main rendering loop
- `render_model()`: Render the 3D model
- `render_gui()`: Render GUI elements

## Controls

- **Mouse Drag**: Pan the camera view
- **Mouse Wheel**: Zoom in/out
- **Slider Click**: Adjust model parameters
- **R Key**: Reset camera view
- **ESC Key**: Exit application

## Technical Implementation Details

### OpenGL Setup
The renderer uses OpenGL for hardware-accelerated rendering:
- Orthographic projection for 2D rendering
- Texture management for model parts
- Matrix transformations for camera controls

### Parameter System
Model parameters are dynamically loaded from the model JSON and presented as interactive sliders:
- Each parameter has min/max values and default settings
- Parameters are updated in real-time during interaction
- Mouse position influences eye and head tracking parameters

### Animation Pipeline
The animation system updates at 60 FPS:
- Time-based animation updates
- Interpolation between key poses
- Real-time parameter adjustments

## Extending the System

### Adding New Models
To add a new Live2D model:

1. Create a new directory in `/models/`
2. Add the model JSON file
3. Include textures in a `textures/` subdirectory
4. Add motions in a `motions/` subdirectory (optional)

### Custom Parameters
The system supports custom model parameters defined in the model JSON file. New parameters will automatically appear as sliders in the GUI.

### Advanced Rendering
For full Live2D SDK support, integrate with the official Live2D Cubism SDK or a Python wrapper like `live2d-cubism-core`.

## Dependencies

- **pygame**: For window management and input handling
- **PyOpenGL**: For 3D rendering capabilities
- **numpy**: For mathematical operations
- **Pillow**: For image processing

## Limitations and Future Improvements

### Current Limitations
- Simplified rendering instead of full Live2D SDK
- No motion file playback
- Basic texture handling

### Potential Improvements
- Integration with Live2D Cubism SDK
- Motion file support (.mtn files)
- Advanced mesh deformation
- More sophisticated animation blending
- Export functionality
- Model editing capabilities

## License

This project is licensed under the terms specified in the LICENSE file.