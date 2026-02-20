/**
 * Live2D Desktop Mate - Enhanced Renderer (FIXED VERSION)
 * Production-ready implementation with comprehensive error handling, logging, and fallbacks
 * @version 2.1.0
 */

/**
 * Logger utility for the renderer
 */
class RendererLogger {
    constructor(prefix = '[Live2DRenderer]') {
        this.prefix = prefix;
        this.enabled = true;
    }

    log(level, message, data) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${message}`;
        
        const consoleMethods = {
            debug: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        };
        
        (consoleMethods[level] || console.log)(logMessage, data || '');
    }

    debug(message, data) { this.log('debug', message, data); }
    info(message, data) { this.log('info', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    error(message, data) { this.log('error', message, data); }
}

/**
 * Matrix44 helper class for 3D transformations
 */
class Matrix44 {
    constructor() {
        this.tr = new Float32Array(16);
        this.identity();
    }

    identity() {
        for (let i = 0; i < 16; ++i) {
            this.tr[i] = (i % 5 === 0) ? 1 : 0;
        }
    }

    getArray() {
        return this.tr;
    }

    getScaleX() {
        return this.tr[0];
    }

    getScaleY() {
        return this.tr[5];
    }

    updateScale(x, y) {
        this.tr[0] = x;
        this.tr[5] = y;
    }

    translate(x, y) {
        this.tr[12] = x;
        this.tr[13] = y;
    }

    multiply(rhs) {
        const dst = new Float32Array(16);
        const l = this.tr;
        const r = rhs.tr;

        for (let i = 0; i < 16; ++i) {
            dst[i] = l[i % 4] * r[Math.floor(i / 4) * 4] +
                     l[(i % 4) + 4] * r[(Math.floor(i / 4) * 4) + 1] +
                     l[(i % 4) + 8] * r[(Math.floor(i / 4) * 4) + 2] +
                     l[(i % 4) + 12] * r[(Math.floor(i / 4) * 4) + 3];
        }

        this.tr = dst;
    }
}

/**
 * Main Live2D Renderer class using official SDK
 */
class Live2DRenderer {
    constructor(canvas, options = {}) {
        this.logger = new RendererLogger('[Live2DRenderer]');
        this.logger.info('Initializing renderer with official SDK...', { options });

        this.canvas = canvas;
        this.options = {
            premultipliedAlpha: true,
            useHighPrecisionMask: false,
            enableMotions: true,
            enableExpressions: true,
            enablePhysics: true,
            enableLipSync: true,
            autoBreathing: true,
            frameRateLimit: 60,
            ...options
        };

        // Core properties
        this.gl = null;
        this.live2dModel = null; // This will be the Core Model instance
        this.modelMatrix = null;
        this.viewMatrix = null;
        this.projMatrix = null;
        this.deviceToScreen = null;

        // Managers (Handled by SDK or custom logic if needed)
        this.motionManager = null;
        this.expressionManager = null;
        this.physics = null;
        this.eyeBlink = null;
        this.dragManager = null;

        // Animation and timing
        this.lastTimeSeconds = Date.now() / 1000;
        this.frameTime = 0;
        this.targetFrameTime = 1 / this.options.frameRateLimit;
        this.animationFrameId = null;

        // States
        this.parameters = {};
        this.expressions = {};
        this.motions = {};
        this.hitAreas = [];
        this.eventListeners = new Map();

        // Official SDK Renderer
        this.cubismRenderer = null; // Will be an instance of CubismRenderer_WebGL

        // Initialize
        try {
            this.init();
            this.logger.info('✓ Renderer initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize renderer', error);
            throw error;
        }
    }

    /**
     * Initialize WebGL context and core components using the framework
     */
    init() {
        this.logger.info('Setting up WebGL context...');
        // Setup WebGL context with fallbacks
        const contextOptions = {
            alpha: true,
            premultipliedAlpha: this.options.premultipliedAlpha,
            antialias: true,
            stencil: true
        };
        this.gl = this.canvas.getContext('webgl', contextOptions) ||
                  this.canvas.getContext('experimental-webgl', contextOptions);
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        this.logger.info('✓ WebGL context created');

        // Initialize Cubism framework using the global cubismframework
        this.initializeCubism();
    }

    /**
     * Initialize Cubism framework with fallbacks
     */
    initializeCubism() {
        this.logger.info('Initializing Cubism framework...');
        if (typeof Live2DCubismCore === 'undefined') {
            throw new Error('Live2D Core library not loaded');
        }
        if (typeof cubismframework === 'undefined') {
             throw new Error('Live2D Cubism Framework library not loaded');
        }

        // Start up the framework (this is typically done once per application)
        // Check if already started by your application elsewhere
        if (!cubismframework.CubismFramework.isStarted()) {
             cubismframework.CubismFramework.startUp();
             this.logger.info('Cubism Framework started up.');
        }

        // Initialize the framework (this is typically done once per application)
        // Check if already initialized by your application elsewhere
        if (!cubismframework.CubismFramework.isInitialized()) {
             cubismframework.CubismFramework.initialize();
             this.logger.info('Cubism Framework initialized.');
        }

        this.logger.info('✓ Live2D Cubism Core & Framework available', {
            coreVersion: Live2DCubismCore.Version.csmGetVersion ? Live2DCubismCore.Version.csmGetVersion() : 'unknown',
            frameworkInitialized: cubismframework.CubismFramework.isInitialized()
        });
    }


    /**
     * Setup helper methods on the renderer for the shader manager
     */
    _setupRendererHelpers() {
        const renderer = this.cubismRenderer;
        const gl = this.gl;

        // Helper method to get vertex buffers
        renderer.getDrawableVertexBuffers = (model, index) => {
            if (!renderer._drawableVertexBuffer) {
                renderer._drawableVertexBuffer = gl.createBuffer();
            }
            
            const vertexCount = model.getDrawableVertexCount(index);
            const vertices = model.getDrawableVertices(index);
            const uvs = model.getDrawableVertexUvs(index);
            
            // Build vertex array with position (3), uv (2), color (4) = 9 floats per vertex
            const vertexArray = new Float32Array(vertexCount * 9);
            
            for (let i = 0; i < vertexCount; i++) {
                const offset = i * 9;
                vertexArray[offset] = vertices[i * 2];       // x
                vertexArray[offset + 1] = vertices[i * 2 + 1]; // y
                vertexArray[offset + 2] = 0;                 // z
                vertexArray[offset + 3] = uvs[i * 2];        // u
                vertexArray[offset + 4] = uvs[i * 2 + 1];    // v
                vertexArray[offset + 5] = 1;                 // r
                vertexArray[offset + 6] = 1;                 // g
                vertexArray[offset + 7] = 1;                 // b
                vertexArray[offset + 8] = 1;                 // a
            }
            
            gl.bindBuffer(gl.ARRAY_BUFFER, renderer._drawableVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.DYNAMIC_DRAW);
            
            return renderer._drawableVertexBuffer;
        };

        // Helper method to get index buffers
        renderer.getDrawableIndexBuffers = (model, index) => {
            if (!renderer._drawableIndexBuffer) {
                renderer._drawableIndexBuffer = gl.createBuffer();
            }
            
            const indexCount = model.getDrawableVertexIndexCount(index);
            const indices = model.getDrawableVertexIndices(index);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderer._drawableIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
            
            return renderer._drawableIndexBuffer;
        };

        // Helper method to get MVP matrix
        renderer.getMvpMatrix = () => {
            return renderer._mvpMatrix;
        };

        // Helper method to get base color
        renderer.getDrawableBaseColor = (index) => {
            const model = renderer.getModel();
            const opacity = model.getDrawableOpacity(index);
            return { r: opacity, g: opacity, b: opacity, a: opacity };
        };
    }

    /**
     * Load Live2D model using the official SDK workflow
     */
    async loadModel(modelPath) {
        this.logger.info('Loading model using official SDK...', { path: modelPath });
        try {
            // 1. Fetch the .model3.json file
            const response = await fetch(modelPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const modelData = await response.json();
            this.logger.debug('Model JSON loaded', modelData);

            // 2. Determine paths for dependent files (.moc3, textures, etc.)
            const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
            const mocPath = `${modelDir}/${modelData.FileReferences.Moc}`;
            const texturePaths = modelData.FileReferences.Textures.map(tex => `${modelDir}/${tex}`);

            // 3. Load the .moc3 file (model data)
            const mocResponse = await fetch(mocPath);
            if (!mocResponse.ok) {
                throw new Error(`Failed to load moc3: HTTP ${mocResponse.status}`);
            }
            const mocArrayBuffer = await mocResponse.arrayBuffer();
            this.logger.debug('Moc3 data loaded', { size: mocArrayBuffer.byteLength });

            // 4. Create Core Model instance from Moc
            const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocArrayBuffer);
            if (!moc) {
                throw new Error('Failed to create Moc from array buffer');
            }
            this.logger.info('✓ Moc created');

            const model = Live2DCubismCore.Model.fromMoc(moc);
            if (!model) {
                throw new Error('Failed to create model from Moc');
            }
            this.live2dModel = model; // Store the core model
            this.logger.info('✓ Core Model created');

            // 5. Create the official SDK renderer instance (CubismRenderer_WebGL)
            // This is the crucial step that handles the actual WebGL rendering
            if (typeof CubismRenderer_WebGL === 'undefined') {
                 throw new Error('CubismRenderer_WebGL is not available. Check if cubismrenderer.js and cubismrenderer_webgl.js are loaded.');
            }
            this.cubismRenderer = new CubismRenderer_WebGL(); // Create the WebGL renderer

            // CRITICAL FIX #1: Start up the renderer with WebGL context FIRST
            this.cubismRenderer.startUp(this.gl);
            this.logger.info('✓ CubismRenderer_WebGL started with WebGL context');

            // Add helper methods needed by the shader manager
            this._setupRendererHelpers();

            // Initialize the renderer with the core model
            this.cubismRenderer.initialize(model);
            this.logger.info('✓ Official CubismRenderer_WebGL initialized');

            // 6. Load textures and bind them to the renderer
            await this.loadTextures(texturePaths);

            // 7. Setup initial matrices and render state
            this.setupMatrices();
            this.setupRenderState();

            this.logger.info('✓ Model loaded successfully using official SDK');
            this.emit('loaded', { model: this.live2dModel });

            return true;
        } catch (error) {
            this.logger.error('Failed to load model using official SDK', error);
            this.emit('error', { error: error.message });
            return false;
        }
    }

    /**
     * Load textures and register them with the official renderer
     */
    async loadTextures(texturePaths) {
        this.logger.info('Loading textures for official renderer...', { count: texturePaths.length });

        // Create a temporary map to hold loaded textures
        const tempTextureMap = new Map();
        let textureIdCounter = 0;

        for (let i = 0; i < texturePaths.length; i++) {
            try {
                const texture = await this.loadTexture(this.gl, texturePaths[i]);
                tempTextureMap.set(textureIdCounter, texture);
                this.logger.debug(`✓ Texture ${i + 1}/${texturePaths.length} loaded (ID: ${textureIdCounter})`);
                textureIdCounter++;
            } catch (error) {
                this.logger.error(`Failed to load texture ${texturePaths[i]}`, error);
                // Create a placeholder texture and register it
                const placeholder = this.createPlaceholderTexture();
                tempTextureMap.set(textureIdCounter, placeholder);
                textureIdCounter++;
            }
        }

        // CRITICAL FIX #2: Bind textures to the renderer using bindTexture method
        // The renderer expects textures to be bound with model texture indices
        const loadedTextures = Array.from(tempTextureMap.values());
        for (let i = 0; i < loadedTextures.length; i++) {
            this.cubismRenderer.bindTexture(i, loadedTextures[i]);
            this.logger.debug(`✓ Texture ${i} bound to renderer`);
        }

        // Store textures for cleanup
        this.textures = loadedTextures;
        this.textureMap = tempTextureMap;
        this.logger.info('✓ Textures loaded and bound to renderer', { count: this.textures.length });
    }

    /**
     * Load a single texture
     */
    loadTexture(gl, path) {
        return new Promise((resolve, reject) => {
            const texture = gl.createTexture();
            const image = new Image();
            image.onload = () => {
                try {
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                    // Generate mipmaps
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.generateMipmap(gl.TEXTURE_2D);

                    resolve(texture);
                } catch (error) {
                    reject(error);
                }
            };

            image.onerror = () => {
                reject(new Error(`Failed to load texture: ${path}`));
            };

            image.crossOrigin = "Anonymous";
            image.src = path;
        });
    }

    /**
     * Create placeholder texture for fallback
     */
    createPlaceholderTexture() {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Create 1x1 pixel white texture
        const pixel = new Uint8Array([255, 255, 255, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        this.logger.warn('Created placeholder texture');
        return texture;
    }


    /**
     * Setup transformation matrices using SDK helpers if available, or manually
     */
    setupMatrices() {
        this.logger.debug('Setting up transformation matrices...');
        // Use the SDK's matrix class if available, otherwise use your custom one
        this.modelMatrix = new CubismMatrix44(); // Use SDK matrix
        this.viewMatrix = new CubismMatrix44(); // Use SDK matrix
        this.projMatrix = new CubismMatrix44(); // Use SDK matrix

        // Set up initial model position and scale to fit canvas and correct orientation
        const modelWidth = this.live2dModel.canvasinfo.CanvasWidth; // Get model's native canvas width from core
        const modelHeight = this.live2dModel.canvasinfo.CanvasHeight; // Get model's native canvas height from core

        const scale = Math.min(this.canvas.width / modelWidth, this.canvas.height / modelHeight) * 0.8; // Fit with margin
        this.modelMatrix.scaleRelative(scale, scale);
        // The model's origin (0,0) is typically the center of its canvas.
        // Translate to center it on the HTML canvas.
        this.modelMatrix.translateRelative(this.canvas.width / 2.0, this.canvas.height / 2.0);
        
        // Standard orthographic projection for 2D rendering covering the canvas pixel area.
        this.projMatrix.setMatrix([
            2.0 / this.canvas.width, 0, 0, 0,
            0, -2.0 / this.canvas.height, 0, 0,
            0, 0, 1, 0,
            -1, 1, 0, 1
        ]);

        this.logger.debug('✓ Matrices initialized', { scale, modelWidth, modelHeight });
    }

    /**
     * Setup render state for the SDK renderer
     */
    setupRenderState() {
        this.logger.debug('Setting up render state...');
        // Get the current framebuffer and viewport
        const fbo = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        
        // Pass these to the renderer
        this.cubismRenderer.setRenderState(fbo, viewport);
        this.logger.debug('✓ Render state set', { fbo, viewport });
    }


    /**
     * Update model with delta time
     */
    update(deltaTimeSeconds) {
        if (!this.live2dModel) return;
        try {
            // CRITICAL: Call the core model's update function.
            // This is what advances the model's internal state (animations, expressions, physics if applied).
            this.live2dModel.update();

            this.logger.debug('Model updated', { deltaTime: deltaTimeSeconds });

        } catch (error) {
            this.logger.error('Error during model update', error);
        }
    }

    /**
     * Helper methods for shader manager
     */
    getDrawableVertexBuffers(model, index) {
        if (!this.cubismRenderer._drawableVertexBuffer) {
            this.cubismRenderer._drawableVertexBuffer = this.gl.createBuffer();
        }
        
        const vertexCount = model.getDrawableVertexCount(index);
        const vertices = model.getDrawableVertices(index);
        
        // Build vertex array with position (3), uv (2), color (4) = 9 floats per vertex
        const vertexArray = new Float32Array(vertexCount * 9);
        const uvs = model.getDrawableVertexUvs(index);
        
        for (let i = 0; i < vertexCount; i++) {
            const offset = i * 9;
            vertexArray[offset] = vertices[i * 2];       // x
            vertexArray[offset + 1] = vertices[i * 2 + 1]; // y
            vertexArray[offset + 2] = 0;                 // z
            vertexArray[offset + 3] = uvs[i * 2];        // u
            vertexArray[offset + 4] = uvs[i * 2 + 1];    // v
            vertexArray[offset + 5] = 1;                 // r
            vertexArray[offset + 6] = 1;                 // g
            vertexArray[offset + 7] = 1;                 // b
            vertexArray[offset + 8] = 1;                 // a
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cubismRenderer._drawableVertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexArray, this.gl.DYNAMIC_DRAW);
        
        return this.cubismRenderer._drawableVertexBuffer;
    }

    getDrawableIndexBuffers(model, index) {
        if (!this.cubismRenderer._drawableIndexBuffer) {
            this.cubismRenderer._drawableIndexBuffer = this.gl.createBuffer();
        }
        
        const indexCount = model.getDrawableVertexIndexCount(index);
        const indices = model.getDrawableVertexIndices(index);
        
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.cubismRenderer._drawableIndexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.DYNAMIC_DRAW);
        
        return this.cubismRenderer._drawableIndexBuffer;
    }

    getMvpMatrix() {
        // Return the MVP matrix stored in the renderer (set in render method)
        return this.cubismRenderer._mvpMatrix;
    }

    getDrawableBaseColor(index) {
        const model = this.live2dModel;
        const r = model.getDrawableOpacity(index);
        return { r: r, g: r, b: r, a: r };
    }

    /**
     * Render the model using the official SDK renderer
     */
    render() {
        if (!this.live2dModel || !this.cubismRenderer) return;
        try {
            const gl = this.gl;

            // Clear the canvas
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clearColor(0.0, 0.0, 0.0, 0.0); // Set clear color (transparent black)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // Configure OpenGL state as expected by the SDK renderer
            gl.enable(gl.BLEND); // Ensure blending is enabled
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // Standard alpha blending

            // CRITICAL FIX #3: Ensure render state is set before drawing
            const fbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
            const viewport = gl.getParameter(gl.VIEWPORT);
            this.cubismRenderer.setRenderState(fbo, viewport);

            // Set up the model-view-projection matrix
            // The renderer needs to know the projection and model matrices
            const mvp = new CubismMatrix44();
            mvp.multiplyByMatrix(this.projMatrix);
            mvp.multiplyByMatrix(this.modelMatrix);
            
            // Store the MVP matrix for the shader manager to use
            this.cubismRenderer._mvpMatrix = mvp;

            // Perform the draw operation using the SDK
            this.cubismRenderer.drawModel(); // This is the key call that renders the model

            this.logger.debug('Model rendered using official SDK renderer.');

        } catch (error) {
            this.logger.error('Error during rendering using official SDK', error);
        }
    }


    /**
     * Set parameter value
     */
    setParameter(parameterId, value) {
        if (!this.live2dModel) {
             this.logger.warn('Cannot set parameter: model not loaded', { parameterId });
             return;
        }
        try {
            // Use the core model's API to set parameter values
            const paramIndex = this.live2dModel.getParameterIndex(parameterId);
            if (paramIndex >= 0) {
                 this.live2dModel.setParameterValueByIndex(paramIndex, value);
                 this.parameters[parameterId] = value;
                 this.emit('parameterChanged', { id: parameterId, value });
            } else {
                 this.logger.debug('Parameter not found', { parameterId });
            }
        } catch (error) {
            this.logger.error('Failed to set parameter', { parameterId, value, error });
        }
    }

    getParameter(parameterId) {
         if (!this.live2dModel) return 0;
         try {
             const paramIndex = this.live2dModel.getParameterIndex(parameterId);
             if (paramIndex >= 0) {
                 return this.live2dModel.getParameterValueByIndex(paramIndex);
             }
             return this.parameters[parameterId] || 0;
         } catch (error) {
             this.logger.error('Failed to get parameter', { parameterId, error });
             return 0;
         }
    }


    /**
     * Main render loop
     */
    renderLoop() {
        const now = Date.now() / 1000;
        const deltaTime = now - this.lastTimeSeconds;
        this.lastTimeSeconds = now;

        // Frame rate limiting (simplified)
        this.frameTime += deltaTime;
        if (this.frameTime < this.targetFrameTime) {
            this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
            return;
        }
        this.frameTime -= this.targetFrameTime; // Maintain consistent frame timing

        // Update model state
        this.update(deltaTime);

        // Render the model
        this.render();

        // Continue loop
        this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }

    /**
     * Start the render loop
     */
    startRenderLoop() {
        if (this.animationFrameId) {
            this.logger.warn('Render loop already running');
            return;
        }
        this.logger.info('Starting render loop');
        this.renderLoop();
    }

    /**
     * Stop the render loop
     */
    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            this.logger.info('Render loop stopped');
        }
    }

    /**
     * Event system - add listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Event system - remove listener
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Event system - emit event
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.logger.error('Error in event listener', { event, error });
                }
            });
        }
    }

    /**
     * Destroy the renderer and cleanup resources
     */
    destroy() {
        this.logger.info('Destroying renderer...');
        // Stop animation loop
        this.stopRenderLoop();

        // Release the official SDK renderer
        if (this.cubismRenderer) {
             this.cubismRenderer.release();
             this.cubismRenderer = null;
             this.logger.info('✓ Official CubismRenderer released');
        }

        // Release the core model (if necessary, though SDK usually manages this)
        if (this.live2dModel) {
             // Core model doesn't typically have a release function in JS, it's garbage collected.
             // The renderer holds a reference to it.
             this.live2dModel = null;
        }

        // Cleanup textures (if managed here)
        for (const texture of this.textures) {
            if (texture) {
                this.gl.deleteTexture(texture);
            }
        }
        this.textures = [];
        this.textureMap = null;

        // Remove event listeners
        this.eventListeners.clear();

        // Clear canvas
        if (this.gl) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
        this.logger.info('✓ Renderer destroyed');
    }
}

/**
 * Live2D Tarakara Lilit persona t-renderer class simplified
 */
class L2D_T_Lilit {
    constructor(options = {}) {
        this.logger = new RendererLogger('[L2D-T.Lilit]');
        this.logger.info('Initializing T.Lilit ...', { options });

        this.options = {
            container: 'body',
            width: 400,
            height: 600,
            alwaysOnTop: true,
            clickThrough: false,
            enableWindowControls: true,
            modelPath: globalThis.MODEL_PATH,
            ...options
        };

        this.renderer = null;
        this.canvas = null;
        this.windowElement = null;
        this.isInitialized = false;

        this.init();
    }

    async init() {
        try {
            // Use existing canvas or create new one
            this.canvas = document.getElementById('live2dCanvas');
            
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.width = this.options.width;
                this.canvas.height = this.options.height;
                
                if (this.options.container === 'body') {
                    document.body.appendChild(this.canvas);
                } else {
                    const container = document.querySelector(this.options.container);
                    if (container) {
                        container.appendChild(this.canvas);
                    } else {
                        throw new Error('Container not found');
                    }
                }
            }

            // Create renderer
            this.renderer = new Live2DRenderer(this.canvas, {
                premultipliedAlpha: true,
                enableMotions: true,
                enableExpressions: true,
                enablePhysics: true,
                autoBreathing: true
            });

            this.isInitialized = true;
            this.logger.info('✓ Desktop mate initialized');
        } catch (error) {
            this.logger.error('Failed to initialize desktop mate', error);
            throw error;
        }
    }

    async loadModel(modelPath) {
        if (!this.renderer) {
            throw new Error('Renderer not initialized');
        }

        this.logger.info('Loading model...', { path: modelPath });
        return await this.renderer.loadModel(modelPath);
    }

    startAnimation() {
        if (this.renderer) {
            this.renderer.startRenderLoop();
        }
    }

    stopAnimation() {
        if (this.renderer) {
            this.renderer.stopRenderLoop();
        }
    }

    setExpression(name) {
        if (this.renderer) {
            this.renderer.setExpression(name);
        }
    }

    playMotion(group, index, priority = 3) {
        if (this.renderer) {
            return this.renderer.playMotion(group, index, priority);
        }
        return false;
    }

    setParameter(id, value) {
        if (this.renderer) {
            this.renderer.setParameter(id, value);
        }
    }

    on(event, callback) {
        if (this.renderer) {
            this.renderer.on(event, callback);
        }
    }

    destroy() {
        this.logger.info('Destroying desktop mate...');
        
        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        this.logger.info('✓ Desktop mate destroyed');
    }
}

// Export classes
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { Live2DRenderer, L2D_T_Lilit, Matrix44 };
} else if (typeof window !== 'undefined') {
    window.Live2DRenderer = Live2DRenderer;
    window.Live2DDesktopMate = L2D_T_Lilit;
    window.Matrix44 = Matrix44;
}
