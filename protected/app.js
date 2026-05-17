// ========== CHIRI AI - MAIN APPLICATION ==========
// This file will be obfuscated in production

// Global state
window.CHIRI = window.CHIRI || {};

// Configuration
const CONFIG = {
    version: '13.0.0',
    buildDate: '2025-01-01',
    features: ['chat', 'drive', 'translate', 'camera', 'game'],
    wsUrl: null
};

// Initialize app
async function initApp() {
    console.log('🔐 Initializing CHIRI AI Secure Edition...');
    
    // Check authentication
    const auth = await checkAuth();
    if (!auth.authenticated) {
        showLoginScreen();
        return;
    }
    
    // Set user info
    document.getElementById('userNameDisplay').innerHTML = `👤 ${auth.user.name}`;
    
    // Initialize modules
    initWebSocket();
    initSpeechRecognition();
    initNavigation();
    startInactivityTimer();
    
    // Show mode selection
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('modeScreen').style.display = 'block';
}

// Check authentication
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();
        return data;
    } catch(e) {
        return { authenticated: false };
    }
}

// Initialize WebSocket
function initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        window.CHIRI.ws = ws;
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            if (!window.CHIRI.isTranslatorMode) speak(data.text);
        }
    };
    
    ws.onclose = () => setTimeout(initWebSocket, 3000);
}

// Speech recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'vi-VN';
    window.CHIRI.recognition = recognition;
    
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.trim();
        console.log('🎤 Voice:', text);
        
        if (!window.CHIRI.isAwake && isWakeWord(text)) {
            wakeUp();
        } else if (window.CHIRI.isAwake && !window.CHIRI.isTranslatorMode) {
            sendCommand(text);
        }
    };
    
    recognition.start();
}

// Navigation
function initNavigation() {
    // Mode cards
    document.querySelectorAll('.mode-card').forEach(card => {
        card.onclick = () => {
            const mode = card.getAttribute('data-mode');
            switch(mode) {
                case 'chat': showChatMode(); break;
                case 'drive': showDriveMode(); break;
                case 'translate': showTranslateMode(); break;
                case 'camera': showCameraMode(); break;
                case 'game': showGameMode(); break;
            }
        };
    });
    
    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.onclick = () => showModeScreen();
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            location.reload();
        };
    }
}

// Helper functions
function isWakeWord(text) {
    const words = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi'];
    return words.some(w => text.toLowerCase().includes(w));
}

function wakeUp() {
    if (window.CHIRI.isAwake) return;
    window.CHIRI.isAwake = true;
    updateWakeStatus('awake');
    const greeting = 'Chào bạn! Chiri đã thức! 💕';
    addMessage('ai', greeting);
    speak(greeting);
}

function sendCommand(text) {
    addMessage('user', text);
    if (window.CHIRI.ws?.readyState === WebSocket.OPEN) {
        window.CHIRI.ws.send(JSON.stringify({ type: 'voice', text, driveMode: false }));
    }
}

function addMessage(type, text) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function speak(text) {
    if (!text || window.CHIRI.isTranslatorMode) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    window.speechSynthesis.speak(utterance);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateWakeStatus(status) {
    const wakeDot = document.getElementById('wakeDot');
    const statusText = document.getElementById('globalStatusText');
    if (status === 'awake') {
        if (wakeDot) wakeDot.style.background = '#00ff00';
        if (statusText) statusText.innerHTML = 'AWAKE';
    } else {
        if (wakeDot) wakeDot.style.background = '#666';
        if (statusText) statusText.innerHTML = 'SLEEPING';
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

function showChatMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'block';
    window.CHIRI.isAwake = false;
}

function showDriveMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'block';
    if (window.initDriveUI) window.initDriveUI();
}

function showTranslateMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'block';
    if (window.initTranslateUI) window.initTranslateUI();
}

function showCameraMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'block';
    if (window.initCameraUI) window.initCameraUI();
}

function showGameMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'block';
}

let inactivityTimer;
function startInactivityTimer() {
    let seconds = 60;
    inactivityTimer = setInterval(() => {
        const timerElem = document.getElementById('sleepTimer');
        if (!timerElem) return;
        if (!window.CHIRI.isAwake) {
            timerElem.innerHTML = '😴 SLEEP IN 60s';
            return;
        }
        if (seconds <= 0) {
            window.CHIRI.isAwake = false;
            updateWakeStatus('sleeping');
            timerElem.innerHTML = '😴 SLEEPING';
        } else {
            timerElem.innerHTML = `😴 SLEEP IN ${seconds}s`;
            seconds--;
        }
    }, 1000);
}

// Start app
initApp();

// Exports for modules
window.showModeScreen = showModeScreen;
window.showChatMode = showChatMode;
window.showDriveMode = showDriveMode;
window.showTranslateMode = showTranslateMode;
window.showCameraMode = showCameraMode;
window.showGameMode = showGameMode;
window.addMessage = addMessage;
window.speak = speak;
