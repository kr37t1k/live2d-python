# Live2D Widget for PyQt

A PyQtWebEngine widget for rendering Live2D models using web technologies (PIXI.js and pixi-live2d).

## Features

- Embeddable PyQt widget for Live2D model rendering
- Supports Live2D Cubism 4 models
- Interactive controls (dragging, motion playback)
- Model loading from local directories
- Signals for status updates and error handling

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```python
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from live2d_widget import Live2DWidget

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Live2D Widget Example")
        self.setGeometry(100, 100, 1200, 800)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Create Live2D widget
        self.live2d_widget = Live2DWidget(
            parent=self,
            model_path="/path/to/your/model/directory",
            enable_controls=True
        )
        layout.addWidget(self.live2d_widget)

if __name__ == "__main__":
    import sys
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
```

### Using the Widget Methods

```python
# Load a different model
live2d_widget.set_model_path("/path/to/new/model")

# Play a specific motion
live2d_widget.play_motion("idle")

# Reset the view
live2d_widget.reset_view()

# Toggle dragging mode
live2d_widget.toggle_dragging()

# Update status
live2d_widget.update_status("Loading model...")
```

### Signal Connections

```python
# Connect to signals
live2d_widget.model_loaded.connect(lambda success: print(f"Model loaded: {success}"))
live2d_widget.model_load_error.connect(lambda error: print(f"Error: {error}"))
```

## Requirements

- Python 3.8+
- PyQt6
- PyQt6-WebEngine
- Live2D Cubism Core
- PIXI.js
- pixi-live2d

## Project Structure

```
/workspace/
├── live2d_widget/           # Main package
│   ├── __init__.py          # Package entry point
│   └── live2d_web_widget.py # Main widget implementation
├── pixi/                    # PIXI.js and pixi-live2d libraries
├── cubism.web.sdk/          # Live2D Cubism SDK
├── models/                  # Sample Live2D models
├── requirements.txt         # Python dependencies
└── setup.py                 # Package setup
```

## API Reference

### Live2DWidget Class

- `__init__(parent=None, model_path=None, enable_controls=True)`: Initialize the widget
- `set_model_path(path)`: Load a model from the specified path
- `play_motion(motion_name)`: Play a specific motion
- `reset_view()`: Reset the model view
- `toggle_dragging()`: Toggle dragging mode
- `update_status(message)`: Update the status label

### Signals

- `model_loaded(bool)`: Emitted when a model is loaded successfully
- `model_load_error(str)`: Emitted when model loading fails

## License

MIT License - See the LICENSE file for details.
