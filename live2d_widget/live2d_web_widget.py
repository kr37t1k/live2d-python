"""
Live2D Widget for PyQtWebEngine - A reusable module for Live2D model rendering

This module provides a PyQt widget that renders Live2D models using
web technologies through QtWebEngine.
"""

import sys
import os
import json
from pathlib import Path
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QVBoxLayout, QWidget, 
    QPushButton, QHBoxLayout, QFileDialog, QSplitter,
    QLabel, QFrame
)
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtCore import QUrl, QDir, pyqtSignal, QObject
from PyQt6.QtWebEngineCore import QWebEngineSettings
from PyQt6.QtGui import QFont
import tempfile
import shutil


class Live2DWidget(QWidget):
    """
    A PyQt widget for rendering Live2D models using QtWebEngine.
    
    This widget can be embedded in any PyQt application and provides
    controls for loading and interacting with Live2D models.
    """
    
    # Signal emitted when model loading status changes
    model_loaded = pyqtSignal(bool)
    model_load_error = pyqtSignal(str)
    
    def __init__(self, parent=None, model_path=None, enable_controls=True):
        """
        Initialize the Live2D widget.
        
        Args:
            parent: Parent widget
            model_path: Path to the Live2D model directory (optional)
            enable_controls: Whether to show control buttons
        """
        super().__init__(parent)
        self.model_path = model_path
        self.enable_controls = enable_controls
        self._temp_dir = None
        
        self._setup_ui()
        self._setup_web_engine()
        
        # Create temporary directory for web assets
        self._create_temp_assets()
        
        if model_path:
            self.load_model_from_path(model_path)
    
    def _setup_ui(self):
        """Setup the user interface."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create main content area
        if self.enable_controls:
            # Create controls panel
            controls_frame = QFrame()
            controls_frame.setFrameStyle(QFrame.Shape.StyledPanel)
            controls_layout = QHBoxLayout(controls_frame)
            
            self.load_button = QPushButton("Load Model")
            self.load_button.clicked.connect(self._browse_model)
            controls_layout.addWidget(self.load_button)
            
            self.reload_button = QPushButton("Reload")
            self.reload_button.clicked.connect(self._reload_page)
            controls_layout.addWidget(self.reload_button)
            
            controls_layout.addStretch()
            
            layout.addWidget(controls_frame)
        
        # Create web view
        self.web_view = QWebEngineView()
        layout.addWidget(self.web_view)
        
        # Status label
        if self.enable_controls:
            self.status_label = QLabel("Ready to load model")
            self.status_label.setFont(QFont("Arial", 10))
            layout.addWidget(self.status_label)
    
    def _setup_web_engine(self):
        """Setup web engine settings."""
        settings = self.web_view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
    
    def _create_temp_assets(self):
        """Create temporary directory with web assets."""
        self._temp_dir = tempfile.mkdtemp(prefix="live2d_widget_")
        
        # Copy necessary files to temp directory
        self._copy_assets_to_temp()
        
        # Create the HTML file
        self._create_html_file()
        
        # Load the HTML
        html_path = os.path.join(self._temp_dir, "index.html")
        self.web_view.load(QUrl.fromLocalFile(html_path))
    
    def _copy_assets_to_temp(self):
        """Copy required assets to temporary directory."""
        # Copy pixi files
        pixi_dir = os.path.join(self._temp_dir, "pixi")
        os.makedirs(pixi_dir, exist_ok=True)
        
        # Copy pixi files from project directory
        if os.path.exists("/workspace/pixi/pixi.js"):
            shutil.copy("/workspace/pixi/pixi.js", os.path.join(pixi_dir, "pixi.js"))
        if os.path.exists("/workspace/pixi/pixi.min.js"):
            shutil.copy("/workspace/pixi/pixi.min.js", os.path.join(pixi_dir, "pixi.min.js"))
        if os.path.exists("/workspace/pixi/pixi-live2d.js"):
            shutil.copy("/workspace/pixi/pixi-live2d.js", os.path.join(pixi_dir, "pixi-live2d.js"))
        if os.path.exists("/workspace/pixi/pixi-live2d.min.js"):
            shutil.copy("/workspace/pixi/pixi-live2d.min.js", os.path.join(pixi_dir, "pixi-live2d.min.js"))
        
        # Copy cubism core
        core_dir = os.path.join(self._temp_dir, "cubism.web.sdk", "Core")
        os.makedirs(core_dir, exist_ok=True)
        
        if os.path.exists("/workspace/cubism.web.sdk/Core/live2dcubismcore.min.js"):
            shutil.copy(
                "/workspace/cubism.web.sdk/Core/live2dcubismcore.min.js", 
                os.path.join(core_dir, "live2dcubismcore.min.js")
            )
    
    def _create_html_file(self):
        """Create the HTML file for Live2D rendering."""
        # Create CSS content
        css_content = """
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    background: linear-gradient(135deg, #0f0c29, #24243e);
    color: white;
    font-family: 'Segoe UI', system-ui, sans-serif;
    height: 100vh;
    overflow: hidden;
}

#canvas-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

canvas {
    display: block;
    width: 100%;
    height: 100%;
}

#controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 12, 41, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 16px;
    border: 1px solid rgba(114, 9, 183, 0.5);
    max-width: 90%;
    width: 600px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    display: none; /* Hidden by default, can be shown via JS */
}

.control-group {
    margin-bottom: 12px;
}

button {
    background: linear-gradient(90deg, #4cc9f0, #7209b7);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 50px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin: 4px;
    min-width: 120px;
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(76, 201, 240, 0.4);
}

button:disabled {
    opacity: 0.5;
    transform: none;
    cursor: not-allowed;
}

h4 {
    margin-bottom: 8px;
    color: #4cc9f0;
    font-size: 1.1rem;
}

#status {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    padding: 8px 20px;
    border-radius: 30px;
    font-size: 0.9rem;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(76, 201, 240, 0.3);
}

.motion-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
        """
        
        # Create JavaScript content
        js_content = """
const Application = PIXI.Application;

// Global variables
let app = null;
let live2dModel = null;
let isDragging = false;
let dragEnabled = false;

// Initialize PIXI Application
function initApp() {
    if (app) return;

    try {
        app = new Application({
            view: document.getElementById('canvas'),
            backgroundColor: 0x0f0c29,
            transparent: true,
            resizeTo: window,
            resolution: window.devicePixelRatio || 1
        });

        window.addEventListener('resize', () => {
            if (app) {
                app.renderer.resize(window.innerWidth, window.innerHeight);
                if (live2dModel) positionModel();
            }
        });

        console.log('✅ PIXI Application created (v6)');

    } catch (error) {
        console.error('PIXI init error:', error);
        updateStatus(`❌ PIXI error: ${error.message}`);

        // Fallback: Try alternative PIXI access
        if (typeof Application === 'undefined') {
            alert('PIXI not loaded! Check network tab for 404 errors.');
        }
    }
}

// Position model in center
function positionModel() {
    if (!live2dModel || !app) return;

    live2dModel.position.set(app.screen.width / 2, app.screen.height * 0.75);
    const scale = Math.min(
        app.screen.width / live2dModel.width,
        app.screen.height / live2dModel.height
    ) * 0.7;
    live2dModel.scale.set(scale);
}

// Load model function
async function loadModel(modelPath) {
    if (!modelPath) {
        updateStatus('⚠️ No model path provided');
        return;
    }
    
    updateStatus(`Loading: ${modelPath}...`);

    try {
        initApp();

        // Clear previous model
        if (live2dModel) {
            app.stage.removeChild(live2dModel);
            live2dModel.destroy();
            live2dModel = null;
        }

        live2dModel = await PIXI.live2d.Live2DModel.from(modelPath);

        app.stage.addChild(live2dModel);
        positionModel();
        setupInteraction();

        // Enable motion buttons
        document.querySelectorAll('#motion-buttons button').forEach(btn => {
            btn.disabled = false;
        });

        updateStatus(`✅ Model loaded!`);
        
        // Notify parent window about successful load
        if (window.pyqt5qt6bridge) {
            window.pyqt5qt6bridge.modelLoaded(true);
        }

    } catch (error) {
        console.error('Model load error:', error);
        updateStatus(`❌ Failed: ${error.message}`);
        
        // Notify parent window about error
        if (window.pyqt5qt6bridge) {
            window.pyqt5qt6bridge.modelLoadError(error.message);
        }
    }
}

// Setup interaction
function setupInteraction() {
    if (!live2dModel) return;

    live2dModel.interactive = true;

    live2dModel.on('pointerdown', (e) => {
        if (dragEnabled) {
            isDragging = true;
            document.body.style.cursor = 'grabbing';
        }
    });

    live2dModel.on('pointermove', (e) => {
        if (isDragging && dragEnabled && live2dModel.internalModel?._model?._dragManager) {
            const { x, y } = e.data.global;
            const dx = (x - app.screen.width / 2) * 0.01;
            const dy = (y - app.screen.height / 2) * 0.01;
            live2dModel.internalModel._model._dragManager.adjustDrag(dx, dy);
        }
    });

    live2dModel.on('pointerup', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });

    live2dModel.on('pointerupoutside', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });

    // Tap interaction
    live2dModel.on('hit', (areas) => {
        if (!dragEnabled && !isDragging) {
            const bodyHits = ['Body', 'body', 'Head', 'head'];
            if (areas.some(a => bodyHits.includes(a))) {
                playMotion('tap_body');
            }
        }
    });
}

function playMotion(group) {
    if (!live2dModel) {
        updateStatus('⚠️ No model loaded');
        return;
    }

    try {
        const motions = live2dModel.motions;
        if (motions?.[group]?.[0] !== undefined) {
            live2dModel.motion(group, 0);
            updateStatus(`▶️ ${group}`);
        } else {
            // Try common aliases
            const aliases = [group, group.toLowerCase(), 'TapBody', 'tapBody', 'FlickHead', 'flickHead'];
            for (const alias of aliases) {
                if (motions?.[alias]?.[0] !== undefined) {
                    live2dModel.motion(alias, 0);
                    updateStatus(`▶️ ${alias}`);
                    return;
                }
            }
            updateStatus(`⚠️ No ${group} motion`);
        }
    } catch (e) {
        console.error('Motion error:', e);
        updateStatus(`❌ ${e.message}`);
    }
}

function resetView() {
    if (live2dModel?.internalModel?._model?._dragManager) {
        live2dModel.internalModel._model._dragManager.adjustDrag(0, 0);
        updateStatus('🔄 Reset');
    }
}

function toggleDragging() {
    dragEnabled = !dragEnabled;
    document.getElementById('drag-status').textContent = dragEnabled ? 'ON' : 'OFF';
    updateStatus(`Drag: ${dragEnabled ? 'ON' : 'OFF'}`);
}

function updateStatus(msg) {
    document.getElementById('status').textContent = msg;
    
    // Also update parent window status if available
    if (window.pyqt5qt6bridge) {
        window.pyqt5qt6bridge.updateStatus(msg);
    }
}

// Bridge for communication with PyQt
window.pyqt5qt6bridge = {
    loadModel: function(modelPath) {
        loadModel(modelPath);
    },
    playMotion: function(motion) {
        playMotion(motion);
    },
    resetView: function() {
        resetView();
    },
    toggleDragging: function() {
        toggleDragging();
    }
};

console.log('🔍 PIXI version check:');
console.log('PIXI global:', typeof PIXI);
console.log('PIXI.Application:', typeof PIXI.Application);
console.log('PIXI version:', PIXI.VERSION);
console.log('Live2D available:', !!PIXI.live2d);

updateStatus('✅ Ready! Waiting for model...');
        """
        
        # Create HTML file
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Live2D + PIXI v6</title>
    <style>{css_content}</style>
</head>
<body>
    <div id="canvas-container">
        <canvas id="canvas"></canvas>
    </div>

    <div id="controls">
        <div class="control-group">
            <button onclick="resetView()">Reset View</button>
        </div>
        <div class="control-group">
            <button onclick="toggleDragging()">Toggle Drag: <span id="drag-status">OFF</span></button>
        </div>
        <div class="control-group">
            <h4>Motions:</h4>
            <div class="motion-buttons" id="motion-buttons">
                <button onclick="playMotion('idle')">Idle</button>
                <button onclick="playMotion('tap_body')">Tap Body</button>
            </div>
        </div>
    </div>

    <div id="status">Loading libraries...</div>

    <!-- Live2D Libraries -->
    <script src="./cubism.web.sdk/Core/live2dcubismcore.min.js"></script>
    <script src="./pixi/pixi.js"></script>
    <script src="./pixi/pixi-live2d.js"></script>

    <script>{js_content}</script>
</body>
</html>"""
        
        # Write HTML file
        html_path = os.path.join(self._temp_dir, "index.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
    
    def _get_model_files(self, model_dir):
        """Get model file paths."""
        model_dir = Path(model_dir)
        
        # Find model3.json file
        model_file = None
        for file in model_dir.glob("*.model3.json"):
            model_file = f"./{file.name}"
            break
        
        if not model_file:
            # Fallback to model.json if model3.json not found
            fallback = model_dir / "model.json"
            if fallback.exists():
                model_file = f"./{fallback.name}"
        
        # Find motion files
        motions = []
        for motion_file in model_dir.glob("*.motion3.json"):
            motions.append(str(motion_file.name))
        
        return {
            'model_file': model_file or '',
            'motions': motions
        }
    
    def load_model_from_path(self, model_path):
        """
        Load a Live2D model from the specified path.
        
        Args:
            model_path (str): Path to the directory containing the Live2D model files
        """
        if not os.path.exists(model_path):
            self.model_load_error.emit(f"Model path does not exist: {model_path}")
            return False
        
        model_files = self._get_model_files(model_path)
        if not model_files['model_file']:
            self.model_load_error.emit(f"No model file found in: {model_path}")
            return False
        
        # Copy model files to temp directory
        dest_model_dir = os.path.join(self._temp_dir, "model")
        os.makedirs(dest_model_dir, exist_ok=True)
        
        # Copy all model files
        for item in os.listdir(model_path):
            src_path = os.path.join(model_path, item)
            dest_path = os.path.join(dest_model_dir, item)
            if os.path.isfile(src_path):
                shutil.copy2(src_path, dest_path)
        
        # Update the model file path to point to the copied model
        model_file_path = f"./model/{os.path.basename(model_files['model_file'])}"
        
        # Execute JavaScript to load the model
        js_code = f"pyqt5qt6bridge.loadModel('{model_file_path}');"
        self.web_view.page().runJavaScript(js_code)
        
        return True
    
    def _browse_model(self):
        """Open file dialog to select a model directory."""
        model_dir = QFileDialog.getExistingDirectory(
            self, "Select Live2D Model Directory", 
            self.model_path or os.getcwd()
        )
        
        if model_dir:
            self.model_path = model_dir
            self.load_model_from_path(model_dir)
    
    def _reload_page(self):
        """Reload the web page."""
        self.web_view.reload()
    
    def set_model_path(self, path):
        """
        Set the model path and load the model.
        
        Args:
            path (str): Path to the Live2D model directory
        """
        self.model_path = path
        self.load_model_from_path(path)
    
    def play_motion(self, motion_name):
        """
        Play a specific motion on the loaded model.
        
        Args:
            motion_name (str): Name of the motion to play
        """
        js_code = f"pyqt5qt6bridge.playMotion('{motion_name}');"
        self.web_view.page().runJavaScript(js_code)
    
    def reset_view(self):
        """Reset the view of the model."""
        js_code = "pyqt5qt6bridge.resetView();"
        self.web_view.page().runJavaScript(js_code)
    
    def toggle_dragging(self):
        """Toggle dragging mode."""
        js_code = "pyqt5qt6bridge.toggleDragging();"
        self.web_view.page().runJavaScript(js_code)
    
    def update_status(self, message):
        """
        Update the status label.
        
        Args:
            message (str): Status message to display
        """
        if hasattr(self, 'status_label'):
            self.status_label.setText(message)
    
    def sizeHint(self):
        """Return a recommended size for the widget."""
        return QSize(800, 600)
    
    def __del__(self):
        """Cleanup temporary directory when widget is destroyed."""
        if self._temp_dir and os.path.exists(self._temp_dir):
            import shutil
            shutil.rmtree(self._temp_dir, ignore_errors=True)


class Live2DWindow(QMainWindow):
    """
    A standalone window for the Live2D widget.
    This can be used for testing or as a standalone application.
    """
    
    def __init__(self, model_path=None):
        super().__init__()
        self.setWindowTitle("Live2D Model Renderer")
        self.setGeometry(100, 100, 1200, 800)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Create Live2D widget
        self.live2d_widget = Live2DWidget(parent=self, model_path=model_path, enable_controls=True)
        layout.addWidget(self.live2d_widget)
        
        # Connect signals
        self.live2d_widget.model_loaded.connect(self._on_model_loaded)
        self.live2d_widget.model_load_error.connect(self._on_model_error)
    
    def _on_model_loaded(self, success):
        """Handle model loaded signal."""
        if success:
            print("Model loaded successfully!")
        else:
            print("Model failed to load.")
    
    def _on_model_error(self, error_message):
        """Handle model load error signal."""
        print(f"Model load error: {error_message}")


def main():
    """Main application function for testing."""
    app = QApplication(sys.argv)
    
    # Create and show the main window
    window = Live2DWindow(model_path="/workspace/models/huohuo")
    window.show()
    
    # Run the application
    sys.exit(app.exec())


if __name__ == "__main__":
    main()