// Live2D Python - JavaScript Client
// Handles Live2D model rendering and communication with the server

const MODEL_PATH = 'web/models/Hiyori/Hiyori.model3.json';
const MODEL_DIR = MODEL_PATH.substring(0, MODEL_PATH.lastIndexOf('/'));
const WS_URL = window.location.origin;

console.log('Live2D Core available:', typeof Live2DCubismCore);
console.log('Socket URL:', WS_URL);

let socket;
let canvas, gl;
let live2dModel = null;
let modelViewMatrix = null;
let projectionMatrix = null;
let renderer = null;
let textures = [];
let vertexBuffers = [];
let indexBuffers = [];
let program = null;
let shaderLocations = {};

// Initialize socket connection
function initSocket() {
    try {
        socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            timeout: 10000
        });
    } catch (e) {
        console.error('Socket connection error:', e);
    }

    socket.on('connect', () => {
        console.log('✓ Server connected');
        document.getElementById('connectionStatus').innerHTML = '✅ Server connected';
        document.getElementById('connectionStatus').style.color = '#4CAF50';
    });

    socket.on('disconnect', () => {
        console.log('✗ Server disconnected');
        document.getElementById('connectionStatus').innerHTML = '❌ Server disconnected';
        document.getElementById('connectionStatus').style.color = '#f44336';
    });

    socket.on('model_state', (data) => {
        console.log('Model state received:', data);
        applyModelState(data);
    });

    socket.on('parameter_update', (data) => {
        updateParameter(data.id, data.value);
    });

    socket.on('expression_update', (data) => {
        setExpression(data.expression, data.active);
    });

    socket.on('motion_start', (data) => {
        console.log('Motion started:', data);
        // Handle motion playback
    });

    socket.on('clients_count_response', (data) => {
        document.getElementById('clientCount').textContent = data.count;
    });
}

// Request client count from server
function requestClientCount() {
    if (socket) {
        socket.emit('get_clients_count', {});
    }
}

// Initialize WebGL context
function initWebGL() {
    canvas = document.getElementById('live2dCanvas');

    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        alert('Your browser does not support WebGL');
        return false;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
}

// Matrix operations for 3D transformations
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

    getScale() {
        return this.tr[0];
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

// Apply model state from server
function applyModelState(state) {
    if (!state) return;
    console.log('Applying model state:', state);
    
    if (state.parameters) {
        Object.entries(state.parameters).forEach(([param, value]) => {
            updateParameter(param, value);
        });
    }

    if (state.expressions) {
        Object.entries(state.expressions).forEach(([expr, active]) => {
            setExpression(expr, active);
        });
    }
}

// Update parameter value
function updateParameter(paramId, value) {
    if (!live2dModel) return;
    
    const paramIndex = live2dModel.getParameterIndex(paramId);
    if (paramIndex >= 0) {
        live2dModel.setParameterValue(paramIndex, value);
        console.log(`Updated parameter ${paramId} = ${value}`);
    } else {
        console.warn(`Parameter ${paramId} not found in model`);
    }
}

// Set expression state
function setExpression(expression, active) {
    // Expressions are handled differently depending on the model
    console.log(`Expression ${expression}: ${active ? 'On' : 'Off'}`);
}

// Initialize UI controls
function initControls() {
    const sliders = {
        'angleX': 'ParamAngleX',
        'angleY': 'ParamAngleY',
        'eyeOpen': 'ParamEyeLOpen',
        'mouthOpen': 'ParamMouthOpenY'
    };

    Object.entries(sliders).forEach(([sliderId, paramId]) => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(sliderId + 'Value');

        if (slider && valueSpan) {
            slider.addEventListener('input', function() {
                const value = parseFloat(this.value);
                valueSpan.textContent = value.toFixed(2);

                if (socket) {
                    socket.emit('set_parameter', {
                        id: paramId,
                        value: value
                    });
                }
                
                // Update the parameter immediately for smooth interaction
                updateParameter(paramId, value);
            });
        }
    });

    document.querySelectorAll('.expr-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const expr = this.dataset.expr;
            const isActive = !this.classList.contains('active');

            this.classList.toggle('active');

            if (socket) {
                socket.emit('set_expression', {
                    expression: expr,
                    active: isActive
                });
            }
        });
    });

    document.querySelectorAll('.motion-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const group = this.dataset.group;

            if (socket) {
                socket.emit('play_motion', {
                    group: group,
                    index: 0,
                    priority: 3
                });
            }
        });
    });
}

// Load texture image
function loadTexture(gl, path) {
    return new Promise((resolve, reject) => {
        const texture = gl.createTexture();
        const image = new Image();
        
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            resolve(texture);
        };
        
        image.onerror = function() {
            reject(new Error(`Failed to load texture: ${path}`));
        };
        
        image.src = path;
    });
}

// Create shader
function createShader(gl, type, source) {
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

// Create shader program
function createShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    
    return shaderProgram;
}

// Initialize shader program
function initShaderProgram() {
    // Vertex shader source
    const vsSource = `
        attribute vec4 a_position;
        attribute vec2 a_texCoord;
        uniform mat4 u_mvpMatrix;
        varying vec2 v_texCoord;
        
        void main() {
            gl_Position = u_mvpMatrix * a_position;
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
    
    // Create shader program
    program = createShaderProgram(gl, vsSource, fsSource);
    
    if (!program) {
        console.error('Failed to create shader program');
        return false;
    }
    
    // Get attribute and uniform locations
    shaderLocations = {
        vertexPositionAttribute: gl.getAttribLocation(program, 'a_position'),
        textureCoordAttribute: gl.getAttribLocation(program, 'a_texCoord'),
        mvpMatrixUniform: gl.getUniformLocation(program, 'u_mvpMatrix'),
        textureUniform: gl.getUniformLocation(program, 'u_texture'),
        opacityUniform: gl.getUniformLocation(program, 'u_opacity')
    };
    
    return true;
}

// Load and render the Live2D model
async function loadModel() {
    try {
        console.log('Loading model from:', MODEL_PATH);
        
        // Fetch the model JSON file
        const response = await fetch(MODEL_PATH);
        if (!response.ok) {
            throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
        }
        
        const modelData = await response.json();
        const modelPath = `${MODEL_DIR}/${modelData.FileReferences.Moc}`;
        
        // Load the moc3 file
        const mocResponse = await fetch(modelPath);
        const mocArrayBuffer = await mocResponse.arrayBuffer();
        
        // Validate that Live2D Core is available
        if (typeof Live2DCubismCore === 'undefined') {
            throw new Error('Live2D Core library not loaded');
        }
        
        // Create the model
        const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocArrayBuffer);
        const model = Live2DCubismCore.Model.fromMoc(moc);
        
        // Set up the Live2D model
        live2dModel = model;
        
        // Load textures
        const texPaths = modelData.FileReferences.Textures.map(tex => `${MODEL_DIR}/${tex}`);
        for (const texPath of texPaths) {
            const texture = await loadTexture(gl, texPath);
            textures.push(texture);
        }
        
        // Initialize shader program
        if (!initShaderProgram()) {
            throw new Error('Failed to initialize shader program');
        }
        
        console.log('✓ Model loaded successfully');
        
        // Initialize matrices
        modelViewMatrix = new Matrix44();
        projectionMatrix = new Matrix44();
        
        // Set up initial model position and scale
        const scale = Math.min(canvas.width, canvas.height) / 2.0;
        modelViewMatrix.updateScale(scale, scale);
        modelViewMatrix.translate(canvas.width / 2.0, canvas.height / 2.0);
        
        // Start the render loop
        function renderLoop(time) {
            renderFrame(time);
            requestAnimationFrame(renderLoop);
        }
        
        requestAnimationFrame(renderLoop);
        
    } catch (error) {
        console.error('Failed to load model:', error);
        alert('Failed to load Live2D model. Check console for details.');
    }
}

// Render frame function
function renderFrame(time) {
    if (!live2dModel) return;
    
    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Update model
    live2dModel.update();
    
    // Use shader program
    gl.useProgram(program);
    
    // Get model parameters and draw
    const drawCount = live2dModel.getDrawableCount();
    
    for (let i = 0; i < drawCount; ++i) {
        try {
            // Get opacity
            const opacity = live2dModel.getDrawableOpacity(i);
            
            // Get vertex positions
            const vertices = live2dModel.getDrawableVertices(i);
            
            // Get texture index
            const textureIndex = live2dModel.getDrawableTextureIndices(i);
            
            // Get vertex index count
            const indexCount = live2dModel.getDrawableVertexIndexCount(i);
            const indicesArray = live2dModel.getDrawableVertexIndices(i);
            
            // Validate data exists
            if (!vertices || !indicesArray || textureIndex >= textures.length) {
                continue;
            }
            
            // Create vertex buffer
            const vertexBuffer = gl.createBuffer();
            if (!vertexBuffer) {
                console.error('Failed to create vertex buffer');
                continue;
            }
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            
            // Enable vertex attributes
            if (shaderLocations.vertexPositionAttribute !== -1) {
                gl.enableVertexAttribArray(shaderLocations.vertexPositionAttribute);
                gl.vertexAttribPointer(shaderLocations.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
            }
            
            // Create index buffer
            const indexBuffer = gl.createBuffer();
            if (!indexBuffer) {
                console.error('Failed to create index buffer');
                gl.deleteBuffer(vertexBuffer);
                continue;
            }
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicesArray), gl.STATIC_DRAW);
            
            // Set texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex]);
            if (shaderLocations.textureUniform !== -1) {
                gl.uniform1i(shaderLocations.textureUniform, 0);
            }
            
            // Set opacity
            if (shaderLocations.opacityUniform !== -1) {
                gl.uniform1f(shaderLocations.opacityUniform, opacity);
            }
            
            // Set MVP matrix
            const mvpMatrix = new Matrix44();
            mvpMatrix.multiply(projectionMatrix);
            mvpMatrix.multiply(modelViewMatrix);
            if (shaderLocations.mvpMatrixUniform !== -1) {
                gl.uniformMatrix4fv(shaderLocations.mvpMatrixUniform, false, mvpMatrix.getArray());
            }
            
            // Draw elements
            gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
            
            // Clean up buffers
            gl.deleteBuffer(vertexBuffer);
            gl.deleteBuffer(indexBuffer);
            
        } catch (error) {
            console.error(`Error drawing drawable ${i}:`, error);
        }
    }
}

// Initialize the application
async function initApp() {
    // Initialize WebGL
    if (!initWebGL()) {
        console.error('Failed to initialize WebGL');
        return;
    }
    
    // Initialize socket
    initSocket();
    
    // Initialize controls
    initControls();
    
    // Load the model
    await loadModel();
    
    // Set up periodic client count updates
    setInterval(requestClientCount, 1000); // Update every second
}

// Start the application when the page loads
window.addEventListener('load', initApp);