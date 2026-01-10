// Live2D Cubism Core should be loaded via script tag before this file
// Ensure Live2DCubismCore is available globally
if (typeof Live2DCubismCore === 'undefined') {
    console.warn('Live2DCubismCore not found. Please ensure live2dcubismcore.min.js is loaded before this script.');
}

// Base class with caching functionality
class Live2DBase {
    constructor(coreObject) {
        this._core = coreObject;
        this._cache = new Map();
    }

    // Python-style property access
    get count() {
        return this._core ? (this._core.count || (this._core.ids ? this._core.ids.length : 0) || 0) : 0;
    }

    // Cache management
    _getCached(key, factory) {
        if (!this._cache.has(key)) {
            this._cache.set(key, factory());
        }
        return this._cache.get(key);
    }

    clearCache() {
        this._cache.clear();
    }
}

// Drawables wrapper
class Live2DDrawables extends Live2DBase {
    constructor(coreDrawables) {
        super(coreDrawables);
        this._core = coreDrawables;
    }

    getVertices(index) {
        if (index >= this.count) return null;
        return this._getCached(`vertices_${index}`, () => {
            if (this._core.vertexPositions && this._core.vertexPositions[index]) {
                return new Float32Array(this._core.vertexPositions[index]);
            } else {
                return null;
            }
        });
    }

    getUVs(index) {
        if (index >= this.count) return null;
        return this._getCached(`uvs_${index}`, () => {
            if (this._core.vertexUvs && this._core.vertexUvs[index]) {
                return new Float32Array(this._core.vertexUvs[index]);
            } else {
                return null;
            }
        });
    }

    getIndices(index) {
        if (index >= this.count) return null;
        return this._getCached(`indices_${index}`, () => {
            if (this._core.indexes && this._core.indexes[index]) {
                return new Uint16Array(this._core.indexes[index]);
            } else {
                return null;
            }
        });
    }

    getOpacity(index) {
        if (index >= this.count) return 1.0;
        return this._core.opacities ? this._core.opacities[index] : 1.0;
    }

    getTextureIndex(index) {
        if (index >= this.count) return 0;
        return this._core.textureIndices ? this._core.textureIndices[index] : 0;
    }

    getDrawOrder(index) {
        if (index >= this.count) return 0;
        return this._core.drawOrders ? this._core.drawOrders[index] : 0;
    }

    getRenderOrder(index) {
        if (index >= this.count) return 0;
        return this._core.renderOrders ? this._core.renderOrders[index] : 0;
    }

    getMaskCount(index) {
        if (index >= this.count) return 0;
        return this._core.maskCounts ? this._core.maskCounts[index] : 0;
    }

    getId(index) {
        if (index >= this.count) return null;
        return this._core.ids ? this._core.ids[index] : null;
    }

    isVisible(index) {
        if (index >= this.count) return false;
        const opacity = this.getOpacity(index);
        return opacity > 0.001;
    }

    getIndexCount(index) {
        if (index >= this.count) return 0;
        const indices = this.getIndices(index);
        return indices ? indices.length : 0;
    }

    getVertexCount(index) {
        if (index >= this.count) return 0;
        const vertices = this.getVertices(index);
        return vertices ? vertices.length / 2 : 0; // Each vertex has 2 components (x, y)
    }
}

// Parameters wrapper
class Live2DParameters extends Live2DBase {
    constructor(coreParams) {
        super(coreParams);
        this._core = coreParams;
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

    set(nameOrIndex, value, isIndex = false) {
        const index = isIndex ? nameOrIndex : this._nameToIndex.get(nameOrIndex);
        if (index !== undefined && index < this.count) {
            // Clamp value to reasonable range
            const clampedValue = Math.max(this.minimumValue(index), Math.min(this.maximumValue(index), value));
            this._core.values[index] = clampedValue;
            return true;
        }
        return false;
    }

    get(nameOrIndex, isIndex = false) {
        const index = isIndex ? nameOrIndex : this._nameToIndex.get(nameOrIndex);
        if (index !== undefined && index < this.count) {
            return this._core.values[index];
        }
        return null;
    }

    getName(index) {
        if (index >= this.count) return null;
        return this._core.ids ? this._core.ids[index] : null;
    }

    getDefault(index) {
        if (index >= this.count) return 0;
        return this._core.defaultValues ? this._core.defaultValues[index] : 0;
    }

    minimumValue(index) {
        if (index >= this.count) return -1;
        return this._core.minimumValues ? this._core.minimumValues[index] : -1;
    }

    maximumValue(index) {
        if (index >= this.count) return 1;
        return this._core.maximumValues ? this._core.maximumValues[index] : 1;
    }

    // Iterator support
    *[Symbol.iterator]() {
        for (let i = 0; i < this.count; i++) {
            yield {
                index: i,
                name: this.getName(i),
                value: this._core.values[i],
                defaultValue: this.getDefault(i),
                minimum: this.minimumValue(i),
                maximum: this.maximumValue(i)
            };
        }
    }
}

// Parts wrapper
class Live2DParts extends Live2DBase {
    constructor(coreParts) {
        super(coreParts);
        this._core = coreParts;
    }

    getVisibility(index) {
        if (index >= this.count) return true;
        return this._core.opacities ? this._core.opacities[index] > 0.5 : true;
    }

    setVisibility(index, visible) {
        if (index >= this.count) return false;
        if (this._core.opacities) {
            this._core.opacities[index] = visible ? 1.0 : 0.0;
            return true;
        }
        return false;
    }

    getId(index) {
        if (index >= this.count) return null;
        return this._core.ids ? this._core.ids[index] : null;
    }
}

// Canvas info wrapper
class Live2DCanvasInfo extends Live2DBase {
    constructor(coreCanvasInfo) {
        super(coreCanvasInfo);
        this._core = coreCanvasInfo;
    }

    get width() {
        return this._core ? this._core.CanvasWidth : 0;
    }

    get height() {
        return this._core ? this._core.CanvasHeight : 0;
    }

    get pixelWidth() {
        return this._core ? this._core.PixelsPerUnit : 0;
    }
}

// Main Live2D Model class
class Live2DModel {
    constructor(arrayBuffer) {
        // Create moc from array buffer
        this._moc = Live2DCubismCore.Moc.fromArrayBuffer(arrayBuffer);
        if (!this._moc) {
            throw new Error('Failed to create Live2D MOC from array buffer');
        }

        // Create model from moc
        this._core = Live2DCubismCore.Model.fromMoc(this._moc);
        if (!this._core) {
            throw new Error('Failed to create Live2D model from MOC');
        }

        // Initialize parameter values to defaults
        if (this._core.parameters && this._core.parameters.defaultValues) {
            for (let i = 0; i < this._core.parameters.defaultValues.length; i++) {
                this._core.parameters.values[i] = this._core.parameters.defaultValues[i];
            }
        }

        // Initialize wrapper objects
        this.drawables = new Live2DDrawables(this._core.drawables);
        this.parameters = new Live2DParameters(this._core.parameters);
        this.parts = new Live2DParts(this._core.parts);
        this.canvasInfo = new Live2DCanvasInfo(this._core.canvasinfo || {});

        // Setup rendering state
        this._lastTime = 0;
        this._time = 0;
        
        // Initialize vertex and index buffers cache
        this._webglBuffers = {
            vertices: new Map(),
            uvs: new Map(),
            indices: new Map()
        };
    }

    // Factory method to load from URL
    static async fromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const buffer = await response.arrayBuffer();
            return new Live2DModel(buffer);
        } catch (error) {
            console.error('Error loading Live2D model:', error);
            throw error;
        }
    }

    // Update model state
    update(deltaTime = 16.67) {
        this._time += deltaTime;

        // Update core model
        if (this._core) {
            this._core.update();
        }

        // Clear caches that might become invalid
        this.drawables.clearCache();
    }

    // Get model matrix (placeholder implementation)
    getModelMatrix() {
        // Return identity matrix for now
        return [
            1, 0, 0, 0,
            0, 1, 0, 0, 
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    // Reset to default parameter values
    resetToDefaults() {
        if (this._core.parameters && this._core.parameters.defaultValues) {
            for (let i = 0; i < this._core.parameters.defaultValues.length; i++) {
                this._core.parameters.values[i] = this._core.parameters.defaultValues[i];
            }
        }
    }

    // Cleanup resources
    destroy() {
        // Delete WebGL buffers if they exist
        if (this._webglBuffers) {
            this._webglBuffers.vertices.clear();
            this._webglBuffers.uvs.clear();
            this._webglBuffers.indices.clear();
        }

        // Release core resources if possible
        if (this._core && typeof this._core.release === 'function') {
            this._core.release();
        }
        if (this._moc && typeof this._moc.release === 'function') {
            this._moc.release();
        }

        this._core = null;
        this._moc = null;
    }
}

// WebGL Renderer class
class Live2DRenderer {
    constructor(gl, model) {
        this.gl = gl;
        this.model = model;
        this.program = null;
        this.uniforms = {};
        this.attributes = {};
        this.textures = [];
        
        // Create shader program
        this.setupShaders();
    }

    setupShaders() {
        const gl = this.gl;

        // Vertex shader source
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_modelViewProjectionMatrix;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 0.0, 1.0);
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
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Could not link WebGL program:', gl.getProgramInfoLog(this.program));
            return;
        }

        // Get attribute and uniform locations
        this.attributes.position = gl.getAttribLocation(this.program, 'a_position');
        this.attributes.texCoord = gl.getAttribLocation(this.program, 'a_texCoord');
        
        this.uniforms.modelViewProjectionMatrix = gl.getUniformLocation(this.program, 'u_modelViewProjectionMatrix');
        this.uniforms.texture = gl.getUniformLocation(this.program, 'u_texture');
        this.uniforms.opacity = gl.getUniformLocation(this.program, 'u_opacity');
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    // Create WebGL buffers for all drawables
    createWebGLBuffers() {
        const gl = this.gl;
        
        for (let i = 0; i < this.model.drawables.count; i++) {
            // Create vertex buffer
            const vertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            const vertices = this.model.drawables.getVertices(i);
            if (vertices) {
                gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
                this.model._webglBuffers.vertices.set(i, vertexBuffer);
            }

            // Create UV buffer
            const uvBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            const uvs = this.model.drawables.getUVs(i);
            if (uvs) {
                gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
                this.model._webglBuffers.uvs.set(i, uvBuffer);
            }

            // Create index buffer
            const indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            const indices = this.model.drawables.getIndices(i);
            if (indices) {
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
                this.model._webglBuffers.indices.set(i, indexBuffer);
            }
        }
    }

    // Render the model
    render(projectionMatrix = null) {
        const gl = this.gl;
        
        // Use shader program
        gl.useProgram(this.program);

        // Set default projection matrix if not provided
        if (!projectionMatrix) {
            // Create a simple orthographic projection
            const canvas = gl.canvas;
            const projection = [
                2 / canvas.width, 0, 0, 0,
                0, -2 / canvas.height, 0, 0,
                0, 0, 1, 0,
                -1, 1, 0, 1
            ];
            projectionMatrix = projection;
        }

        // Set uniforms
        gl.uniformMatrix4fv(this.uniforms.modelViewProjectionMatrix, false, projectionMatrix);
        gl.uniform1i(this.uniforms.texture, 0); // Use texture unit 0

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Render each drawable
        for (let i = 0; i < this.model.drawables.count; i++) {
            if (!this.model.drawables.isVisible(i)) continue;

            const opacity = this.model.drawables.getOpacity(i);
            if (opacity <= 0.001) continue; // Skip nearly transparent parts

            // Set opacity uniform
            gl.uniform1f(this.uniforms.opacity, opacity);

            // Bind vertex buffer
            const vertexBuffer = this.model._webglBuffers.vertices.get(i);
            if (vertexBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
                gl.enableVertexAttribArray(this.attributes.position);
                gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 0, 0);
            }

            // Bind UV buffer
            const uvBuffer = this.model._webglBuffers.uvs.get(i);
            if (uvBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
                gl.enableVertexAttribArray(this.attributes.texCoord);
                gl.vertexAttribPointer(this.attributes.texCoord, 2, gl.FLOAT, false, 0, 0);
            }

            // Bind index buffer and draw
            const indexBuffer = this.model._webglBuffers.indices.get(i);
            if (indexBuffer) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                const indexCount = this.model.drawables.getIndexCount(i);
                if (indexCount > 0) {
                    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
                }
            }
        }

        // Disable vertex attributes
        gl.disableVertexAttribArray(this.attributes.position);
        gl.disableVertexAttribArray(this.attributes.texCoord);
        
        // Disable blending
        gl.disable(gl.BLEND);
    }

    // Cleanup WebGL resources
    destroy() {
        const gl = this.gl;
        
        if (this.program) {
            gl.deleteProgram(this.program);
            this.program = null;
        }
    }
}

// Desktop Mate Application class
class Live2DDesktopMate {
    constructor(canvasId = 'live2d-canvas', options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found`);
        }

        // Setup WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported by this browser');
        }

        this.model = null;
        this.renderer = null;
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        this.isRunning = false;

        // Store options
        this.options = {
            autoStart: true,
            modelUrl: options.modelUrl || '',
            ...options
        };

        // Initialize
        this.init();
    }

    init() {
        // Set canvas size
        this.resizeCanvas();

        // Add resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Start animation if autoStart is enabled
        if (this.options.autoStart && this.options.modelUrl) {
            this.loadModel(this.options.modelUrl);
        }
    }

    resizeCanvas() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    }

    async loadModel(url) {
        try {
            // Destroy existing model if present
            if (this.model) {
                this.stopAnimation();
                this.model.destroy();
            }

            // Load new model
            this.model = await Live2DModel.fromURL(url);
            
            // Create renderer
            this.renderer = new Live2DRenderer(this.gl, this.model);
            
            // Create WebGL buffers
            this.renderer.createWebGLBuffers();

            // Start animation
            this.startAnimation();

            console.log('Live2D model loaded successfully');
            console.log(`Model has ${this.model.drawables.count} drawables`);
            console.log(`Model has ${this.model.parameters.count} parameters`);

            return true;
        } catch (error) {
            console.error('Error loading Live2D model:', error);
            return false;
        }
    }

    startAnimation() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastUpdateTime = performance.now();
            this.animate();
        }
    }

    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isRunning = false;
    }

    animate = () => {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        // Update model
        if (this.model) {
            this.model.update(deltaTime);
        }

        // Clear canvas
        const gl = this.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Render model
        if (this.renderer && this.model) {
            this.renderer.render();
        }

        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.animate);
    }

    // Set expression (placeholder implementation)
    setExpression(expressionName) {
        console.log(`Setting expression: ${expressionName}`);
        // In a real implementation, this would load and apply expression data
    }

    // Play motion (placeholder implementation)
    playMotion(motionGroup, index) {
        console.log(`Playing motion: ${motionGroup}[${index}]`);
        // In a real implementation, this would load and play motion data
    }

    // Set parameter by name
    setParameter(name, value) {
        if (this.model && this.model.parameters) {
            return this.model.parameters.set(name, value);
        }
        return false;
    }

    // Get parameter by name
    getParameter(name) {
        if (this.model && this.model.parameters) {
            return this.model.parameters.get(name);
        }
        return null;
    }

    // Cleanup resources
    destroy() {
        this.stopAnimation();
        
        if (this.model) {
            this.model.destroy();
            this.model = null;
        }

        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }
    }
}

// Global initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Example usage:
    // Create desktop mate application
    window.live2dApp = new Live2DDesktopMate('live2d-canvas', {
        autoStart: true,
        modelUrl: 'model/model.model3.json' // Replace with actual model path
    });

    // Example of how to interact with parameters
    // This could be connected to UI controls
    setTimeout(() => {
        if (window.live2dApp.model) {
            console.log("Available parameters:");
            for (const param of window.live2dApp.model.parameters) {
                console.log(`- ${param.name}: ${param.value} (min: ${param.minimum}, max: ${param.maximum})`);
            }
        }
    }, 2000);
});

// Make classes available globally
window.Live2DBase = Live2DBase;
window.Live2DDrawables = Live2DDrawables;
window.Live2DParameters = Live2DParameters;
window.Live2DParts = Live2DParts;
window.Live2DCanvasInfo = Live2DCanvasInfo;
window.Live2DModel = Live2DModel;
window.Live2DRenderer = Live2DRenderer;
window.Live2DDesktopMate = Live2DDesktopMate;