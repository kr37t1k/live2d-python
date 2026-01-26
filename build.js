/**
 * Build Script for Live2D Desktop Mate
 * Packages all components into a production-ready bundle
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
    input: {
        js: [
            './web/live2dcubismcore.min.js',
            './web/cubismframework.js',
            './web/cubismrenderer.js',
            './web/Live2DRenderer.js'
        ],
        html: [
            './web/index.html',
            './web/desktop_mate.html'
        ]
    },
    output: {
        dir: './dist',
        js: 'live2d-desktop-mate.min.js',
        css: 'live2d-desktop-mate.min.css'
    },
    assets: [
        './web/models/**/*'
    ]
};

// Create dist directory
function createDistDir() {
    if (!fs.existsSync(config.output.dir)) {
        fs.mkdirSync(config.output.dir, { recursive: true });
        console.log('✓ Created dist directory');
    }
}

// Copy assets
function copyAssets() {
    // Copy models
    const modelsSrc = './web/models';
    const modelsDest = path.join(config.output.dir, 'models');
    
    if (fs.existsSync(modelsSrc)) {
        copyRecursive(modelsSrc, modelsDest);
        console.log('✓ Copied model assets');
    }
    
    // Copy other assets
    const otherAssets = ['./web/styles.css'];
    for (const asset of otherAssets) {
        if (fs.existsSync(asset)) {
            const dest = path.join(config.output.dir, path.basename(asset));
            fs.copyFileSync(asset, dest);
            console.log(`✓ Copied ${asset}`);
        }
    }
}

// Recursive copy function
function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Bundle JavaScript files
function bundleJs() {
    let bundledCode = '';
    
    // Add banner
    bundledCode += `/* Live2D Desktop Mate - Production Bundle */\n`;
    bundledCode += `/* Built on ${new Date().toISOString()} */\n\n`;
    
    // Add each JS file
    for (const file of config.input.js) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            bundledCode += `/* ${file} */\n`;
            bundledCode += content;
            bundledCode += '\n\n';
            console.log(`✓ Added ${file}`);
        } else {
            console.warn(`⚠ File not found: ${file}`);
        }
    }
    
    // Write bundled file
    const outputPath = path.join(config.output.dir, config.output.js);
    fs.writeFileSync(outputPath, bundledCode);
    console.log(`✓ Bundled JavaScript to ${outputPath}`);
    
    // Minify if terser is available
    try {
        const terser = require('terser');
        minifyJs(outputPath);
    } catch (e) {
        console.log('ℹ Terser not found, skipping minification. Install with: npm install terser');
    }
}

// Minify JavaScript with terser
function minifyJs(inputPath) {
    try {
        const terser = require('terser');
        const code = fs.readFileSync(inputPath, 'utf8');
        
        const result = terser.minify(code, {
            compress: {
                drop_console: true,
                drop_debugger: true
            },
            mangle: true
        });
        
        if (result.error) {
            console.error('Minification error:', result.error);
            return;
        }
        
        const minifiedPath = inputPath.replace('.js', '.min.js');
        fs.writeFileSync(minifiedPath, result.code);
        console.log(`✓ Minified JavaScript to ${minifiedPath}`);
    } catch (e) {
        console.error('Minification failed:', e.message);
    }
}

// Copy HTML files
function copyHtml() {
    for (const file of config.input.html) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            const outputPath = path.join(config.output.dir, path.basename(file));
            fs.writeFileSync(outputPath, content);
            console.log(`✓ Copied ${file} to ${outputPath}`);
        }
    }
}

// Create package.json for the bundle
function createPackageJson() {
    const pkg = {
        name: "live2d-desktop-mate",
        version: "1.0.0",
        description: "Production-ready Live2D desktop mascot application",
        main: "live2d-desktop-mate.min.js",
        scripts: {
            start: "python main.py",
            "serve": "python -m http.server 8000"
        },
        keywords: ["live2d", "desktop", "mascot", "animation"],
        author: "Live2D Desktop Mate",
        license: "MIT"
    };
    
    const outputPath = path.join(config.output.dir, 'package.json');
    fs.writeFileSync(outputPath, JSON.stringify(pkg, null, 2));
    console.log(`✓ Created package.json at ${outputPath}`);
}

// Create README for distribution
function createReadme() {
    const readmeContent = `# Live2D Desktop Mate - Production Build

This is a production-ready build of the Live2D Desktop Mate application.

## Files Included:
- \`live2d-desktop-mate.min.js\` - Main JavaScript bundle
- \`models/\` - Live2D model assets
- \`index.html\` - Main application interface
- \`desktop_mate.html\` - Standalone desktop overlay mode

## Usage:

### As a Web Application:
Simply open \`index.html\` in a modern browser.

### As a Desktop Overlay:
Open \`desktop_mate.html\` in a browser with appropriate flags for transparent windows.

### With Python Backend:
Run the main application:
\`\`\`
python main.py
\`\`\`

## Features:
- Full Live2D Cubism SDK support
- Real-time parameter control
- Expression and motion playback
- Physics simulation
- Lip sync capability
- Mouse interaction
- Draggable window

## Requirements:
- Modern browser with WebGL support
- Live2D Cubism SDK files included

## API:
The application provides both WebSocket and REST APIs for external control.
`;

    const outputPath = path.join(config.output.dir, 'README.md');
    fs.writeFileSync(outputPath, readmeContent);
    console.log(`✓ Created README.md at ${outputPath}`);
}

// Main build function
function build() {
    console.log('📦 Starting Live2D Desktop Mate build process...\n');
    
    try {
        createDistDir();
        bundleJs();
        copyHtml();
        copyAssets();
        createPackageJson();
        createReadme();
        
        console.log('\n🎉 Build completed successfully!');
        console.log(`📁 Output directory: ${config.output.dir}`);
        console.log(`📋 Files created:`);
        
        const files = fs.readdirSync(config.output.dir);
        for (const file of files) {
            console.log(`   - ${file}`);
        }
        
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        process.exit(1);
    }
}

// Run build if called directly
if (require.main === module) {
    build();
}

module.exports = {
    build,
    config
};