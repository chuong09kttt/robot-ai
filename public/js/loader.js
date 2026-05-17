// ========== CHIRI AI - SECURE LOADER ==========
// This file is obfuscated in production
// Below is the development version

console.log('🔐 Secure module loading...');

// WebSocket connection
const socket = io({
    path: '/ws',
    transports: ['websocket'],
    reconnection: true
});

socket.on('connect', () => {
    console.log('🔌 Secure WebSocket connected');
});

// Game state
let gameActive = false;
let currentMode = null;

// Initialize main app
async function initApp() {
    // Load face detection module
    await loadFaceDetection();
    
    // Load chat module
    await loadChatModule();
    
    // Show mode selection
    showModeScreen();
    
    document.getElementById('loading')?.remove();
}

async function loadFaceDetection() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
}

async function loadChatModule() {
    // Chat functionality
    window.initChat = function() {
        console.log('Chat mode initialized');
        // Chat logic here
    };
}

function showModeScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="mode-screen">
            <div class="gaming-bg"></div>
            <div class="mode-container">
                <div class="user-header">
                    <span class="user-name">👤 USER</span>
                    <button id="logoutBtn" class="logout-gaming">⏻ EXIT</button>
                </div>
                <div class="mode-grid">
                    <div class="mode-card" data-mode="chat">
                        <div class="mode-icon">💬</div>
                        <div class="mode-name">CHAT MODE</div>
                        <div class="mode-badge">AI</div>
                    </div>
                    <div class="mode-card" data-mode="game">
                        <div class="mode-icon">🎮</div>
                        <div class="mode-name">GAME MODE</div>
                        <div class="mode-badge">BODY TRACKING</div>
                    </div>
                    <div class="mode-card" data-mode="camera">
                        <div class="mode-icon">📷</div>
                        <div class="mode-name">CAMERA MODE</div>
                        <div class="mode-badge">FACE ID</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.mode-card').forEach(card => {
        card.onclick = () => {
            const mode = card.dataset.mode;
            if (mode === 'game') showGameTypeScreen();
            else if (mode === 'chat') showChatMode();
            else if (mode === 'camera') showCameraMode();
        };
    });
    
    document.getElementById('logoutBtn').onclick = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        location.reload();
    };
}

function showGameTypeScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="mode-screen">
            <div class="gaming-bg"></div>
            <div class="mode-container">
                <div class="user-header">
                    <span class="user-name">🎮 CHỌN CHẾ ĐỘ</span>
                    <button id="backBtn" class="logout-gaming">⌂ BACK</button>
                </div>
                <div class="mode-grid">
                    <div class="mode-card" id="selectBoat">
                        <div class="mode-icon">🚤</div>
                        <div class="mode-name">CHẾ ĐỘ THUYỀN</div>
                        <div class="mode-desc">Điều khiển thuyền trên biển</div>
                    </div>
                    <div class="mode-card" id="selectPlane">
                        <div class="mode-icon">✈️</div>
                        <div class="mode-name">CHẾ ĐỘ MÁY BAY</div>
                        <div class="mode-desc">Bay trên bầu trời</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('selectBoat').onclick = () => startGame('boat');
    document.getElementById('selectPlane').onclick = () => startGame('plane');
    document.getElementById('backBtn').onclick = showModeScreen;
}

async function startGame(mode) {
    currentMode = mode;
    
    // Initialize game session on server
    const res = await fetch('/api/game/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
        credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
        showGameScreen(mode, data.game);
    }
}

function showGameScreen(mode, gameData) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="game-container">
            <canvas id="gameCanvas"></canvas>
            <video id="webcam" autoplay playsinline muted></video>
            <div id="gameHud">
                <div id="gameSpeed">🚀 Speed: 0</div>
                <div id="gameScore">💰 Score: ${gameData.score}</div>
                <div id="gameLives">❤️ Lives: ${gameData.lives}</div>
                <div id="gameStatus">🎮 ${mode === 'boat' ? 'OCEAN RACING' : 'SKY RACING'}</div>
            </div>
            <div class="game-instruction">
                🎮 <span>ĐIỀU KHIỂN:</span> ${mode === 'boat' ? 'Giơ 2 tay như vô lăng → xoay để lái' : 'Dang 2 tay sang 2 bên → nghiêng để lượn'} | Đầu cao → tăng tốc | Nắm tay → bắn
            </div>
            <button id="backToMenu" class="back-btn-game">🏠 HOME</button>
        </div>
    `;
    
    document.getElementById('backToMenu').onclick = showModeScreen;
    
    // Initialize tracking and game loop
    initGameTracking(mode);
}

function initGameTracking(mode) {
    // Body tracking logic
    console.log(`🎮 Starting ${mode} mode with secure tracking`);
    // Game loop here
}

window.initApp = initApp;
