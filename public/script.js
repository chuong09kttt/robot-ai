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
let inactivityInterval = null;
let inactivitySeconds = 60;

// WAKE WORDS
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi'];

// ========== UI NAVIGATION ==========
function showModeScreen() {
    document.getElementById('modeScreen').style.display = 'block';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
    document.getElementById('registerModal').style.display = 'none';
    console.log('Show mode screen');
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
    console.log('Show login screen');
}

function showChatMode() {
    console.log('Showing Chat Mode');
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'block';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
    
    isAwake = false;
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
}

function showDriveMode() {
    console.log('Showing Drive Mode');
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'block';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
    
    initDriveMode();
}

function showTranslateMode() {
    console.log('Showing Translate Mode');
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'block';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
    
    initTranslateMode();
}

function showCameraMode() {
    console.log('Showing Camera Mode');
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'block';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'none';
    
    initCameraMode();
}

function showGameMode() {
    console.log('Showing Game Mode Selection');
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'block';
}

function showGameTypeScreen() {
    showGameMode();
}

// ========== LOGIN (ĐÃ SỬA - THÊM credentials: 'include') ==========
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    console.log('🔐 Login attempt:', username);
    
    if (!username || !password) {
        errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin!';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'  // QUAN TRỌNG: gửi cookie session
        });
        const data = await response.json();
        console.log('📥 Login response:', data);
        
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
                    else if (mode === 'game') showGameMode();
                };
            });
            
            // Back buttons
            document.querySelectorAll('.back-btn').forEach(btn => {
                btn.onclick = () => showModeScreen();
            });
            
            // Manual wake button
            const manualWakeBtn = document.getElementById('manualWakeBtn');
            if (manualWakeBtn) {
                manualWakeBtn.onclick = () => {
                    if (!isAwake) wakeUp();
                    else {
                        addMessage('ai', 'Chiri đang thức!');
                        speak('Chiri đang thức!');
                    }
                };
            }
            
            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                    if (ws) ws.close();
                    if (recognition) recognition.stop();
                    if (inactivityInterval) clearInterval(inactivityInterval);
                    showLoginScreen();
                    document.getElementById('loginUsername').value = '';
                    document.getElementById('loginPassword').value = '';
                };
            }
            
            // Modal close button
            const closeModalBtn = document.getElementById('closeModalBtn');
            if (closeModalBtn) closeModalBtn.onclick = closeRegisterModal;
            
            // Capture and save buttons
            const captureBtn = document.getElementById('capturePhotoBtn');
            if (captureBtn) captureBtn.onclick = capturePhoto;
            
            const saveBtn = document.getElementById('saveFaceBtn');
            if (saveBtn) saveBtn.onclick = saveFaceRegistration;
            
        } else {
            errorDiv.textContent = data.message;
        }
    } catch(e) {
        console.error('Login error:', e);
        errorDiv.textContent = 'Lỗi kết nối server!';
    }
}

// ========== WEBSOCKET ==========
function initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            if (!isTranslatorMode) speak(data.text);
        }
    };
    ws.onclose = () => setTimeout(initWebSocket, 3000);
}

// ========== CHAT FUNCTIONS ==========
function setExpression(expression) {
    const robotSvg = document.querySelector('.robot-svg');
    if (robotSvg) {
        robotSvg.classList.remove('listening', 'happy', 'thinking', 'sleepy', 'talking');
        robotSvg.classList.add(expression);
    }
    
    const mouth = document.querySelector('.robot-mouth');
    if (!mouth) return;
    
    switch(expression) {
        case 'talking':
            mouth.style.transform = 'scaleY(0.8)';
            break;
        case 'listening':
            mouth.style.transform = 'scaleY(0.7)';
            break;
        case 'happy':
            mouth.style.transform = 'scaleY(1.1)';
            break;
        case 'thinking':
            mouth.style.transform = 'scaleY(0.2)';
            break;
        case 'sleepy':
            mouth.style.transform = 'scaleY(0.3)';
            break;
        default:
            mouth.style.transform = 'scaleY(0.5)';
    }
}

function updateWakeIndicator(state) {
    const wakeDot = document.getElementById('wakeDot');
    const statusText = document.getElementById('globalStatusText');
    
    if (state === 'listening') {
        if (wakeDot) wakeDot.style.background = '#f39c12';
        if (statusText) statusText.innerHTML = 'LISTENING...';
    } else if (state === 'awake') {
        if (wakeDot) wakeDot.style.background = '#00ff00';
        if (statusText) statusText.innerHTML = 'AWAKE';
    } else {
        if (wakeDot) wakeDot.style.background = '#666';
        if (statusText) statusText.innerHTML = 'SLEEPING';
    }
}

function addMessage(type, text) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    while (chatBox.children.length > 50) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function speak(text) {
    if (!text || isTranslatorMode) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

function wakeUp() {
    if (isAwake) return;
    isAwake = true;
    updateWakeIndicator('awake');
    setExpression('happy');
    
    const greeting = 'Chào bạn! Chiri đã thức! 💕';
    addMessage('ai', greeting);
    speak(greeting);
}

function startInactivityCountdown() {
    if (inactivityInterval) clearInterval(inactivityInterval);
    inactivitySeconds = 60;
    
    inactivityInterval = setInterval(() => {
        const timerElem = document.getElementById('sleepTimer');
        if (!timerElem) return;
        
        if (!isAwake) {
            timerElem.innerHTML = '😴 SLEEP IN 60s';
            return;
        }
        
        if (inactivitySeconds <= 0) {
            isAwake = false;
            updateWakeIndicator('sleeping');
            setExpression('sleepy');
            timerElem.innerHTML = '😴 SLEEPING';
        } else {
            timerElem.innerHTML = `😴 SLEEP IN ${inactivitySeconds}s`;
            inactivitySeconds--;
        }
    }, 1000);
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    if (recognition) recognition.stop();
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'vi-VN';
    
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.trim();
        console.log('Voice:', text);
        
        if (!isAwake && WAKE_WORDS.some(w => text.toLowerCase().includes(w))) {
            wakeUp();
        } else if (isAwake && !isTranslatorMode && text) {
            processCommand(text);
        }
    };
    
    recognition.start();
}

function processCommand(text) {
    addMessage('user', text);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text, driveMode: false }));
    } else {
        addMessage('ai', 'Đang kết nối lại server...');
    }
}

// ========== DRIVE MODE ==========
function initDriveMode() {
    console.log('Drive mode initialized');
    
    document.querySelectorAll('.drive-btn-gaming').forEach(btn => {
        btn.onmousedown = () => {
            const cmd = btn.getAttribute('data-cmd');
            console.log('Drive command:', cmd);
            if (ws) ws.send(JSON.stringify({ type: 'drive_command', command: cmd, duration: 0 }));
        };
        btn.onmouseup = () => {
            if (ws) ws.send(JSON.stringify({ type: 'drive_command', command: 'STOP', duration: 0 }));
        };
    });
}

// ========== TRANSLATE MODE ==========
function initTranslateMode() {
    console.log('Translate mode initialized');
    
    const swapBtn = document.getElementById('swapLangBtn');
    const speakBtn = document.getElementById('speakTranslationBtn');
    const clearBtn = document.getElementById('clearTranslationBtn');
    
    if (swapBtn) {
        swapBtn.onclick = () => {
            const source = document.getElementById('sourceLang');
            const target = document.getElementById('targetLang');
            const temp = source.value;
            source.value = target.value;
            target.value = temp;
        };
    }
    
    if (speakBtn) {
        speakBtn.onclick = () => {
            const text = document.getElementById('translatedText').innerText;
            if (text && text !== 'AWAITING INPUT...') {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US';
                window.speechSynthesis.speak(utterance);
            }
        };
    }
    
    if (clearBtn) {
        clearBtn.onclick = () => {
            document.getElementById('originalText').innerHTML = 'AWAITING INPUT...';
            document.getElementById('translatedText').innerHTML = 'AWAITING INPUT...';
        };
    }
}

// ========== CAMERA MODE ==========
async function initCameraMode() {
    console.log('Camera mode initialized');
    
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    
    if (!videoElement || !canvasElement) return;
    if (typeof FaceMesh === 'undefined') {
        console.log('FaceMesh not loaded');
        return;
    }
    
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    
    faceMesh.setOptions({ maxNumFaces: 4, refineLandmarks: true });
    faceMesh.onResults(onFaceMeshResults);
    
    const toggleBtn = document.getElementById('cameraToggleBtn');
    const registerBtn = document.getElementById('registerFaceBtn');
    const recognizeBtn = document.getElementById('recognizeFaceBtn');
    
    if (toggleBtn) toggleBtn.onclick = toggleCamera;
    if (registerBtn) registerBtn.onclick = openRegisterModal;
    if (recognizeBtn) {
        recognizeBtn.onclick = () => {
            isRecognizing = !isRecognizing;
            addMessage('ai', isRecognizing ? 'Bắt đầu nhận diện' : 'Đã tắt nhận diện');
            speak(isRecognizing ? 'Bắt đầu nhận diện khuôn mặt' : 'Đã tắt nhận diện');
        };
    }
}

async function toggleCamera() {
    if (!isCameraActive) {
        if (typeof Camera === 'undefined') {
            console.log('Camera library not loaded');
            return;
        }
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isCameraActive && faceMesh) await faceMesh.send({ image: videoElement });
            }
        });
        await camera.start();
        isCameraActive = true;
        const toggleBtn = document.getElementById('cameraToggleBtn');
        if (toggleBtn) toggleBtn.textContent = 'TẮT CAMERA';
        document.getElementById('cameraStatusText').innerHTML = 'ACTIVE';
        document.getElementById('faceText').innerHTML = 'CAMERA ACTIVE';
    } else {
        camera.stop();
        isCameraActive = false;
        const toggleBtn = document.getElementById('cameraToggleBtn');
        if (toggleBtn) toggleBtn.textContent = 'BẬT CAMERA';
        document.getElementById('cameraStatusText').innerHTML = 'OFFLINE';
        document.getElementById('faceText').innerHTML = 'CAMERA OFFLINE';
    }
}

function onFaceMeshResults(results) {
    if (!isCameraActive || !canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiFaceLandmarks?.length > 0) {
        document.getElementById('faceText').textContent = `${results.multiFaceLandmarks.length} face(s) detected`;
        document.getElementById('faceEmoji').textContent = '😊';
    } else {
        document.getElementById('faceText').textContent = 'No face detected';
        document.getElementById('faceEmoji').textContent = '😔';
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

let photoCount = 0;
function capturePhoto() {
    if (photoCount < 3) {
        photoCount++;
        document.getElementById('photoCount').innerHTML = `📸 ${photoCount}/3 CAPTURED`;
        const preview = document.getElementById('previewCanvas');
        if (preview) {
            const ctx = preview.getContext('2d');
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(0, 0, preview.width, preview.height);
            setTimeout(() => {
                ctx.clearRect(0, 0, preview.width, preview.height);
                const video = document.querySelector('#registerModal video');
                if (video && video.videoWidth) {
                    preview.width = video.videoWidth;
                    preview.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, preview.width, preview.height);
                }
            }, 200);
        }
    } else {
        alert('Đã chụp đủ 3 ảnh!');
    }
}

function saveFaceRegistration() {
    const name = document.getElementById('faceNameInput').value.trim();
    if (!name) {
        alert('❌ Vui lòng nhập tên!');
        return;
    }
    if (photoCount < 3) {
        alert(`❌ Cần chụp đủ 3 ảnh! Hiện có ${photoCount}/3`);
        return;
    }
    alert(`✅ Đã đăng ký khuôn mặt cho ${name}!`);
    closeRegisterModal();
    document.getElementById('faceNameInput').value = '';
    photoCount = 0;
    document.getElementById('photoCount').innerHTML = '📸 0/3 CAPTURED';
}

// ========== GAME MODE INITIALIZERS ==========
// Import game modules (chỉ import 1 lần)
//import { initBoatMode, stopBoatMode } from './js/game.js';
//import { initPlaneMode, stopPlaneMode } from './js/plane-mode.js';

window.initBoatMode = initBoatMode;
window.stopBoatMode = stopBoatMode;
window.initPlaneMode = initPlaneMode;
window.stopPlaneMode = stopPlaneMode;

// Override showGameMode
window.showGameMode = function() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'block';
};

window.startGameWithMode = function(mode) {
    document.getElementById('gameTypeScreen').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    
    if (mode === 'boat') {
        initBoatMode();
    } else if (mode === 'plane') {
        initPlaneMode();
    }
};

// ========== EXPORT FUNCTIONS ==========
window.showModeScreen = showModeScreen;
window.showChatMode = showChatMode;
window.showDriveMode = showDriveMode;
window.showTranslateMode = showTranslateMode;
window.showCameraMode = showCameraMode;
window.showGameMode = showGameMode;
window.showGameTypeScreen = showGameTypeScreen;

// ========== INITIALIZE ==========
document.getElementById('loginBtn').onclick = login;
document.getElementById('loginPassword').onkeypress = (e) => {
    if (e.key === 'Enter') login();
};
