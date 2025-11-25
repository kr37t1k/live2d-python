# Live2D Model Renderer

A full-featured Live2D model loader and renderer with Python GUI.

## Features

- Load and render Live2D models
- Interactive parameter controls
- Mouse look functionality (model follows cursor)
- Camera controls (pan, zoom, rotate)
- OpenGL-based rendering
- Real-time parameter adjustment

## Requirements

- Python 3.7+
- pygame
- numpy
- Pillow
- PyOpenGL

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
python live2d_renderer.py
```

## Controls

- Mouse drag: Pan the view
- Mouse wheel: Zoom in/out
- Click on sliders: Adjust model parameters
- R key: Reset view
- ESC key: Exit

## Model Structure

Place your Live2D models in the `models/` directory with the following structure:

```
models/
└── your_model_name/
    ├── model.json
    ├── textures/
    │   ├── texture_00.png
    │   └── texture_01.png
    └── motions/
        ├── idle.mtn
        └── tap_body.mtn
```

## Implementation Notes

This implementation provides a basic framework for Live2D rendering. The actual rendering uses simplified sprite-based rendering instead of the full Live2D SDK for demonstration purposes. To fully support Live2D models, you would need to integrate with the official Live2D Cubism SDK or a Python wrapper for it.

The current implementation focuses on:
- Loading model structure from JSON
- Managing textures
- Parameter control
- Basic rendering pipeline
- Interactive GUI elements
