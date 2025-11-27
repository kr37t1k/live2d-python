#!/usr/bin/env node
/**
 * Build script to compile Cubism Framework for web usage
 * This creates a bundled JavaScript file that can be used in the Qt WebWidget
 */

const fs = require('fs');
const path = require('path');

// Function to read and process a TypeScript file, converting it to JavaScript
function processTsFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Convert TypeScript to JavaScript by removing type annotations
    // This is a simplified conversion - in a real scenario, you'd use TypeScript compiler
    content = content
        .replace(/:\s*\w+/g, '') // Remove type annotations like :number, :string, etc.
        .replace(/public\s+|private\s+|protected\s+/g, '') // Remove access modifiers
        .replace(/\s*:\s*[\w.]+(\[\])?\s*(?=[,}=\n])/g, '') // Remove more type annotations
        .replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"];\n?/g, '') // Remove imports
        .replace(/export\s+(default\s+)?/g, ''); // Remove exports
    
    return content;
}

// Main build function
function buildFramework() {
    console.log('Building Live2D Cubism Framework for Web...');
    
    // Define the core framework components
    const frameworkComponents = [
        // Core framework setup
        `const Live2DCubismFramework = {};
        
        // Framework configuration
        Live2DCubismFramework.CubismFramework = {
            _isStarted: false,
            _isInitialized: false,
            _options: null,
            
            startUp: function(options) {
                this._isStarted = true;
                this._options = options;
                console.log("Cubism Framework started.");
                return true;
            },
            
            initialize: function() {
                if (!this._isStarted) {
                    console.error("Cubism Framework is not started.");
                    return;
                }
                
                this._isInitialized = true;
                console.log("Cubism Framework initialized.");
            },
            
            dispose: function() {
                this._isInitialized = false;
                this._isStarted = false;
                console.log("Cubism Framework disposed.");
            },
            
            isStarted: function() {
                return this._isStarted;
            },
            
            isInitialized: function() {
                return this._isInitialized;
            }
        };`,
        
        // Matrix classes
        `Live2DCubismFramework.CubismMatrix44 = function() {
            this._tr = new Float32Array(16);
            this.loadIdentity();
        };
        
        Live2DCubismFramework.CubismMatrix44.prototype = {
            loadIdentity: function() {
                for (let i = 0; i < 16; i++) {
                    this._tr[i] = (i % 5 == 0) ? 1 : 0;
                }
            },
            
            multiply: function(a, b, dst) {
                const c = new Float32Array(16);
                for (let i = 0; i < 16; i++) {
                    c[i] = 0;
                    for (let j = 0; j < 4; j++) {
                        c[i] += a[i % 4 + j * 4] * b[Math.floor(i / 4) * 4 + j];
                    }
                }
                for (let i = 0; i < 16; i++) {
                    dst[i] = c[i];
                }
            },
            
            getArray: function() {
                return this._tr;
            },
            
            getScaleX: function() {
                return this._tr[0];
            },
            
            getScaleY: function() {
                return this._tr[5];
            },
            
            getTranslateX: function() {
                return this._tr[12];
            },
            
            getTranslateY: function() {
                return this._tr[13];
            },
            
            transformX: function(src) {
                return this._tr[0] * src + this._tr[12];
            },
            
            transformY: function(src) {
                return this._tr[5] * src + this._tr[13];
            },
            
            invert: function() {
                // Simple 2D invert for now
                const matrix = this._tr;
                const det = matrix[0] * matrix[5] - matrix[1] * matrix[4];
                if (Math.abs(det) < 1e-8) {
                    return; // Not invertible
                }
                
                const invDet = 1.0 / det;
                const a = matrix[0], b = matrix[1], c = matrix[4], d = matrix[5];
                const tx = matrix[12], ty = matrix[13];
                
                matrix[0] = d * invDet;
                matrix[1] = -b * invDet;
                matrix[4] = -c * invDet;
                matrix[5] = a * invDet;
                matrix[12] = (c * ty - d * tx) * invDet;
                matrix[13] = (b * tx - a * ty) * invDet;
            }
        };`,
        
        // Model setting JSON parser
        `Live2DCubismFramework.CubismModelSettingJson = function(json) {
            this._json = json;
        };
        
        Live2DCubismFramework.CubismModelSettingJson.prototype = {
            getMotionFileName: function(groupName) {
                if (!this._json.FileReferences || !this._json.FileReferences.Motions) {
                    return "";
                }
                
                const motions = this._json.FileReferences.Motions[groupName];
                if (!motions || motions.length == 0) {
                    return "";
                }
                
                return motions[0].File;
            },
            
            getTextureFileName: function(index) {
                if (!this._json.FileReferences || !this._json.FileReferences.Textures) {
                    return "";
                }
                
                const textures = this._json.FileReferences.Textures;
                if (index >= textures.length) {
                    return "";
                }
                
                return textures[index];
            },
            
            getModelFileName: function() {
                if (!this._json.FileReferences || !this._json.FileReferences.Moc) {
                    return "";
                }
                
                return this._json.FileReferences.Moc;
            },
            
            getPhysicsFileName: function() {
                if (!this._json.FileReferences || !this._json.FileReferences.Physics) {
                    return "";
                }
                
                return this._json.FileReferences.Physics;
            },
            
            getDisplayInfoFileName: function() {
                if (!this._json.FileReferences || !this._json.FileReferences.DisplayInfo) {
                    return "";
                }
                
                return this._json.FileReferences.DisplayInfo;
            },
            
            getPoseFileName: function() {
                if (!this._json.FileReferences || !this._json.FileReferences.Pose) {
                    return "";
                }
                
                return this._json.FileReferences.Pose;
            },
            
            getHitAreasCount: function() {
                if (!this._json.Groups) {
                    return 0;
                }
                
                for (let i = 0; i < this._json.Groups.length; i++) {
                    if (this._json.Groups[i].Target == "HitArea") {
                        return this._json.Groups[i].Name.length;
                    }
                }
                
                return 0;
            },
            
            getHitAreaId: function(index) {
                if (!this._json.Groups) {
                    return -1;
                }
                
                for (let i = 0; i < this._json.Groups.length; i++) {
                    if (this._json.Groups[i].Target == "HitArea") {
                        if (index < this._json.Groups[i].Name.length) {
                            return this._json.Groups[i].Name[index];
                        }
                    }
                }
                
                return -1;
            },
            
            getHitAreaName: function(index) {
                if (!this._json.Groups) {
                    return null;
                }
                
                for (let i = 0; i < this._json.Groups.length; i++) {
                    if (this._json.Groups[i].Target == "HitArea") {
                        if (index < this._json.Groups[i].Ids.length) {
                            return this._json.Groups[i].Ids[index];
                        }
                    }
                }
                
                return null;
            }
        };`,
        
        // Motion manager
        `Live2DCubismFramework.CubismMotionManager = function() {
            this._currentPriority = 0;
            this._reservePriority = 0;
        };
        
        Live2DCubismFramework.CubismMotionManager.prototype = {
            getCurrentPriority: function() {
                return this._currentPriority;
            },
            
            getReservePriority: function() {
                return this._reservePriority;
            },
            
            reserveMotion: function(priority) {
                if (priority <= this._reservePriority || priority <= this._currentPriority) {
                    return false;
                }
                
                this._reservePriority = priority;
                return true;
            },
            
            setReservePriority: function(priority) {
                this._reservePriority = priority;
            },
            
            startMotion: function(priority) {
                if (priority <= this._currentPriority) {
                    return false;
                }
                
                this._currentPriority = priority;
                this._reservePriority = 0;
                return true;
            },
            
            finishMotion: function() {
                this._currentPriority = 0;
            },
            
            update: function(model) {
                // Motion update logic would go here
            }
        };`,
        
        // Main user model class
        `Live2DCubismFramework.CubismUserModel = function() {
            this._moc = null;
            this._model = null;
            this._motionManager = null;
            this._expressionManager = null;
            this._eyeBlink = null;
            this._breath = null;
            this._modelMatrix = null;
            this._pose = null;
            this._dragX = 0;
            this._dragY = 0;
            this._accelerationX = 0;
            this._accelerationY = 0;
            this._accelerationZ = 0;
            this._mocConsistency = true;
        };
        
        Live2DCubismFramework.CubismUserModel.prototype = {
            initialize: function() {
                this._motionManager = new Live2DCubismFramework.CubismMotionManager();
                this._expressionManager = new Live2DCubismFramework.CubismMotionManager();
            },
            
            loadModel: function(mocArrayBuffer) {
                this._moc = Live2DCubismCore.CubismMoc.create(mocArrayBuffer);
                if (this._moc) {
                    this._model = Live2DCubismCore.CubismModel.create(this._moc);
                    this.initialize();
                    return true;
                }
                return false;
            },
            
            getParameterId: function(parameterName) {
                // In a real implementation, this would return the parameter ID
                return parameterName;
            },
            
            getParameterIndex: function(parameterId) {
                // In a real implementation, this would return the parameter index
                return 0;
            },
            
            setParameterValueById: function(parameterId, value) {
                // Set parameter value by ID
                // This is a simplified implementation
                console.log("Setting parameter " + parameterId + " to " + value);
            },
            
            setParameterValueByIndex: function(parameterIndex, value) {
                // Set parameter value by index
                // This is a simplified implementation
                console.log("Setting parameter at index " + parameterIndex + " to " + value);
            },
            
            getParameterValueById: function(parameterId) {
                // Get parameter value by ID
                return 0; // Simplified
            },
            
            getParameterValueByIndex: function(parameterIndex) {
                // Get parameter value by index
                return 0; // Simplified
            },
            
            setDragging: function(x, y) {
                this._dragX = x;
                this._dragY = y;
            },
            
            setAcceleration: function(x, y, z) {
                this._accelerationX = x;
                this._accelerationY = y;
                this._accelerationZ = z;
            },
            
            update: function() {
                // Update model
                if (this._model) {
                    this._model.update();
                }
            },
            
            draw: function(renderer) {
                // Draw the model using the renderer
                if (this._model) {
                    // This would use the renderer to draw the model
                    console.log("Drawing model");
                }
            }
        };`
    ];
    
    // Combine all components into a single file
    const frameworkCode = frameworkComponents.join('\n\n');
    
    // Write the framework file
    const outputPath = path.join(__dirname, 'cubism.web.sdk', 'dist', 'live2d-cubism-framework.js');
    fs.writeFileSync(outputPath, frameworkCode);
    
    console.log(`Framework built successfully at ${outputPath}`);
}

// Run the build if called directly
if (require.main === module) {
    buildFramework();
}