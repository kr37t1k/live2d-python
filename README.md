# live2d-python

Python bindings for Live2D Cubism SDK.
***
## Requirements
* Models (Live2D Cubism) "*.moc3"
* Python 3.6+ (Up to Python 3.11)
* Live2D Cubism SDK (https://www.live2d.com/en/download/) but in repository already.
***
## Installation
Clone this repository (```git clone https://github.com/kr37t1k/live2d-python.git```) or within pip
```bash
python -m pip install git+https://github.com/kr37t1k/live2d-python.git
```
***
## Usage
```python
from socket import io
from live2d_python import Live2D
Live2D.init()
...
```