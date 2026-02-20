/**
 * CubismShaderManager_WebGL - Simple shader manager for Live2D Cubism SDK
 */

!function(global, factory) {
    if (typeof exports === 'object' && typeof module === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        exports.cubismshadermanager = factory();
    } else {
        global.CubismShaderManager_WebGL = factory();
    }
}(this, function() {
    'use strict';

    const vertexShaderSource = `
        attribute vec3 position;
        attribute vec2 uv;
        attribute vec4 color;
        
        varying vec2 vUv;
        varying vec4 vColor;
        
        uniform mat4 matrix;
        
        void main() {
            gl_Position = matrix * vec4(position, 1.0);
            vUv = uv;
            vColor = color;
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;
        
        varying vec2 vUv;
        varying vec4 vColor;
        
        uniform sampler2D texture;
        uniform vec4 baseColor;
        uniform vec4 multiplyColor;
        uniform vec4 screenColor;
        
        void main() {
            vec4 texColor = texture2D(texture, vUv);
            vec4 color = texColor * vColor * baseColor;
            
            color.rgb *= multiplyColor.rgb;
            color.rgb += screenColor.rgb * (1.0 - texColor.rgb);
            
            gl_FragColor = color;
        }
    `;

    const fragmentMaskShaderSource = `
        precision mediump float;
        
        varying vec2 vUv;
        varying vec4 vColor;
        
        uniform sampler2D texture;
        
        void main() {
            vec4 texColor = texture2D(texture, vUv);
            gl_FragColor = vec4(texColor.a, 0.0, 0.0, 1.0);
        }
    `;

    class CubismShader {
        constructor(gl) {
            this.gl = gl;
            this.shaderProgram = this._createProgram(vertexShaderSource, fragmentShaderSource);
            this.maskShaderProgram = this._createProgram(vertexShaderSource, fragmentMaskShaderSource);
        }

        _createProgram(vertexSource, fragmentSource) {
            const gl = this.gl;
            const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource);
            const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);
            
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Failed to link shader program:', gl.getProgramInfoLog(program));
                return null;
            }
            
            return program;
        }

        _compileShader(type, source) {
            const gl = this.gl;
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Failed to compile shader:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            
            return shader;
        }

        setupShaderProgramForDraw(renderer, model, index) {
            const gl = this.gl;
            const program = this.shaderProgram;
            
            gl.useProgram(program);
            
            const positionLocation = gl.getAttribLocation(program, 'position');
            const uvLocation = gl.getAttribLocation(program, 'uv');
            const colorLocation = gl.getAttribLocation(program, 'color');
            
            const matrixLocation = gl.getUniformLocation(program, 'matrix');
            const textureLocation = gl.getUniformLocation(program, 'texture');
            const baseColorLocation = gl.getUniformLocation(program, 'baseColor');
            const multiplyColorLocation = gl.getUniformLocation(program, 'multiplyColor');
            const screenColorLocation = gl.getUniformLocation(program, 'screenColor');
            
            const vertexBuffer = renderer.getDrawableVertexBuffers(model, index);
            const indexBuffer = renderer.getDrawableIndexBuffers(model, index);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            
            const vertexStride = 9 * 4;
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, vertexStride, 0);
            
            gl.enableVertexAttribArray(uvLocation);
            gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, vertexStride, 3 * 4);
            
            gl.enableVertexAttribArray(colorLocation);
            gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, vertexStride, 5 * 4);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            
            const mvpMatrix = renderer.getMvpMatrix();
            if (mvpMatrix) {
                gl.uniformMatrix4fv(matrixLocation, false, mvpMatrix.getArray());
            }
            
            const textureIndex = model.getDrawableTextureIndex(index);
            const texture = renderer._textures ? renderer._textures.getValue(textureIndex) : null;
            if (texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(textureLocation, 0);
            }
            
            const baseColor = renderer.getDrawableBaseColor(index);
            gl.uniform4fv(baseColorLocation, [baseColor.r, baseColor.g, baseColor.b, baseColor.a]);
            
            gl.uniform4f(multiplyColorLocation, 1.0, 1.0, 1.0, 1.0);
            gl.uniform4f(screenColorLocation, 0.0, 0.0, 0.0, 0.0);
        }

        setupShaderProgramForMask(renderer, model, index) {
            const gl = this.gl;
            const program = this.maskShaderProgram;
            
            gl.useProgram(program);
            
            const positionLocation = gl.getAttribLocation(program, 'position');
            const uvLocation = gl.getAttribLocation(program, 'uv');
            const colorLocation = gl.getAttribLocation(program, 'color');
            
            const matrixLocation = gl.getUniformLocation(program, 'matrix');
            const textureLocation = gl.getUniformLocation(program, 'texture');
            
            const vertexBuffer = renderer.getDrawableVertexBuffers(model, index);
            const indexBuffer = renderer.getDrawableIndexBuffers(model, index);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            
            const vertexStride = 9 * 4;
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, vertexStride, 0);
            
            gl.enableVertexAttribArray(uvLocation);
            gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, vertexStride, 3 * 4);
            
            gl.enableVertexAttribArray(colorLocation);
            gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, vertexStride, 5 * 4);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            
            const mvpMatrix = renderer.getMvpMatrix();
            if (mvpMatrix) {
                gl.uniformMatrix4fv(matrixLocation, false, mvpMatrix.getArray());
            }
            
            const textureIndex = model.getDrawableTextureIndex(index);
            const texture = renderer._textures ? renderer._textures.getValue(textureIndex) : null;
            if (texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(textureLocation, 0);
            }
        }

        release() {
            const gl = this.gl;
            if (this.shaderProgram) {
                gl.deleteProgram(this.shaderProgram);
                this.shaderProgram = null;
            }
            if (this.maskShaderProgram) {
                gl.deleteProgram(this.maskShaderProgram);
                this.maskShaderProgram = null;
            }
        }
    }

    class CubismShaderManager_WebGL {
        constructor() {
            this._gl = null;
            this._shader = null;
        }

        static getInstance() {
            if (!CubismShaderManager_WebGL._instance) {
                CubismShaderManager_WebGL._instance = new CubismShaderManager_WebGL();
            }
            return CubismShaderManager_WebGL._instance;
        }

        static deleteInstance() {
            if (CubismShaderManager_WebGL._instance) {
                CubismShaderManager_WebGL._instance.release();
                CubismShaderManager_WebGL._instance = null;
            }
        }

        setGlContext(gl) {
            this._gl = gl;
        }

        getShader(gl) {
            if (!this._shader || this._gl !== gl) {
                this._gl = gl;
                this._shader = new CubismShader(gl);
            }
            return this._shader;
        }

        release() {
            if (this._shader) {
                this._shader.release();
                this._shader = null;
            }
        }
    }

    return CubismShaderManager_WebGL;
});
