// ========== SECURE LOADER ==========
// This file will be minified and obfuscated

(async function() {
    try {
        // Check authentication
        const response = await fetch('/api/auth/check', { 
            credentials: 'include' 
        });
        const data = await response.json();
        
        if (data.authenticated) {
            // Load main application
            loadScript('/protected/js/app.js');
            loadScript('/protected/js/modules/chat.js');
            loadScript('/protected/js/modules/drive.js');
            loadScript('/protected/js/modules/translate.js');
            loadScript('/protected/js/modules/camera.js');
            loadScript('/protected/js/modules/game.js');
        } else {
            showLoginScreen();
        }
    } catch(e) {
        showLoginScreen();
    }
})();

function loadScript(src) {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    document.head.appendChild(script);
}

function showLoginScreen() {
    const app = document.getElementById('app');
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
    
    document.getElementById('loginBtn').onclick = login;
    document.getElementById('loginPassword').onkeypress = (e) => {
        if (e.key === 'Enter') login();
    };
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            location.reload();
        } else {
            errorDiv.textContent = data.message;
        }
    } catch(e) {
        errorDiv.textContent = 'Lỗi kết nối server!';
    }
}
