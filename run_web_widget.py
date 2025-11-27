#!/usr/bin/env python3
"""
Launcher for the Qt6 WebWidget Live2D Cubism 4 Model Renderer
"""

import sys
import os

def main():
    """Main launcher function"""
    # Add the workspace to the Python path
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, workspace_dir)
    
    try:
        # Import and run the Qt6 WebWidget application
        from live2d_web_widget import main as app_main
        print("Starting Qt6 WebWidget Live2D Cubism 4 Model Renderer...")
        print("Controls:")
        print("  - Mouse drag: Interact with the model")
        print("  - Mouse wheel: Zoom in/out")
        print("  - Click on 'Toggle Drag' button: Toggle drag mode")
        print("  - Click on 'Reset View' button: Reset view")
        print("  - Motion buttons: Play different motions")
        print()
        app_main()
    except ImportError as e:
        print(f"Error importing Qt6 WebWidget application: {e}")
        print("Make sure all dependencies are installed:")
        print("  pip install PyQt6 PyQt6-WebEngine")
        sys.exit(1)
    except Exception as e:
        print(f"Error running application: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()