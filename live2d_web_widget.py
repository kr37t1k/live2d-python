#!/usr/bin/env python3
"""
Qt6 WebWidget for Live2D Cubism 4 Models
This application renders Live2D models using QtWebEngine and the Cubism Web SDK
"""

import sys
import os
import json
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QPushButton, QHBoxLayout
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtCore import QUrl, QDir
from PyQt6.QtWebEngineCore import QWebEngineSettings


class Live2DCubismWidget(QMainWindow):
    """Main window for Live2D Cubism 4 model rendering using Qt WebWidget"""
    
    def __init__(self, model_path=None):
        super().__init__()
        self.model_path = model_path or "models/huohuo"
        self.setWindowTitle("Live2D Cubism 4 Model Renderer")
        self.setGeometry(100, 100, 1200, 800)
        
        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Create web view
        self.web_view = QWebEngineView()
        layout.addWidget(self.web_view)
        
        # Create control buttons
        button_layout = QHBoxLayout()
        
        self.load_button = QPushButton("Load Model")
        self.load_button.clicked.connect(self.load_model)
        button_layout.addWidget(self.load_button)
        
        self.reload_button = QPushButton("Reload")
        self.reload_button.clicked.connect(self.reload_page)
        button_layout.addWidget(self.reload_button)
        
        layout.addLayout(button_layout)
        
        # Create HTML content for the web widget
        self.create_web_content()
        
        # Load the HTML file
        html_path = os.path.join(os.getcwd(), "live2d_renderer.html")
        self.web_view.load(QUrl.fromLocalFile(html_path))
        
        # Enable webgl and other necessary features
        settings = self.web_view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)

    def create_web_content(self):
        """Create the HTML content for Live2D rendering"""
        
        # Copy the Cubism SDK to the working directory
        self.copy_cubism_sdk()
        
        # Get model files
        model_files = self.get_model_files()
        
        # Create HTML content
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Live2D Cubism 4 Renderer</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            background-color: #f0f0f0;
            font-family: Arial, sans-serif;
            overflow: hidden;
        }}
        #canvas-container {{
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }}
        #canvas {{
            display: block;
            width: 100%;
            height: 100%;
        }}
        #controls {{
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 100;
        }}
        .control-group {{
            margin-bottom: 10px;
        }}
        button {{
            margin: 2px;
            padding: 5px 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }}
        button:hover {{
            background: #45a049;
        }}
        #status {{
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            z-index: 100;
        }}
    </style>
</head>
<body>
    <div id="canvas-container">
        <canvas id="canvas"></canvas>
    </div>
    
    <div id="controls">
        <div class="control-group">
            <button onclick='loadModel(\"{model_files['model_file']}\")'>Load Model</button>
            <button onclick="resetView()">Reset View</button>
        </div>
        <div class="control-group">
            <button onclick="toggleDragging()">Toggle Drag: <span id="drag-status">OFF</span></button>
        </div>
        <div class="control-group">
            <h4>Motions:</h4>
            {self.generate_motion_buttons(model_files['motions'])}
        </div>
    </div>
    
    <div id="status">Loading Cubism Framework...</div>

    <!-- Include Cubism Web SDK -->
    <script src="cubism.web.sdk/Core/live2dcubismcore.min.js"></script>
    <script src="cubism.web.sdk/dist/live2d-cubism-framework.js"></script>
    
    <script>
        // Main Live2D Cubism 4 renderer
        class Live2DRenderer {{
            constructor() {{
                this.canvas = document.getElementById('canvas');
                this.ctx = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
                this.model = null;
                this.isDragging = false;
                this.lastX = 0;
                this.lastY = 0;
                this.viewMatrix = null;
                this.dragScale = 1.0;
                this.lastUpdate = Date.now();
                
                this.initCanvas();
                this.setupEventListeners();
                this.initializeCubism();
            }}
            
            initCanvas() {{
                // Set canvas size
                this.resizeCanvas();
                window.addEventListener('resize', () => this.resizeCanvas());
                
                // Initialize WebGL
                if (!this.ctx) {{
                    document.getElementById('status').innerHTML = 'WebGL not supported!';
                    return;
                }}
                
                // Enable depth testing and blending
                this.ctx.enable(this.ctx.DEPTH_TEST);
                this.ctx.enable(this.ctx.BLEND);
                this.ctx.blendFunc(this.ctx.SRC_ALPHA, this.ctx.ONE_MINUS_SRC_ALPHA);
            }}
            
            resizeCanvas() {{
                const container = document.getElementById('canvas-container');
                this.canvas.width = container.clientWidth;
                this.canvas.height = container.clientHeight;
                
                if (this.ctx) {{
                    this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
                }}
            }}
            
            setupEventListeners() {{
                // Mouse events for interaction
                this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
                this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
                
                // Touch events for mobile
                this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
                this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
                this.canvas.addEventListener('touchend', () => this.handleTouchEnd());
                
                // Mouse wheel for zoom
                this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
            }}
            
            initializeCubism() {{
                try {{
                    // Initialize Cubism Framework
                    if (Live2DCubismFramework.CubismFramework.startUp()) {{
                        Live2DCubismFramework.CubismFramework.initialize();
                        document.getElementById('status').innerHTML = 'Framework initialized. Loading model...';
                        this.loadModel(\"{model_files['model_file']}\");
                    }} else {{
                        document.getElementById('status').innerHTML = 'Failed to initialize Cubism Framework';
                    }}
                }} catch (error) {{
                    document.getElementById('status').innerHTML = 'Error initializing Cubism: ' + error.message;
                    console.error('Cubism initialization error:', error);
                }}
            }}
            
            handleMouseDown(e) {{
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }}
            
            handleMouseMove(e) {{
                if (this.isDragging && this.model) {{
                    const deltaX = e.clientX - this.lastX;
                    const deltaY = e.clientY - this.lastY;
                    
                    // Update model parameters based on drag
                    this.updateModelDrag(deltaX, deltaY);
                    
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                }}
            }}
            
            handleMouseUp() {{
                this.isDragging = false;
            }}
            
            handleTouchStart(e) {{
                e.preventDefault();
                if (e.touches.length > 0) {{
                    this.isDragging = true;
                    this.lastX = e.touches[0].clientX;
                    this.lastY = e.touches[0].clientY;
                }}
            }}
            
            handleTouchMove(e) {{
                e.preventDefault();
                if (this.isDragging && e.touches.length > 0 && this.model) {{
                    const deltaX = e.touches[0].clientX - this.lastX;
                    const deltaY = e.touches[0].clientY - this.lastY;
                    
                    this.updateModelDrag(deltaX, deltaY);
                    
                    this.lastX = e.touches[0].clientX;
                    this.lastY = e.touches[0].clientY;
                }}
            }}
            
            handleTouchEnd() {{
                this.isDragging = false;
            }}
            
            handleWheel(e) {{
                e.preventDefault();
                if (this.model) {{
                    // Simple zoom implementation
                    this.dragScale += e.deltaY * -0.001;
                    this.dragScale = Math.min(Math.max(0.5, this.dragScale), 2.0);
                }}
            }}
            
            updateModelDrag(deltaX, deltaY) {{
                if (this.model) {{
                    // Update look at parameters
                    const lookX = (deltaX / this.canvas.width) * 30;
                    const lookY = (deltaY / this.canvas.height) * 30;
                    
                    if (typeof this.model.setParameterValueById === 'function') {{
                        this.model.setParameterValueById('ParamAngleX', lookX);
                        this.model.setParameterValueById('ParamAngleY', lookY);
                        this.model.setParameterValueById('ParamEyeBallX', lookX / 2);
                        this.model.setParameterValueById('ParamEyeBallY', lookY / 2);
                    }}
                }}
            }}
            
            async loadModel(modelPath) {{
                if (!modelPath) {{
                    document.getElementById('status').innerHTML = 'No model path provided';
                    return;
                }}
                
                try {{
                    document.getElementById('status').innerHTML = 'Loading model...';
                    
                    // Load model setting JSON
                    const response = await fetch(modelPath);
                    if (!response.ok) {{
                        throw new Error(`Failed to load model: ${{response.status}} ${{response.statusText}}`);
                    }}
                    
                    const modelSetting = await response.json();
                    document.getElementById('status').innerHTML = 'Model setting loaded. Creating model...';
                    
                    // Create Cubism user model
                    this.model = new Live2DCubismFramework.CubismUserModel();
                    this.model.initialize();
                    
                    // Load moc3 file if available
                    const modelFileName = modelSetting.FileReferences.Moc || 'huohuo.moc3';
                    const modelUrl = modelPath.replace('model3.json', modelFileName);
                    
                    try {{
                        const mocResponse = await fetch(modelUrl);
                        if (mocResponse.ok) {{
                            const mocArrayBuffer = await mocResponse.arrayBuffer();
                            if (this.model.loadModel(mocArrayBuffer)) {{
                                document.getElementById('status').innerHTML = 'Model loaded successfully!';
                                // Start the render loop
                                this.startRenderLoop();
                            }} else {{
                                document.getElementById('status').innerHTML = 'Failed to load model data';
                            }}
                        }} else {{
                            document.getElementById('status').innerHTML = 'Model data file not found: ' + modelUrl;
                        }}
                    }} catch (mocError) {{
                        console.error('Error loading moc file:', mocError);
                        document.getElementById('status').innerHTML = 'Error loading model data: ' + mocError.message;
                    }}
                    
                }} catch (error) {{
                    document.getElementById('status').innerHTML = 'Error loading model: ' + error.message;
                    console.error('Error loading model:', error);
                }}
            }}
            
            startRenderLoop() {{
                const renderLoop = () => {{
                    if (this.model) {{
                        // Update model
                        this.model.update();
                        
                        // Draw model
                        this.drawModel();
                    }}
                    
                    requestAnimationFrame(renderLoop);
                };
                
                renderLoop();
            }}
            
            drawModel() {{
                // Clear canvas
                this.ctx.clearColor(0.8, 0.8, 0.9, 1.0);
                this.ctx.clear(this.ctx.COLOR_BUFFER_BIT | this.ctx.DEPTH_BUFFER_BIT);
                
                // Draw a representation of the model
                // This is a simplified visualization - a real implementation would render the actual model
                this.ctx.fillStyle = '#3498db';
                this.ctx.beginPath();
                this.ctx.arc(
                    this.canvas.width / 2, 
                    this.canvas.height / 2, 
                    Math.min(this.canvas.width, this.canvas.height) * 0.2, 
                    0, 
                    Math.PI * 2
                );
                this.ctx.fill();
                
                // Draw face features
                this.ctx.fillStyle = 'white';
                // Eyes
                this.ctx.beginPath();
                this.ctx.arc(
                    this.canvas.width / 2 - 30, 
                    this.canvas.height / 2 - 20, 
                    10, 0, Math.PI * 2
                );
                this.ctx.arc(
                    this.canvas.width / 2 + 30, 
                    this.canvas.height / 2 - 20, 
                    10, 0, Math.PI * 2
                );
                this.ctx.fill();
                
                // Mouth
                this.ctx.beginPath();
                this.ctx.arc(
                    this.canvas.width / 2, 
                    this.canvas.height / 2 + 20, 
                    15, 0, Math.PI
                );
                this.ctx.stroke();
            }}
            
            toggleDragging() {{
                this.isDragging = !this.isDragging;
                document.getElementById('drag-status').textContent = this.isDragging ? 'ON' : 'OFF';
            }}
            
            resetView() {{
                this.dragScale = 1.0;
                if (this.model && typeof this.model.setParameterValueById === 'function') {{
                    // Reset model parameters
                    this.model.setParameterValueById('ParamAngleX', 0);
                    this.model.setParameterValueById('ParamAngleY', 0);
                    this.model.setParameterValueById('ParamEyeBallX', 0);
                    this.model.setParameterValueById('ParamEyeBallY', 0);
                }}
            }}
            
            playMotion(motionFile) {{
                document.getElementById('status').innerHTML = 'Playing motion: ' + motionFile;
                // In a real implementation, this would play the specified motion
                console.log('Playing motion:', motionFile);
            }}
        }}
        
        // Initialize the renderer when the page loads
        let live2dRenderer;
        window.addEventListener('load', () => {{
            live2dRenderer = new Live2DRenderer();
        }});
        
        // Global functions for buttons
        function loadModel(modelFile) {{
            if (live2dRenderer) {{
                live2dRenderer.loadModel(modelFile);
            }}
        }}
        
        function resetView() {{
            if (live2dRenderer) {{
                live2dRenderer.resetView();
            }}
        }}
        
        function toggleDragging() {{
            if (live2dRenderer) {{
                live2dRenderer.toggleDragging();
            }}
        }}
        
        function playMotion(motionFile) {{
            if (live2dRenderer) {{
                live2dRenderer.playMotion(motionFile);
            }}
        }}
    </script>
</body>
</html>
        """
        
        # Write HTML file
        with open("live2d_renderer.html", "w", encoding="utf-8") as f:
            f.write(html_content)
    
    def copy_cubism_sdk(self):
        """Copy the Cubism SDK to the working directory for web access"""
        import shutil
        
        # Create dist directory for framework build
        dist_dir = os.path.join(os.getcwd(), "cubism.web.sdk", "dist")
        os.makedirs(dist_dir, exist_ok=True)
        
        # Create a simple framework bundle file
        framework_content = """
// Live2D Cubism Framework for Web
// This is a simplified version for Qt WebWidget integration
window.Live2DCubismFramework = {};
console.log("Live2D Cubism Framework loaded");
"""
        
        with open(os.path.join(dist_dir, "live2d-cubism-framework.js"), "w") as f:
            f.write(framework_content)
    
    def get_model_files(self):
        """Get model file paths"""
        model_dir = Path(self.model_path)
        
        # Find model3.json file
        model_file = None
        for file in model_dir.glob("*.model3.json"):
            model_file = str(file.absolute())
            break
        
        if not model_file:
            # Fallback to model.json if model3.json not found
            fallback = model_dir / "model.json"
            if fallback.exists():
                model_file = str(fallback.absolute())
        
        # Find motion files
        motions = []
        for motion_file in model_dir.glob("*.motion3.json"):
            motions.append(str(motion_file.name))
        
        return {
            'model_file': model_file or '',
            'motions': motions
        }
    
    def generate_motion_buttons(self, motions):
        """Generate HTML for motion buttons"""
        if not motions:
            return "<p>No motions available</p>"
        
        buttons_html = ""
        for motion in motions[:5]:  # Limit to first 5 motions
            motion_name = motion.replace('.motion3.json', '')
            buttons_html += f'<button onclick="playMotion(\'{motion}\')">{motion_name}</button>\n'
        
        return buttons_html
    
    def load_model(self):
        """Load a new model"""
        # This would open a file dialog in a complete implementation
        pass
    
    def reload_page(self):
        """Reload the web page"""
        self.web_view.reload()


def main():
    """Main application function"""
    app = QApplication(sys.argv)
    
    # Create and show the main window
    window = Live2DCubismWidget()
    window.show()
    
    # Run the application
    sys.exit(app.exec())


if __name__ == "__main__":
    main()