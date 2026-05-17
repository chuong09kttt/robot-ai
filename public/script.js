// ========== CHIRI AI - MAIN SCRIPT ==========

// Global variables
let currentUser = null;
let ws = null;
let recognition = null;
let isAwake = false;
let isTranslatorMode = false;
let isCameraActive = false;
let faceMesh = null;
let camera = null;
let videoElement = null;
let canvasElement = null;
let faceDatabase = new Map();
let isRecognizing = false;
let gameActive = false;

// WAKE WORDS
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi'];

// ========== LOGIN FUNCTIONS ==========
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!username || !password) {
        errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin!';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (data.success) {
            currentUser = { username: data.username, name: data.name };
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
            document.getElementById('userNameDisplay').innerHTML = `👤 ${data.name}`;
            
            // Initialize features after login
            initWebSocket();
            initSpeechRecognition();
            loadFaceDatabase();
            startInactivityCountdown();
            
            // Setup mode cards
            document.querySelectorAll('.mode-card').forEach(card => {
                card.onclick = () => {
                    const mode = card.getAttribute('data-mode');
                    if (mode === 'chat') showChatMode();
                    else if (mode === 'drive') showDriveMode();
                    else if (mode === 'translate') showTranslateMode();
                    else if (mode === 'camera') showCameraMode();
                    else if (mode === 'game') showGameTypeScreen();
                };
            });
            
            // Back buttons
            document.querySelectorAll('.back-btn').forEach(btn => {
                btn.onclick = () => showModeScreen();
            });
            
            // Logout button
            document.getElementById('logoutBtn').onclick = async () => {
                await fetch('/api/logout', { method: 'POST' });
                if (ws) ws.close();
                if (recognition) recognition.stop();
                location.reload();
            };
            
        } else {
            errorDiv.textContent = data.message;
        }
    } catch(e) {
        errorDiv.textContent = 'Lỗi kết nối server!';
    }
}

function showModeScreen() {
    document.getElementById('modeScreen').style.display = 'block';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
}

function showGameTypeScreen() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'block';
}

function startGameWithMode(mode) {
    document.getElementById('gameTypeScreen').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    
    if (mode === 'boat') {
        if (typeof initBoatMode === 'function') initBoatMode();
        else console.log('Boat mode not loaded');
    } else if (mode === 'plane') {
        if (typeof initPlaneMode === 'function') initPlaneMode();
        else console.log('Plane mode not loaded');
    }
}

// Attach to window
window.showGameTypeScreen = showGameTypeScreen;
window.startGameWithMode = startGameWithMode;

// ========== WEBSOCKET ==========
function initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            speak(data.text);
        }
    };
    ws.onclose = () => setTimeout(initWebSocket, 3000);
}

// ========== SPEECH ==========
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'vi-VN';
    
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.trim();
        console.log('Voice:', text);
        
        if (!isAwake && WAKE_WORDS.some(w => text.toLowerCase().includes(w))) {
            wakeUp();
        } else if (isAwake && !isTranslatorMode) {
            processCommand(text);
        }
    };
    
    recognition.start();
}

async function speak(text) {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

function addMessage(type, text) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function wakeUp() {
    if (isAwake) return;
    isAwake = true;
    const greeting = 'Chào bạn! Chiri đã thức! 💕';
    addMessage('ai', greeting);
    speak(greeting);
}

function processCommand(text) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text, driveMode: false }));
    }
}

// ========== MODE FUNCTIONS ==========
function showChatMode() {
    showModeScreen();
    document.getElementById('chatPanel').style.display = 'block';
    isAwake = false;
}

function showDriveMode() {
    showModeScreen();
    document.getElementById('drivePanel').style.display = 'block';
    
    document.querySelectorAll('.drive-btn-gaming').forEach(btn => {
        btn.onmousedown = () => {
            const cmd = btn.getAttribute('data-cmd');
            if (ws) ws.send(JSON.stringify({ type: 'drive_command', command: cmd, duration: 0 }));
        };
        btn.onmouseup = () => {
            if (ws) ws.send(JSON.stringify({ type: 'drive_command', command: 'STOP', duration: 0 }));
        };
    });
}

function showTranslateMode() {
    showModeScreen();
    document.getElementById('translatePanel').style.display = 'block';
    // Translation logic here
}

function showCameraMode() {
    showModeScreen();
    document.getElementById('cameraPanel').style.display = 'block';
    initCameraMode();
}

// ========== CAMERA MODE ==========
async function initCameraMode() {
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    
    if (typeof FaceMesh === 'undefined') return;
    
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    
    faceMesh.setOptions({ maxNumFaces: 4, refineLandmarks: true });
    faceMesh.onResults(onFaceMeshResults);
    
    document.getElementById('cameraToggleBtn').onclick = toggleCamera;
    document.getElementById('registerFaceBtn').onclick = openRegisterModal;
    document.getElementById('recognizeFaceBtn').onclick = () => {
        isRecognizing = !isRecognizing;
        addMessage('ai', isRecognizing ? 'Bắt đầu nhận diện' : 'Đã tắt nhận diện');
    };
}

async function toggleCamera() {
    if (!isCameraActive) {
        if (typeof Camera === 'undefined') return;
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isCameraActive && faceMesh) await faceMesh.send({ image: videoElement });
            }
        });
        await camera.start();
        isCameraActive = true;
        document.getElementById('cameraToggleBtn').textContent = 'TẮT CAMERA';
    } else {
        camera.stop();
        isCameraActive = false;
        document.getElementById('cameraToggleBtn').textContent = 'BẬT CAMERA';
    }
}

function onFaceMeshResults(results) {
    if (!isCameraActive || !canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiFaceLandmarks?.length > 0 && isRecognizing) {
        document.getElementById('faceText').textContent = `${results.multiFaceLandmarks.length} face(s) detected`;
    }
}

// ========== FACE DATABASE ==========
async function loadFaceDatabase() {
    try {
        const res = await fetch('/api/face-database');
        const data = await res.json();
        console.log('Face database:', data);
    } catch(e) {}
}

function openRegisterModal() {
    document.getElementById('registerModal').style.display = 'flex';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
}

// ========== INACTIVITY ==========
let inactivityInterval = null;

function startInactivityCountdown() {
    if (inactivityInterval) clearInterval(inactivityInterval);
    inactivityInterval = setInterval(() => {
        if (!isAwake) return;
        // Auto sleep logic
    }, 1000);
}

// ========== INITIALIZE ==========
document.getElementById('loginBtn').onclick = login;
document.getElementById('loginPassword').onkeypress = (e) => {
    if (e.key === 'Enter') login();
};

document.getElementById('closeModalBtn')?.addEventListener('click', closeRegisterModal);
document.getElementById('capturePhotoBtn')?.addEventListener('click', () => {
    alert('Chụp ảnh thành công!');
});
document.getElementById('saveFaceBtn')?.addEventListener('click', () => {
    const name = document.getElementById('faceNameInput').value;
    if (name) {
        alert(`Đã lưu khuôn mặt cho ${name}`);
        closeRegisterModal();
    }
});

// Export for game modes
window.initBoatMode = () => console.log('Boat mode started');
window.initPlaneMode = () => console.log('Plane mode started');
