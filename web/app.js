// Live2D Python - JavaScript Client
// Handles Live2D model rendering and communication with the server

globalThis.MODEL_PATH = 'web/models/Hiyori/Hiyori.model3.json';
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
    console.log("Applying model state:", state); 

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

    // Add event listeners to expression buttons
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
            if (globalThis.character2d) {
                if (isActive) {
                    globalThis.character2d.setExpression(expr);
                }
            }
        });
    });

    // Add event listeners to motion buttons
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
            if (globalThis.character2d) {
                globalThis.character2d.playMotion(group, 0, 3);
            }
        });
    });
}

// Dynamically generate expression and motion buttons from model3.json
async function generateModelControls(modelPath) {
    try {
        // Load the model configuration
        const response = await fetch(modelPath);
        if (!response.ok) {
            throw new Error(`Failed to load model config: ${response.status} ${response.statusText}`);
        }
        
        const modelConfig = await response.json();
        
        // Generate motion buttons from motion groups
        if (modelConfig.FileReferences.Motions) {
            generateMotionButtons(modelConfig.FileReferences.Motions);
        }
        
        // Some models have expressions in the Groups section or as special motions
        // Check for expression-like parameters in Groups
        if (modelConfig.Groups) {
            const expressionGroup = modelConfig.Groups.find(group => group.Name === 'Expressions' || group.Name === 'LipSync');
            if (expressionGroup) {
                // Generate expression buttons based on expression parameters
                generateExpressionButtonsFromParameters(expressionGroup.Ids);
            }
        }
        
        // If no expressions were found in the above, try to generate from motions that might be expressions
        if (!document.querySelectorAll('.expr-btn').length) {
            // Look for common expression motion names in the motions
            const motionNames = Object.keys(modelConfig.FileReferences.Motions || {});
            const expressionMotions = motionNames.filter(name => 
                name.toLowerCase().includes('exp') || 
                name.toLowerCase().includes('expression') ||
                ['Idle', 'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10'].includes(name)
            );
            
            if (expressionMotions.length > 0) {
                generateExpressionButtonsFromMotions(expressionMotions);
            }
        }
        
    } catch (error) {
        console.error('Failed to generate model controls:', error);
        // Use fallback buttons
        setupFallbackButtons();
    }
}

// Generate expression buttons from parameters (if available in model config)
function generateExpressionButtonsFromParameters(paramIds) {
    const exprContainer = findExpressionContainer();
    if (!exprContainer) return;
    
    // Clear existing buttons
    exprContainer.innerHTML = '';
    
    paramIds.forEach(paramId => {
        const paramName = paramId.replace('Param', '');
        const button = document.createElement('button');
        button.className = 'expr-btn';
        button.dataset.expr = paramId;
        button.textContent = `😊 ${paramName}`;
        button.addEventListener('click', handleExpressionClick);
        exprContainer.appendChild(button);
    });
}

// Generate expression buttons from motion names that might be expressions
function generateExpressionButtonsFromMotions(motionNames) {
    const exprContainer = findExpressionContainer();
    if (!exprContainer) return;
    
    // Clear existing buttons
    exprContainer.innerHTML = '';
    
    motionNames.forEach(motionName => {
        const button = document.createElement('button');
        button.className = 'expr-btn';
        button.dataset.expr = motionName;
        button.textContent = `😊 ${motionName}`;
        button.addEventListener('click', handleExpressionClick);
        exprContainer.appendChild(button);
    });
}

// Helper function to find expression container
function findExpressionContainer() {
    let exprContainer = document.querySelector('.expression-buttons');
    if (!exprContainer) {
        // Look for a div that contains expression buttons
        const exprSections = document.querySelectorAll('.control-group');
        for (let section of exprSections) {
            if (section.textContent.toLowerCase().includes('expression') || section.querySelector('.expr-btn')) {
                exprContainer = section.querySelector('div') || section;
                break;
            }
        }
    }
    if (!exprContainer) {
        exprContainer = document.querySelector('.expr-btn')?.parentElement;
    }
    return exprContainer;
}

// Generate expression buttons from expression files
function generateExpressionButtons(expressions) {
    // Find expression container by looking for elements with class or text
    let exprContainer = document.querySelector('.expression-buttons');
    if (!exprContainer) {
        // Look for a div that contains expression buttons
        const exprSections = document.querySelectorAll('.control-group');
        for (let section of exprSections) {
            if (section.textContent.includes('Expression') || section.querySelector('.expr-btn')) {
                exprContainer = section.querySelector('div') || section;
                break;
            }
        }
    }
    if (!exprContainer) {
        exprContainer = document.querySelector('.expr-btn')?.parentElement;
    }
    
    if (!exprContainer) return;
    
    exprContainer.innerHTML = ''; // Clear existing buttons
    
    expressions.forEach(expr => {
        const exprName = expr.File.split('/').pop().replace('.exp3.json', '');
        const button = document.createElement('button');
        button.className = 'expr-btn';
        button.dataset.expr = exprName;
        button.textContent = `😊 ${exprName}`;
        button.addEventListener('click', handleExpressionClick);
        exprContainer.appendChild(button);
    });
}

// Generate motion buttons from motion groups
function generateMotionButtons(motions) {
    // Find motion container by looking for elements with class or text
    let motionContainer = document.querySelector('.motion-buttons');
    if (!motionContainer) {
        // Look for a div that contains motion buttons
        const motionSections = document.querySelectorAll('.control-group');
        for (let section of motionSections) {
            if (section.textContent.toLowerCase().includes('motion') || section.querySelector('.motion-btn')) {
                motionContainer = section.querySelector('div') || section;
                break;
            }
        }
    }
    if (!motionContainer) {
        motionContainer = document.querySelector('.motion-btn')?.parentElement;
    }
    
    if (!motionContainer) return;
    
    motionContainer.innerHTML = ''; // Clear existing buttons
    
    Object.keys(motions).forEach(groupName => {
        const button = document.createElement('button');
        button.className = 'motion-btn';
        button.dataset.group = groupName;
        button.textContent = `🎭 ${groupName}`;
        button.addEventListener('click', handleMotionClick);
        motionContainer.appendChild(button);
    });
}

// Fallback function to set up default buttons if model parsing fails
function setupFallbackButtons() {
    console.log('Using fallback buttons');
    
    // Setup expression buttons
    const exprButtons = [
        { id: 'smile', text: '😊 Smile' },
        { id: 'angry', text: '😠 Angry' },
        { id: 'sad', text: '😢 Sad' },
        { id: 'surprised', text: '😮 Surprised' }
    ];
    
    const exprContainer = document.querySelector('.expression-buttons');
    if (exprContainer) {
        exprContainer.innerHTML = '';
        exprButtons.forEach(expr => {
            const button = document.createElement('button');
            button.className = 'expr-btn';
            button.dataset.expr = expr.id;
            button.textContent = expr.text;
            button.addEventListener('click', handleExpressionClick);
            exprContainer.appendChild(button);
        });
    }
    
    // Setup motion buttons
    const motionButtons = [
        { id: 'idle', text: '💤 Idle' },
        { id: 'TapBody', text: '👈 Tap body' },
        { id: 'Shake', text: '👋 Wave' }
    ];
    
    const motionContainer = document.querySelector('.motion-buttons');
    if (motionContainer) {
        motionContainer.innerHTML = '';
        motionButtons.forEach(motion => {
            const button = document.createElement('button');
            button.className = 'motion-btn';
            button.dataset.group = motion.id;
            button.textContent = motion.text;
            button.addEventListener('click', handleMotionClick);
            motionContainer.appendChild(button);
        });
    }
}

// Handle expression button click
function handleExpressionClick(e) {
    const expr = e.target.dataset.expr;
    const isActive = !e.target.classList.contains('active');
    
    e.target.classList.toggle('active');
    
    if (socket) {
        socket.emit('set_expression', {
            expression: expr,
            active: isActive
        });
    }
    
    // Set expression on the renderer
    if (globalThis.character2d) {
        if (isActive) {
            globalThis.character2d.setExpression(expr);
        }
    }
}

// Handle motion button click
function handleMotionClick(e) {
    const group = e.target.dataset.group;
    
    if (socket) {
        socket.emit('play_motion', {
            group: group,
            index: 0,
            priority: 3
        });
    }
    
    // Play motion on the renderer
    if (globalThis.character2d) {
        globalThis.character2d.playMotion(group, 0, 3);
    }
}

// Load and render the Live2D model
async function loadModel() {
    try {
        console.log('Loading model from:', MODEL_PATH);
        
        // Get the canvas element
        globalThis.live2dCanvas = document.getElementById('live2dCanvas');
        
        // Check if Live2DDesktopMate exists
        if (typeof Live2DDesktopMate === 'undefined') {
            console.error('Live2DDesktopMate is not defined. Make sure Live2DWrapper.js is loaded.');
            showModelError('Live2D library not loaded');
            return;
        }
        
        // Create the desktop mate instance
        globalThis.character2d = new Live2DDesktopMate({
            container: '#live2dCanvas',
            width: 400,
            height: 600,
            modelPath: MODEL_PATH
        });
        
        console.log('Live2DDesktopMate instance created, now loading model...');
        
        // Load the model using the full model3.json path
        const success = await globalThis.character2d.loadModel(MODEL_PATH);
        if (success) {
            // Start the render loop
            globalThis.character2d.startAnimation(); //live2dRenderer is autoUpdate - true
            console.log('Model loaded and animation started successfully');
        } else {
            console.error('Failed to load model');
            showModelError('Failed to load Live2D model');
        }
        
    } catch (error) {
        console.error('Failed to load model:', error);
        console.error('Error details:', error.message, error.stack);
        console.error('Model path:', MODEL_PATH);
        
        // Check if core library is loaded
        if (typeof Live2DCubismCore === 'undefined') {
            console.error('Live2DCubismCore is not loaded!');
        } else {
            console.log('Live2DCubismCore is loaded');
        }
        
        showModelError('Failed to load Live2D model. Check console for details.');
    }
}

// Show error message in the UI
function showModelError(message) {
    const canvas = document.getElementById('live2dCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'red';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    }
    console.error(message);
}

// Initialize the application
async function initApp() {
    // Initialize socket
    initSocket();
    
    // Load the model first
    await loadModel();
    
    // Initialize controls after model is loaded
    initControls();
    
    // Generate dynamic controls based on the model
    await generateModelControls(MODEL_PATH);
    
    // Set up periodic client count updates
    setInterval(requestClientCount, 10000); // Update every second
}

// Start the application when the page loads
window.addEventListener('load', initApp);
