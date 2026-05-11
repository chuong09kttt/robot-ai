// DOM elements
const wakeDot = document.getElementById('wakeDot');
const wakeText = document.getElementById('wakeText');
const sleepTimer = document.getElementById('sleepTimer');
const robotSvg = document.querySelector('.robot-svg');
const statusText = document.getElementById('statusText');
const chatBox = document.getElementById('chatBox');
const manualWake = document.getElementById('manualWake');

// State variables
let ws = null;
let recognition = null;
let isAwake = false;
let inactivityTimer = null;
let countdownInterval = null;
let isProcessing = false;
let currentAudio = null;
let lastActivityTime = Date.now();

// Constants
const INACTIVITY_LIMIT = 120000; // 2 minutes
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào pika', 'pika ơi', 'hey pika', 'chào bạn', 'alô'];

// ========== BIỂU CẢM KHUÔN MẶT ==========
function setExpression(expression) {
    robotSvg.classList.remove('listening', 'happy', 'thinking', 'surprised', 'sleepy');
    if (expression === 'listening') robotSvg.classList.add('listening');
    else if (expression === 'happy') robotSvg.classList.add('happy');
    else if (expression === 'thinking') robotSvg.classList.add('thinking');
    else if (expression === 'surprised') robotSvg.classList.add('surprised');
    else if (expression === 'sleepy') robotSvg.classList.add('sleepy');
}

// ========== UI UPDATE ==========
function updateWakeIndicator(state) {
    if (state === 'listening') {
        wakeDot.classList.add('listening');
        wakeText.innerHTML = '🎤 Đang nghe...';
    } else if (state === 'awake') {
        wakeDot.classList.remove('listening');
        wakeDot.style.background = '#f39c12';
        wakeText.innerHTML = '💬 Đang thức';
    } else if (state === 'sleeping') {
        wakeDot.classList.remove('listening');
        wakeDot.style.background = '#2ecc71';
        wakeText.innerHTML = '😴 Đang ngủ';
    }
}

// ========== ADD MESSAGE ==========
function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    while (chatBox.children.length > 25) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== SPEECH SYNTHESIS ==========
async function playAudio(text) {
    try {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        const url = `/tts?text=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(audioUrl);
        
        currentAudio.onplay = () => setExpression('happy');
        currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            if (isAwake) setExpression('listening');
            isProcessing = false;
        };
        
        currentAudio.onerror = () => fallbackSpeak(text);
        
        await currentAudio.play();
        
    } catch (error) {
        fallbackSpeak(text);
    }
}

function fallbackSpeak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.9;
        
        utterance.onstart = () => setExpression('happy');
        utterance.onend = () => {
            if (isAwake) setExpression('listening');
            isProcessing = false;
        };
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } else {
        isProcessing = false;
    }
}

// ========== WAKE / SLEEP ==========
function wakeUp() {
    if (isAwake) return;
    
    console.log('🔊 Robot thức dậy');
    isAwake = true;
    lastActivityTime = Date.now();
    
    resetInactivityTimer();
    updateWakeIndicator('awake');
    
    const greeting = "Dạ, Pika đây ạ! Có gì cần giúp không ạ?";
    addMessage('ai', greeting);
    playAudio(greeting);
    
    statusText.innerHTML = '🎤 Pika đang lắng nghe... Hãy nói!';
    setExpression('listening');
}

function goToSleep() {
    if (!isAwake) return;
    
    console.log('😴 Robot đi ngủ');
    isAwake = false;
    
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    
    const sleepMsg = "Pika đi ngủ đây ạ. Khi nào cần hãy gọi Pika nhé!";
    addMessage('ai', sleepMsg);
    playAudio(sleepMsg);
    
    statusText.innerHTML = '😴 Pika đang ngủ - Hãy nói "Xin chào" để đánh thức';
    
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    sleepTimer.innerHTML = '😴 Đang ngủ';
}

// ========== TIMER ==========
function resetInactivityTimer() {
    lastActivityTime = Date.now();
    
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (isAwake && (Date.now() - lastActivityTime) >= INACTIVITY_LIMIT) {
            goToSleep();
        }
    }, INACTIVITY_LIMIT);
    
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        if (isAwake) {
            const elapsed = Date.now() - lastActivityTime;
            const remaining = Math.max(0, INACTIVITY_LIMIT - elapsed);
            const seconds = Math.floor(remaining / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            sleepTimer.innerHTML = `😴 Ngủ sau ${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// ========== PROCESS VOICE COMMAND ==========
async function processCommand(text) {
    if (isProcessing) return;
    
    console.log(`📝 Xử lý: "${text}"`);
    isProcessing = true;
    resetInactivityTimer();
    
    addMessage('user', text);
    setExpression('thinking');
    statusText.innerHTML = '🤔 Pika đang suy nghĩ...';
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text: text }));
    } else {
        console.log('WebSocket chưa kết nối');
        addMessage('ai', 'Xin lỗi, Pika đang mất kết nối!');
        setExpression('listening');
        isProcessing = false;
    }
}

// ========== SPEECH RECOGNITION ==========
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        statusText.innerHTML = '❌ Trình duyệt không hỗ trợ! Dùng Chrome/Edge!';
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
        console.log('🎤 Micro đang lắng nghe...');
        if (isAwake) {
            setExpression('listening');
            statusText.innerHTML = '🎤 Đang lắng nghe... Hãy nói!';
        }
    };
    
    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (event.results[i].isFinal && transcript) {
                console.log(`🎙️ Nghe: "${transcript}"`);
                
                if (!isAwake && !isProcessing) {
                    for (const word of WAKE_WORDS) {
                        if (transcript.includes(word)) {
                            wakeUp();
                            break;
                        }
                    }
                } else if (isAwake && !isProcessing && transcript.length > 2) {
                    let isOnlyWakeWord = WAKE_WORDS.some(w => transcript === w);
                    if (!isOnlyWakeWord) {
                        processCommand(transcript);
                    }
                }
            }
        }
    };
    
    recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
            statusText.innerHTML = '❌ Cần cấp quyền micro! Nhấn ổ khóa 🔒 trên thanh địa chỉ!';
            alert('⚠️ Cho phép truy cập micro:\nNhấn biểu tượng ổ khóa → Cho phép quyền Micro → Refresh');
        }
    };
    
    recognition.onend = () => {
        if (!isProcessing) {
            setTimeout(() => {
                try { recognition.start(); } catch(e) {}
            }, 500);
        }
    };
    
    recognition.start();
    console.log('✅ Speech Recognition started');
}

// ========== WEBSOCKET ==========
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => console.log('✅ WebSocket connected');
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            playAudio(data.text);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

// ========== MANUAL WAKE BUTTON ==========
manualWake.addEventListener('click', () => {
    if (!isAwake) {
        wakeUp();
    } else {
        resetInactivityTimer();
        const msg = "Dạ, Pika đây! Bạn cần gì ạ?";
        addMessage('ai', msg);
        playAudio(msg);
    }
});

// ========== INITIALIZATION ==========
function init() {
    console.log('🚀 Pika AI khởi động...');
    setExpression('sleepy');
    statusText.innerHTML = '🎤 Nói "Xin chào" hoặc "Hello" để đánh thức';
    
    connectWebSocket();
    initSpeechRecognition();
    resetInactivityTimer();
}

// Start everything when DOM is ready
document.addEventListener('DOMContentLoaded', init);
