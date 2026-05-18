// ========== CHIRI AI - MAIN UI SCRIPT ==========
// Đây là file chính điều khiển toàn bộ giao diện và tính năng

// Global variables
let currentUser = null;
let ws = null;
let recognition = null;
let isAwake = false;
let isListening = false;
let isSpeaking = false;
let isAIProcessing = false;
let isTranslatorMode = false;
let isCameraActive = false;
let faceMesh = null;
let camera = null;
let videoElement = null;
let canvasElement = null;
let faceDatabase = new Map();
let isRecognizing = false;
let mouthAnimationInterval = null;
let inactivityInterval = null;
let inactivitySeconds = 60;
let reconnectAttempts = 0;

// Translation variables
let translationRecognition = null;
let lastProcessedText = '';
let translationTimeout = null;
let sourceLang = 'vi';
let targetLang = 'en';

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

function showChatMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'block';
    isAwake = false;
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
}

function showDriveMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'block';
    initDriveMode();
}

function showTranslateMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'block';
    initTranslateMode();
}

function showCameraMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'block';
    initCameraMode();
}

function showGameMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'block';
}

// ========== LOGIN ==========
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!username || !password) {
        errorDiv.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu!';
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
            currentUser = { username: data.username, name: data.name };
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
            document.getElementById('userNameDisplay').innerHTML = `👤 ${data.name}`;
            
            // Initialize features
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
            
            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                    if (ws) ws.close();
                    if (recognition) recognition.stop();
                    if (inactivityInterval) clearInterval(inactivityInterval);
                    document.getElementById('modeScreen').style.display = 'none';
                    document.getElementById('loginScreen').style.display = 'flex';
                };
            }
            
            // Modal close
            const closeModalBtn = document.getElementById('closeModalBtn');
            if (closeModalBtn) closeModalBtn.onclick = closeRegisterModal;
            
            const captureBtn = document.getElementById('capturePhotoBtn');
            if (captureBtn) captureBtn.onclick = capturePhoto;
            
            const saveBtn = document.getElementById('saveFaceBtn');
            if (saveBtn) saveBtn.onclick = saveFaceRegistration;
            
        } else {
            errorDiv.textContent = data.message;
        }
    } catch(e) {
        errorDiv.textContent = 'Lỗi kết nối server!';
    }
}

// ========== WEBSOCKET ==========
function initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('WebSocket connected');
    };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            isAIProcessing = false;
            addMessage('ai', data.text);
            if (!isTranslatorMode) speak(data.text);
        }
    };
    ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), 8000);
        setTimeout(initWebSocket, delay);
    };
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
    if (mouthAnimationInterval) clearInterval(mouthAnimationInterval);
    switch(expression) {
        case 'talking':
            startMouthAnimation();
            break;
        case 'listening': mouth.style.transform = 'scaleY(0.7)'; break;
        case 'happy': mouth.style.transform = 'scaleY(1.1)'; break;
        case 'thinking': mouth.style.transform = 'scaleY(0.2)'; break;
        case 'sleepy': mouth.style.transform = 'scaleY(0.3)'; break;
        default: mouth.style.transform = 'scaleY(0.5)';
    }
}

function startMouthAnimation() {
    if (mouthAnimationInterval) clearInterval(mouthAnimationInterval);
    const mouth = document.querySelector('.robot-mouth');
    let frame = 0;
    mouthAnimationInterval = setInterval(() => {
        frame++;
        const scale = 0.4 + Math.sin(frame * 0.8) * 0.45;
        if (mouth) mouth.style.transform = `scaleY(${scale})`;
    }, 80);
}

function stopMouthAnimation() {
    if (mouthAnimationInterval) {
        clearInterval(mouthAnimationInterval);
        mouthAnimationInterval = null;
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
    while (chatBox.children.length > 50) chatBox.removeChild(chatBox.firstChild);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function speak(text) {
    if (!text || isTranslatorMode) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = true;
    setExpression('talking');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;
    utterance.onend = () => {
        isSpeaking = false;
        stopMouthAnimation();
        if (isAwake && !isTranslatorMode) setExpression('listening');
    };
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
    startInactivityCountdown();
}

function goToSleep() {
    if (!isAwake) return;
    isAwake = false;
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    if (recognition) try { recognition.stop(); } catch(e) {}
}

function startInactivityCountdown() {
    if (inactivityInterval) clearInterval(inactivityInterval);
    inactivitySeconds = 60;
    inactivityInterval = setInterval(() => {
        const timerElem = document.getElementById('sleepTimer');
        if (!timerElem) return;
        if (!isAwake || isSpeaking || isAIProcessing || isTranslatorMode) {
            inactivitySeconds = 60;
            timerElem.innerHTML = '😴 SLEEP IN 60s';
            return;
        }
        if (inactivitySeconds <= 0) {
            clearInterval(inactivityInterval);
            goToSleep();
        } else {
            timerElem.innerHTML = `😴 SLEEP IN ${inactivitySeconds}s`;
            inactivitySeconds--;
        }
    }, 1000);
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Trình duyệt không hỗ trợ!'); return; }
    if (recognition) try { recognition.stop(); } catch(e) {}
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'vi-VN';
    recognition.onstart = () => { isListening = true; if (!isTranslatorMode) { updateWakeIndicator('listening'); setExpression('listening'); } };
    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        if (!transcript) return;
        const lower = transcript.toLowerCase();
        if (!isAwake) { if (WAKE_WORDS.some(w => lower.includes(w))) wakeUp(); return; }
        if (!isSpeaking && !isAIProcessing) {
            if (lower.includes('bật phiên dịch')) toggleTranslatorMode();
            else if (lower.includes('tắt phiên dịch')) toggleTranslatorMode();
            else processCommand(transcript);
        }
    };
    recognition.onend = () => { isListening = false; if (isAwake && !isSpeaking && !isTranslatorMode) setTimeout(() => recognition.start(), 500); };
    recognition.start();
}

function processCommand(text) {
    isAIProcessing = true;
    setExpression('thinking');
    addMessage('user', text);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text, driveMode: false }));
    } else {
        addMessage('ai', 'Đang kết nối lại server...');
        isAIProcessing = false;
    }
}

// ========== DRIVE MODE ==========
function initDriveMode() {
    console.log('Drive mode initialized');
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

// ========== TRANSLATE MODE ==========
function initTranslateMode() {
    console.log('Translate mode initialized');
    sourceLang = document.getElementById('sourceLang').value;
    targetLang = document.getElementById('targetLang').value;
    const swapBtn = document.getElementById('swapLangBtn');
    const speakBtn = document.getElementById('speakTranslationBtn');
    const clearBtn = document.getElementById('clearTranslationBtn');
    if (swapBtn) swapBtn.onclick = swapLanguages;
    if (speakBtn) speakBtn.onclick = speakCurrentTranslation;
    if (clearBtn) clearBtn.onclick = clearTranslation;
    startTranslationMode();
}

function toggleTranslatorMode() {
    isTranslatorMode = !isTranslatorMode;
    if (isTranslatorMode) { startTranslationMode(); addMessage('ai', 'Đã bật phiên dịch!'); speak('Đã bật phiên dịch'); }
    else { stopTranslationMode(); addMessage('ai', 'Đã tắt phiên dịch.'); speak('Đã tắt phiên dịch'); }
}

function startTranslationMode() {
    if (translationRecognition) try { translationRecognition.stop(); } catch(e) {}
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    translationRecognition = new SpeechRecognition();
    translationRecognition.continuous = true;
    translationRecognition.interimResults = true;
    translationRecognition.lang = getLanguageCode(sourceLang);
    translationRecognition.onstart = () => { const elem = document.getElementById('translateStatusText'); if (elem) elem.innerHTML = '🎤 LISTENING...'; };
    translationRecognition.onresult = async (event) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        if (finalText && finalText !== lastProcessedText) {
            document.getElementById('originalText').innerHTML = escapeHtml(finalText);
            if (translationTimeout) clearTimeout(translationTimeout);
            translationTimeout = setTimeout(async () => {
                const translated = await translateText(finalText, sourceLang, targetLang);
                document.getElementById('translatedText').innerHTML = escapeHtml(translated);
                lastProcessedText = finalText;
            }, 500);
        }
    };
    translationRecognition.onend = () => { if (isTranslatorMode) setTimeout(() => { if (isTranslatorMode && translationRecognition) translationRecognition.start(); }, 500); };
    translationRecognition.start();
}

function stopTranslationMode() {
    if (translationRecognition) { translationRecognition.stop(); translationRecognition = null; }
    if (translationTimeout) clearTimeout(translationTimeout);
}

async function translateText(text, source, target) {
    if (!text || source === target) return text;
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data?.responseData?.translatedText) {
                let translated = data.responseData.translatedText.replace(/^\[ERROR\]\s*/, '').replace(/<[^>]*>/g, '');
                if (translated && !translated.includes('MYMEMORY WARNING')) return translated;
            }
        }
        return text;
    } catch(e) { return text; }
}

function getLanguageCode(lang) {
    const codes = { 'vi': 'vi-VN', 'en': 'en-US', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR', 'fr': 'fr-FR', 'de': 'de-DE', 'es': 'es-ES' };
    return codes[lang] || 'en-US';
}

function swapLanguages() {
    const temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;
    document.getElementById('sourceLang').value = sourceLang;
    document.getElementById('targetLang').value = targetLang;
    clearTranslation();
    if (isTranslatorMode) { stopTranslationMode(); startTranslationMode(); }
}

function clearTranslation() {
    document.getElementById('originalText').innerHTML = 'AWAITING INPUT...';
    document.getElementById('translatedText').innerHTML = 'AWAITING INPUT...';
    lastProcessedText = '';
}

function speakCurrentTranslation() {
    const text = document.getElementById('translatedText')?.innerText;
    if (text && text !== 'AWAITING INPUT...') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getLanguageCode(targetLang);
        window.speechSynthesis.speak(utterance);
    }
}

// ========== CAMERA MODE ==========
async function initCameraMode() {
    console.log('Camera mode initialized');
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    if (!videoElement || !canvasElement) return;
    if (typeof FaceMesh === 'undefined') return;
    faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    faceMesh.setOptions({ maxNumFaces: 4, refineLandmarks: true });
    faceMesh.onResults(onFaceMeshResults);
    document.getElementById('cameraToggleBtn').onclick = toggleCamera;
    document.getElementById('registerFaceBtn').onclick = openRegisterModal;
    document.getElementById('recognizeFaceBtn').onclick = () => {
        isRecognizing = !isRecognizing;
        addMessage('ai', isRecognizing ? 'Bắt đầu nhận diện' : 'Đã tắt nhận diện');
        speak(isRecognizing ? 'Bắt đầu nhận diện' : 'Đã tắt nhận diện');
    };
}

async function toggleCamera() {
    if (!isCameraActive) {
        if (typeof Camera === 'undefined') return;
        camera = new Camera(videoElement, {
            onFrame: async () => { if (isCameraActive && faceMesh) await faceMesh.send({ image: videoElement }); }
        });
        await camera.start();
        isCameraActive = true;
        document.getElementById('cameraToggleBtn').textContent = 'TẮT CAMERA';
        document.getElementById('cameraStatusText').innerHTML = 'ACTIVE';
        document.getElementById('faceText').innerHTML = 'CAMERA ACTIVE';
    } else {
        camera.stop();
        isCameraActive = false;
        document.getElementById('cameraToggleBtn').textContent = 'BẬT CAMERA';
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
    } else {
        alert('Đã chụp đủ 3 ảnh!');
    }
}

function saveFaceRegistration() {
    const name = document.getElementById('faceNameInput').value.trim();
    if (!name) { alert('❌ Vui lòng nhập tên!'); return; }
    if (photoCount < 3) { alert(`❌ Cần chụp đủ 3 ảnh! Hiện có ${photoCount}/3`); return; }
    alert(`✅ Đã đăng ký khuôn mặt cho ${name}!`);
    closeRegisterModal();
    document.getElementById('faceNameInput').value = '';
    photoCount = 0;
    document.getElementById('photoCount').innerHTML = '📸 0/3 CAPTURED';
}

// ========== GAME MODE HANDLERS ==========
// ========== GAME MODE HANDLERS ==========
// Các hàm này sẽ được gọi từ main.js sau khi modules loaded
// Chỉ cần đảm bảo window.startGameWithMode đã được định nghĩa

// Nếu game modules chưa load kịp, chờ một chút
function waitForGameModules() {
    return new Promise((resolve) => {
        if (typeof window.startGameWithMode === 'function') {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof window.startGameWithMode === 'function') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            // Timeout sau 5 giây
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        }
    });
}

// Hàm start game cập nhật
window.startGameWithMode = async function(mode) {
    // Đợi game modules load
    await waitForGameModules();
    
    document.getElementById('gameTypeScreen').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    
    if (mode === 'boat') {
        if (typeof window.initBoatMode === 'function') {
            window.initBoatMode();
        } else {
            console.error('initBoatMode not found');
            alert('🚤 Đang tải game thuyền, vui lòng thử lại!');
        }
    } else if (mode === 'plane') {
        if (typeof window.initPlaneMode === 'function') {
            window.initPlaneMode();
        } else {
            console.error('initPlaneMode not found');
            alert('✈️ Đang tải game máy bay, vui lòng thử lại!');
        }
    }
};

// Gán sự kiện cho nút chọn game
document.getElementById('selectBoatMode')?.addEventListener('click', () => {
    window.startGameWithMode('boat');
});
document.getElementById('selectPlaneMode')?.addEventListener('click', () => {
    window.startGameWithMode('plane');
});


// Export functions
window.showModeScreen = showModeScreen;
window.showChatMode = showChatMode;
window.showDriveMode = showDriveMode;
window.showTranslateMode = showTranslateMode;
window.showCameraMode = showCameraMode;
window.showGameMode = showGameMode;










// ========== PWA & FULLSCREEN FEATURES ==========

// Lock orientation to landscape (for game)
async function lockOrientation() {
    try {
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
            console.log('✅ Orientation locked to landscape');
        }
    } catch(e) {
        console.log('Orientation lock not supported:', e);
    }
}

// Request fullscreen
async function requestFullscreen() {
    try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            await elem.msRequestFullscreen();
        }
        console.log('✅ Fullscreen mode activated');
    } catch(e) {
        console.log('Fullscreen request failed:', e);
    }
}

// Exit fullscreen
async function exitFullscreen() {
    try {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
        }
        console.log('✅ Exited fullscreen');
    } catch(e) {}
}

// Check if fullscreen is supported
function isFullscreenSupported() {
    return !!(document.documentElement.requestFullscreen || 
              document.documentElement.webkitRequestFullscreen);
}

// Toggle fullscreen
function toggleFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        exitFullscreen();
    } else {
        requestFullscreen();
    }
}

// Hide address bar on mobile
function hideAddressBar() {
    window.scrollTo(0, 1);
    setTimeout(() => window.scrollTo(0, 1), 100);
}

// Register Service Worker for PWA
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('✅ Service Worker registered:', registration.scope);
            
            // Check for updates
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            console.log('🔄 New version available, reload to update');
                            // Show update notification
                            showUpdateNotification();
                        } else {
                            console.log('✅ App ready for offline use');
                        }
                    }
                };
            };
        } catch(e) {
            console.log('Service Worker registration failed:', e);
        }
    }
}

// Show update notification
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #00d4ff;
        color: #000;
        padding: 12px 24px;
        border-radius: 40px;
        font-family: 'Orbitron', monospace;
        z-index: 10000;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(0,212,255,0.5);
    `;
    notification.innerHTML = '🔄 Cập nhật mới có sẵn! Nhấn để tải lại';
    notification.onclick = () => window.location.reload();
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 10000);
}

// Create splash screen
function showSplashScreen() {
    // Check if splash already shown
    if (sessionStorage.getItem('splashShown')) return;
    
    const splash = document.createElement('div');
    splash.id = 'splash';
    splash.innerHTML = `
        <div class="splash-logo">🐹</div>
        <div class="splash-text">CHIRI AI</div>
        <div style="margin-top: 20px; font-size: 12px; opacity: 0.6;">CHẠM ĐỂ BẮT ĐẦU</div>
    `;
    document.body.appendChild(splash);
    
    // Remove splash on click or after timeout
    const removeSplash = () => {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 500);
        sessionStorage.setItem('splashShown', 'true');
    };
    
    splash.onclick = async () => {
        removeSplash();
        // Request fullscreen on first user interaction
        if (isFullscreenSupported() && !document.fullscreenElement) {
            await requestFullscreen();
        }
        await lockOrientation();
    };
    
    // Auto remove after 3 seconds
    setTimeout(removeSplash, 3000);
}

// Initialize PWA features
async function initPWA() {
    console.log('📱 Initializing PWA features...');
    
    // Register service worker
    await registerServiceWorker();
    
    // Lock orientation (best effort)
    await lockOrientation();
    
    // Hide address bar on mobile
    hideAddressBar();
    window.addEventListener('resize', hideAddressBar);
    window.addEventListener('orientationchange', hideAddressBar);
    
    // Show splash screen on first visit
    showSplashScreen();
    
    // Add fullscreen toggle button (optional)
    addFullscreenButton();
}

// Add floating fullscreen button
function addFullscreenButton() {
    const btn = document.createElement('div');
    btn.className = 'fullscreen-btn';
    btn.innerHTML = '⛶';
    btn.onclick = (e) => {
        e.stopPropagation();
        toggleFullscreen();
    };
    document.body.appendChild(btn);
}

// Listen for fullscreen change events
document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    console.log(`Fullscreen mode: ${isFullscreen ? 'ON' : 'OFF'}`);
    
    // Update button icon
    const btn = document.querySelector('.fullscreen-btn');
    if (btn) btn.innerHTML = isFullscreen ? '✕' : '⛶';
});

// Listen for visibility change (for PWA)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('App became visible');
        hideAddressBar();
    }
});

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
} else {
    initPWA();
}


// Thêm vào script.js
function showQRCode() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'block';
    
    // Generate QR code (cần thêm thư viện qrcode)
    if (typeof QRCode !== 'undefined') {
        const qrcode = new QRCode(document.getElementById('qrcode'), {
            text: window.location.href,
            width: 200,
            height: 200
        });
    }
}

// ========== PWA INSTALL PROMPT ==========
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('beforeinstallprompt event fired');
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
});

function showInstallPromotion() {
    // Tạo banner cài đặt
    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: linear-gradient(135deg, #0a0a2a, #1a1a3a);
        border: 2px solid #00d4ff;
        border-radius: 16px;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
        box-shadow: 0 0 30px rgba(0,212,255,0.3);
    `;
    
    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 32px;">🐹</span>
            <div>
                <div style="font-weight: bold; color: #00d4ff;">Cài đặt CHIRI AI</div>
                <div style="font-size: 12px; opacity: 0.8;">Trải nghiệm như app thực thụ</div>
            </div>
        </div>
        <button id="installBtn" style="
            background: linear-gradient(90deg, #00d4ff, #ff00ff);
            border: none;
            padding: 10px 24px;
            border-radius: 30px;
            color: white;
            font-weight: bold;
            cursor: pointer;
        ">CÀI ĐẶT</button>
    `;
    
    document.body.appendChild(banner);
    
    document.getElementById('installBtn').onclick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User installed the app');
            }
            deferredPrompt = null;
            banner.remove();
        }
    };
    
    // Tự động ẩn sau 10 giây
    setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 10000);
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.log('Service Worker error:', err));
    });
}
