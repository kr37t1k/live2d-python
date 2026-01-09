// Live2D Python - JavaScript Client
// Handles Live2D model rendering and communication with the server

const MODEL_PATH = 'web/models/Hiyori/Hiyori.model3.json';
const WS_URL = window.location.origin;

console.log('Live2D Core available:', typeof Live2DCubismCore);
console.log('Socket URL:', WS_URL);

let socket;
let live2dRenderer = null;

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
function setParameterValue(model, paramName, value) {
        const index = getParameterIndex(model.parameters, paramName);
        if (index !== -1) {
            model.parameters.values[index] = Math.max(-1, Math.min(1, value));
//            console.log(`Set ${paramName}[${index}] = ${value}`);
            return true;
        }
        return false;
    }
function getParameterIndex(parameters, paramName) {
    if (!parameters || !parameters.ids) {
        console.warn('Parameters object or parameter names (ids) not available');
        const predictedNames = [
            'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
            'ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeBallX', 'ParamEyeBallY',
            'ParamBrowLY', 'ParamBrowRY', 'ParamMouthOpenY',
            'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ'
        ];

        for (let i = 0; i < Math.min(predictedNames.length, parameters.count); i++) {
            if (predictedNames[i] === paramName) {
//                console.log(`Found predicted parameter "${paramName}" at index ${i}`);
                return i;
            }
        }

        const variations = [
            String(paramName),
            String(paramName).toLowerCase(),
            String(paramName).toUpperCase(),
            'Param' + String(paramName).replace('Param', ''),
            String(paramName).replace('Param', 'Param')
        ];

        for (let i = 0; i < parameters.count; i++) {
            const currentName = `Param_${i}`;
            for (const variation of variations) {
                if (currentName.includes(variation) || variation.includes(currentName)) {
//                    console.log(`Matched parameter "${paramName}" ~ "${currentName}" at index ${i}`);
                    return i;
                }
            }
        }

        return -1;
    }

    for (let i = 0; i < parameters.ids.length; i++) {
        if (parameters.ids[i] === paramName) {
            return i;
        }
    }

    const searchName = String(paramName).toLowerCase();
    for (let i = 0; i < parameters.ids.length; i++) {
        const currentName = parameters.ids[i].toLowerCase();
        if (currentName.includes(searchName) || searchName.includes(currentName)) {
//            console.log(`Partial match: "${paramName}" -> "${parameters.ids[i]}" at index ${i}`);
            return i;
        }
    }

    console.warn(`Parameter "${paramName}" not found in:`, parameters.ids);
    return -1;
}
// Update parameter value
function updateParameter(paramId, value) {
    if (live2dRenderer) {
        live2dRenderer.setParameter(paramId, value);
        console.log(`Updated parameter ${paramId} = ${value}`);
    }
}

// Set expression state
function setExpression(expression, active) {
    if (live2dRenderer) {
        if (active) {
            live2dRenderer.setExpression(expression);
            console.log(`Expression ${expression}: On`);
        } else {
            console.log(`Expression ${expression}: Off`);
        }
    }
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
            
            // Set expression on the renderer
            if (live2dRenderer) {
                if (isActive) {
                    live2dRenderer.setExpression(expr);
                }
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
            
            // Play motion on the renderer
            if (live2dRenderer) {
                live2dRenderer.playMotion(group, 0, 3);
            }
        });
    });
}

// Load and render the Live2D model
async function loadModel() {
    try {
        console.log('Loading model from:', MODEL_PATH);
        
        // Get the canvas element
        const canvas = document.getElementById('live2dCanvas');
        
        // Create the Live2D renderer
        live2dRenderer = new Live2DRenderer(canvas, {
            premultipliedAlpha: true,
            useHighPrecisionMask: true,
            enableMotions: true,
            enableExpressions: true,
            enablePhysics: true,
            enableLipSync: true,
            autoBreathing: true,
            frameRateLimit: 60
        });
        
        // Setup event listeners
        live2dRenderer.on('loaded', (data) => {
            console.log('✓ Model loaded successfully');
            console.log('Model has motions:', Object.keys(live2dRenderer.motions || {}));
        });
        
        live2dRenderer.on('click', (data) => {
            console.log('Model clicked at:', data.x, data.y);
        });
        
        live2dRenderer.on('motionStart', (data) => {
            console.log('Motion started:', data);
        });
        
        live2dRenderer.on('motionEnd', (data) => {
            console.log('Motion ended:', data);
        });
        
        live2dRenderer.on('error', (data) => {
            console.error('Renderer error:', data.error);
        });
        
        // Load the model
        const success = await live2dRenderer.loadModel(MODEL_PATH);
        
        if (success) {
            // Start the render loop
            live2dRenderer.renderLoop();
        } else {
            console.error('Failed to load model');
        }
        
    } catch (error) {
        console.error('Failed to load model:', error);
        alert('Failed to load Live2D model. Check console for details.');
    }
}

// Initialize the application
async function initApp() {
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