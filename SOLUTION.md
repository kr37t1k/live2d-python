# Solution for "Not allowed to load local resource" Error

## Problem
You were getting the error "Not allowed to load local resource: file://..." when trying to load Live2D Cubism models in your browser. This happens because modern browsers block loading local files directly due to security restrictions (CORS - Cross-Origin Resource Sharing policy).

## Solution Implemented
I've created a local web server to serve your Live2D models, which bypasses the browser's security restrictions.

## Files Created
1. `server.js` - A Node.js server that serves files from the workspace directory
2. Updated `index.html` - Fixed hardcoded Windows file paths to use relative paths
3. Updated `index.script.js` - Fixed hardcoded Windows file paths to use relative paths

## How to Run the Server
1. Make sure you have Node.js installed
2. Run the server:
   ```bash
   cd /workspace
   node server.js
   ```
3. The server will start on http://localhost:3000
4. Open your browser and navigate to http://localhost:3000

## Model Access
Your models are accessible at:
- http://localhost:3000/models/huohuo/huohuo.model3.json
- http://localhost:3000/models/[other-model-name]/[model-file].json

## Key Changes Made
- Changed hardcoded Windows paths like `C:\Users\user\Documents\...` to relative paths like `/models/huohuo/huohuo.model3.json`
- Created a local server that properly handles HTTP requests for your model files
- Models are now served with proper HTTP headers that browsers accept

## Alternative Solutions
If you prefer not to use the Node.js server, you can also:
1. Use Python's built-in server: `python -m http.server 8000` (Python 3) or `python -m SimpleHTTPServer 8000` (Python 2)
2. Use Live Server extension in VS Code
3. Use any other local web server (Apache, Nginx, etc.)

The main point is that your Live2D models must be served through an HTTP server rather than accessed directly as local files in the browser.