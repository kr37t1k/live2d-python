#!/usr/bin/env python3
"""
Setup script for Live2D Model Renderer
Installs all required dependencies
"""

import subprocess
import sys
import os

def install_dependencies():
    """Install required Python packages"""
    print("Installing dependencies...")
    
    # Read requirements from file
    req_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    
    try:
        with open(req_file, 'r') as f:
            requirements = f.read().splitlines()
        
        # Filter out empty lines and comments
        requirements = [req.strip() for req in requirements if req.strip() and not req.startswith('#')]
        
        for req in requirements:
            print(f"Installing {req}...")
            result = subprocess.run([sys.executable, '-m', 'pip', 'install', req], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Error installing {req}: {result.stderr}")
                return False
            else:
                print(f"Successfully installed {req}")
        
        print("All dependencies installed successfully!")
        return True
        
    except FileNotFoundError:
        print(f"Requirements file not found: {req_file}")
        return False
    except Exception as e:
        print(f"Error during installation: {e}")
        return False

def main():
    print("Live2D Model Renderer - Setup")
    print("=" * 40)
    
    if install_dependencies():
        print("\nSetup completed successfully!")
        print("\nTo run the application, use:")
        print("  python run_live2d.py")
        print("\nor")
        print("  python live2d_renderer.py")
    else:
        print("\nSetup failed. Please install dependencies manually:")
        print("  pip install -r requirements.txt")
        sys.exit(1)

if __name__ == "__main__":
    main()