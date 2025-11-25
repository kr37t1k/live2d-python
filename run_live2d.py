#!/usr/bin/env python3
"""
Simple launcher for the Live2D Model Renderer
"""

import sys
import os

def main():
    # Add the workspace to the Python path
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, workspace_dir)
    
    try:
        # Import and run the main application
        from live2d_renderer import main as app_main
        print("Starting Live2D Model Renderer...")
        print("Controls:")
        print("  - Mouse drag: Pan the view")
        print("  - Mouse wheel: Zoom in/out")
        print("  - Click on sliders: Adjust model parameters")
        print("  - R key: Reset view")
        print("  - ESC key: Exit")
        print()
        app_main()
    except ImportError as e:
        print(f"Error importing main application: {e}")
        print("Make sure all dependencies are installed:")
        print("  pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"Error running application: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()