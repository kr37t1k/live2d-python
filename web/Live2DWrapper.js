/**
 * Live2D Python-like Wrapper Classes
 * Clean, intuitive API for Live2D Cubism Core Web SDK
 */

/**
 * Base class for Live2D objects with caching functionality
 */
class Live2DBase {
    constructor(coreObject) {
        this._core = coreObject;
        this._cache = new Map();
    }

    // Python-style property access
    get count() {
        return this._core.count || 0;
    }

    // Cache management
    _getCached(key, factory) {
        if (!this._cache.has(key)) {
            this._cache.set(key, factory());
        }
        return this._cache.get(key);
    }

    // Clear cache
    clearCache() {
        this._cache.clear();
    }
}

/**
 * Drawables wrapper class
 */
class Live2DDrawables extends Live2DBase {
    constructor(coreDrawables) {
        super(coreDrawables);
        this._buildNameIndexMap();
    }

    _buildNameIndexMap() {
        this._nameToIndex = new Map();
        if (this._core.ids) {
            for (let i = 0; i < this._core.ids.length; i++) {
                this._nameToIndex.set(this._core.ids[i], i);
            }
        }
    }

    /**
     * Get vertices for a specific drawable
     */
    getVertices(index) {
        if (index >= this.count) return null;
        return this._getCached(`vertices_${index}`, () => {
            return new Float32Array(this._core.vertexPositions[index]);
        });
    }
//     Сброс всех динамических флагов
    resetDynamicFlags() {
        if (this._core.resetDynamicFlags) {
            // Высокоуровневый метод если есть
            this._core.resetDynamicFlags();
        } else if (typeof _csm !== 'undefined' && _csm.resetDrawableDynamicFlags && this._modelPtr) {
            // Низкоуровневый вызов через Emscripten
            _csm.resetDrawableDynamicFlags(this._modelPtr);
        } else if (this._core._resetDynamicFlags) {
            // Альтернативное имя метода
            this._core._resetDynamicFlags();
        }

        // Также можно сбросить флаги вручную
        if (this._core.dynamicFlags) {
            for (let i = 0; i < this._core.dynamicFlags.length; i++) {
                this._core.dynamicFlags[i] = false;
            }
        }
    }
    /**
     * Get UV coordinates for a specific drawable
     */
    getUVs(index) {
        if (index >= this.count) return null;
        return this._getCached(`uvs_${index}`, () => {
            return this._core.vertexUvs ? 
                new Float32Array(this._core.vertexUvs[index]) : 
                null;
        });
    }

    /**
     * Get indices for a specific drawable
     */
    getIndices(index) {
        if (index >= this.count) return null;
        return this._getCached(`indices_${index}`, () => {
            return this._core.indices ? 
                new Int32Array(this._core.indices[index]) : 
                null;
        });
    }

    /**
     * Get opacity for a specific drawable
     */
    getOpacity(index) {
        if (index >= this.count) return 1.0;
        return this._core.opacities ? this._core.opacities[index] : 1.0;
    }

    /**
     * Get texture index for a specific drawable
     */
    getTextureIndex(index) {
        if (index >= this.count) return 0;
        return this._core.textureIndices ? this._core.textureIndices[index] : 0;
    }

    /**
     * Check if a drawable is visible
     */
    isVisible(index) {
        if (index >= this.count) return false;
        return this.getOpacity(index) > 0.001;
    }

    /**
     * Get draw order for a specific drawable
     */
    getDrawOrder(index) {
        if (index >= this.count) return 0;
        return this._core.drawOrders ? this._core.drawOrders[index] : 0;
    }

    /**
     * Get render order for a specific drawable
     */
    getRenderOrder(index) {
        if (index >= this.count) return 0;
        return this._core.renderOrders ? this._core.renderOrders[index] : 0;
    }

    /**
     * Get vertex count for a specific drawable
     */
    getVertexCount(index) {
        if (index >= this.count) return 0;
        return this._core.vertexCounts ? this._core.vertexCounts[index] : 0;
    }

    /**
     * Get index count for a specific drawable
     */
    getIndexCount(index) {
        if (index >= this.count) return 0;
        return this._core.indexCounts ? this._core.indexCounts[index] : 0;
    }

    /**
     * Get all texture indices
     */
    get textureIndices() {
        return this._core.textureIndices || [];
    }

    /**
     * Get drawable ID by index
     */
    getId(index) {
        if (index >= this.count) return null;
        return this._core.ids ? this._core.ids[index] : null;
    }

    /**
     * Get index by drawable ID
     */
    getIndexById(id) {
        return this._nameToIndex.get(id);
    }
}

/**
 * Parameters wrapper class with auto-mapping
 */
class Live2DParameters extends Live2DBase {
    constructor(coreParams) {
        super(coreParams);
        this._buildNameIndexMap();
    }

    _buildNameIndexMap() {
        this._nameToIndex = new Map();
        if (this._core.ids) {
            for (let i = 0; i < this._core.ids.length; i++) {
                this._nameToIndex.set(this._core.ids[i], i);
            }
        }
    }

    /**
     * Set parameter value by name or index
     */
    set(nameOrIndex, value, isIndex = false) {
        const index = isIndex ? nameOrIndex : this._nameToIndex.get(nameOrIndex);
        if (index !== undefined && index < this.count) {
            this._core.values[index] = Math.max(this.getMinimum(index), Math.min(this.getMaximum(index), value));
            return true;
        }
        return false;
    }

    /**
     * Get parameter value by name or index
     */
    get(nameOrIndex, isIndex = false) {
        const index = isIndex ? nameOrIndex : this._nameToIndex.get(nameOrIndex);
        if (index !== undefined && index < this.count) {
            return this._core.values[index];
        }
        return null;
    }

    /**
     * Get minimum value for a parameter
     */
    getMinimum(index) {
        if (index >= this.count) return -1;
        return this._core.minimumValues ? this._core.minimumValues[index] : -1;
    }

    /**
     * Get maximum value for a parameter
     */
    getMaximum(index) {
        if (index >= this.count) return 1;
        return this._core.maximumValues ? this._core.maximumValues[index] : 1;
    }

    /**
     * Get default value for a parameter
     */
    getDefault(index) {
        if (index >= this.count) return 0;
        return this._core.defaultValues ? this._core.defaultValues[index] : 0;
    }

    /**
     * Get parameter ID by index
     */
    getId(index) {
        if (index >= this.count) return null;
        return this._core.ids ? this._core.ids[index] : null;
    }

    /**
     * Get index by parameter ID
     */
    getIndexById(id) {
        return this._nameToIndex.get(id);
    }

    /**
     * Normalize value to [0, 1] range
     */
    normalizeValue(index, value) {
        const min = this.getMinimum(index);
        const max = this.getMaximum(index);
        if (max === min) return 0;
        return (value - min) / (max - min);
    }

    /**
     * Denormalize value from [0, 1] range
     */
    denormalizeValue(index, normalizedValue) {
        const min = this.getMinimum(index);
        const max = this.getMaximum(index);
        return min + (max - min) * normalizedValue;
    }

    /**
     * Iterator support for parameters
     */
    *[Symbol.iterator]() {
        for (let i = 0; i < this.count; i++) {
            yield {
                index: i,
                name: this._core.ids ? this._core.ids[i] : `Param_${i}`,
                value: this._core.values[i],
                minimum: this.getMinimum(i),
                maximum: this.getMaximum(i),
                defaultValue: this.getDefault(i)
            };
        }
    }
}

/**
 * Parts wrapper class
 */
class Live2DParts extends Live2DBase {
    constructor(coreParts) {
        super(coreParts);
        this._buildNameIndexMap();
    }

    _buildNameIndexMap() {
        this._nameToIndex = new Map();
        if (this._core.ids) {
            for (let i = 0; i < this._core.ids.length; i++) {
                this._nameToIndex.set(this._core.ids[i], i);
            }
        }
    }

    /**
     * Get opacity for a specific part
     */
    getOpacity(index) {
        if (index >= this.count) return 1.0;
        return this._core.opacities ? this._core.opacities[index] : 1.0;
    }

    /**
     * Set opacity for a specific part
     */
    setOpacity(index, value) {
        if (index >= this.count) return false;
        if (this._core.opacities) {
            this._core.opacities[index] = Math.max(0, Math.min(1, value));
            return true;
        }
        return false;
    }

    /**
     * Get part ID by index
     */
    getId(index) {
        if (index >= this.count) return null;
        return this._core.ids ? this._core.ids[index] : null;
    }

    /**
     * Get index by part ID
     */
    getIndexById(id) {
        return this._nameToIndex.get(id);
    }

    /**
     * Get parent index for a specific part
     */
    getParentIndex(index) {
        if (index >= this.count) return -1;
        return this._core.parentIndices ? this._core.parentIndices[index] : -1;
    }
}

/**
 * Canvas Info wrapper class
 */
class Live2DCanvasInfo extends Live2DBase {
    constructor(coreCanvasInfo) {
        super(coreCanvasInfo);
    }

    get width() {
        return this._core.CanvasWidth || 0;
    }

    get height() {
        return this._core.CanvasHeight || 0;
    }

    get originX() {
        return this._core.CanvasOriginX || 0;
    }

    get originY() {
        return this._core.CanvasOriginY || 0;
    }

    get pixelsPerUnit() {
        return this._core.PixelsPerUnit || 0;
    }

    get aspectRatio() {
        return this.width > 0 ? this.height / this.width : 1;
    }
}

/**
 * Main Live2D Model class
 */
class Live2DModel {
    constructor(arrayBuffer) {
        if (!Live2DCubismCore) {
            throw new Error('Live2D Cubism Core not loaded');
        }

        this._moc = Live2DCubismCore.Moc.fromArrayBuffer(arrayBuffer);
        if (!this._moc) {
            throw new Error('Failed to create MOC from array buffer');
        }

        this._core = Live2DCubismCore.Model.fromMoc(this._moc);
        if (!this._core) {
            throw new Error('Failed to create model from MOC');
        }

        // Initialize wrappers
        this.drawables = new Live2DDrawables(this._core.drawables);
        this.parameters = new Live2DParameters(this._core.parameters);
        this.parts = new Live2DParts(this._core.parts);
        this.canvasInfo = new Live2DCanvasInfo(this._core.canvasinfo);

        // Rendering state
        this._time = 0;
        this._lastUpdateTime = 0;
        this._vertexBuffers = new Map();
        this._indexBuffers = new Map();

        // Animation state
        this._expressions = new Map();
        this._motions = new Map();
    }

    /**
     * Factory method to load model from URL
     */
    static async fromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            return new Live2DModel(buffer);
        } catch (error) {
            console.error('Failed to load model from URL:', error);
            throw error;
        }
    }

    /**
     * Update model state
     */
    update(deltaTime = 16.67) {
        this._time += deltaTime;

        // Update core model
        if (this._core.update) {
            this._core.update();
        }

        // Reset dynamic flags for next frame
        if (this._core.drawables && this._core.drawables.dynamicFlags) {
            this.drawables.resetDynamicFlags(this._core._ptr);
        }

        this._lastUpdateTime = Date.now();
    }

    /**
     * Get model time in seconds
     */
    get time() {
        return this._time / 1000;
    }

    /**
     * Reset model to initial state
     */
    reset() {
        if (this._core.parameters && this._core.parameters.defaultValues) {
            for (let i = 0; i < this.parameters.count; i++) {
                this._core.parameters.values[i] = this._core.parameters.defaultValues[i];
            }
        }
        this._time = 0;
    }

    /**
     * Set expression
     */
    setExpression(expressionName, weight = 1.0) {
        // This would be implemented with expression data loading
        this._expressions.set(expressionName, weight);
    }

    /**
     * Get expression weight
     */
    getExpression(expressionName) {
        return this._expressions.get(expressionName) || 0;
    }

    /**
     * Create WebGL buffers for rendering
     */
    createWebGLBuffers(gl) {
        const buffers = {
            vertices: new Map(),
            uvs: new Map(),
            indices: new Map()
        };

        for (let i = 0; i < this.drawables.count; i++) {
            // Vertex buffer
            const vBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            const vertices = this.drawables.getVertices(i);
            if (vertices) {
                gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
                buffers.vertices.set(i, vBuffer);
            }

            // UV buffer (if exists)
            const uvBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            const uvs = this.drawables.getUVs(i);
            if (uvs) {
                gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
                buffers.uvs.set(i, uvBuffer);
            }

            // Index buffer
            const iBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
            const indices = this.drawables.getIndices(i);
            if (indices) {
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
                buffers.indices.set(i, iBuffer);
            }
        }

        return buffers;
    }

    /**
     * Update WebGL buffers with current data
     */
    updateWebGLBuffers(gl, buffers) {
        for (let i = 0; i < this.drawables.count; i++) {
            // Update vertex buffer
            const vBuffer = buffers.vertices.get(i);
            if (vBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
                const vertices = this.drawables.getVertices(i);
                if (vertices) {
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
                }
            }

            // Update UV buffer
            const uvBuffer = buffers.uvs.get(i);
            if (uvBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
                const uvs = this.drawables.getUVs(i);
                if (uvs) {
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, uvs);
                }
            }

            // Update index buffer
            const iBuffer = buffers.indices.get(i);
            if (iBuffer) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
                const indices = this.drawables.getIndices(i);
                if (indices) {
                    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indices);
                }
            }
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Delete WebGL buffers if they exist
        if (this._vertexBuffers) {
            for (const [_, buffer] of this._vertexBuffers) {
                if (buffer) {
                    gl.deleteBuffer(buffer);
                }
            }
        }
        if (this._indexBuffers) {
            for (const [_, buffer] of this._indexBuffers) {
                if (buffer) {
                    gl.deleteBuffer(buffer);
                }
            }
        }

        // Release core model and moc
        if (this._core && this._core.release) {
            this._core.release();
        }
        if (this._moc && this._moc._release) {
            this._moc._release();
        }

        // Clear references
        this._core = null;
        this._moc = null;
        this.drawables = null;
        this.parameters = null;
        this.parts = null;
        this.canvasInfo = null;
    }
}

/**
 * Live2D Renderer class
 */
class Live2DRenderer {
    constructor(gl, model) {
        this.gl = gl;
        this.model = model;
        this.buffers = model.createWebGLBuffers(gl);
        this.shader = this.createShaderProgram();
        this.textures = [];
        
        // Initialize render state
        this.setupRenderState();
    }

    /**
     * Create shader program for rendering
     */
    createShaderProgram() {
        const gl = this.gl;

        // Vertex shader source
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_matrix;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        // Fragment shader source
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

        // Compile shaders
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

        // Create shader program
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }

        // Get attribute and uniform locations
        return {
            program: shaderProgram,
            attributes: {
                position: gl.getAttribLocation(shaderProgram, 'a_position'),
                texCoord: gl.getAttribLocation(shaderProgram, 'a_texCoord')
            },
            uniforms: {
                matrix: gl.getUniformLocation(shaderProgram, 'u_matrix'),
                texture: gl.getUniformLocation(shaderProgram, 'u_texture'),
                opacity: gl.getUniformLocation(shaderProgram, 'u_opacity')
            }
        };
    }

    /**
     * Compile a shader
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Setup render state
     */
    setupRenderState() {
        const gl = this.gl;

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // Enable culling for back faces
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
    }

    /**
     * Render the model
     */
    render(projectionMatrix) {
        const gl = this.gl;

        // Use shader program
        gl.useProgram(this.shader.program);

        // Set projection matrix
        if (this.shader.uniforms.matrix && projectionMatrix) {
            gl.uniformMatrix4fv(this.shader.uniforms.matrix, false, projectionMatrix);
        }

        // Render each drawable in render order
        const renderOrders = [];
        for (let i = 0; i < this.model.drawables.count; i++) {
            renderOrders.push({
                index: i,
                order: this.model.drawables.getRenderOrder(i)
            });
        }
        
        // Sort by render order
        renderOrders.sort((a, b) => a.order - b.order);

        for (const renderOrder of renderOrders) {
            const i = renderOrder.index;
            
            if (!this.model.drawables.isVisible(i)) continue;

            const opacity = this.model.drawables.getOpacity(i);
            const textureIndex = this.model.drawables.getTextureIndex(i);

            // Skip if no texture available
            if (textureIndex >= this.textures.length || !this.textures[textureIndex]) continue;

            // Bind texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[textureIndex]);
            gl.uniform1i(this.shader.uniforms.texture, 0);

            // Set opacity
            gl.uniform1f(this.shader.uniforms.opacity, opacity);

            // Bind vertex buffer
            const vBuffer = this.buffers.vertices.get(i);
            if (vBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
                gl.enableVertexAttribArray(this.shader.attributes.position);
                gl.vertexAttribPointer(
                    this.shader.attributes.position,
                    2, // 2 components per iteration
                    gl.FLOAT, // data type
                    false, // normalize
                    0, // stride
                    0 // offset
                );
            }

            // Bind UV buffer
            const uvBuffer = this.buffers.uvs.get(i);
            if (uvBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
                gl.enableVertexAttribArray(this.shader.attributes.texCoord);
                gl.vertexAttribPointer(
                    this.shader.attributes.texCoord,
                    2, // 2 components per iteration
                    gl.FLOAT, // data type
                    false, // normalize
                    0, // stride
                    0 // offset
                );
            }

            // Bind index buffer and draw
            const iBuffer = this.buffers.indices.get(i);
            if (iBuffer) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
                const indexCount = this.model.drawables.getIndexCount(i);
                gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
            }

            // Disable vertex attrib arrays
            gl.disableVertexAttribArray(this.shader.attributes.position);
            gl.disableVertexAttribArray(this.shader.attributes.texCoord);
        }
    }

    /**
     * Update buffers with current model data
     */
    updateBuffers() {
        this.model.updateWebGLBuffers(this.gl, this.buffers);
    }

    /**
     * Load textures for the model
     */
    async loadTextures(texturePaths) {
        const promises = texturePaths.map(path => this.loadTexture(path));
        this.textures = await Promise.all(promises);
    }

    /**
     * Load a single texture
     */
    loadTexture(path) {
        return new Promise((resolve, reject) => {
            const gl = this.gl;
            const texture = gl.createTexture();
            const image = new Image();
            
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                
                // Set texture parameters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                
                resolve(texture);
            };
            
            image.onerror = () => {
                reject(new Error(`Failed to load texture: ${path}`));
            };
            
            image.crossOrigin = 'Anonymous';
            image.src = path;
        });
    }

    /**
     * Cleanup renderer resources
     */
    destroy() {
        // Delete textures
        for (const texture of this.textures) {
            if (texture) {
                this.gl.deleteTexture(texture);
            }
        }

        // Delete shader program
        if (this.shader && this.shader.program) {
            this.gl.deleteProgram(this.shader.program);
        }

        // Delete buffers
        for (const [_, buffer] of this.buffers.vertices) {
            if (buffer) {
                this.gl.deleteBuffer(buffer);
            }
        }
        for (const [_, buffer] of this.buffers.uvs) {
            if (buffer) {
                this.gl.deleteBuffer(buffer);
            }
        }
        for (const [_, buffer] of this.buffers.indices) {
            if (buffer) {
                this.gl.deleteBuffer(buffer);
            }
        }
    }
}

/**
 * Desktop Mate class for desktop applications
 */
class Live2DDesktopMate {
    constructor(options = {}) {
        this.options = {
            container: 'body',
            width: 400,
            height: 600,
            modelPath: this.MODEL_PATH,
            transparent: false,
            enableInteractions: true,
            autoUpdate: true,
            ...options
        };

        this.model = null;
        this.renderer = null;
        this.canvas = null;
        this.gl = null;
        this.animationId = null;
        this.isRunning = false;

        // Interaction state
        this.dragState = {
            isDragging: false,
            startX: 0,
            startY: 0
        };

        this.init();
    }

    /**
     * Initialize the desktop mate
     */
    async init() {
        await this.createCanvas();
        await this.setupWebGL();
        this.setupEventHandlers();
    }

    /**
     * Create canvas element
     */
    async createCanvas() {
//        this.canvas = document.createElement('canvas');
        this.canvas = document.getElementById('live2dCanvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.position = 'fixed';
        this.canvas.style.bottom = '20px';
        this.canvas.style.right = '20px';
        this.canvas.style.zIndex = '9999';
        this.canvas.style.borderRadius = '10px';
        this.canvas.style.pointerEvents = 'auto';

        if (this.options.transparent) {
            this.canvas.style.backgroundColor = 'transparent';
            this.canvas.style.mixBlendMode = 'multiply';
        }

        // Add to container
        if (this.options.container === 'body') {
            document.body.appendChild(this.canvas);
        } else {
            const container = document.querySelector(this.options.container);
            if (container) {
                container.appendChild(this.canvas);
            }
        }
    }

    /**
     * Setup WebGL context
     */
    async setupWebGL() {
        this.gl = this.canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: true,
            antialias: true,
            stencil: true
        });

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
    }

    /**
     * Load model
     */
    async loadModel(url = this.options.modelPath) {
        try {
            this.model = await Live2DModel.fromURL(url);
            this.renderer = new Live2DRenderer(this.gl, this.model);
            
            // Load textures from model configuration
            if (url.endsWith('.model3.json')) {
                const modelDir = url.substring(0, url.lastIndexOf('/'));
                const response = await fetch(url);
                const modelData = await response.json();
                console.log(modelData);
                
                const texturePaths = modelData.FileReferences.Textures.map(tex => `${modelDir}/${tex}`);
                await this.renderer.loadTextures(texturePaths);
            }
            
            if (this.options.autoUpdate) {
                this.startAnimation();
            }
            
            console.log('Model loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load model:', error);
            return false;
        }
    }

    /**
     * Start animation loop
     */
    startAnimation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        const animate = () => {
            if (!this.isRunning) return;
            
            this.update();
            this.render();
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    /**
     * Update model state
     */
    update() {
        if (this.model) {
            // Update with delta time (assuming 60fps if no time info available)
            this.model.update(16.67);
            
            // Update renderer buffers
            if (this.renderer) {
                this.renderer.updateBuffers();
            }
        }
    }

    /**
     * Render the model
     */
    render() {
        if (!this.model || !this.renderer) return;

        // Clear canvas
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Create simple orthographic projection matrix
        const projectionMatrix = this.createOrthographicMatrix(
            0, this.canvas.width, this.canvas.height, 0, -1, 1
        );

        // Render the model
        this.renderer.render(projectionMatrix);
    }

    /**
     * Create orthographic projection matrix
     */
    createOrthographicMatrix(left, right, bottom, top, near, far) {
        const matrix = new Float32Array(16);
        
        matrix[0] = 2 / (right - left);
        matrix[5] = 2 / (top - bottom);
        matrix[10] = -2 / (far - near);
        matrix[12] = -(right + left) / (right - left);
        matrix[13] = -(top + bottom) / (top - bottom);
        matrix[14] = -(far + near) / (far - near);
        matrix[15] = 1;
        
        return matrix;
    }

    /**
     * Set expression
     */
    setExpression(name, weight = 1.0) {
        if (this.model) {
            this.model.setExpression(name, weight);
        }
    }

    /**
     * Play motion
     */
    playMotion(group, index, priority = 3) {
        // Implementation would depend on motion data loading
        console.log(`Playing motion: ${group}[${index}]`);
    }

    /**
     * Set parameter
     */
    setParameter(id, value) {
        if (this.model && this.model.parameters) {
            this.model.parameters.set(id, value);
        }
    }

    /**
     * Get parameter
     */
    getParameter(id) {
        if (this.model && this.model.parameters) {
            return this.model.parameters.get(id);
        }
        return null;
    }

    /**
     * Setup event handlers for interactions
     */
    setupEventHandlers() {
        if (!this.options.enableInteractions) return;

        // Mouse down for dragging
        this.canvas.addEventListener('mousedown', (e) => {
            this.dragState.isDragging = true;
            this.dragState.startX = e.clientX - this.canvas.getBoundingClientRect().left;
            this.dragState.startY = e.clientY - this.canvas.getBoundingClientRect().top;
            this.canvas.style.cursor = 'grabbing';
        });

        // Mouse move for dragging
        document.addEventListener('mousemove', (e) => {
            if (!this.dragState.isDragging) return;

            const newX = e.clientX - this.dragState.startX;
            const newY = e.clientY - this.dragState.startY;

            // Keep within viewport bounds
            const maxX = window.innerWidth - this.canvas.width;
            const maxY = window.innerHeight - this.canvas.height;

            this.canvas.style.left = Math.max(0, Math.min(maxX, newX)) + 'px';
            this.canvas.style.top = Math.max(0, Math.min(maxY, newY)) + 'px';
        });

        // Mouse up to stop dragging
        document.addEventListener('mouseup', () => {
            this.dragState.isDragging = false;
            this.canvas.style.cursor = 'default';
        });

        // Click detection for interactions
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calculate relative position to center
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const relX = (x - centerX) / centerX;
            const relY = (y - centerY) / centerY;

            // Update eye tracking parameters based on click position
            if (this.model && this.model.parameters) {
                this.model.parameters.set('ParamEyeBallX', relX * 0.5);
                this.model.parameters.set('ParamEyeBallY', relY * 0.5);
                this.model.parameters.set('ParamAngleX', relX * 30);
                this.model.parameters.set('ParamAngleY', relY * 30);
            }
        });
    }

    /**
     * Destroy the desktop mate
     */
    destroy() {
        this.stopAnimation();
        
        if (this.model) {
            this.model.destroy();
        }
        
        if (this.renderer) {
            this.renderer.destroy();
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Export classes for module systems
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Live2DBase,
        Live2DDrawables,
        Live2DParameters,
        Live2DParts,
        Live2DCanvasInfo,
        Live2DModel,
        Live2DRenderer,
        Live2DDesktopMate
    };
} else if (typeof window !== 'undefined') {
    globalThis.Live2DBase = Live2DBase;
    globalThis.Live2DDrawables = Live2DDrawables;
    globalThis.Live2DParameters = Live2DParameters;
    globalThis.Live2DParts = Live2DParts;
    globalThis.Live2DCanvasInfo = Live2DCanvasInfo;
    globalThis.Live2DModel = Live2DModel;
    globalThis.Live2DRenderer = Live2DRenderer;
    globalThis.Live2DDesktopMate = Live2DDesktopMate;
}