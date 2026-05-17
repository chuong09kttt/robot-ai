// ========== BUILD SCRIPT ==========
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { protectJavaScript, addWatermarkToCSS, addWatermarkToHTML } = require('../src/utils/watermark');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function log(message, color = 'blue') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Ensure directories exist
function ensureDirectories() {
    const dirs = [
        'protected/js/modules',
        'protected/wasm',
        'database',
        'public/css',
        'public/js'
    ];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            log(`✅ Created directory: ${dir}`, 'green');
        }
    }
}

// Build WebAssembly from C++
function buildWasm() {
    log('\n🔧 Building WebAssembly...', 'yellow');
    
    const wasmSource = path.join(__dirname, '../wasm/game.cpp');
    const wasmOutput = path.join(__dirname, '../protected/wasm/game.wasm');
    
    if (!fs.existsSync(wasmSource)) {
        log('⚠️ No WASM source found, skipping...', 'yellow');
        return;
    }
    
    try {
        // Check if emcc is available
        execSync('emcc --version', { stdio: 'ignore' });
        
        // Compile C++ to WASM
        execSync(`emcc ${wasmSource} -o ${wasmOutput} -s WASM=1 -s EXPORTED_FUNCTIONS="['_game_init','_game_update','_game_get_score']" -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']"`, { stdio: 'inherit' });
        log('✅ WebAssembly built successfully!', 'green');
    } catch (error) {
        log('⚠️ Emscripten not installed, skipping WASM build', 'yellow');
        log('   Install with: brew install emscripten (Mac) or apt-get install emscripten (Linux)', 'yellow');
    }
}

// Obfuscate JavaScript files
function obfuscateJS() {
    log('\n🔒 Obfuscating JavaScript files...', 'yellow');
    
    try {
        execSync('node scripts/obfuscate.js', { stdio: 'inherit' });
        log('✅ JavaScript obfuscation complete!', 'green');
    } catch (error) {
        log('❌ Obfuscation failed: ' + error.message, 'red');
    }
}

// Minify CSS
function minifyCSS() {
    log('\n🎨 Minifying CSS...', 'yellow');
    
    const cssSource = path.join(__dirname, '../public/css/style.css');
    const cssOutput = path.join(__dirname, '../public/css/style.min.css');
    
    if (!fs.existsSync(cssSource)) {
        log('⚠️ No CSS source found, skipping...', 'yellow');
        return;
    }
    
    try {
        execSync(`cleancss -o ${cssOutput} ${cssSource}`, { stdio: 'inherit' });
        log('✅ CSS minified successfully!', 'green');
    } catch (error) {
        log('⚠️ clean-css not installed, using fallback', 'yellow');
        // Fallback: simple minification
        let css = fs.readFileSync(cssSource, 'utf8');
        css = css.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove comments
        css = css.replace(/\s+/g, ' '); // Remove extra whitespace
        css = css.replace(/;\s*}/g, '}'); // Remove last semicolon
        fs.writeFileSync(cssOutput, css);
        log('✅ CSS minified with fallback!', 'green');
    }
}

// Generate loader.js
function generateLoader() {
    log('\n📄 Generating loader.js...', 'yellow');
    
    const loaderPath = path.join(__dirname, '../protected/loader.js');
    const loaderContent = `// ========== CHIRI AI SECURE LOADER ==========
// This file is minified and protected

(function(){
    const APP_VERSION = "13.0.0";
    const BUILD_DATE = "${new Date().toISOString()}";
    
    async function checkAuth(){
        try{
            const res=await fetch('/api/auth/check',{credentials:'include'});
            const data=await res.json();
            if(data.authenticated){
                loadApp();
            }else{
                showLogin();
            }
        }catch(e){
            showLogin();
        }
    }
    
    function loadApp(){
        const scripts=['/protected/js/app.js','/protected/js/modules/chat.js','/protected/js/modules/drive.js','/protected/js/modules/translate.js','/protected/js/modules/camera.js','/protected/js/modules/game.js'];
        scripts.forEach(src=>{
            const s=document.createElement('script');
            s.src=src;
            s.type='text/javascript';
            document.head.appendChild(s);
        });
    }
    
    function showLogin(){
        document.getElementById('app').innerHTML=\`
            <div class="login-screen">
                <div class="login-container">
                    <div class="login-robot-glow">🐹</div>
                    <h1 class="gaming-title">CHIRI <span>AI</span></h1>
                    <div class="gaming-subtitle">SECURE EDITION</div>
                    <div class="version-tag">v\${APP_VERSION} | MAX SECURITY</div>
                    <div class="login-form">
                        <div class="input-group">
                            <span class="input-icon">👤</span>
                            <input type="text" id="loginUsername" placeholder="USERNAME">
                        </div>
                        <div class="input-group">
                            <span class="input-icon">🔒</span>
                            <input type="password" id="loginPassword" placeholder="PASSWORD">
                        </div>
                        <button id="loginBtn" class="gaming-btn">ĐĂNG NHẬP</button>
                        <div class="login-error" id="loginError"></div>
                    </div>
                    <div class="login-hint">
                        <div class="hint-title">⚡ ACCESS CODE</div>
                        <div class="hint-item">admin / admin123</div>
                        <div class="hint-item">ch / 123</div>
                    </div>
                </div>
            </div>
        \`;
        
        document.getElementById('loginBtn').onclick=login;
        document.getElementById('loginPassword').onkeypress=e=>{if(e.key==='Enter')login();};
    }
    
    async function login(){
        const username=document.getElementById('loginUsername').value;
        const password=document.getElementById('loginPassword').value;
        const errorDiv=document.getElementById('loginError');
        try{
            const res=await fetch('/api/auth/login',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({username,password}),
                credentials:'include'
            });
            const data=await res.json();
            if(data.success){
                location.reload();
            }else{
                errorDiv.textContent=data.message;
            }
        }catch(e){
            errorDiv.textContent='Lỗi kết nối server!';
        }
    }
    
    checkAuth();
})();
`;
    
    fs.writeFileSync(loaderPath, loaderContent);
    log('✅ loader.js generated!', 'green');
}

// Generate empty database files
function initDatabase() {
    log('\n💾 Initializing database...', 'yellow');
    
    const facesPath = path.join(__dirname, '../database/faces.enc');
    const usersPath = path.join(__dirname, '../database/users.enc');
    
    if (!fs.existsSync(facesPath)) {
        fs.writeFileSync(facesPath, JSON.stringify({ encrypted: '', iv: '', authTag: '' }));
        log('✅ faces.enc created', 'green');
    }
    
    if (!fs.existsSync(usersPath)) {
        fs.writeFileSync(usersPath, JSON.stringify({}));
        log('✅ users.enc created', 'green');
    }
}

// Create logs directory
function initLogs() {
    const logsPath = path.join(__dirname, '../database/logs');
    if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
        log('✅ logs directory created', 'green');
    }
}

// Generate version info
function generateVersionInfo() {
    log('\n📝 Generating version info...', 'yellow');
    
    const versionPath = path.join(__dirname, '../protected/version.json');
    const versionInfo = {
        version: '13.0.0',
        buildDate: new Date().toISOString(),
        buildNumber: process.env.BUILD_NUMBER || '1',
        features: ['chat', 'drive', 'translate', 'camera', 'face', 'game'],
        security: ['session-fingerprint', 'watermark', 'obfuscation', 'encrypted-db']
    };
    
    fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
    log('✅ version.json generated!', 'green');
}


// Generate loader.js
function generateLoader() {
    log('\n📄 Generating loader.js...', 'yellow');
    
    const sourceLoaderPath = path.join(__dirname, '../protected/loader.js');
    const targetLoaderPath = path.join(__dirname, '../public/js/loader.js');
    
    // Ensure public/js directory exists
    const publicJsDir = path.join(__dirname, '../public/js');
    if (!fs.existsSync(publicJsDir)) {
        fs.mkdirSync(publicJsDir, { recursive: true });
    }
    
    // Copy loader.js to public/js
    if (fs.existsSync(sourceLoaderPath)) {
        fs.copyFileSync(sourceLoaderPath, targetLoaderPath);
        log('✅ loader.js copied to public/js/', 'green');
    } else {
        log('⚠️ loader.js source not found', 'yellow');
    }
}


// Main build function
async function build() {
    log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
    log('║         🚀 CHIRI AI - BUILD SYSTEM v13.0                   ║', 'blue');
    log('╚════════════════════════════════════════════════════════════╝', 'blue');
    
    ensureDirectories();
    generateLoader();
    obfuscateJS();
    minifyCSS();
    buildWasm();
    initDatabase();
    initLogs();
    generateVersionInfo();
    
    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║         ✅ BUILD COMPLETED SUCCESSFULLY!                   ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝', 'green');
    log('\n📦 Output directory: protected/', 'yellow');
    log('📦 Database directory: database/', 'yellow');
    log('📦 Public directory: public/', 'yellow');
}

// Run build
build().catch(console.error);
