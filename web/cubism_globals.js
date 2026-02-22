/**
 * Cubism Globals Bridge
 * This file extracts classes from UMD modules and makes them globally available
 * Must be loaded AFTER cubismframework.js, cubismmatrix44.js, and cubismrenderer.js
 */

(function() {
    'use strict';

    console.log('[CubismGlobals] Setting up global class exports...');

    // CubismMatrix44 - check if already global from cubismmatrix44.js
    if (typeof window.CubismMatrix44 === 'undefined') {
        if (typeof cubismframework !== 'undefined' && cubismframework.CubismMatrix44) {
            window.CubismMatrix44 = cubismframework.CubismMatrix44;
            console.log('[CubismGlobals] CubismMatrix44 exported from cubismframework');
        } else if (typeof CubismMatrix44 !== 'undefined') {
            window.CubismMatrix44 = CubismMatrix44;
            console.log('[CubismGlobals] CubismMatrix44 already global');
        }
    }

    // csmVector - for vectors/arrays
    if (typeof window.csmVector === 'undefined') {
        if (typeof cubismframework !== 'undefined' && cubismframework.csmVector) {
            window.csmVector = cubismframework.csmVector;
            console.log('[CubismGlobals] csmVector exported globally');
        }
    }

    // csmMap - for maps/dictionaries
    if (typeof window.csmMap === 'undefined') {
        if (typeof cubismframework !== 'undefined' && cubismframework.csmMap) {
            window.csmMap = cubismframework.csmMap;
            console.log('[CubismGlobals] csmMap exported globally');
        }
    }

    // CubismRenderer - base renderer class
    if (typeof window.CubismRenderer === 'undefined') {
        if (typeof cubismrenderer !== 'undefined' && cubismrenderer.CubismRenderer) {
            window.CubismRenderer = cubismrenderer.CubismRenderer;
            console.log('[CubismGlobals] CubismRenderer exported globally');
        }
    }

    // CubismRenderer_WebGL - WebGL renderer
    if (typeof window.CubismRenderer_WebGL === 'undefined') {
        if (typeof cubismrenderer !== 'undefined' && cubismrenderer.CubismRenderer) {
            window.CubismRenderer_WebGL = cubismrenderer.CubismRenderer;
            console.log('[CubismGlobals] CubismRenderer_WebGL alias exported');
        }
    }

    // CubismClippingContext - for clipping masks
    if (typeof window.CubismClippingContext === 'undefined') {
        if (typeof cubismrenderer !== 'undefined' && cubismrenderer.CubismClippingContext) {
            window.CubismClippingContext = cubismrenderer.CubismClippingContext;
            console.log('[CubismGlobals] CubismClippingContext exported globally');
        }
    }

    // CubismTextureColor - for texture colors
    if (typeof window.CubismTextureColor === 'undefined') {
        if (typeof cubismrenderer !== 'undefined' && cubismrenderer.CubismTextureColor) {
            window.CubismTextureColor = cubismrenderer.CubismTextureColor;
            console.log('[CubismGlobals] CubismTextureColor exported globally');
        }
    }

    // CubismBlendMode - for blend modes
    if (typeof window.CubismBlendMode === 'undefined') {
        if (typeof cubismrenderer !== 'undefined' && cubismrenderer.CubismBlendMode) {
            window.CubismBlendMode = cubismrenderer.CubismBlendMode;
            console.log('[CubismGlobals] CubismBlendMode exported globally');
        }
    }

    // Verify all required classes are available
    const requiredClasses = [
        'CubismMatrix44',
        'CubismRenderer',
        'csmVector',
        'csmMap'
    ];

    let allAvailable = true;
    for (const className of requiredClasses) {
        if (typeof window[className] === 'undefined') {
            console.error(`[CubismGlobals] Missing required class: ${className}`);
            allAvailable = false;
        }
    }

    if (allAvailable) {
        console.log('[CubismGlobals] ✓ All required classes are available globally');
    } else {
        console.error('[CubismGlobals] ✗ Some required classes are missing!');
    }

})();

