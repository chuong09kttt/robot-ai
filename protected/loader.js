// ========== CHIRI AI SECURE LOADER ==========
(function(){
    'use strict';
    
    async function checkAuthentication() {
        try {
            const response = await fetch('/api/auth/check', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.authenticated) {
                loadApplication();
            } else {
                showLoginScreen();
            }
        } catch (error) {
            showLoginScreen();
        }
    }
    
    function loadApplication() {
        // Scripts to load in correct order
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
                console.log('All modules loaded');
                return;
            }
            
            const script = document.createElement('script');
            script.src = scripts[index];
            script.type = 'text/javascript';
            script.onload = () => {
                loadedCount++;
                loadScript(index + 1);
            };
            script.onerror = () => {
                console.error(`Failed to load: ${scripts[index]}`);
                loadScript(index + 1);
            };
            document.head.appendChild(script);
        }
        
        loadScript(0);
    }
    
    function showLoginScreen() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-container">
                    <div class="login-robot-glow">🐹</div>
                    <h1 class="gaming-title">CHIRI <span>AI</span></h1>
                    <div class="gaming-subtitle">SECURE EDITION</div>
                    <div class="version-tag">v13.0 | MAX SECURITY</div>
                    
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
        `;
        
        document.getElementById('loginBtn').onclick = handleLogin;
        document.getElementById('loginPassword').onkeypress = (e) => {
            if (e.key === 'Enter') handleLogin();
        };
    }
    
    async function handleLogin() {
        const username = document.getElementById('loginUsername')?.value || '';
        const password = document.getElementById('loginPassword')?.value || '';
        const errorDiv = document.getElementById('loginError');
        
        if (!username || !password) {
            if (errorDiv) errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin!';
            return;
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
                window.location.reload();
            } else {
                if (errorDiv) errorDiv.textContent = data.message;
            }
        } catch (error) {
            if (errorDiv) errorDiv.textContent = 'Lỗi kết nối server!';
        }
    }
    
    checkAuthentication();
})();
