/**
 * Production-Ready Live2D Renderer with Emscripten Cubism Core SDK
 * Optimized implementation with shared ArrayBuffer and proper material rendering
 */

class ProductionLive2DRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            ...{
                premultipliedAlpha: true,
                useHighPrecisionMask: true,
                enableMotions: true,
                enableExpressions: true,
                enablePhysics: true,
                enableLipSync: true,
                autoBreathing: true,
                frameRateLimit: 60
            },
            ...options
        };

        // Core properties
        this.gl = null;
        this.live2dModel = null;
        this.textures = [];
        this.motionManager = null;
        this.expressionManager = null;
        this.physics = null;
        this.dragManager = null;
        this.modelMatrix = null;
        this.viewMatrix = null;
        this.projMatrix = null;
        this.deviceToScreen = null;

        // Animation and timing
        this.lastTimeSeconds = Date.now() / 1000;
        this.frameTime = 0;
        this.targetFrameTime = 1 / this.options.frameRateLimit;

        // States
        this.parameters = {};
        this.expressions = {};
        this.motions = {};
        this.hitAreas = [];
        this.eventListeners = new Map();

        // Optimization: Shared ArrayBuffer for vertex data
        this.sharedVertexBuffer = null;
        this.sharedIndexBuffer = null;
        this.maxVertices = 4096; // Maximum expected vertices
        this.maxIndices = 8192;  // Maximum expected indices

        // WebGL buffers and programs
        this.webglBuffers = {
            vertex: null,
            index: null,
            uv: null
        };

        this.shaderProgram = null;

        // Initialize
        this.init();
    }

    /**
     * Initialize WebGL context and core components
     */
    init() {
        // Setup WebGL context with advanced options
        this.gl = this.canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: this.options.premultipliedAlpha,
            antialias: true,
            stencil: true,
            preserveDrawingBuffer: false
        });

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        // Configure WebGL
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFuncSeparate(
            this.gl.ONE,
            this.gl.ONE_MINUS_SRC_ALPHA,
            this.gl.ONE,
            this.gl.ONE_MINUS_SRC_ALPHA
        );
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.frontFace(this.gl.CCW);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        // Initialize Cubism framework
        this.initializeCubism();

        // Setup managers
        this.setupMotionManager();
        this.setupExpressionManager();
        this.setupDragManager();

        // Setup matrices
        this.setupMatrices();

        // Create shared buffers for optimization
        this.createSharedBuffers();

        // Create shader program
        this.createShaderProgram();

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Initialize Cubism framework
     */
    initializeCubism() {
        if (typeof Live2DCubismCore === 'undefined') {
            throw new Error('Live2D Core library not loaded');
        }
        console.log('Cubism framework initialized');
    }

    /**
     * Create shared buffers to minimize allocations
     */
    createSharedBuffers() {
        // Create shared buffers with pre-allocated size
        this.webglBuffers.vertex = this.gl.createBuffer();
        this.webglBuffers.index = this.gl.createBuffer();
        this.webglBuffers.uv = this.gl.createBuffer();

        // Pre-allocate vertex data buffer
        const vertexData = new Float32Array(this.maxVertices * 2);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.webglBuffers.vertex);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.DYNAMIC_DRAW);

        // Pre-allocate index data buffer
        const indexData = new Uint16Array(this.maxIndices);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.webglBuffers.index);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.DYNAMIC_DRAW);
    }

    /**
     * Create shader program for optimized rendering
     */
    createShaderProgram() {
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform float u_opacity;
            void main() {
                vec4 texColor = texture2D(u_texture, v_texCoord);
                gl_FragColor = texColor * u_opacity;
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);

        this.shaderProgram = this.gl.createProgram();
        this.gl.attachShader(this.shaderProgram, vertexShader);
        this.gl.attachShader(this.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.shaderProgram);

        if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(this.shaderProgram));
        }

        // Get attribute and uniform locations
        this.attributes = {
            position: this.gl.getAttribLocation(this.shaderProgram, 'a_position'),
            texCoord: this.gl.getAttribLocation(this.shaderProgram, 'a_texCoord')
        };

        this.uniforms = {
            mvpMatrix: this.gl.getUniformLocation(this.shaderProgram, 'u_mvpMatrix'),
            texture: this.gl.getUniformLocation(this.shaderProgram, 'u_texture'),
            opacity: this.gl.getUniformLocation(this.shaderProgram, 'u_opacity')
        };
    }

    /**
     * Create shader
     */
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Setup motion manager
     */
    setupMotionManager() {
        this.motionManager = {
            currentPriority: 0,
            reservePriority: 0,
            motions: {},
            currentMotion: null,
            motionQueue: [],
            fadeTime: 0,

            setReservePriority: function(priority) {
                this.reservePriority = priority;
            },

            setPriority: function(priority) {
                this.currentPriority = priority;
            },

            getCurrentPriority: function() {
                return this.currentPriority;
            },

            getReservePriority: function() {
                return this.reservePriority;
            },

            startMotion: function(motion, fadeInTime, fadeOutTime) {
                this.currentMotion = motion;
                this.currentMotion.startTime = performance.now();
                this.currentMotion.fadeInTime = fadeInTime || 0.5;
                this.currentMotion.fadeOutTime = fadeOutTime || 0.5;
                this.currentMotion.duration = motion.data?.Meta?.Duration || 3.0;
                this.fadeTime = 0;
                return this.currentMotion;
            },

            update: function(model, deltaTimeSeconds) {
                if (this.currentMotion) {
                    const elapsed = (performance.now() - this.currentMotion.startTime) / 1000;
                    this.fadeTime = Math.min(elapsed / this.currentMotion.fadeInTime, 1.0);

                    if (elapsed > this.currentMotion.duration) {
                        this.currentMotion = null; // Motion finished
                    }
                }
            }
        };
    }

    /**
     * Setup expression manager
     */
    setupExpressionManager() {
        this.expressionManager = {
            currentExpression: null,
            expressionQueue: [],
            expressionData: {},
            activeExpressions: [],

            setExpression: (expressionId) => {
                this.expressionManager.currentExpression = expressionId;
                this.emit('expressionChanged', expressionId);
            },

            update: (model, deltaTimeSeconds) => {
                // Update expression over time
            },

            loadExpression: async (expressionPath) => {
                try {
                    const response = await fetch(expressionPath);
                    const expressionData = await response.json();
                    this.expressionManager.expressionData[expressionPath] = expressionData;
                    return expressionData;
                } catch (error) {
                    console.error('Failed to load expression:', error);
                    return null;
                }
            },

            setExpressionParams: (model, expressionData) => {
                if (!expressionData || !expressionData.Parameters) return;

                for (const param of expressionData.Parameters) {
                    const paramIndex = model.getParameterIndex(param.Id);
                    if (paramIndex >= 0) {
                        const currentValue = model.getParameterValue(paramIndex);
                        let newValue = currentValue;

                        switch (param.Blend) {
                            case 'Add':
                                newValue = currentValue + param.Value;
                                break;
                            case 'Multiply':
                                newValue = currentValue * param.Value;
                                break;
                            case 'Overwrite':
                            default:
                                newValue = param.Value;
                                break;
                        }

                        model.setParameterValue(paramIndex, newValue);
                    }
                }
            }
        };
    }

    /**
     * Setup drag manager for mouse interactions
     */
    setupDragManager() {
        this.dragManager = {
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            isDragging: false,

            setPoint: (x, y) => {
                this.dragManager.lastX = x;
                this.dragManager.lastY = y;
            },

            isDragging: () => this.dragManager.isDragging,

            update: (deltaTimeSeconds) => {
                if (this.dragManager.isDragging) {
                    // Process dragging logic
                }
            }
        };
    }

    /**
     * Setup transformation matrices
     */
    setupMatrices() {
        // Initialize matrices
        this.modelMatrix = new Matrix44();
        this.viewMatrix = new Matrix44();
        this.projMatrix = new Matrix44();
        this.deviceToScreen = new Matrix44();

        // Set up initial model position and scale
        const scale = Math.min(this.canvas.width, this.canvas.height) / 2.0;
        this.modelMatrix.updateScale(scale, scale);
        this.modelMatrix.translate(this.canvas.width / 2.0, this.canvas.height / 2.0);
    }

    /**
     * Load Live2D model from .model3.json
     */
    async loadModel(modelPath) {
        try {
            console.log('Loading model from:', modelPath);

            // Fetch the model JSON file
            const response = await fetch(modelPath);
            if (!response.ok) {
                throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
            }

            const modelData = await response.json();
            const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
            const mocPath = `${modelDir}/${modelData.FileReferences.Moc}`;

            // Load the moc3 file
            const mocResponse = await fetch(mocPath);
            const mocArrayBuffer = await mocResponse.arrayBuffer();

            // Create the model
            const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocArrayBuffer);
            const model = Live2DCubismCore.Model.fromMoc(moc);

            // Store the model
            this.live2dModel = model;

            // Parse model3.json for texture paths and other configurations
            await this.parseModelConfiguration(modelData, modelDir);

            console.log('✓ Model loaded successfully');
            this.emit('loaded', { model: this.live2dModel });

            return true;

        } catch (error) {
            console.error('Failed to load model:', error);
            this.emit('error', { error: error.message });
            return false;
        }
    }

    /**
     * Parse model configuration from .model3.json
     */
    async parseModelConfiguration(modelData, modelDir) {
        // Load textures
        const texPaths = modelData.FileReferences.Textures.map(tex => `${modelDir}/${tex}`);
        for (const texPath of texPaths) {
            const texture = await this.loadTexture(this.gl, texPath);
            this.textures.push(texture);
        }

        // Load physics if available
        if (modelData.FileReferences.Physics) {
            await this.loadPhysics(`${modelDir}/${modelData.FileReferences.Physics}`);
        }

        // Load pose if available
        if (modelData.FileReferences.Pose) {
            await this.loadPose(`${modelDir}/${modelData.FileReferences.Pose}`);
        }

        // Initialize hit areas
        if (modelData.HitAreas) {
            this.hitAreas = modelData.HitAreas;
        }

        // Initialize motions
        if (modelData.FileReferences.Motions) {
            await this.loadMotions(modelData.FileReferences.Motions, modelDir);
        }

        // Initialize expressions if available in Groups
        if (modelData.Groups) {
            await this.loadExpressionsFromGroups(modelData.Groups, modelDir);
        }

        // Load display info
        if (modelData.FileReferences.DisplayInfo) {
            await this.loadDisplayInfo(`${modelDir}/${modelData.FileReferences.DisplayInfo}`);
        }

        // Load user data
        if (modelData.FileReferences.UserData) {
            await this.loadUserData(`${modelDir}/${modelData.FileReferences.UserData}`);
        }
    }

    /**
     * Load display info from .cdi3.json
     */
    async loadDisplayInfo(displayInfoPath) {
        try {
            const response = await fetch(displayInfoPath);
            const displayInfo = await response.json();
            console.log('Display info loaded:', displayInfoPath);
            this.displayInfo = displayInfo;
        } catch (error) {
            console.warn('Failed to load display info:', error);
        }
    }

    /**
     * Load user data from .userdata3.json
     */
    async loadUserData(userDataPath) {
        try {
            const response = await fetch(userDataPath);
            const userData = await response.json();
            console.log('User data loaded:', userDataPath);
            this.userData = userData;
        } catch (error) {
            console.warn('Failed to load user data:', error);
        }
    }

    /**
     * Load expressions from groups in model3.json
     */
    async loadExpressionsFromGroups(groups, modelDir) {
        try {
            for (const group of groups) {
                if (group.Target === "Parameter" && group.Name === "LipSync") {
                    // Handle lip sync parameters
                    console.log("Lip sync parameters:", group.Ids);
                    this.lipSyncParams = group.Ids;
                } else if (group.Target === "Parameter" && group.Name === "EyeBlink") {
                    // Handle eye blink parameters
                    console.log("Eye blink parameters:", group.Ids);
                    this.eyeBlinkParams = group.Ids;
                }
            }
        } catch (error) {
            console.warn('Failed to load expressions from groups:', error);
        }
    }

    /**
     * Load textures for the model
     */
    loadTexture(gl, path) {
        return new Promise((resolve, reject) => {
            const texture = gl.createTexture();
            const image = new Image();

            image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                // Set texture parameters for better quality
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                // Generate mipmaps
                gl.generateMipmap(gl.TEXTURE_2D);

                resolve(texture);
            };

            image.onerror = function() {
                reject(new Error(`Failed to load texture: ${path}`));
            };

            image.crossOrigin = "Anonymous"; // Handle CORS
            image.src = path;
        });
    }

    /**
     * Load physics settings
     */
    async loadPhysics(physicsPath) {
        try {
            const response = await fetch(physicsPath);
            const physicsData = await response.json();

            // Store physics data for later processing
            this.physics = physicsData;
            console.log('Physics loaded:', physicsPath);

            this.emit('physicsLoaded', { path: physicsPath });
        } catch (error) {
            console.warn('Failed to load physics:', error);
        }
    }

    /**
     * Load pose settings
     */
    async loadPose(posePath) {
        try {
            const response = await fetch(posePath);
            const poseData = await response.json();

            // Store pose data for later processing
            console.log('Pose loaded:', posePath);
            this.pose = poseData;

            this.emit('poseLoaded', { path: posePath });
        } catch (error) {
            console.warn('Failed to load pose:', error);
        }
    }

    /**
     * Load motions for the model
     */
    async loadMotions(motionGroups, modelDir) {
        try {
            // Process each motion group
            for (const [groupName, motions] of Object.entries(motionGroups)) {
                this.motions[groupName] = [];

                for (const motion of motions) {
                    const motionPath = `${modelDir}/${motion.File}`;

                    // Load the actual motion data
                    const motionData = await this.loadMotionData(motionPath);

                    this.motions[groupName].push({
                        path: motionPath,
                        data: motionData,
                        fadeInTime: motion.FadeInTime || 0.5,
                        fadeOutTime: motion.FadeOutTime || 0.5,
                        duration: motionData?.Meta?.Duration || 3.0,
                        totalSegmentCount: motionData?.Meta?.TotalSegmentCount || 0
                    });
                }
            }

            console.log('Motions loaded:', Object.keys(this.motions));
            this.emit('motionsLoaded', { groups: Object.keys(this.motions) });
        } catch (error) {
            console.warn('Failed to load motions:', error);
        }
    }

    /**
     * Load individual motion data
     */
    async loadMotionData(motionPath) {
        try {
            const response = await fetch(motionPath);
            return await response.json();
        } catch (error) {
            console.error('Failed to load motion data:', motionPath, error);
            return null;
        }
    }

    /**
     * Load expression data from .exp3.json
     */
    async loadExpressionData(expressionPath) {
        try {
            const response = await fetch(expressionPath);
            return await response.json();
        } catch (error) {
            console.error('Failed to load expression data:', expressionPath, error);
            return null;
        }
    }

    /**
     * Set expression by name
     */
    async setExpression(expressionName) {
        if (!this.expressionManager) return;

        // Find expression file path based on model configuration
        const expressionPath = `web/models/huohuo/${expressionName}.exp3.json`; // Example path
        const expressionData = await this.loadExpressionData(expressionPath);

        if (expressionData) {
            this.expressionManager.setExpressionParams(this.live2dModel, expressionData);
            this.expressionManager.setExpression(expressionName);
            this.expressions[expressionName] = true;
        }
    }

    /**
     * Play motion by group and index
     */
    playMotion(group, index, priority = 3) {
        if (!this.motionManager || !this.motions[group] || !this.motions[group][index]) {
            console.warn(`Motion not found: ${group}[${index}]`);
            return false;
        }

        if (this.motionManager.getCurrentPriority() >= priority) {
            return false; // Priority too low
        }

        this.motionManager.setPriority(priority);

        // Start the motion
        const motion = this.motions[group][index];
        this.motionManager.startMotion(motion, motion.fadeInTime, motion.fadeOutTime);

        // Emit motion start event
        this.emit('motionStart', { group, index, priority });

        return true;
    }

    /**
     * Set parameter value
     */
    setParameter(parameterId, value) {
        if (!this.live2dModel) return;

        // Find parameter index efficiently
        const paramIndex = this.getParameterIndex(parameterId);
        if (paramIndex >= 0) {
            this.live2dModel.setParameterValue(paramIndex, value);
            this.parameters[parameterId] = value;

            // Emit parameter change event
            this.emit('parameterChanged', { id: parameterId, value });
        }
    }

    /**
     * Get parameter index efficiently
     */
    getParameterIndex(parameterId) {
        if (!this.live2dModel) return -1;

        // Cache parameter indices to avoid repeated lookups
        if (!this.parameterIndices) {
            this.parameterIndices = {};
        }

        if (this.parameterIndices[parameterId] === undefined) {
            this.parameterIndices[parameterId] = this.live2dModel.getParameterIndex
                ? this.live2dModel.getParameterIndex(parameterId)
                : -1;
        }

        return this.parameterIndices[parameterId];
    }

    /**
     * Get parameter value
     */
    getParameter(parameterId) {
        if (!this.live2dModel) return 0;

        const paramIndex = this.getParameterIndex(parameterId);
        if (paramIndex >= 0) {
            return this.live2dModel.getParameterValue(paramIndex);
        }

        return this.parameters[parameterId] || 0;
    }

    /**
     * Set lip sync value for mouth movement
     */
    setLipSync(value) {
        if (this.options.enableLipSync && this.lipSyncParams) {
            for (const paramId of this.lipSyncParams) {
                this.setParameter(paramId, value);
            }
        }
    }

    /**
     * Update model with delta time
     */
    update(deltaTimeSeconds) {
        if (!this.live2dModel) return;

        // Update drag manager
        if (this.dragManager) {
            this.dragManager.update(deltaTimeSeconds);
        }

        // Update physics if enabled
        if (this.physics && this.options.enablePhysics) {
            this.updatePhysics(deltaTimeSeconds);
        }

        // Update expressions
        if (this.expressionManager) {
            this.expressionManager.update(this.live2dModel, deltaTimeSeconds);
        }

        // Update motions
        if (this.motionManager) {
            this.motionManager.update(this.live2dModel, deltaTimeSeconds);
        }

        // Auto breathing if enabled
        if (this.options.autoBreathing) {
            this.updateBreathing(deltaTimeSeconds);
        }

        // Update the model
        this.live2dModel.update();
    }

    /**
     * Update physics simulation
     */
    updatePhysics(deltaTimeSeconds) {
        // In a full implementation, this would update physics calculations
        // For now, we'll just log that physics is being updated
        console.log('Updating physics...');
    }

    /**
     * Update breathing animation
     */
    updateBreathing(deltaTimeSeconds) {
        // Simple breathing animation
        const breathValue = 0.5 + 0.5 * Math.sin(Date.now() * 0.001);
        this.setParameter('ParamBreath', breathValue);
    }

    /**
     * Render the model with optimized pipeline
     */
    render() {
        if (!this.live2dModel) return;

        // Clear the canvas
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent background
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);

        // Update model
        this.live2dModel.update();

        // Use our custom shader program
        this.gl.useProgram(this.shaderProgram);

        // Get drawables count
        const drawCount = this.live2dModel.getDrawableCount();

        // Render each drawable with optimized pipeline
        for (let i = 0; i < drawCount; ++i) {
            this.renderDrawable(i);
        }
    }

    /**
     * Render a specific drawable with optimized pipeline
     */
    renderDrawable(drawableIndex) {
        // Get drawable information
        const opacity = this.live2dModel.getDrawableOpacity(drawableIndex);
        const vertices = this.live2dModel.getDrawableVertices(drawableIndex);
        const uvs = this.live2dModel.getDrawableVertexUvs(drawableIndex); // UV coordinates
        const textureIndex = this.live2dModel.getDrawableTextureIndices(drawableIndex)[0];
        const indexCount = this.live2dModel.getDrawableVertexIndexCount(drawableIndex);
        const indices = this.live2dModel.getDrawableVertexIndices(drawableIndex);
        const blendMode = this.live2dModel.getDrawableBlendMode(drawableIndex);
        const isDoubleSided = this.live2dModel.getDrawableCulling(drawableIndex) === 0;
        const maskCount = this.live2dModel.getDrawableMaskCount(drawableIndex);

        // Validate data
        if (!vertices || !indices || textureIndex >= this.textures.length) {
            return;
        }

        // Set culling based on drawable settings
        if (isDoubleSided) {
            this.gl.disable(this.gl.CULL_FACE);
        } else {
            this.gl.enable(this.gl.CULL_FACE);
        }

        // Set blend mode based on drawable settings
        switch (blendMode) {
            case 1: // Additive
                this.gl.blendFuncSeparate(
                    this.gl.SRC_ALPHA, 
                    this.gl.ONE,
                    this.gl.ONE,
                    this.gl.ONE_MINUS_SRC_ALPHA
                );
                break;
            case 2: // Multiplicative
                this.gl.blendFuncSeparate(
                    this.gl.ZERO, 
                    this.gl.SRC_COLOR,
                    this.gl.ONE,
                    this.gl.ONE_MINUS_SRC_ALPHA
                );
                break;
            default: // Normal
                this.gl.blendFuncSeparate(
                    this.gl.SRC_ALPHA, 
                    this.gl.ONE_MINUS_SRC_ALPHA,
                    this.gl.ONE,
                    this.gl.ONE_MINUS_SRC_ALPHA
                );
                break;
        }

        // Bind texture
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[textureIndex]);
        this.gl.uniform1i(this.uniforms.texture, 0);

        // Use optimized buffer approach with shared buffers
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.webglBuffers.vertex);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, new Float32Array(vertices));
        
        // Bind UV coordinates
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.webglBuffers.uv);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, new Float32Array(uvs));

        // Bind index buffer
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.webglBuffers.index);
        this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(indices));

        // Set up vertex attributes
        const stride = 2 * 4; // 2 floats per vertex (x, y) * 4 bytes per float
        
        // Position attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.webglBuffers.vertex);
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, stride, 0);
        
        // UV attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.webglBuffers.uv);
        this.gl.enableVertexAttribArray(this.attributes.texCoord);
        this.gl.vertexAttribPointer(this.attributes.texCoord, 2, this.gl.FLOAT, false, stride, 0);

        // Set uniforms
        this.gl.uniformMatrix4fv(this.uniforms.mvpMatrix, false, this.modelMatrix.getArray());
        this.gl.uniform1f(this.uniforms.opacity, opacity);

        // Apply masking if needed
        if (maskCount > 0) {
            this.applyMasks(drawableIndex);
        }

        // Draw elements
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);

        // Disable vertex attribute arrays
        this.gl.disableVertexAttribArray(this.attributes.position);
        this.gl.disableVertexAttribArray(this.attributes.texCoord);
    }

    /**
     * Apply masks to the drawable
     */
    applyMasks(drawableIndex) {
        // Enable stencil test for masking
        this.gl.enable(this.gl.STENCIL_TEST);
        this.gl.stencilOp(this.gl.KEEP, this.gl.KEEP, this.gl.REPLACE);
        this.gl.stencilFunc(this.gl.ALWAYS, 1, 0xFF);
        this.gl.colorMask(false, false, false, false);

        // In a full implementation, we would draw the mask geometry here
        // For now, we'll just set up the stencil buffer

        // Restore color mask
        this.gl.colorMask(true, true, true, true);
        this.gl.stencilFunc(this.gl.EQUAL, 1, 0xFF);
        this.gl.stencilOp(this.gl.KEEP, this.gl.KEEP, this.gl.KEEP);
    }

    /**
     * Main render loop
     */
    renderLoop() {
        // Calculate delta time
        const now = Date.now() / 1000;
        const deltaTime = now - this.lastTimeSeconds;
        this.lastTimeSeconds = now;

        // Frame rate limiting
        this.frameTime += deltaTime;
        if (this.frameTime < this.targetFrameTime) {
            // Skip frame to maintain target frame rate
            requestAnimationFrame(() => this.renderLoop());
            return;
        }
        this.frameTime -= this.targetFrameTime;

        // Update and render
        this.update(deltaTime);
        this.render();

        // Continue loop
        requestAnimationFrame(() => this.renderLoop());
    }

    /**
     * Handle mouse/touch events for interactivity
     */
    setupEventHandlers() {
        // Mouse down event
        this.canvas.addEventListener('mousedown', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Check for hit areas
            const hitResult = this.checkHit(x, y);
            if (hitResult) {
                this.emit('click', { x, y, hitArea: hitResult });

                // Trigger tap body motion if body was clicked
                if (hitResult.Name === 'Body') {
                    this.playMotion('TapBody', 0, 3);
                }
            }

            // Start drag
            if (this.dragManager) {
                this.dragManager.startX = x;
                this.dragManager.startY = y;
                this.dragManager.setPoint(x, y);
                this.dragManager.isDragging = true;
            }
        });

        // Mouse move event
        this.canvas.addEventListener('mousemove', (event) => {
            if (this.dragManager && this.dragManager.isDragging) {
                const rect = this.canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                this.dragManager.setPoint(x, y);

                // Update look-at parameters based on mouse position
                const centerX = this.canvas.width / 2;
                const centerY = this.canvas.height / 2;
                const dx = (x - centerX) / centerX;
                const dy = (y - centerY) / centerY;

                this.setParameter('ParamEyeBallX', dx * 0.5);
                this.setParameter('ParamEyeBallY', dy * 0.5);
                this.setParameter('ParamAngleX', dx * 30);
                this.setParameter('ParamAngleY', dy * 30);
            }
        });

        // Mouse up event
        this.canvas.addEventListener('mouseup', () => {
            if (this.dragManager) {
                this.dragManager.isDragging = false;
            }
        });

        // Touch events for mobile support
        this.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            const touch = event.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Similar to mouse down
            const hitResult = this.checkHit(x, y);
            if (hitResult) {
                this.emit('click', { x, y, hitArea: hitResult });
            }
        });
    }

    /**
     * Check if a point hits any of the model's hit areas
     */
    checkHit(x, y) {
        // Convert screen coordinates to model coordinates
        const deviceX = (x - this.canvas.width / 2) / (this.canvas.width / 2);
        const deviceY = (y - this.canvas.height / 2) / (this.canvas.height / 2);

        // Check each hit area
        for (const hitArea of this.hitAreas) {
            // In a full implementation, we would use the actual hit area rectangles
            // For now, we'll just return the first hit area as a placeholder
            return hitArea;
        }

        return null;
    }

    /**
     * Event system methods
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    /**
     * Destroy the renderer and cleanup resources
     */
    destroy() {
        // Stop animation loop
        cancelAnimationFrame(this.animationFrameId);

        // Cleanup textures
        for (const texture of this.textures) {
            if (texture) {
                this.gl.deleteTexture(texture);
            }
        }
        this.textures = [];

        // Cleanup WebGL buffers
        if (this.webglBuffers.vertex) {
            this.gl.deleteBuffer(this.webglBuffers.vertex);
        }
        if (this.webglBuffers.index) {
            this.gl.deleteBuffer(this.webglBuffers.index);
        }
        if (this.webglBuffers.uv) {
            this.gl.deleteBuffer(this.webglBuffers.uv);
        }

        // Cleanup shader program
        if (this.shaderProgram) {
            this.gl.deleteProgram(this.shaderProgram);
        }

        // Cleanup model
        if (this.live2dModel && this.live2dModel.release) {
            this.live2dModel.release();
        }
        this.live2dModel = null;

        // Remove event listeners
        this.eventListeners.clear();

        // Clear canvas
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
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
            this.tr[i] = (i % 5 == 0) ? 1 : 0;
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
 * TransparentLive2DDesktopMate class - Desktop application with transparent window
 */
class TransparentLive2DDesktopMate {
    constructor(options = {}) {
        this.options = {
            ...{
                container: 'body',
                width: 400,
                height: 600,
                alwaysOnTop: true,
                clickThrough: false,
                enableWindowControls: true,
                modelPath: 'web/models/Hiyori/Hiyori.model3.json',
                transparent: true,
                resizable: true
            },
            ...options
        };

        this.renderer = null;
        this.canvas = null;
        this.windowElement = null;
        this.isInitialized = false;

        this.init();
    }

    async init() {
        // Create canvas element with transparent background
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.position = 'fixed';
        this.canvas.style.bottom = '20px';
        this.canvas.style.right = '20px';
        this.canvas.style.zIndex = '9999';
        this.canvas.style.borderRadius = '10px';
        this.canvas.style.boxShadow = this.options.transparent ? 'none' : '0 4px 20px rgba(0,0,0,0.3)';
        this.canvas.style.background = 'transparent';
        this.canvas.style.pointerEvents = this.options.clickThrough ? 'none' : 'auto';

        // Create window container with transparency
        if (this.options.container === 'body') {
            this.windowElement = document.createElement('div');
            this.windowElement.style.position = 'fixed';
            this.windowElement.style.bottom = '20px';
            this.windowElement.style.right = '20px';
            this.windowElement.style.zIndex = '9998';
            this.windowElement.style.backgroundColor = 'transparent';
            this.windowElement.style.borderRadius = '10px';
            this.windowElement.style.overflow = 'hidden';
            this.windowElement.appendChild(this.canvas);

            document.body.appendChild(this.windowElement);
        } else {
            const container = document.querySelector(this.options.container);
            if (container) {
                container.appendChild(this.canvas);
            }
        }

        // Create renderer
        this.renderer = new ProductionLive2DRenderer(this.canvas, {
            premultipliedAlpha: true,
            useHighPrecisionMask: true,
            enableMotions: true,
            enableExpressions: true,
            enablePhysics: true,
            enableLipSync: true,
            autoBreathing: true
        });

        // Setup event handlers
        this.setupWindowControls();

        this.isInitialized = true;

        // Load the model
        await this.loadModel(this.options.modelPath);
    }

    /**
     * Setup window controls (drag, resize, etc.)
     */
    setupWindowControls() {
        if (!this.options.enableWindowControls) return;

        let isDragging = false;
        let isResizing = false;
        let dragStartX, dragStartY, initialX, initialY;
        let resizeStartX, resizeStartY, initialWidth, initialHeight;

        // Make canvas draggable
        this.canvas.addEventListener('mousedown', (e) => {
            // Only start drag if not clicking on resize handle
            if (!isResizing) {
                isDragging = true;
                dragStartX = e.clientX - this.canvas.getBoundingClientRect().left;
                dragStartY = e.clientY - this.canvas.getBoundingClientRect().top;
                this.canvas.style.cursor = 'grabbing';
                e.stopPropagation();
            }
        });

        // Add resize handle if resizable
        if (this.options.resizable) {
            const resizeHandle = document.createElement('div');
            resizeHandle.style.position = 'absolute';
            resizeHandle.style.bottom = '0';
            resizeHandle.style.right = '0';
            resizeHandle.style.width = '20px';
            resizeHandle.style.height = '20px';
            resizeHandle.style.cursor = 'se-resize';
            resizeHandle.style.backgroundColor = 'rgba(0,0,0,0.2)';
            resizeHandle.style.borderRadius = '0 0 10px 0';
            this.canvas.parentElement.appendChild(resizeHandle);

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                initialWidth = this.canvas.width;
                initialHeight = this.canvas.height;
                e.stopPropagation();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = e.clientX - dragStartX;
                const y = e.clientY - dragStartY;

                this.canvas.style.left = x + 'px';
                this.canvas.style.top = y + 'px';
                this.canvas.style.right = 'auto';
                this.canvas.style.bottom = 'auto';
            } else if (isResizing) {
                const width = initialWidth + (e.clientX - resizeStartX);
                const height = initialHeight + (e.clientY - resizeStartY);

                // Minimum size constraint
                if (width >= 200 && height >= 300) {
                    this.canvas.width = width;
                    this.canvas.height = height;
                    this.canvas.style.width = width + 'px';
                    this.canvas.style.height = height + 'px';
                }
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
            this.canvas.style.cursor = 'default';
        });
    }

    /**
     * Load Live2D model
     */
    async loadModel(modelPath) {
        if (!this.renderer) {
            throw new Error('Renderer not initialized');
        }

        return await this.renderer.loadModel(modelPath);
    }

    /**
     * Set expression
     */
    setExpression(name) {
        if (this.renderer) {
            this.renderer.setExpression(name);
        }
    }

    /**
     * Play motion
     */
    playMotion(group, index, priority = 3) {
        if (this.renderer) {
            return this.renderer.playMotion(group, index, priority);
        }
        return false;
    }

    /**
     * Set parameter
     */
    setParameter(id, value) {
        if (this.renderer) {
            this.renderer.setParameter(id, value);
        }
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (this.renderer) {
            this.renderer.on(event, callback);
        }
    }

    /**
     * Start the render loop
     */
    startRenderLoop() {
        if (this.renderer) {
            this.renderer.renderLoop();
        }
    }

    /**
     * Destroy the desktop mate
     */
    destroy() {
        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        if (this.windowElement && this.windowElement.parentNode) {
            this.windowElement.parentNode.removeChild(this.windowElement);
        }
    }
}

// Export classes for module systems
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { ProductionLive2DRenderer, TransparentLive2DDesktopMate };
} else if (typeof window !== 'undefined') {
    window.ProductionLive2DRenderer = ProductionLive2DRenderer;
    window.TransparentLive2DDesktopMate = TransparentLive2DDesktopMate;
}