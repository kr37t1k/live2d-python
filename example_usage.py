#!/usr/bin/env python3
"""
Example usage of the Live2D Widget module.

This script demonstrates how to use the Live2DWidget in a PyQt application.
"""

import sys
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QPushButton, QHBoxLayout


def main():
    """Example application showing how to use the Live2DWidget."""
    app = QApplication(sys.argv)
    
    # Create main window
    window = QMainWindow()
    window.setWindowTitle("Live2D Widget Example")
    window.setGeometry(100, 100, 1200, 800)
    
    # Create central widget
    central_widget = QWidget()
    window.setCentralWidget(central_widget)
    layout = QVBoxLayout(central_widget)
    
    # Import and create Live2D widget
    from live2d_widget import Live2DWidget
    
    # Create the Live2D widget with the huohuo model
    live2d_widget = Live2DWidget(
        parent=window,
        model_path="/workspace/models/huohuo",  # Use the sample model
        enable_controls=True  # Show control buttons
    )
    layout.addWidget(live2d_widget)
    
    # Create additional control buttons
    controls_layout = QHBoxLayout()
    
    def load_different_model():
        """Example function to load a different model."""
        # This would typically open a dialog, but for demo purposes we'll use a different path
        live2d_widget.set_model_path("/workspace/models/default")
    
    def play_idle_motion():
        """Play the idle motion."""
        live2d_widget.play_motion("idle")
    
    def play_tap_body():
        """Play the tap body motion."""
        live2d_widget.play_motion("tap_body")
    
    def reset_view():
        """Reset the view."""
        live2d_widget.reset_view()
    
    def toggle_drag():
        """Toggle dragging mode."""
        live2d_widget.toggle_dragging()
    
    load_button = QPushButton("Load Different Model")
    load_button.clicked.connect(load_different_model)
    controls_layout.addWidget(load_button)
    
    idle_button = QPushButton("Idle Motion")
    idle_button.clicked.connect(play_idle_motion)
    controls_layout.addWidget(idle_button)
    
    tap_button = QPushButton("Tap Body")
    tap_button.clicked.connect(play_tap_body)
    controls_layout.addWidget(tap_button)
    
    reset_button = QPushButton("Reset View")
    reset_button.clicked.connect(reset_view)
    controls_layout.addWidget(reset_button)
    
    drag_button = QPushButton("Toggle Drag")
    drag_button.clicked.connect(toggle_drag)
    controls_layout.addWidget(drag_button)
    
    layout.addLayout(controls_layout)
    
    # Connect signals to demonstrate event handling
    def on_model_loaded(success):
        print(f"Model loaded successfully: {success}")
        if success:
            live2d_widget.update_status("Model loaded successfully!")
    
    def on_model_error(error):
        print(f"Model load error: {error}")
        live2d_widget.update_status(f"Error: {error}")
    
    live2d_widget.model_loaded.connect(on_model_loaded)
    live2d_widget.model_load_error.connect(on_model_error)
    
    # Show the window
    window.show()
    
    # Run the application
    sys.exit(app.exec())


if __name__ == "__main__":
    main()