const MODEL_PATH = 'web/models/Hiyori/Hiyori.moc3';
const MODEL_DIR = MODEL_PATH.substring(0, MODEL_PATH.lastIndexOf('/'));
const WS_URL = window.location.origin;

console.log('Core:', typeof Live2DCubismCore);
console.log('Framework:', typeof cubismframework);
console.log('Renderer:', typeof cubismrenderer);

let socket;
let canvas, gl;
let currentModel = null;

// --- ВСЕ ФУНКЦИИ ОПРЕДЕЛИ ПЕРЕД ИХ ИСПОЛЬЗОВАНИЕМ ---

// 1. Socket functions
function initSocket() {
    try {
        socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            timeout: 10000
        });
    }
    catch (e) {
        console.warn('Socket connection warn:', e);
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
        console.log('Model state:', data);
        applyModelState(data);
    });

    socket.on('parameter_update', (data) => {
        if (currentModel) {
            updateParameter(data.id, data.value);
        }
    });

    socket.on('expression_update', (data) => {
        if (currentModel) {
            setExpression(data.expression, data.active);
        }
    });

    socket.on('motion_start', (data) => {
        console.log('Launching motion:', data);
    });

    socket.on('connect', updateClientCount);
    socket.on('disconnect', updateClientCount);

    function updateClientCount() {
        socket.emit('get_clients_count', {}, (count) => {
            document.getElementById('clientCount').textContent = count;
        });
    }
}

// 2. WebGL initialization
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
        alert('Your browser not support WebGL');
        return false;
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
}

// 3. Missing functions
function applyModelState(state) {
    if (!state || !currentModel) return;
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

function updateParameter(paramId, value) {
    if (!currentModel) return;
    console.log(`Updating parameter ${paramId} = ${value}`);

    // Здесь будет реальное обновление параметров модели
}

function setExpression(expression, active) {
    if (!currentModel) return;
    console.log(`Expression ${expression}: ${active ? 'On' : 'Off'}`);
}

// 4. Controls initialization
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
function createShaderProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // ПРОВЕРКА ОШИБОК
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Shader link failed:', gl.getProgramInfoLog(program));
        return null;
    }

    // СОЗДАЁМ ОБЪЕКТ С LOCATIONS
    const shaderInfo = {
        program: program,
        attribLocations: {},
        uniformLocations: {}
    };

    // Получаем location ДЛЯ ВСЕХ uniform и attrib
    shaderInfo.attribLocations.aPosition = gl.getAttribLocation(program, 'aPosition');
    shaderInfo.attribLocations.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

    shaderInfo.uniformLocations.uProjection = gl.getUniformLocation(program, 'uProjection');
    shaderInfo.uniformLocations.uColor = gl.getUniformLocation(program, 'uColor');
    shaderInfo.uniformLocations.uTexture = gl.getUniformLocation(program, 'uTexture');

    console.log('Shader created with locations:', shaderInfo);
    return shaderInfo;
}
// 2. WebGL initialization
async function loadModel() {
    const canvas = document.getElementById('live2dCanvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    let globalScale = 1.25;
    let shaderInfo = null;

    try {
        const vs = `
            attribute vec2 aPosition;
            uniform mat4 uProjection;
            void main() {
                gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
            }
        `;

        const fs = `
            precision mediump float;
            uniform vec4 uColor;
            void main() {
                gl_FragColor = uColor;
            }
        `;

        shaderInfo = createShaderProgram(gl, vs, fs);

        if (!shaderInfo) {
            throw new Error('Failed to create shader');
        }
    } catch (error) {
        console.error('Shader creation failed:', error);
        return null;
    }
    try {
        const response = await fetch(MODEL_PATH);
        const arrayBuffer = await response.arrayBuffer();
        const moc = Live2DCubismCore.Moc.fromArrayBuffer(arrayBuffer);
        const model = Live2DCubismCore.Model.fromMoc(moc);
        const drawables = model.drawables;

        console.log('✓ Model loaded, drawables:', drawables.count);

        // 2. ЗАГРУЖАЕМ ТЕКСТУРЫ
        const textures = await loadModelTextures(gl, MODEL_DIR);
        console.log('✓ Textures loaded:', textures.length);

        // 3. Создаём шейдер (простой, без текстур для начала)
        if (!shaderInfo) {
            throw new Error('Failed to create shader');
        }

        // 4. Создаём буферы
        const buffers = createModelBuffers(gl, drawables);

        // 5. Запускаем рендер с ВСЕМИ параметрами
        function animate(time) {
            renderFrame(
                gl,
                model,
                drawables,
                shaderInfo,
                buffers,
                textures  // <-- передаём текстуры
            );
            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);

        return {
            model: model,
            drawables: drawables,
            textures: textures,
            shader: shaderInfo,
            buffers: buffers
        };

    } catch (error) {
        console.error('Load model failed:', error);
        return null;
    };
};
async function loadModel_pause () {
    try {
        console.log('Loading model...');
        const response = await fetch(MODEL_PATH);
        const arrayBuffer = await response.arrayBuffer();
        const moc = Live2DCubismCore.Moc.fromArrayBuffer(arrayBuffer);
        const model = Live2DCubismCore.Model.fromMoc(moc);

        console.log('✓ Model created, Drawables:', model.drawables.count);

        // 1. ПРОВЕРЬ СТРУКТУРУ ДАННЫХ
        const drawables = model.drawables;
        console.log('Drawables structure:', {
            vertexPositions: drawables.vertexPositions ? 'Array[' + drawables.vertexPositions.length + ']' : 'MISSING',
            vertexUvs: drawables.vertexUvs ? 'Array[' + drawables.vertexUvs.length + ']' : 'MISSING',
            indices: drawables.indices ? 'Array[' + drawables.indices.length + ']' : 'MISSING',
            opacities: drawables.opacities ? 'Array[' + drawables.opacities.length + ']' : 'MISSING'
        });

        const shader = createLive2DShaderProgram(gl);
        const buffers = createSimpleBuffers(gl, drawables);
        if (shaderInfo && buffers) {
            function animate(time) {
                render(time, gl, model, drawables, shaderInfo, buffers, textures);
                requestAnimationFrame(animate);
            }
            requestAnimationFrame(animate);
        } else {
            console.error('Failed to initialize rendering');
        }



        // 3. АНИМАЦИОННЫЙ ЦИКЛ
        function render(time) {
            if (model.parameters && model.parameters.values) {
                const timeSec = performance.now() * 0.001;
                model.parameters.values[0] = Math.sin(timeSec * 1.5) * 0.2;

                const blink = Math.sin(timeSec * 3) > 0.9 ? 0.2 : 1.0;
                if (model.parameters.values[3] !== undefined) model.parameters.values[3] = blink;
                if (model.parameters.values[4] !== undefined) model.parameters.values[4] = blink;

                if (model.parameters.values[10] !== undefined) {
                    model.parameters.values[10] = Math.sin(timeSec * 0.8) * 0.05;
                }
            }

            gl.clearColor(0.1, 0.1, 0.15, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            if (!shaderInfo || !shaderInfo.program) {
                    console.error('Shader not initialized!');
                    return;
                }

            gl.useProgram(shaderInfo.program);

            // Используй КЭШИРОВАННЫЕ location
            if (shaderInfo.uniformLocations.uProjection) {
                gl.uniformMatrix4fv(shaderInfo.uniformLocations.uProjection, false, projectionMatrix);
            }

            // Для атрибутов
            if (shaderInfo.attribLocations.aPosition !== -1) {
                gl.enableVertexAttribArray(shaderInfo.attribLocations.aPosition);

            const canvas = gl.canvas;
            const modelBounds = calculateModelBounds(drawables);

            const targetScale = globalScale;
            const scaleX = targetScale * 2 / (modelBounds.width || 0.1);
            const scaleY = targetScale * 2 / (modelBounds.height || 0.1);
            const scale = Math.min(scaleX, scaleY) * targetScale;

            const offsetX = -modelBounds.centerX;
            const offsetY = -modelBounds.centerY;

            const projectionMatrix = new Float32Array([
                scale, 0, 0, 0,
                0, scale, 0, 0,
                0, 0, 1, 0,
                offsetX * scale, offsetY * scale, 0, 1
            ]);

            // Униформа проекции
            const uProjLoc = gl.getUniformLocation(program, 'uProjection');
            if (uProjLoc) gl.uniformMatrix4fv(uProjLoc, false, projectionMatrix);

            let visibleDrawables = 0;

            for (let i = 0; i < drawables.count; i++) {
                if (!drawables.vertexPositions[i] || !drawables.indices[i]) continue;
                if (drawables.opacities && drawables.opacities[i] <= 0.01) continue;

                // ВАЖНО: Привязка вершин ВСЕГДА нужна
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffers[i]);
                const aPosLoc = gl.getAttribLocation(program, 'aPosition');
                if (aPosLoc !== -1) {
                    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
                    gl.enableVertexAttribArray(aPosLoc);
                }

                // UV координаты (только если есть и шейдер поддерживает)
                if (useTextures && buffers.uvBuffers[i]) {
                    const aTexLoc = gl.getAttribLocation(program, 'aTexCoord');
                    if (aTexLoc !== -1) {
                        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uvBuffers[i]);
                        gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 0, 0);
                        gl.enableVertexAttribArray(aTexLoc);
                    }
                }

                // Текстура (только если есть)
                if (useTextures && textures[i % textures.length]) {
                    const uTexLoc = gl.getUniformLocation(program, 'uTexture');
                    if (uTexLoc !== -1) {
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, textures[i % textures.length]);
                        gl.uniform1i(uTexLoc, 0);
                    }
                }

                // Индексы
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffers[i]);

                // Цвет/прозрачность
                const opacity = drawables.opacities ? drawables.opacities[i] : 1.0;
                const uColorLoc = gl.getUniformLocation(program, 'uColor');
                if (uColorLoc) {
                    if (useTextures) {
                        gl.uniform4f(uColorLoc, 1.0, 1.0, 1.0, opacity); // Белый для текстур
                    } else {
                        // Разные цвета для отладки
                        const hue = (i * 137) % 360;
                        const color = hslToRgb(hue / 360, 0.8, 0.6);
                        gl.uniform4f(uColorLoc, color.r, color.g, color.b, opacity);
                    }
                }

                // Рисуем
                const indexCount = drawables.indices[i].length / 2;
                gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

                // Очистка
                if (aPosLoc !== -1) gl.disableVertexAttribArray(aPosLoc);
                const aTexLoc = gl.getAttribLocation(program, 'aTexCoord');
                if (aTexLoc !== -1) gl.disableVertexAttribArray(aTexLoc);

                visibleDrawables++;
            }

        gl.disable(gl.BLEND);
        requestAnimationFrame(render);
}

// Функция расчёта границ модели
function calculateModelBounds(drawables) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let totalVertices = 0;

    for (let i = 0; i < drawables.count; i++) {
        const verts = drawables.vertexPositions[i];
        if (!verts) continue;

        totalVertices += verts.length / 2;

        for (let j = 0; j < verts.length; j += 2) {
            const x = verts[j];
            const y = verts[j + 1];

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    return {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        totalVertices
    };
}

// Цвета для разных типов drawables
function getDrawableColor(index, drawables) {
    // Проверяем по прозрачности
    const opacity = drawables.opacities ? drawables.opacities[index] : 1.0;

    if (opacity < 0.3) {
        return [0.3, 0.3, 0.8, opacity]; // синий для полупрозрачных
    }

    // Цветовая схема в зависимости от индекса
    const hue = (index * 137) % 360;
    const rgb = hslToRgb(hue / 360, 0.8, 0.6);

    return [rgb.r, rgb.g, rgb.b, opacity];
}

// HSL to RGB (возвращает объект)
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { r, g, b };
}


        // ЗАПУСКАЕМ
        requestAnimationFrame(render);

        console.log('=== DEBUG INFO ===');
        for (let i = 0; i < Math.min(3, drawables.count); i++) {
            const verts = drawables.vertexPositions[i];
            const indices = drawables.indices[i];
            console.log(`Drawable ${i}: ${verts.length/2} vertices, ${indices.length/2} indices`);

            // Первые 3 вершины
            console.log(`  First 3 vertices:`);
            for (let v = 0; v < Math.min(6, verts.length); v += 2) {
                console.log(`    (${verts[v].toFixed(2)}, ${verts[v+1].toFixed(2)})`);
            }
        }
        // 4. ВОЗВРАЩАЕМ КОНТРОЛЛЕР
        return {
            model: model,
            drawables: drawables,
            setParameter: function(index, value) {
                if (model.parameters && index < model.parameters.count) {
                    model.parameters.values[index] = value;
            }}
        };}
    } catch (e) {console.warn(e);}
}
window.changeScale = function(factor) {
    const scaleElement = document.getElementById('debugInfo');
    if (scaleElement) {
        // Обновим scale в следующем кадре
        // Нужно сделать scale глобальной переменной
        console.log('Change scale by', factor);
    }
};

// СОЗДАНИЕ БУФЕРОВ
function createSimpleBuffers(gl, drawables) {
    const vertexBuffers = [];
    const uvBuffers = [];
    const indexBuffers = [];

    for (let i = 0; i < drawables.count; i++) {
        // VERTEX BUFFER
        if (drawables.vertexPositions[i]) {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, drawables.vertexPositions[i], gl.STATIC_DRAW);
            vertexBuffers.push(buffer);
        } else {
            vertexBuffers.push(null);
        }

        // UV BUFFER
        if (drawables.vertexUvs && drawables.vertexUvs[i]) {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, drawables.vertexUvs[i], gl.STATIC_DRAW);
            uvBuffers.push(buffer);
        } else {
            uvBuffers.push(null);
        }

        // INDEX BUFFER
        if (drawables.indices[i]) {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawables.indices[i], gl.STATIC_DRAW);
            indexBuffers.push(buffer);
        } else {
            indexBuffers.push(null);
        }
    }

    return { vertexBuffers, uvBuffers, indexBuffers };
}
// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РЕНДЕРИНГА ==========
// ФУНКЦИЯ ЗАГРУЗКИ ТЕКСТУР
async function loadModelTextures(gl, modelDir) {
    const textures = [];
    let textureFiles = [];
    try {
        const modelInfoRes = await fetch(MODEL_PATH.replace('.moc3', '.model3.json'));
        const modelInfo = await modelInfoRes.json();
        if (modelInfo.FileReferences?.Textures) {
            textureFiles = modelInfo.FileReferences.Textures;
            console.log('Found texture paths in .model3.json:', textureFiles);
        }
    } catch (e) {
        console.log('No .model3.json, trying default texture names');
    }

    // Если не нашли через JSON, пробуем стандартные имена
    if (textureFiles.length === 0) {
        textureFiles = [
            'texture_00.png',
            'texture_01.png',
            'texture_02.png',
            '00.png',
            '01.png',
            'textures/texture_00.png',
            'textures/00.png'
        ];
    }

    // Загружаем каждую текстуру
    for (const texFile of textureFiles) {
        try {
            const fullPath = `${modelDir}/${texFile}`;
            const texture = await loadTexture(gl, fullPath);
            textures.push(texture);
            console.log(`✓ Texture loaded: ${texFile}`);

            // Обычно хватает 1-2 текстур
            if (textures.length >= 2) break;
        } catch (error) {
            // Пробуем следующий файл
            continue;
        }
    }

    // Если ни одна текстура не загрузилась - создаём белую заглушку
    if (textures.length === 0) {
        console.warn('No textures found, creating white placeholder');
        textures.push(createWhiteTexture(gl));
    }

    return textures;
}
// Загрузка текстуры
function loadTexture(gl, url) {
    return new Promise((resolve, reject) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Временная белая текстура
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255]));

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            resolve(texture);
        };
        img.onerror = reject;
        img.src = url;
    });
}
function createWhiteTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255]));
    return texture;
}

// Создание буферов модели
function createModelBuffers(gl, drawables) {
    const vertexBuffers = [];
    const uvBuffers = [];
    const indexBuffers = [];

    for (let i = 0; i < drawables.count; i++) {
        // Вершины
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, drawables.vertexPositions[i], gl.DYNAMIC_DRAW);
        vertexBuffers.push(vertexBuffer);

        // UV координаты
        const uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, drawables.vertexUvs[i], gl.STATIC_DRAW);
        uvBuffers.push(uvBuffer);

        // Индексы
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawables.indices[i], gl.STATIC_DRAW);
        indexBuffers.push(indexBuffer);
    }

    return { vertexBuffers, uvBuffers, indexBuffers };
}

// Шейдер для Live2D
function createLive2DShaderProgram(gl) {
     const vs = `
        attribute vec2 aPosition;
        attribute vec2 aTexCoord;
        varying vec2 vTexCoord;
        uniform mat4 uProjection;

        void main() {
            gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
            vTexCoord = aTexCoord;
        }
    `;

    const fs = `
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D uTexture;
        uniform float uOpacity;
        uniform vec4 uMultiplyColor;

        void main() {
            vec4 texColor = texture2D(uTexture, vTexCoord);
            gl_FragColor = vec4(texColor.rgb * uMultiplyColor.rgb, texColor.a * uMultiplyColor.a * uOpacity);
        }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vs);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fs);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Сохраняем location для быстрого доступа
    program.locations = {
        aPosition: gl.getAttribLocation(program, 'aPosition'),
        aTexCoord: gl.getAttribLocation(program, 'aTexCoord'),
        uProjection: gl.getUniformLocation(program, 'uProjection'),
        uModelView: gl.getUniformLocation(program, 'uModelView'),
        uTexture: gl.getUniformLocation(program, 'uTexture'),
        uColor: gl.getUniformLocation(program, 'uColor'),
        uOpacity: gl.getUniformLocation(program, 'uOpacity')
    };

    return program;
}

// РЕНДЕР КАДРА (обновлённый)
function renderFrame(gl, model, drawables, shaderInfo, buffers, textures) {
    // Проверяем что всё есть
    if (!gl || !shaderInfo || !shaderInfo.program) {
        console.error('Missing GL or shader');
        return;
    }

    // Очистка
    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Используем шейдер
    gl.useProgram(shaderInfo.program);

    // Проекционная матрица (простая)
    const scale = 40;
    const projectionMatrix = new Float32Array([
        scale, 0, 0, 0,
        0, -scale, 0, 0, // Y инвертирован для WebGL
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);

    // Устанавливаем uniform
    if (shaderInfo.uniformLocations.uProjection) {
        gl.uniformMatrix4fv(shaderInfo.uniformLocations.uProjection, false, projectionMatrix);
    }

    // Рисуем каждый drawable
    for (let i = 0; i < drawables.count; i++) {
        if (!drawables.vertexPositions[i] || !drawables.indices[i]) continue;

        // Привязываем вершины
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffers[i]);
        gl.enableVertexAttribArray(shaderInfo.attribLocations.aPosition);
        gl.vertexAttribPointer(shaderInfo.attribLocations.aPosition, 2, gl.FLOAT, false, 0, 0);

        // Привязываем индексы
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffers[i]);

        // Цвет (белый для начала)
        if (shaderInfo.uniformLocations.uColor) {
            const opacity = drawables.opacities ? drawables.opacities[i] : 1.0;
            gl.uniform4f(shaderInfo.uniformLocations.uColor, 1, 1, 1, opacity);
        }

        // Рисуем треугольники
        const indexCount = drawables.indices[i].length / 2;
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

        // Очистка
        gl.disableVertexAttribArray(shaderInfo.attribLocations.aPosition);
    }

    gl.disable(gl.BLEND);
}
function renderLive2DFrameNotWorkingIDK(gl, model, drawables, program, buffers, textures) {
    const canvas = gl.canvas;

    // Ортографическая проекция
    const projectionMatrix = new Float32Array([
        2.0 / canvas.width, 0, 0, 0,
        0, -2.0 / canvas.height, 0, 0,
        0, 0, 1, 0,
        -1, 1, 0, 1
    ]);

    // Матрица модели (можно вращать/масштабировать)
    const modelViewMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);

    // Очистка
    gl.clearColor(0.2, 0.2, 0.3, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Используем шейдер
    gl.useProgram(program);

    // Устанавливаем uniform'ы
    gl.uniformMatrix4fv(program.locations.uProjection, false, projectionMatrix);
    gl.uniformMatrix4fv(program.locations.uModelView, false, modelViewMatrix);
    gl.uniform4f(program.locations.uColor, 1.0, 1.0, 1.0, 1.0);

    // Рендерим каждый drawable
    for (let i = 0; i < drawables.count; i++) {
        // Пропускаем невидимые
        const opacity = drawables.opacities ? drawables.opacities[i] : 1.0;
        if (opacity <= 0.001) continue;

        // Текстура (берем по кругу если не хватает)
        const texIndex = i % textures.length;
        if (textures[texIndex]) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[texIndex]);
            gl.uniform1i(program.locations.uTexture, 0);
        }

        gl.uniform1f(program.locations.uOpacity, opacity);

        // Вершины
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffers[i]);
        gl.enableVertexAttribArray(program.locations.aPosition);
        gl.vertexAttribPointer(program.locations.aPosition, 2, gl.FLOAT, false, 0, 0);

        // UV координаты
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uvBuffers[i]);
        gl.enableVertexAttribArray(program.locations.aTexCoord);
        gl.vertexAttribPointer(program.locations.aTexCoord, 2, gl.FLOAT, false, 0, 0);

        // Индексы
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffers[i]);

        // Отрисовка
        const indexCount = drawables.indexCounts ?
            drawables.indexCounts[i] :
            drawables.indices[i].length;

        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

        // Отключаем атрибуты
        gl.disableVertexAttribArray(program.locations.aPosition);
        gl.disableVertexAttribArray(program.locations.aTexCoord);
    }
}

// ========== ОБНОВИ init() ==========
async function init() {
    console.log('Live2D Initialization');

    // Инициализация WebGL
    if (!initWebGL()) {
        console.error('WebGL initialization failed');
        return;
    }

    // Инициализация Socket
    initSocket();

    // Загрузка модели
    try {
        currentModel = await loadModel();
        if (currentModel) {
            window.model = currentModel;
            console.log('✓ Model ready! Try in console:');
            console.log('  model.setParameter(0, 0.5)');
            console.log('  model.setParameter(1, -0.3)');
        }
    } catch (error) {
        console.error('Model loading failed:', error);
    }

    // Инициализация контролов
    initControls();
}

window.addEventListener('DOMContentLoaded', init);