// ========== CHIRI AI SECURE LOADER ==========
(function(){
    'use strict';
    
    const APP_VERSION = "13.0.0";
    
    // Log function
    function log(message, type = 'info') {
        console.log(`[CHIRI] ${message}`);
    }
    
    // Check authentication
    async function checkAuthentication() {
        log('Checking authentication...');
        
        try {
            const response = await fetch('/api/auth/check', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.authenticated) {
                log('User authenticated, loading application...');
                loadApplication();
            } else {
                log('User not authenticated, showing login screen');
                showLoginScreen();
            }
        } catch (error) {
            log('Authentication failed: ' + error.message, 'error');
            showLoginScreen();
        }
    }
    
    // Load all modules
    function loadApplication() {
        // List of scripts to load in correct order
        const scripts = [
            '/protected/modules/tracking.js',
            '/protected/app.js',
            '/protected/modules/chat.js',
            '/protected/modules/drive.js',
            '/protected/modules/translate.js',
            '/protected/modules/camera.js',
            '/protected/modules/game.js'
        ];
        
        let loadedCount = 0;
        
        function loadScript(index) {
            if (index >= scripts.length) {
                log(`All ${loadedCount} modules loaded successfully`);
                // Dispatch event when all modules are loaded
                window.dispatchEvent(new Event('chiri-modules-loaded'));
                return;
            }
            
            const script = document.createElement('script');
            script.src = scripts[index];
            script.type = 'text/javascript';
            script.onload = () => {
                loadedCount++;
                log(`Loaded: ${scripts[index]}`);
                loadScript(index + 1);
            };
            script.onerror = (err) => {
                log(`Failed to load: ${scripts[index]}`, 'error');
                console.error(err);
                loadScript(index + 1);
            };
            document.head.appendChild(script);
        }
        
        loadScript(0);
    }
    
    // Show login screen
    function showLoginScreen() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-container">
                    <div class="login-robot-glow">🐹</div>
                    <h1 class="gaming-title">CHIRI <span>AI</span></h1>
                    <div class="gaming-subtitle">SECURE EDITION</div>
                    <div class="version-tag">v${APP_VERSION} | MAX SECURITY</div>
                    
                    <div class="login-form">
                        <div class="input-group">
                            <span class="input-icon">👤</span>
                            <input type="text" id="loginUsername" placeholder="USERNAME" autocomplete="off">
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
        `;
        
        const loginBtn = document.getElementById('loginBtn');
        const passwordInput = document.getElementById('loginPassword');
        
        if (loginBtn) {
            loginBtn.onclick = handleLogin;
        }
        if (passwordInput) {
            passwordInput.onkeypress = (e) => {
                if (e.key === 'Enter') handleLogin();
            };
        }
    }
    
    // Handle login
    async function handleLogin() {
        const username = document.getElementById('loginUsername')?.value || '';
        const password = document.getElementById('loginPassword')?.value || '';
        const errorDiv = document.getElementById('loginError');
        
        if (!username || !password) {
            if (errorDiv) errorDiv.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu!';
            return;
        }
        
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.textContent = 'ĐANG XỬ LÝ...';
            loginBtn.disabled = true;
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                log(`Login successful: ${username}`);
                window.location.reload();
            } else {
                if (errorDiv) errorDiv.textContent = data.message || 'Đăng nhập thất bại!';
                if (loginBtn) {
                    loginBtn.textContent = 'ĐĂNG NHẬP';
                    loginBtn.disabled = false;
                }
            }
        } catch (error) {
            if (errorDiv) errorDiv.textContent = 'Lỗi kết nối server!';
            if (loginBtn) {
                loginBtn.textContent = 'ĐĂNG NHẬP';
                loginBtn.disabled = false;
            }
        }
    }
    
    // Start
    checkAuthentication();
})();
