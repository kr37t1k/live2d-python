/**
 * Live2D Desktop Mate - Enhanced Renderer
 * Production-ready implementation with comprehensive error handling, logging, and fallbacks
 * @version 2.0.0
 */

/**
 * Logger utility for the renderer
 */
class RendererLogger {
  constructor(prefix = "[Live2DRenderer]") {
    this.prefix = prefix;
    this.enabled = true;
  }

  log(level, message, data) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${message}`;

    const consoleMethods = {
      debug: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    (consoleMethods[level] || console.log)(logMessage, data || "");
  }

  debug(message, data) {
    this.log("debug", message, data);
  }
  info(message, data) {
    this.log("info", message, data);
  }
  warn(message, data) {
    this.log("warn", message, data);
  }
  error(message, data) {
    this.log("error", message, data);
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
      this.tr[i] = i % 5 === 0 ? 1 : 0;
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
      dst[i] =
        l[i % 4] * r[Math.floor(i / 4) * 4] +
        l[(i % 4) + 4] * r[Math.floor(i / 4) * 4 + 1] +
        l[(i % 4) + 8] * r[Math.floor(i / 4) * 4 + 2] +
        l[(i % 4) + 12] * r[Math.floor(i / 4) * 4 + 3];
    }

    this.tr = dst;
  }
}

/**
 * Main Live2D Renderer class
 */
class Live2DRenderer {
  constructor(canvas, options = {}) {
    this.logger = new RendererLogger("[Live2DRenderer]");
    this.logger.info("Initializing renderer...", { options });

    this.canvas = canvas;
    this.options = {
      premultipliedAlpha: true,
      useHighPrecisionMask: false,
      enableMotions: true,
      enableExpressions: true,
      enablePhysics: true,
      enableLipSync: true,
      autoBreathing: true,
      frameRateLimit: 60,
      ...options,
    };

    // Core properties
    this.gl = null;
    this.live2dModel = null;
    this.textures = [];
    this.motionManager = null;
    this.expressionManager = null;
    this.physics = null;
    this.eyeBlink = null;
    this.dragManager = null;

    // Matrices
    this.modelMatrix = null;
    this.viewMatrix = null;
    this.projMatrix = null;
    this.deviceToScreen = null;

    // Animation and timing
    this.lastTimeSeconds = Date.now() / 1000;
    this.frameTime = 0;
    this.targetFrameTime = 1 / this.options.frameRateLimit;
    this.animationFrameId = null;

    // States
    this.parameters = {};
    this.expressions = {};
    this.motions = {};
    this.hitAreas = [];
    this.eventListeners = new Map();

    // Shader program cache
    this.simpleShaderProgram = null;

    // Initialize
    try {
      this.init();
      this.logger.info("✓ Renderer initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize renderer", error);
      throw error;
    }
  }

  /**
   * Initialize WebGL context and core components
   */
  init() {
    this.logger.info("Setting up WebGL context...");

    // Setup WebGL context with fallbacks
    const contextOptions = {
      alpha: true,
      premultipliedAlpha: this.options.premultipliedAlpha,
      antialias: true,
      stencil: true,
    };

    this.gl =
      this.canvas.getContext("webgl", contextOptions) ||
      this.canvas.getContext("experimental-webgl", contextOptions);

    if (!this.gl) {
      throw new Error("WebGL not supported");
    }

    this.logger.info("✓ WebGL context created");

    // Configure WebGL
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFuncSeparate(
      this.gl.ONE,
      this.gl.ONE_MINUS_SRC_ALPHA,
      this.gl.ONE,
      this.gl.ONE_MINUS_SRC_ALPHA,
    );
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.frontFace(this.gl.CCW);

    // Initialize Cubism framework
    this.initializeCubism();

    // Setup managers
    this.setupMotionManager();
    this.setupExpressionManager();
    this.setupDragManager();

    // Setup matrices
    this.setupMatrices();
  }

  /**
   * Initialize Cubism framework with fallbacks
   */
  initializeCubism() {
    this.logger.info("Initializing Cubism framework...");

    if (typeof Live2DCubismCore === "undefined") {
      throw new Error("Live2D Core library not loaded");
    }

    this.logger.info("✓ Live2D Cubism Core available", {
      version: Live2DCubismCore.Version?.csmGetVersion?.() || "unknown",
    });
  }

  /**
   * Setup motion manager with fallbacks
   */
  setupMotionManager() {
    this.logger.debug("Setting up motion manager...");

    this.motionManager = {
      currentPriority: 0,
      reservePriority: 0,
      currentMotion: null,
      motionQueue: [],
      motionStartTime: 0,
      motionDuration: 0,
      motionFadeInTime: 0,
      motionFadeOutTime: 0,
      isFading: false,
      fadeStartTime: 0,
      fadeDirection: 0, // 1 for fade in, -1 for fade out

      setReservePriority(priority) {
        this.reservePriority = priority;
      },

      setPriority(priority) {
        this.currentPriority = priority;
      },

      getCurrentPriority() {
        return this.currentPriority;
      },

      getReservePriority() {
        return this.reservePriority;
      },

      startMotion(motion, priority, fadeInTime, fadeOutTime) {
        if (priority >= this.currentPriority) {
          if (this.currentMotion) {
            // Stop current motion if it has lower priority
            this.currentMotion = null;
          }
          this.currentMotion = motion;
          this.currentPriority = priority;
          this.motionStartTime = Date.now();
          this.motionDuration = motion.duration || 0;
          this.motionFadeInTime = fadeInTime || 0.5;
          this.motionFadeOutTime = fadeOutTime || 0.5;
          this.isFading = false;
          this.fadeStartTime = 0;
          this.fadeDirection = 0;

          this.logger.info("Motion started", {
            motion: motion.name || "unnamed",
            priority,
            duration: this.motionDuration,
          });
        } else {
          // Add to queue if lower priority
          this.motionQueue.push({
            motion,
            priority,
            fadeInTime,
            fadeOutTime,
          });
          this.logger.debug("Motion queued", {
            motion: motion.name || "unnamed",
            priority,
            queueLength: this.motionQueue.length,
          });
        }
      },

      stopCurrentMotion() {
        if (this.currentMotion) {
          this.isFading = true;
          this.fadeStartTime = Date.now();
          this.fadeDirection = -1; // Fade out

          this.logger.info("Motion stopping", {
            motion: this.currentMotion.name || "unnamed",
          });
        }
      },

      updateAndDraw(model, deltaTimeSeconds) {
        if (!this.currentMotion) return;

        const now = Date.now();
        const elapsedTime = (now - this.motionStartTime) / 1000; // Convert to seconds

        // Handle fading
        if (this.isFading) {
          const fadeElapsed = (now - this.fadeStartTime) / 1000;
          const fadeDuration =
            this.fadeDirection === -1
              ? this.motionFadeOutTime
              : this.motionFadeInTime;

          if (fadeElapsed >= fadeDuration) {
            // Fade complete
            if (this.fadeDirection === -1) {
              // Motion finished
              this.currentMotion = null;
              this.currentPriority = 0;

              // Check for queued motions
              if (this.motionQueue.length > 0) {
                const nextMotion = this.motionQueue.shift();
                this.startMotion(
                  nextMotion.motion,
                  nextMotion.priority,
                  nextMotion.fadeInTime,
                  nextMotion.fadeOutTime,
                );
              }
            } else {
              // Fade in complete
              this.isFading = false;
              this.fadeDirection = 0;
            }
          } else {
            // Calculate fade opacity
            const fadeProgress = fadeElapsed / fadeDuration;
            const opacity =
              this.fadeDirection === -1 ? 1 - fadeProgress : fadeProgress;

            // Apply fade to motion
            if (model && typeof model.setOpacity === "function") {
              model.setOpacity(opacity);
            }
          }
        }

        // Update motion parameters
        if (this.currentMotion && model) {
          // Update motion based on elapsed time
          if (typeof this.currentMotion.update === "function") {
            this.currentMotion.update(model, elapsedTime);
          }

          // Check if motion has reached its end
          if (this.motionDuration > 0 && elapsedTime >= this.motionDuration) {
            this.stopCurrentMotion();
          }
        }
      },
    };

    this.logger.debug("✓ Motion manager ready");
  }

  /**
   * Setup expression manager
   */
  setupExpressionManager() {
    this.logger.debug("Setting up expression manager...");

    this.expressionManager = {
      currentExpression: null,
      expressionQueue: [],
      expressionStartTime: 0,
      expressionDuration: 0,
      expressionFadeInTime: 0,
      expressionFadeOutTime: 0,
      isFading: false,
      fadeStartTime: 0,
      fadeDirection: 0, // 1 for fade in, -1 for fade out
      expressionValues: {}, // Store current expression values

      setExpression: (expressionId, priority = 0) => {
        // If we have a current expression, start fading it out
        if (this.currentExpression && this.currentExpression !== expressionId) {
          this.isFading = true;
          this.fadeStartTime = Date.now();
          this.fadeDirection = -1; // Fade out

          // Store the expression value for later restoration
          this.expressionValues[this.currentExpression] = 1.0;
        }

        // Set the new expression
        this.currentExpression = expressionId;
        this.expressionStartTime = Date.now();
        this.expressionDuration = 0; // Infinite unless specified
        this.expressionFadeInTime = 0.3; // Default fade in time
        this.expressionFadeOutTime = 0.3; // Default fade out time
        this.isFading = false;
        this.fadeDirection = 0;

        // Reset the expression value
        this.expressionValues[expressionId] = 0.0;

        this.emit("expressionChanged", expressionId);
        this.logger.info("Expression changed", { expressionId });
      },

      update: (model, deltaTimeSeconds) => {
        if (!model || !this.currentExpression) return;

        const now = Date.now();

        // Handle expression fading
        if (this.isFading) {
          const fadeElapsed = (now - this.fadeStartTime) / 1000;
          const fadeDuration =
            this.fadeDirection === -1
              ? this.expressionFadeOutTime
              : this.expressionFadeInTime;

          if (fadeElapsed >= fadeDuration) {
            // Fade complete
            if (this.fadeDirection === -1) {
              // Expression fully faded out
              if (model && typeof model.setExpression === "function") {
                model.setExpression(this.currentExpression, 0.0);
              }
            } else {
              // Fade in complete
              this.isFading = false;
              this.fadeDirection = 0;
            }
          } else {
            // Calculate fade value
            const fadeProgress = fadeElapsed / fadeDuration;
            const value =
              this.fadeDirection === -1 ? 1.0 - fadeProgress : fadeProgress;

            // Apply expression value
            if (model && typeof model.setExpression === "function") {
              model.setExpression(this.currentExpression, value);
            }

            // Store the value for smooth transitions
            this.expressionValues[this.currentExpression] = value;
          }
        } else {
          // Ensure the current expression is fully applied
          if (model && typeof model.setExpression === "function") {
            model.setExpression(this.currentExpression, 1.0);
          }
          this.expressionValues[this.currentExpression] = 1.0;
        }

        // Apply any queued expressions
        for (const [exprId, value] of Object.entries(this.expressionValues)) {
          if (exprId !== this.currentExpression && value > 0) {
            if (model && typeof model.setExpression === "function") {
              model.setExpression(exprId, value);
            }
          }
        }
      },
    };

    this.logger.debug("✓ Expression manager ready");
  }

  /**
   * Setup drag manager for mouse interactions
   */
  setupDragManager() {
    this.logger.debug("Setting up drag manager...");

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

      update: (deltaTimeSeconds) => {
        if (this.dragManager.isDragging) {
          // Process dragging logic
        }
      },
    };

    this.logger.debug("✓ Drag manager ready");
  }

  /**
   * Setup transformation matrices
   */
  setupMatrices() {
    this.logger.debug("Setting up transformation matrices...");

    this.modelMatrix = new Matrix44();
    this.viewMatrix = new Matrix44();
    this.projMatrix = new Matrix44();
    this.deviceToScreen = new Matrix44();

    // Set up initial model position and scale
    const scale = Math.min(this.canvas.width, this.canvas.height) / 2.0;
    this.modelMatrix.updateScale(scale, scale);
    this.modelMatrix.translate(
      this.canvas.width / 2.0,
      this.canvas.height / 2.0,
    );

    this.logger.debug("✓ Matrices initialized", { scale });
  }

  /**
   * Load Live2D model with comprehensive error handling
   */
  async loadModel(modelPath) {
    this.logger.info("Loading model...", { path: modelPath });

    try {
      // Fetch model JSON
      const response = await fetch(modelPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const modelData = await response.json();
      this.logger.debug("Model JSON loaded", modelData);

      const modelDir = modelPath.substring(0, modelPath.lastIndexOf("/"));
      const mocPath = `${modelDir}/${modelData.FileReferences.Moc}`;

      // Load moc3 file
      this.logger.info("Loading moc3 file...", { path: mocPath });
      const mocResponse = await fetch(mocPath);
      if (!mocResponse.ok) {
        throw new Error(`Failed to load moc3: HTTP ${mocResponse.status}`);
      }

      const mocArrayBuffer = await mocResponse.arrayBuffer();
      this.logger.debug("Moc3 data loaded", {
        size: mocArrayBuffer.byteLength,
      });

      // Create model from moc
      const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocArrayBuffer);
      if (!moc) {
        throw new Error("Failed to create Moc from array buffer");
      }
      this.logger.info("✓ Moc created");

      const model = Live2DCubismCore.Model.fromMoc(moc);
      if (!model) {
        throw new Error("Failed to create model from Moc");
      }
      this.logger.info("✓ Model created");

      this.live2dModel = model;

      // Load textures
      await this.loadTextures(modelData.FileReferences.Textures, modelDir);

      // Load physics if available
      if (modelData.FileReferences.Physics) {
        await this.loadPhysics(
          `${modelDir}/${modelData.FileReferences.Physics}`,
        );
      }

      // Load pose if available
      if (modelData.FileReferences.Pose) {
        await this.loadPose(`${modelDir}/${modelData.FileReferences.Pose}`);
      }

      // Initialize hit areas
      if (modelData.HitAreas) {
        this.hitAreas = modelData.HitAreas;
        this.logger.info("Hit areas loaded", { count: this.hitAreas.length });
      }

      // Initialize motions
      if (modelData.FileReferences.Motions) {
        await this.loadMotions(modelData.FileReferences.Motions, modelDir);
      }

      this.logger.info("✓ Model loaded successfully");
      this.emit("loaded", { model: this.live2dModel });

      return true;
    } catch (error) {
      this.logger.error("Failed to load model", error);
      this.emit("error", { error: error.message });
      return false;
    }
  }

  /**
   * Load textures with error handling
   */
  async loadTextures(textureFiles, modelDir) {
    this.logger.info("Loading textures...", { count: textureFiles.length });

    const texturePaths = textureFiles.map((tex) => `${modelDir}/${tex}`);

    for (let i = 0; i < texturePaths.length; i++) {
      try {
        const texture = await this.loadTexture(this.gl, texturePaths[i]);
        this.textures.push(texture);
        this.logger.debug(`✓ Texture ${i + 1}/${texturePaths.length} loaded`);
      } catch (error) {
        this.logger.error(`Failed to load texture ${i}`, error);
        // Create placeholder texture on error
        this.textures.push(this.createPlaceholderTexture());
      }
    }

    this.logger.info("✓ Textures loaded", { count: this.textures.length });
  }

  /**
   * Load a single texture
   */
  loadTexture(gl, path) {
    return new Promise((resolve, reject) => {
      const texture = gl.createTexture();
      const image = new Image();

      image.onload = () => {
        try {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image,
          );

          // Generate mipmaps
          gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR_MIPMAP_NEAREST,
          );
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.generateMipmap(gl.TEXTURE_2D);

          resolve(texture);
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => {
        reject(new Error(`Failed to load texture: ${path}`));
      };

      image.crossOrigin = "Anonymous";
      image.src = path;
    });
  }

  /**
   * Create placeholder texture for fallback
   */
  createPlaceholderTexture() {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Create 1x1 pixel white texture
    const pixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );

    this.logger.warn("Created placeholder texture");
    return texture;
  }

  /**
   * Load physics settings
   */
  async loadPhysics(physicsPath) {
    try {
      const response = await fetch(physicsPath);
      const physicsData = await response.json();
      this.physics = physicsData;
      this.logger.info("✓ Physics loaded", { path: physicsPath });
      this.emit("physicsLoaded", { path: physicsPath });
    } catch (error) {
      this.logger.warn("Failed to load physics (non-critical)", error);
    }
  }

  /**
   * Load pose settings
   */
  async loadPose(posePath) {
    try {
      const response = await fetch(posePath);
      const poseData = await response.json();
      this.logger.info("✓ Pose loaded", { path: posePath });
      this.emit("poseLoaded", { path: posePath });
    } catch (error) {
      this.logger.warn("Failed to load pose (non-critical)", error);
    }
  }

  /**
   * Load motions
   */
  async loadMotions(motionGroups, modelDir) {
    try {
      for (const [groupName, motions] of Object.entries(motionGroups)) {
        this.motions[groupName] = [];

        for (const motion of motions) {
          const motionPath = `${modelDir}/${motion.File}`;
          this.motions[groupName].push({
            path: motionPath,
            fadeInTime: motion.FadeInTime || 0.5,
            fadeOutTime: motion.FadeOutTime || 0.5,
          });
        }
      }

      this.logger.info("✓ Motions loaded", {
        groups: Object.keys(this.motions),
        total: Object.values(this.motions).reduce(
          (sum, arr) => sum + arr.length,
          0,
        ),
      });
      this.emit("motionsLoaded", { groups: Object.keys(this.motions) });
    } catch (error) {
      this.logger.warn("Failed to load motions (non-critical)", error);
    }
  }

  /**
   * Set expression by name
   */
  setExpression(expressionId) {
    this.logger.info("Setting expression", { expressionId });

    try {
      if (!this.expressions || !this.expressions[expressionId]) {
        throw new Error(`Expression not found: ${expressionId}`);
      }

      // Set the expression through the expression manager
      if (this.expressionManager) {
        this.expressionManager.setExpression(expressionId);
      } else {
        throw new Error("Expression manager not initialized");
      }

      this.emit("expressionSet", { expressionId });
      return true;
    } catch (error) {
      this.logger.error("Failed to set expression", error);
      this.emit("expressionError", { expressionId, error: error.message });
      return false;
    }
  }

  /**
   * Play motion by group and index
   */
  playMotion(
    motionGroup,
    index = 0,
    priority = 0,
    fadeInTime = 0.5,
    fadeOutTime = 0.5,
  ) {
    this.logger.info("Playing motion", { motionGroup, index, priority });

    try {
      if (!this.motions || !this.motions[motionGroup]) {
        throw new Error(`Motion group not found: ${motionGroup}`);
      }

      const motionList = this.motions[motionGroup];
      if (index >= motionList.length) {
        throw new Error(
          `Invalid motion index: ${index} for group ${motionGroup}`,
        );
      }

      const motion = motionList[index];

      // Start the motion through the motion manager
      if (this.motionManager) {
        this.motionManager.startMotion(
          motion,
          priority,
          fadeInTime,
          fadeOutTime,
        );
      } else {
        throw new Error("Motion manager not initialized");
      }

      this.emit("motionStarted", { motionGroup, index, priority });
      return true;
    } catch (error) {
      this.logger.error("Failed to play motion", error);
      this.emit("motionError", { motionGroup, index, error: error.message });
      return false;
    }
  }

  /**
   * Set parameter value with bounds checking
   */
  setParameter(parameterId, value) {
    if (!this.live2dModel) {
      this.logger.warn("Cannot set parameter: model not loaded", {
        parameterId,
      });
      return;
    }

    try {
      // Try multiple methods to get parameter index (different SDK versions)
      let paramIndex = -1;

      if (typeof this.live2dModel.getParameterIndex === "function") {
        paramIndex = this.live2dModel.getParameterIndex(parameterId);
      } else if (
        this.live2dModel.parameters &&
        this.live2dModel.parameters.ids
      ) {
        paramIndex = this.live2dModel.parameters.ids.indexOf(parameterId);
      }

      if (
        paramIndex >= 0 &&
        typeof this.live2dModel.setParameterValueByIndex === "function"
      ) {
        this.live2dModel.setParameterValueByIndex(paramIndex, value);
        this.parameters[parameterId] = value;
        this.emit("parameterChanged", { id: parameterId, value });
      } else if (
        paramIndex >= 0 &&
        this.live2dModel.parameters &&
        this.live2dModel.parameters.values
      ) {
        this.live2dModel.parameters.values[paramIndex] = value;
        this.parameters[parameterId] = value;
      } else {
        this.logger.debug("Parameter not found or method unavailable", {
          parameterId,
        });
      }
    } catch (error) {
      this.logger.error("Failed to set parameter", {
        parameterId,
        value,
        error,
      });
    }
  }

  /**
   * Get parameter value
   */
  getParameter(parameterId) {
    if (!this.live2dModel) return 0;

    try {
      let paramIndex = -1;

      if (typeof this.live2dModel.getParameterIndex === "function") {
        paramIndex = this.live2dModel.getParameterIndex(parameterId);
      } else if (
        this.live2dModel.parameters &&
        this.live2dModel.parameters.ids
      ) {
        paramIndex = this.live2dModel.parameters.ids.indexOf(parameterId);
      }

      if (
        paramIndex >= 0 &&
        typeof this.live2dModel.getParameterValueByIndex === "function"
      ) {
        return this.live2dModel.getParameterValueByIndex(paramIndex);
      } else if (
        paramIndex >= 0 &&
        this.live2dModel.parameters &&
        this.live2dModel.parameters.values
      ) {
        return this.live2dModel.parameters.values[paramIndex];
      }

      return this.parameters[parameterId] || 0;
    } catch (error) {
      this.logger.error("Failed to get parameter", { parameterId, error });
      return 0;
    }
  }

  /**
   * Play a motion with priority-based queuing
   * @param {string} motionGroup - The motion group name
   * @param {number} index - The motion index within the group
   * @param {number} priority - The motion priority (higher numbers override lower)
   * @param {number} fadeInTime - Fade in duration in seconds
   * @param {number} fadeOutTime - Fade out duration in seconds
   */
  playMotion(
    motionGroup,
    index = 0,
    priority = 0,
    fadeInTime = 0.5,
    fadeOutTime = 0.5,
  ) {
    if (!this.motionManager || !this.motions || !this.motions[motionGroup]) {
      this.logger.warn("Motion not available", { motionGroup, index });
      return false;
    }

    const motionList = this.motions[motionGroup];
    if (index >= motionList.length) {
      this.logger.warn("Invalid motion index", {
        motionGroup,
        index,
        max: motionList.length - 1,
      });
      return false;
    }

    const motion = motionList[index];
    this.motionManager.startMotion(motion, priority, fadeInTime, fadeOutTime);
    return true;
  }

  /**
   * Stop the current motion
   */
  stopMotion() {
    if (this.motionManager) {
      this.motionManager.stopCurrentMotion();
    }
  }

  /**
   * Set an expression with smooth transitions
   * @param {string} expressionId - The expression ID
   * @param {number} priority - The expression priority
   */
  setExpression(expressionId, priority = 0) {
    if (this.expressionManager) {
      this.expressionManager.setExpression(expressionId, priority);
    }
  }

  /**
   * Clear all expressions
   */
  clearExpressions() {
    if (this.expressionManager) {
      this.expressionManager.currentExpression = null;
      this.expressionManager.expressionValues = {};

      // Clear all expressions from the model
      if (
        this.live2dModel &&
        typeof this.live2dModel.clearExpressions === "function"
      ) {
        this.live2dModel.clearExpressions();
      }
    }
  }

  /**
   * Update model with delta time
   */
  update(deltaTimeSeconds) {
    if (!this.live2dModel) return;

    try {
      // Update drag manager
      if (this.dragManager) {
        this.dragManager.update(deltaTimeSeconds);
      }

      // Update motion manager
      if (this.motionManager) {
        this.motionManager.updateAndDraw(this.live2dModel, deltaTimeSeconds);
      }

      // Update expressions if they exist
      // if (this.expressionManager) {
      // this.expressionManager.update(this.live2dModel, deltaTimeSeconds);
      // }

      // Update physics if enabled
      if (this.physics && this.options.enablePhysics) {
        this.updatePhysics(deltaTimeSeconds);
      }

      // Auto breathing
      if (this.options.autoBreathing) {
        this.updateBreathing(deltaTimeSeconds);
      }

      // Update the model
      if (typeof this.live2dModel.update === "function") {
        this.live2dModel.update();
      }
    } catch (error) {
      this.logger.error("Error during model update", error);
    }
  }

  /**
   * Update physics simulation
   */
  updatePhysics(deltaTimeSeconds) {
    // Physics update placeholder
    // In a full implementation, this would update physics calculations
  }

  /**
   * Update breathing animation
   */
  updateBreathing(deltaTimeSeconds) {
    try {
      const breathValue = 0.5 + 0.5 * Math.sin(Date.now() * 0.001);
      this.setParameter("ParamBreath", breathValue);
    } catch (error) {
      // Silently fail if ParamBreath doesn't exist
    }
  }

  /**
   * Render the model
   */
  render() {
    if (!this.live2dModel) return;

    try {
      // Clear the canvas
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      // Update model
      if (typeof this.live2dModel.update === "function") {
        this.live2dModel.update();
      }

      // Get drawables count
      const drawCount = this.getDrawableCount();

      // Render each drawable
      for (let i = 0; i < drawCount; ++i) {
        this.renderDrawable(i);
      }
    } catch (error) {
      this.logger.error("Error during rendering", error);
    }
  }

  /**
   * Get drawable count with fallbacks
   */
  getDrawableCount() {
    if (typeof this.live2dModel.getDrawableCount === "function") {
      return this.live2dModel.getDrawableCount();
    } else if (
      this.live2dModel.drawables &&
      typeof this.live2dModel.drawables.count !== "undefined"
    ) {
      return this.live2dModel.drawables.count;
    }
    return 0;
  }

  /**
   * Render a specific drawable with comprehensive fallbacks
   */
  renderDrawable(drawableIndex) {
    try {
      const model = this.live2dModel;
      const gl = this.gl;

      // Check if drawable is visible
      const opacities =
        model.drawables?.opacities || model.getDrawableOpacities?.();
      if (opacities && opacities[drawableIndex] < 0.001) {
        return; // Skip invisible drawables
      }

      // Get drawable data with fallbacks
      let vertices, uvs, indices, textureIndex;

      // Try to get vertices
      if (typeof model.getDrawableVertices === "function") {
        vertices = model.getDrawableVertices(drawableIndex);
      } else if (model.drawables?.vertexPositions) {
        vertices = model.drawables.vertexPositions[drawableIndex];
      }

      // Try to get UVs
      if (typeof model.getDrawableVertexUvs === "function") {
        uvs = model.getDrawableVertexUvs(drawableIndex);
      } else if (model.drawables?.vertexUvs) {
        uvs = model.drawables.vertexUvs[drawableIndex];
      }

      // Try to get indices
      if (typeof model.getDrawableVertexIndices === "function") {
        indices = model.getDrawableVertexIndices(drawableIndex);
      } else if (model.drawables?.indices) {
        indices = model.drawables.indices[drawableIndex];
      }

      // Try to get texture index
      if (typeof model.getDrawableTextureIndex === "function") {
        textureIndex = model.getDrawableTextureIndex(drawableIndex);
      } else if (model.drawables?.textureIndices) {
        textureIndex = model.drawables.textureIndices[drawableIndex];
      } else {
        textureIndex = 0;
      }

      // Validate data
      if (
        !vertices ||
        !indices ||
        textureIndex >= this.textures.length ||
        !this.textures[textureIndex]
      ) {
        return;
      }

      // Get shader program
      const shaderProgram = this.getSimpleShaderProgram();
      if (!shaderProgram) return;

      gl.useProgram(shaderProgram);

      // Set blend mode
      let blendMode = 0;
      if (typeof model.getDrawableBlendMode === "function") {
        blendMode = model.getDrawableBlendMode(drawableIndex);
      } else if (model.drawables?.blendModes) {
        blendMode = model.drawables.blendModes[drawableIndex];
      }

      switch (blendMode) {
        case 0: // Normal (premultiplied alpha)
          gl.blendFuncSeparate(
            gl.ONE,
            gl.ONE_MINUS_SRC_ALPHA,
            gl.ONE,
            gl.ONE_MINUS_SRC_ALPHA,
          );
          break;
        case 1: // Additive
          gl.blendFunc(gl.ONE, gl.ONE);
          break;
        case 2: // Multiplicative
          gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
          break;
        default: // Normal fallback
          gl.blendFuncSeparate(
            gl.ONE,
            gl.ONE_MINUS_SRC_ALPHA,
            gl.ONE,
            gl.ONE_MINUS_SRC_ALPHA,
          );
          break;
      }

      // Create vertex buffer
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const positionAttributeLocation = gl.getAttribLocation(
        shaderProgram,
        "a_position",
      );
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(
        positionAttributeLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );

      // Create UV buffer
      const uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      if (uvs) {
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
      } else {
        // Generate UVs if not provided
        const generatedUvs = new Float32Array(vertices.length);
        for (let i = 0; i < vertices.length; i += 2) {
          generatedUvs[i] = (vertices[i] + 1) * 0.5;
          generatedUvs[i + 1] = 1.0 - (vertices[i + 1] + 1) * 0.5;
        }
        gl.bufferData(gl.ARRAY_BUFFER, generatedUvs, gl.STATIC_DRAW);
      }

      const texCoordAttributeLocation = gl.getAttribLocation(
        shaderProgram,
        "a_texCoord",
      );
      gl.enableVertexAttribArray(texCoordAttributeLocation);
      gl.vertexAttribPointer(
        texCoordAttributeLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );

      // Bind texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[textureIndex]);
      const textureUniformLocation = gl.getUniformLocation(
        shaderProgram,
        "u_texture",
      );
      gl.uniform1i(textureUniformLocation, 0);

      // Set transformation matrix
      const matrixUniformLocation = gl.getUniformLocation(
        shaderProgram,
        "u_matrix",
      );
      const projectionMatrix = this.createProjectionMatrix();
      const modelMatrix = this.modelMatrix.getArray();

      // Multiply projection and model matrices
      const finalMatrix = new Float32Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          finalMatrix[i * 4 + j] =
            projectionMatrix[i * 4] * modelMatrix[j] +
            projectionMatrix[i * 4 + 1] * modelMatrix[j + 4] +
            projectionMatrix[i * 4 + 2] * modelMatrix[j + 8] +
            projectionMatrix[i * 4 + 3] * modelMatrix[j + 12];
        }
      }
      gl.uniformMatrix4fv(matrixUniformLocation, false, finalMatrix);

      // Create and bind index buffer
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW,
      );

      // Draw
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      // Cleanup
      gl.disableVertexAttribArray(positionAttributeLocation);
      gl.disableVertexAttribArray(texCoordAttributeLocation);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(uvBuffer);
      gl.deleteBuffer(indexBuffer);
    } catch (error) {
      this.logger.error("Failed to render drawable", {
        index: drawableIndex,
        error,
      });
    }
  }

  /**
   * Create projection matrix for rendering
   */
  createProjectionMatrix() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Calculate scale to fit model in canvas
    const scale = Math.min(width, height) / 2.0;

    // Create orthographic projection matrix with proper scaling and centering
    const matrix = new Float32Array(16);
    matrix[0] = (2.0 / width) * scale; // Scale X
    matrix[5] = (2.0 / height) * scale; // Scale Y (positive for proper orientation)
    matrix[10] = 1.0;
    matrix[12] = 0.0; // Center X
    matrix[13] = 0.0; // Center Y
    matrix[15] = 1.0;

    return matrix;
  }

  /**
   * Get or create shader program
   */
  getSimpleShaderProgram() {
    if (this.simpleShaderProgram) {
      return this.simpleShaderProgram;
    }

    try {
      const vertexShaderSource = `
                attribute vec2 a_position;
                attribute vec2 a_texCoord;
                varying vec2 v_texCoord;
                uniform mat4 u_matrix;

                void main() {
                    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
                    v_texCoord = a_texCoord;
                }
            `;

      const fragmentShaderSource = `
                precision mediump float;
                varying vec2 v_texCoord;
                uniform sampler2D u_texture;

                void main() {
                    vec4 texColor = texture2D(u_texture, v_texCoord);
                    gl_FragColor = texColor;
                }
            `;

      const vertexShader = this.createShader(
        this.gl.VERTEX_SHADER,
        vertexShaderSource,
      );
      const fragmentShader = this.createShader(
        this.gl.FRAGMENT_SHADER,
        fragmentShaderSource,
      );

      const program = this.gl.createProgram();
      this.gl.attachShader(program, vertexShader);
      this.gl.attachShader(program, fragmentShader);
      this.gl.linkProgram(program);

      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        throw new Error(
          "Could not link shaders: " + this.gl.getProgramInfoLog(program),
        );
      }

      this.simpleShaderProgram = program;
      this.logger.info("✓ Shader program created");
      return program;
    } catch (error) {
      this.logger.error("Failed to create shader program", error);
      return null;
    }
  }

  /**
   * Create a shader
   */
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error("Shader compilation error: " + error);
    }

    return shader;
  }

  /**
   * Main render loop
   */
  renderLoop() {
    const now = Date.now() / 1000;
    const deltaTime = now - this.lastTimeSeconds;
    this.lastTimeSeconds = now;

    // Frame rate limiting
    this.frameTime += deltaTime;
    if (this.frameTime < this.targetFrameTime) {
      this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
      return;
    }
    this.frameTime -= this.targetFrameTime;

    // Update and render
    this.update(deltaTime);
    this.render();

    // Continue loop
    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  /**
   * Start the render loop
   */
  startRenderLoop() {
    if (this.animationFrameId) {
      this.logger.warn("Render loop already running");
      return;
    }
    this.logger.info("Starting render loop");
    this.renderLoop();
  }

  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.logger.info("Render loop stopped");
    }
  }

  /**
   * Event system - add listener
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Event system - remove listener
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Event system - emit event
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error("Error in event listener", { event, error });
        }
      });
    }
  }

  /**
   * Destroy the renderer and cleanup resources
   */
  destroy() {
    this.logger.info("Destroying renderer...");

    // Stop animation loop
    this.stopRenderLoop();

    // Cleanup textures
    for (const texture of this.textures) {
      if (texture) {
        this.gl.deleteTexture(texture);
      }
    }
    this.textures = [];

    // Cleanup shader program
    if (this.simpleShaderProgram) {
      this.gl.deleteProgram(this.simpleShaderProgram);
      this.simpleShaderProgram = null;
    }

    // Cleanup model
    if (this.live2dModel) {
      if (typeof this.live2dModel.release === "function") {
        this.live2dModel.release();
      }
      this.live2dModel = null;
    }

    // Remove event listeners
    this.eventListeners.clear();

    // Clear canvas
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    this.logger.info("✓ Renderer destroyed");
  }
}

/**
 * Live2DDesktopMate class - simplified wrapper
 */
class Live2DDesktopMate {
  constructor(options = {}) {
    this.logger = new RendererLogger("[Live2DDesktopMate]");
    this.logger.info("Initializing desktop mate...", { options });

    this.options = {
      container: "body",
      width: 400,
      height: 600,
      alwaysOnTop: true,
      clickThrough: false,
      enableWindowControls: true,
      modelPath: globalThis.MODEL_PATH || "models/Hiyori/Hiyori.model3.json",
      ...options,
    };

    this.renderer = null;
    this.canvas = null;
    this.windowElement = null;
    this.isInitialized = false;

    this.init();
  }

  async init() {
    try {
      // Use existing canvas or create new one
      this.canvas = document.getElementById("live2dCanvas");

      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;

        if (this.options.container === "body") {
          document.body.appendChild(this.canvas);
        } else {
          const container = document.querySelector(this.options.container);
          if (container) {
            container.appendChild(this.canvas);
          } else {
            throw new Error("Container not found");
          }
        }
      }

      // Create renderer
      this.renderer = new Live2DRenderer(this.canvas, {
        premultipliedAlpha: true,
        enableMotions: true,
        enableExpressions: true,
        enablePhysics: true,
        autoBreathing: true,
      });

      this.isInitialized = true;
      this.logger.info("✓ Desktop mate initialized");
    } catch (error) {
      this.logger.error("Failed to initialize desktop mate", error);
      throw error;
    }
  }

  async loadModel(modelPath) {
    if (!this.renderer) {
      throw new Error("Renderer not initialized");
    }

    this.logger.info("Loading model...", { path: modelPath });
    return await this.renderer.loadModel(modelPath);
  }

  startAnimation() {
    if (this.renderer) {
      this.renderer.startRenderLoop();
    }
  }

  stopAnimation() {
    if (this.renderer) {
      this.renderer.stopRenderLoop();
    }
  }

  setExpression(name) {
    if (this.renderer) {
      this.renderer.setExpression(name);
    }
  }

  playMotion(group, index, priority = 3) {
    if (this.renderer) {
      return this.renderer.playMotion(group, index, priority);
    }
    return false;
  }

  setParameter(id, value) {
    if (this.renderer) {
      this.renderer.setParameter(id, value);
    }
  }

  on(event, callback) {
    if (this.renderer) {
      this.renderer.on(event, callback);
    }
  }

  destroy() {
    this.logger.info("Destroying desktop mate...");

    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.logger.info("✓ Desktop mate destroyed");
  }
}

// Export classes
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = { Live2DRenderer, Live2DDesktopMate, Matrix44 };
} else if (typeof window !== "undefined") {
  window.Live2DRenderer = Live2DRenderer;
  window.Live2DDesktopMate = Live2DDesktopMate;
  window.Matrix44 = Matrix44;
}
