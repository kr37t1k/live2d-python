#!/usr/bin/env python3
"""
Qt6 WebWidget for Live2D Cubism 4 Models
This application renders Live2D models using QtWebEngine and the Cubism Web SDK
"""

import sys
import os
import json
from run_web import serverInit
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QPushButton, QHBoxLayout, QFileDialog
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
        html_path = os.path.join(os.getcwd(), "index.html")
        self.web_view.load(QUrl.fromLocalFile(html_path))
        # Beyond this let's use already server! but no... its not allowing loading resources on this local http too. hm, what we need then? if i tried http.server,eel...
        # self.web_view.load(QUrl("http://localhost:5000/"))
        
        # Enable webgl and other necessary features
        settings = self.web_view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)

    def readFile(self, file: str):
        with open(file, "r", encoding="utf-8") as f:
            file_data = f.read()
            f.close()
            return str(file_data)
    def writeFile(self, file: str, data: str):
        with open(file, "w", encoding="utf-8") as f:
            f.write(str(data))
            f.close()

    def create_web_content(self):
        """Create the HTML content for Live2D rendering"""
        
        # Copy the Cubism SDK to the working directory
        self.copy_cubism_sdk()
        
        # Get model files
        model_files = self.get_model_files()
        
        # Write HTML file
        index_html_data = self.readFile("index_src.html")
        self.writeFile("index.html", index_html_data.format(
            LOAD_MODEL=model_files['model_file'],
            GENERATE_MOTION_BUTTONS=self.generate_motion_buttons(model_files['motions']),
        ))
        index_js_data = self.readFile("index-script.js")
        self.writeFile("index.script.js", index_js_data.replace("{LOAD_MODEL}", model_files['model_file']).replace("\\", "/"))

    def copy_cubism_sdk(self):
        """Copy the Cubism SDK to the working directory for web access"""
        # Create dist directory for framework build
        dist_dir = os.path.join(os.getcwd(), "cubism.web.sdk", "dist")
        os.makedirs(dist_dir, exist_ok=True)
        
        # Create a simple framework bundle file
        framework_content = """
// Live2D Cubism Framework for Web
// This is a simplified version for Qt WebWidget integration
Live2DCubismFramework
console.log("Live2D Cubism Framework loaded");
"""
        
        # with open(os.path.join(dist_dir, "live2d-cubism-framework.js"), "w") as f:
        #     f.write(framework_content)
    
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
        return QFileDialog(self, "Select Model Directory", os.getcwd()).getExistingDirectory()
    
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