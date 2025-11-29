#!/usr/bin/env python3
"""
Test script to verify the Live2D Widget module functionality.
"""

import sys
import os
from PyQt6.QtWidgets import QApplication

def test_module_import():
    """Test that the module can be imported correctly."""
    try:
        from live2d_widget import Live2DWidget
        print("✓ Module imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Module import failed: {e}")
        return False

def test_widget_creation():
    """Test that the widget can be created."""
    try:
        # Initialize QApplication (needed for Qt widgets)
        app = QApplication(sys.argv)
        
        from live2d_widget import Live2DWidget
        
        # Create widget without parent (will not be displayed)
        widget = Live2DWidget()
        print("✓ Widget created successfully")
        
        # Test basic methods
        print(f"✓ Widget size hint: {widget.sizeHint()}")
        
        # Test setting model path (this will fail gracefully since no model exists at empty path)
        widget.set_model_path("/nonexistent/model")
        print("✓ set_model_path method works")
        
        # Test other methods
        widget.play_motion("idle")
        widget.reset_view()
        widget.toggle_dragging()
        widget.update_status("Test status")
        print("✓ All basic methods work")
        
        return True
    except Exception as e:
        print(f"✗ Widget creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_package_structure():
    """Test that the package structure is correct."""
    try:
        import live2d_widget
        print(f"✓ Package version: {live2d_widget.__version__}")
        print(f"✓ Package author: {live2d_widget.__author__}")
        print(f"✓ Package exports: {live2d_widget.__all__}")
        return True
    except Exception as e:
        print(f"✗ Package structure test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("Testing Live2D Widget Module")
    print("=" * 40)
    
    tests = [
        ("Module Import", test_module_import),
        ("Package Structure", test_package_structure),
        ("Widget Creation", test_widget_creation),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\nRunning {test_name}...")
        if test_func():
            passed += 1
            print(f"✓ {test_name} PASSED")
        else:
            print(f"✗ {test_name} FAILED")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The module is working correctly.")
        return 0
    else:
        print("❌ Some tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())