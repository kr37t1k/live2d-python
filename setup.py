#!/usr/bin/env python3
"""
Setup script for Live2D Widget - PyQtWebEngine Module for Live2D Rendering
"""

from setuptools import setup, find_packages

setup(
    name="live2d-widget",
    version="1.0.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="A PyQtWebEngine widget for rendering Live2D models",
    long_description=open("README.md").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/live2d-widget",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "PyQt6>=6.4.0",
        "PyQt6-WebEngine>=6.4.0",
    ],
    include_package_data=True,
    keywords=["live2d", "pyqt", "qt", "widget", "3d", "animation", "model"],
)