const Application = PIXI.Application;
const Loader = PIXI.Loader;

// Global variables
let app = null;
let live2dModel = null;
let isDragging = false;
let dragEnabled = false;

// Initialize PIXI Application
function initApp() {
    if (app) return;

    try {
        app = new Application({
            view: document.getElementById('canvas'),
            backgroundColor: 0x0f0c29,
            transparent: true,
            resizeTo: window,
            resolution: window.devicePixelRatio || 1
        });

        window.addEventListener('resize', () => {
            if (app) {
                app.renderer.resize(window.innerWidth, window.innerHeight);
                if (live2dModel) positionModel();
            }
        });

        console.log('✅ PIXI Application created (v6)');

    } catch (error) {
        console.error('PIXI init error:', error);
        updateStatus(`❌ PIXI error: ${error.message}`);

        // Fallback: Try alternative PIXI access
        if (typeof Application === 'undefined') {
            alert('PIXI not loaded! Check network tab for 404 errors.');
        }
    }
}

// Position model in center
function positionModel() {
    if (!live2dModel || !app) return;

    live2dModel.position.set(app.screen.width / 2, app.screen.height * 0.75);
    const scale = Math.min(
        app.screen.width / live2dModel.width,
        app.screen.height / live2dModel.height
    ) * 0.7;
    live2dModel.scale.set(scale);
}

// Load model function - modelPath from index.html - \models\huohuo\huohuo.model3.json
async function loadModel(modelPath) {
    updateStatus(`Loading: ${modelPath}...`);

    try {
        initApp();

        // Clear previous model
        if (live2dModel) {
            app.stage.removeChild(live2dModel);
            live2dModel.destroy();
            live2dModel = null;
        }

        live2dModel = await PIXI.live2d.Live2DModel.from(modelPath);

        app.stage.addChild(live2dModel);
        positionModel();
        setupInteraction();

        // Enable motion buttons
        document.querySelectorAll('#motion-buttons button').forEach(btn => {
            btn.disabled = false;
        });

        updateStatus(`✅ Model loaded!`);

    } catch (error) {
        console.error('Model load error:', error);
        updateStatus(`❌ Failed: ${error.message}`);
        alert(`Error: ${error.message}\n\nCheck browser console (F12)`);
    }
}

// Setup interaction
function setupInteraction() {
    if (!live2dModel) return;

    live2dModel.interactive = true;

    live2dModel.on('pointerdown', (e) => {
        if (dragEnabled) {
            isDragging = true;
            document.body.style.cursor = 'grabbing';
        }
    });

    live2dModel.on('pointermove', (e) => {
        if (isDragging && dragEnabled && live2dModel.internalModel?._model?._dragManager) {
            const { x, y } = e.data.global;
            const dx = (x - app.screen.width / 2) * 0.01;
            const dy = (y - app.screen.height / 2) * 0.01;
            live2dModel.internalModel._model._dragManager.adjustDrag(dx, dy);
        }
    });

    live2dModel.on('pointerup', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });

    live2dModel.on('pointerupoutside', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });

    // Tap interaction
    live2dModel.on('hit', (areas) => {
        if (!dragEnabled && !isDragging) {
            const bodyHits = ['Body', 'body', 'Head', 'head'];
            if (areas.some(a => bodyHits.includes(a))) {
                playMotion('tap_body');
            }
        }
    });
}

function playMotion(group) {
    if (!live2dModel) {
        updateStatus('⚠️ No model loaded');
        return;
    }

    try {
        const motions = live2dModel.motions;
        if (motions?.[group]?.[0] !== undefined) {
            live2dModel.motion(group, 0);
            updateStatus(`▶️ ${group}`);
        } else {
            // Try common aliases
            const aliases = [group, group.toLowerCase(), 'TapBody', 'tapBody', 'FlickHead', 'flickHead'];
            for (const alias of aliases) {
                if (motions?.[alias]?.[0] !== undefined) {
                    live2dModel.motion(alias, 0);
                    updateStatus(`▶️ ${alias}`);
                    return;
                }
            }
            updateStatus(`⚠️ No ${group} motion`);
        }
    } catch (e) {
        console.error('Motion error:', e);
        updateStatus(`❌ ${e.message}`);
    }
}

function resetView() {
    if (live2dModel?.internalModel?._model?._dragManager) {
        live2dModel.internalModel._model._dragManager.adjustDrag(0, 0);
        updateStatus('🔄 Reset');
    }
}

function toggleDragging() {
    dragEnabled = !dragEnabled;
    document.getElementById('drag-status').textContent = dragEnabled ? 'ON' : 'OFF';
    updateStatus(`Drag: ${dragEnabled ? 'ON' : 'OFF'}`);
}

function updateStatus(msg) {
    document.getElementById('status').textContent = msg;
}

console.log('🔍 PIXI version check:');
console.log('PIXI global:', typeof PIXI);
console.log('PIXI.Application:', typeof PIXI.Application);
console.log('PIXI version:', PIXI.VERSION);
console.log('Live2D available:', !!PIXI.live2d);

updateStatus('✅ Ready! Click "Load Haru" to start');