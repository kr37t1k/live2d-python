#!/usr/bin/env python3
"""
Setup script for Live2D Python Rendering
"""

import os
from setuptools import setup, find_packages

setup(
    name="live2d-python",
    version="0.5.5",
    author="kr37t1k",
    author_email="egorakentiev28@gmail.com",
    description="A little live2d-web python implementation",
    long_description=open("README.md").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    url="https://github.com/kr37t1k/live2d-python",
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
        "flask",
        "numpy",
    ],
    include_package_data=True,
    keywords=["live2d", "python", "animation", "model"],
)