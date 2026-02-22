/**
 * Live2D Transparent Renderer
 * Production-ready Live2D renderer with transparent background
 * @version 1.0.0
 */

class Live2DTransparentRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.gl = null;
        this.live2dModel = null;
        this.renderer = null;
        this.textures = [];
        this.isLoaded = false;
        this.animationFrameId = null;
        this.lastTime = 0;

        this.options = {
            modelPath: options.modelPath || 'models/Hiyori/Hiyori.model3.json',
            scale: options.scale || 1.0,
            premultipliedAlpha: options.premultipliedAlpha !== false,
            ...options
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Live2D] Initializing renderer...');

            // Debug: Check what's available
            console.log('[Live2D] Debug - Live2DCubismCore:', typeof Live2DCubismCore);
            console.log('[Live2D] Debug - cubismframework:', typeof cubismframework);
            console.log('[Live2D] Debug - cubismrenderer:', typeof cubismrenderer);
            console.log('[Live2D] Debug - CubismRenderer_WebGL:', typeof CubismRenderer_WebGL);

            // Initialize WebGL with alpha support for transparency
            this.gl = this.canvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: this.options.premultipliedAlpha,
                antialias: true
            }) || this.canvas.getContext('experimental-webgl', {
                alpha: true,
                premultipliedAlpha: this.options.premultipliedAlpha,
                antialias: true
            });

            if (!this.gl) {
                throw new Error('WebGL not supported');
            }

            // Set canvas size to window size
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());

            // Initialize Cubism Framework
            if (typeof cubismframework !== 'undefined' && !cubismframework.CubismFramework.isStarted()) {
                cubismframework.CubismFramework.startUp();
                cubismframework.CubismFramework.initialize();
            }

            console.log('[Live2D] ✓ Renderer initialized');

        } catch (error) {
            console.error('[Live2D] Initialization failed:', error);
            showError(error.message);
            throw error;
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update viewport if WebGL context is ready
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    async loadModel(modelPath) {
        try {
            console.log('[Live2D] Loading model:', modelPath);
            hideLoading();

            // Fetch model JSON
            const response = await fetch(modelPath);
            if (!response.ok) {
                throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
            }

            const modelData = await response.json();
            console.log('[Live2D] Model data loaded');

            // Get model directory
            const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));

            // Load moc3 file
            const mocPath = `${modelDir}/${modelData.FileReferences.Moc}`;
            const mocResponse = await fetch(mocPath);
            if (!mocResponse.ok) {
                throw new Error(`Failed to load moc3: ${mocResponse.status}`);
            }
            const mocArrayBuffer = await mocResponse.arrayBuffer();

            // Create model from moc3
            const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocArrayBuffer);
            if (!moc) {
                throw new Error('Failed to create Moc from array buffer');
            }

            this.live2dModel = Live2DCubismCore.Model.fromMoc(moc);
            if (!this.live2dModel) {
                throw new Error('Failed to create model from Moc');
            }

            console.log('[Live2D] ✓ Model created');

            // Debug: Check what's available
            console.log('[Live2D] Debug - cubismrenderer:', typeof cubismrenderer);
            console.log('[Live2D] Debug - cubismrenderer.CubismRenderer:', typeof (cubismrenderer && cubismrenderer.CubismRenderer));
            console.log('[Live2D] Debug - CubismRenderer_WebGL:', typeof CubismRenderer_WebGL);
            console.log('[Live2D] Debug - window.CubismRenderer:', typeof window.CubismRenderer);

            // Create renderer using the official SDK pattern
            if (typeof cubismrenderer !== 'undefined' && cubismrenderer.CubismRenderer) {
                this.renderer = new cubismrenderer.CubismRenderer();
                this.renderer.startUp(this.gl);
                this.renderer.initialize(this.live2dModel);
                console.log('[Live2D] ✓ CubismRenderer initialized');
            } else if (typeof CubismRenderer_WebGL !== 'undefined') {
                // Fallback to direct WebGL renderer
                this.renderer = new CubismRenderer_WebGL();
                this.renderer.startUp(this.gl);
                this.renderer.initialize(this.live2dModel);
                console.log('[Live2D] ✓ CubismRenderer_WebGL initialized (fallback)');
            } else if (typeof window.CubismRenderer !== 'undefined') {
                // Another fallback using global
                this.renderer = new window.CubismRenderer();
                this.renderer.startUp(this.gl);
                this.renderer.initialize(this.live2dModel);
                console.log('[Live2D] ✓ window.CubismRenderer initialized (fallback 2)');
            } else {
                throw new Error('CubismRenderer not available. Make sure cubismrenderer.js is loaded.');
            }

            // Load textures
            const texturePaths = modelData.FileReferences.Textures.map(tex => `${modelDir}/${tex}`);
            await this.loadTextures(texturePaths);

            // Setup matrices
            this.setupMatrices();

            this.isLoaded = true;
            console.log('[Live2D] ✓ Model loaded successfully');

            // Start animation loop
            this.startAnimation();

            return true;
        } catch (error) {
            console.error('[Live2D] Failed to load model:', error);
            showError(error.message);
            return false;
        }
    }

    async loadTextures(texturePaths) {
        console.log('[Live2D] Loading textures:', texturePaths.length);

        for (let i = 0; i < texturePaths.length; i++) {
            try {
                const texture = await this.loadTexture(texturePaths[i]);
                this.textures.push(texture);
                
                // Bind texture to renderer
                if (this.renderer && typeof this.renderer.bindTexture === 'function') {
                    this.renderer.bindTexture(i, texture);
                }
                
                console.log(`[Live2D] ✓ Texture ${i + 1}/${texturePaths.length} loaded`);
            } catch (error) {
                console.error(`[Live2D] Failed to load texture ${i}:`, error);
                // Create placeholder texture
                const placeholder = this.createPlaceholderTexture();
                this.textures.push(placeholder);
                if (this.renderer && typeof this.renderer.bindTexture === 'function') {
                    this.renderer.bindTexture(i, placeholder);
                }
            }
        }

        console.log('[Live2D] ✓ All textures loaded');
    }

    loadTexture(path) {
        return new Promise((resolve, reject) => {
            const texture = this.gl.createTexture();
            const image = new Image();
            
            image.onload = () => {
                try {
                    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
                    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.options.premultipliedAlpha);
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
                    
                    // Set texture parameters
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                    this.gl.generateMipmap(this.gl.TEXTURE_2D);
                    
                    resolve(texture);
                } catch (error) {
                    reject(error);
                }
            };
            
            image.onerror = () => {
                reject(new Error(`Failed to load image: ${path}`));
            };
            
            image.crossOrigin = 'anonymous';
            image.src = path;
        });
    }

    createPlaceholderTexture() {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        // Create 1x1 white pixel
        const pixel = new Uint8Array([255, 255, 255, 255]);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel);
        
        return texture;
    }

    setupMatrices() {
        if (!this.live2dModel) return;

        // Get model canvas dimensions
        const modelWidth = this.live2dModel.canvasinfo.CanvasWidth;
        const modelHeight = this.live2dModel.canvasinfo.CanvasHeight;

        // Calculate scale to fit model in canvas
        const scaleX = (this.canvas.width / modelWidth) * 0.9;
        const scaleY = (this.canvas.height / modelHeight) * 0.9;
        const scale = Math.min(scaleX, scaleY) * this.options.scale;

        // Create model matrix
        this.modelMatrix = new CubismMatrix44();
        this.modelMatrix.scale(scale, scale);
        this.modelMatrix.translate(this.canvas.width / 2, this.canvas.height / 2);

        // Create projection matrix
        this.projectionMatrix = new CubismMatrix44();
        this.projectionMatrix.setMatrix([
            2.0 / this.canvas.width, 0, 0, 0,
            0, -2.0 / this.canvas.height, 0, 0,
            0, 0, 1, 0,
            -1, 1, 0, 1
        ]);

        console.log('[Live2D] ✓ Matrices setup');
    }

    update(deltaTime) {
        if (!this.live2dModel) return;

        // Update model
        this.live2dModel.update();
    }

    render() {
        if (!this.live2dModel || !this.renderer || !this.gl) return;

        // Clear canvas with transparent color
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Enable blending for transparency
        this.gl.enable(this.gl.BLEND);
        
        if (this.options.premultipliedAlpha) {
            this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        } else {
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        }

        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Update renderer matrices
        const viewMatrix = new CubismMatrix44();
        viewMatrix.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        // Calculate MVP matrix
        const mvpMatrix = new CubismMatrix44();
        mvpMatrix.multiplyByMatrix(this.projectionMatrix);
        mvpMatrix.multiplyByMatrix(viewMatrix);
        mvpMatrix.multiplyByMatrix(this.modelMatrix);

        // Set renderer matrices if available
        if (typeof this.renderer.setMvpMatrix === 'function') {
            this.renderer.setMvpMatrix(mvpMatrix);
        }

        // Set render state
        const fbo = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        if (typeof this.renderer.setRenderState === 'function') {
            this.renderer.setRenderState(fbo, viewport);
        }

        // Draw model
        this.renderer.drawModel();
    }

    animationLoop() {
        const now = Date.now() / 1000;
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        this.update(deltaTime);
        this.render();

        this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
    }

    startAnimation() {
        if (this.animationFrameId) return;
        
        this.lastTime = Date.now() / 1000;
        this.animationLoop();
        console.log('[Live2D] ✓ Animation started');
    }

    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log('[Live2D] ✓ Animation stopped');
        }
    }

    setParameter(id, value) {
        if (!this.live2dModel) return;
        
        const paramIndex = this.live2dModel.getParameterIndex(id);
        if (paramIndex >= 0) {
            this.live2dModel.setParameterValueByIndex(paramIndex, value);
        }
    }

    getParameter(id) {
        if (!this.live2dModel) return 0;
        
        const paramIndex = this.live2dModel.getParameterIndex(id);
        if (paramIndex >= 0) {
            return this.live2dModel.getParameterValueByIndex(paramIndex);
        }
        return 0;
    }

    setExpression(name) {
        // Expressions would be implemented here if model has them
        console.log('[Live2D] Set expression:', name);
    }

    playMotion(group, index, priority) {
        // Motions would be implemented here if model has them
        console.log('[Live2D] Play motion:', group, index);
    }

    destroy() {
        console.log('[Live2D] Destroying renderer...');
        
        this.stopAnimation();

        // Release textures
        for (const texture of this.textures) {
            if (texture) {
                this.gl.deleteTexture(texture);
            }
        }
        this.textures = [];

        // Release renderer
        if (this.renderer) {
            if (typeof this.renderer.release === 'function') {
                this.renderer.release();
            }
            this.renderer = null;
        }

        // Release model
        this.live2dModel = null;

        console.log('[Live2D] ✓ Renderer destroyed');
    }
}

// UI Helper Functions
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showError(message) {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loading) {
        loading.style.display = 'none';
    }
    
    if (error && errorMessage) {
        errorMessage.textContent = message;
        error.style.display = 'block';
    }
}

// Initialize when page loads
window.addEventListener('load', async () => {
    console.log('[Live2D] Page loaded, initializing...');
    
    const canvas = document.getElementById('live2dCanvas');
    if (!canvas) {
        showError('Canvas element not found');
        return;
    }

    // Create renderer instance
    const renderer = new Live2DTransparentRenderer(canvas, {
        modelPath: 'models/Hiyori/Hiyori.model3.json',
        scale: 1.0,
        premultipliedAlpha: true
    });

    // Store globally for debugging
    window.live2dRenderer = renderer;

    // Load model
    const success = await renderer.loadModel('models/Hiyori/Hiyori.model3.json');
    
    if (!success) {
        showError('Failed to load Live2D model');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.live2dRenderer) {
        window.live2dRenderer.destroy();
    }
});
