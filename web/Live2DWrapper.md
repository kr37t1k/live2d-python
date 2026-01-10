# Live2D Python-like Wrapper Classes

This project provides clean, intuitive wrapper classes for the Live2D Cubism Core Web SDK, offering a Python-like API with high-level, object-oriented access to Live2D models.

## Features

- **Python-like API**: Clean, intuitive class-based interface
- **High-level abstraction**: Encapsulates raw Live2D Core complexity
- **Caching mechanism**: Efficient memory management
- **Property accessors**: Python-style property getters/setters
- **Iterator support**: Enumerable parameters and drawables
- **WebGL integration**: Built-in rendering capabilities
- **Performance optimized**: Efficient buffer management

## Classes Overview

### Live2DBase
Base class for all Live2D objects with caching functionality.

### Live2DDrawables
Wrapper for model drawables with easy access to vertices, UVs, opacities, etc.

### Live2DParameters
Parameter management with automatic name-to-index mapping and validation.

### Live2DParts
Wrapper for model parts with opacity control.

### Live2DCanvasInfo
Canvas information access with width, height, and scale information.

### Live2DModel
Main model class with Python-like API access to all model components.

### Live2DRenderer
WebGL renderer with built-in buffer management and rendering pipeline.

### Live2DDesktopMate
Desktop application wrapper for creating interactive desktop companions.

## Usage Examples

### Basic Model Loading
```javascript
// Load model from URL
const model = await Live2DModel.fromURL('path/to/model.model3.json');

// Access model information
console.log('Drawables count:', model.drawables.count);
console.log('Parameters count:', model.parameters.count);
console.log('Canvas size:', model.canvasInfo.width, model.canvasInfo.height);
```

### Parameter Management
```javascript
// Set parameter by name
model.parameters.set('ParamAngleX', 0.5);

// Set parameter by index
model.parameters.set(0, 0.3, true); // true indicates index-based access

// Get parameter value
const value = model.parameters.get('ParamAngleX');

// Iterate through all parameters
for (const param of model.parameters) {
    console.log(`${param.name}: ${param.value} (min: ${param.minimum}, max: ${param.maximum})`);
}

// Normalize/denormalize values
const normalized = model.parameters.normalizeValue(0, 0.5);
const denormalized = model.parameters.denormalizeValue(0, 0.5);
```

### Drawable Access
```javascript
// Get drawable information
const vertices = model.drawables.getVertices(0);
const uvs = model.drawables.getUVs(0);
const opacity = model.drawables.getOpacity(0);
const isVisible = model.drawables.isVisible(0);

// Check visibility and render order
for (let i = 0; i < model.drawables.count; i++) {
    if (model.drawables.isVisible(i)) {
        console.log(`Drawable ${i} is visible with opacity: ${model.drawables.getOpacity(i)}`);
    }
}
```

### Rendering
```javascript
// Create WebGL context and renderer
const canvas = document.getElementById('live2dCanvas');
const gl = canvas.getContext('webgl');
const renderer = new Live2DRenderer(gl, model);

// Load textures
await renderer.loadTextures(['path/to/texture.png']);

// Render loop
function render() {
    // Update model
    model.update(16.67); // Delta time in ms
    
    // Update renderer buffers
    renderer.updateBuffers();
    
    // Render
    const projectionMatrix = createOrthographicMatrix(...);
    renderer.render(projectionMatrix);
    
    requestAnimationFrame(render);
}
```

### Desktop Application
```javascript
// Create desktop companion
const desktopMate = new Live2DDesktopMate({
    width: 400,
    height: 600,
    modelPath: 'path/to/model.model3.json',
    transparent: true
});

// Interact with the model
desktopMate.setParameter('ParamAngleX', 0.5);
desktopMate.setExpression('smile');
```

## Key Improvements Over Raw API

1. **Clean Property Access**: Instead of `model.drawables.vertexPositions[0]`, use `model.drawables.getVertices(0)`
2. **Automatic Caching**: Reduces repeated calculations and memory allocations
3. **Name-based Access**: Access parameters and drawables by name instead of indices
4. **Validation**: Input validation and bounds checking
5. **Iterator Support**: Python-like iteration over collections
6. **Error Handling**: Proper error handling and messaging
7. **Memory Management**: Proper resource cleanup and disposal

## Performance Considerations

- Use caching for frequently accessed data
- Update buffers only when necessary
- Dispose of resources properly with the `destroy()` method
- Batch parameter updates when possible

## Integration

Include the wrapper in your project:
```html
<script src="live2dcubismcore.min.js"></script>
<script src="Live2DWrapper.js"></script>
```

Or import as ES6 modules if your build system supports it.

## License

MIT License - See LICENSE file for details.