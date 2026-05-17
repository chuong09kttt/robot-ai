// ========== CHIRI AI SECURE LOADER ==========
// Version: 13.0.0
// This file is minified and protected
// DO NOT MODIFY

(function(){
    'use strict';
    
    const APP_VERSION = "13.0.0";
    const BUILD_DATE = "2025-01-01";
    
    // ========== UTILITIES ==========
    function log(message, type = 'info') {
        if (type === 'error') {
            console.error('[CHIRI]', message);
        } else {
            console.log('[CHIRI]', message);
        }
    }
    
    function showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    // ========== AUTHENTICATION CHECK ==========
    async function checkAuthentication() {
        log('Checking authentication...');
        
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
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
            log('Authentication check failed: ' + error.message, 'error');
            showLoginScreen();
        }
    }
    
    // ========== LOAD MAIN APPLICATION ==========
    function loadApplication() {
        // Scripts to load in order
        const scripts = [
            '/protected/js/app.js',
            '/protected/js/modules/chat.js',
            '/protected/js/modules/drive.js',
            '/protected/js/modules/translate.js',
            '/protected/js/modules/camera.js',
            '/protected/js/modules/game.js'
        ];
        
        let loadedCount = 0;
        
        function loadScript(index) {
            if (index >= scripts.length) {
                log('All modules loaded successfully');
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
            script.onerror = () => {
                log(`Failed to load: ${scripts[index]}`, 'error');
                loadScript(index + 1);
            };
            document.head.appendChild(script);
        }
        
        loadScript(0);
    }
    
    // ========== LOGIN SCREEN ==========
    function showLoginScreen() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-container">
                    <div class="login-robot-glow">🐹</div>
                    <h1 class="gaming-title">CHIRI <span class="highlight">AI</span></h1>
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
                        <div class="login-error" id="loginError" style="display:none"></div>
                    </div>
                    
                    <div class="login-hint">
                        <div class="hint-title">⚡ ACCESS CODE</div>
                        <div class="hint-item">admin / admin123</div>
                        <div class="hint-item">ch / 123</div>
                    </div>
                </div>
            </div>
        `;
        
        // Attach login event handlers
        const loginBtn = document.getElementById('loginBtn');
        const passwordInput = document.getElementById('loginPassword');
        const usernameInput = document.getElementById('loginUsername');
        
        if (loginBtn) {
            loginBtn.onclick = () => handleLogin();
        }
        
        if (passwordInput) {
            passwordInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    handleLogin();
                }
            };
        }
        
        if (usernameInput) {
            usernameInput.focus();
        }
    }
    
    // ========== HANDLE LOGIN ==========
    async function handleLogin() {
        const username = document.getElementById('loginUsername')?.value || '';
        const password = document.getElementById('loginPassword')?.value || '';
        const errorDiv = document.getElementById('loginError');
        
        if (!username || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu!';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        // Show loading state
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.textContent = 'ĐANG XỬ LÝ...';
            loginBtn.disabled = true;
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                log(`Login successful: ${username}`);
                // Reload to trigger authentication check
                window.location.reload();
            } else {
                if (errorDiv) {
                    errorDiv.textContent = data.message || 'Đăng nhập thất bại!';
                    errorDiv.style.display = 'block';
                }
                // Reset button
                if (loginBtn) {
                    loginBtn.textContent = 'ĐĂNG NHẬP';
                    loginBtn.disabled = false;
                }
                // Clear password field
                const passwordInput = document.getElementById('loginPassword');
                if (passwordInput) passwordInput.value = '';
            }
        } catch (error) {
            log('Login error: ' + error.message, 'error');
            if (errorDiv) {
                errorDiv.textContent = 'Lỗi kết nối server! Vui lòng thử lại.';
                errorDiv.style.display = 'block';
            }
            if (loginBtn) {
                loginBtn.textContent = 'ĐĂNG NHẬP';
                loginBtn.disabled = false;
            }
        }
    }
    
    // ========== ANTI-DEBUGGING ==========
    function antiDebug() {
        // Detect DevTools
        let devToolsOpen = false;
        const element = new Image();
        
        Object.defineProperty(element, 'id', {
            get: function() {
                devToolsOpen = true;
                return '';
            }
        });
        
        setInterval(() => {
            console.log(element);
            console.clear();
            
            if (devToolsOpen) {
                document.body.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:#ff4444;display:flex;justify-content:center;align-items:center;font-size:24px;z-index:9999">🔒 Developer tools detected. Please close to continue.</div>';
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            }
        }, 1000);
        
        // Disable right click
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Disable F12, Ctrl+Shift+I, Ctrl+U
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.key === 'u') ||
                (e.ctrlKey && e.shiftKey && e.key === 'J') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C')) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    // ========== INITIALIZE ==========
    function init() {
        log(`CHIRI AI Secure Loader v${APP_VERSION}`);
        
        // Apply anti-debugging in production
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            antiDebug();
        }
        
        // Start authentication check
        checkAuthentication();
    }
    
    // Start the loader when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
