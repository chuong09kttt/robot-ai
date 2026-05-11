// DOM elements
const wakeDot = document.getElementById('wakeDot');
const wakeText = document.getElementById('wakeText');
const sleepTimer = document.getElementById('sleepTimer');
const robotSvg = document.querySelector('.robot-svg');
const statusText = document.getElementById('statusText');
const chatBox = document.getElementById('chatBox');
const manualWake = document.getElementById('manualWake');
const driveModeBtn = document.getElementById('driveModeBtn');

// State variables
let ws = null;
let recognition = null;
let isAwake = false;
let inactivityTimer = null;
let countdownInterval = null;
let isProcessing = false;
let currentAudio = null;
let lastActivityTime = Date.now();
let driveControlMode = false;

// Constants
const INACTIVITY_LIMIT = 120000;
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi', 'hey chiri'];

// Update drive mode UI
function updateDriveModeUI() {
    if (driveControlMode) {
        driveModeBtn.innerHTML = '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.add('drive-active');
        if (isAwake) {
            statusText.innerHTML = '🎮 CHẾ ĐỘ LÁI XE: nói tiến, lùi, trái, phải, dừng';
        }
    } else {
        driveModeBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.remove('drive-active');
        if (isAwake) {
            statusText.innerHTML = '💬 CHẾ ĐỘ TRÒ CHUYỆN: hỏi đáp thông minh';
        }
    }
}

function setExpression(expression) {
    robotSvg.classList.remove('listening', 'happy', 'thinking', 'surprised', 'sleepy');
    if (expression === 'listening') robotSvg.classList.add('listening');
    else if (expression === 'happy') robotSvg.classList.add('happy');
    else if (expression === 'thinking') robotSvg.classList.add('thinking');
    else if (expression === 'sleepy') robotSvg.classList.add('sleepy');
}

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

// ========== SPEECH SYNTHESIS với fallback ==========
async function playAudio(text) {
    try {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        const url = `/tts?text=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        
        if (response.ok) {
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
            
            await currentAudio.play();
        } else {
            fallbackSpeak(text);
        }
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

function wakeUp() {
    if (isAwake) return;
    
    console.log('🔊 Chiri thức dậy');
    isAwake = true;
    lastActivityTime = Date.now();
    
    resetInactivityTimer();
    updateWakeIndicator('awake');
    updateDriveModeUI();
    
    const greeting = driveControlMode ? 
        "Chiri đã thức! Mình đang ở chế độ điều khiển xe. Bạn có thể ra lệnh: tiến, lùi, trái, phải, dừng!" :
        "Chiri đã thức! Mình sẵn sàng trò chuyện. Bạn có thể hỏi mình về nhiệt độ Mặt Trăng, Mặt Trời hoặc bất kỳ điều gì nhé!";
    
    addMessage('ai', greeting);
    playAudio(greeting);
    setExpression('listening');
}

function goToSleep() {
    if (!isAwake) return;
    
    console.log('😴 Chiri đi ngủ');
    isAwake = false;
    
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    
    const sleepMsg = "Chiri đi ngủ đây. Khi nào cần hãy gọi 'Xin chào' nhé!";
    addMessage('ai', sleepMsg);
    playAudio(sleepMsg);
    
    statusText.innerHTML = '😴 Chiri đang ngủ - Hãy nói "Xin chào" để đánh thức';
    
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    sleepTimer.innerHTML = '😴 Đang ngủ';
}

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

async function processCommand(text) {
    if (isProcessing) return;
    
    console.log(`📝 Xử lý: "${text}"`);
    isProcessing = true;
    resetInactivityTimer();
    
    addMessage('user', text);
    setExpression('thinking');
    statusText.innerHTML = '🤔 Chiri đang suy nghĩ...';
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text: text, driveMode: driveControlMode }));
    } else {
        addMessage('ai', 'Xin lỗi, Chiri đang mất kết nối!');
        setExpression('listening');
        isProcessing = false;
    }
}

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
        }
    };
    
    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (event.results[i].isFinal && transcript) {
                console.log(`🎙️ Nghe: "${transcript}"`);
                
                // Lọc bỏ các câu nhận diện sai quá ngắn
                if (transcript.length < 3) continue;
                
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
        console.error('Lỗi recognition:', event.error);
        if (event.error === 'not-allowed') {
            statusText.innerHTML = '❌ Cần cấp quyền micro!';
        }
    };
    
    recognition.onend = () => {
        if (!isProcessing && isAwake) {
            setTimeout(() => {
                try { recognition.start(); } catch(e) {}
            }, 500);
        }
    };
    
    recognition.start();
    console.log('✅ Speech Recognition started');
}

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => console.log('✅ WebSocket connected');
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            playAudio(data.text);
            setExpression('listening');
            isProcessing = false;
            statusText.innerHTML = driveControlMode ? '🎤 Đang nghe lệnh xe...' : '🎤 Đang lắng nghe...';
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

manualWake.addEventListener('click', () => {
    if (!isAwake) {
        wakeUp();
    } else {
        resetInactivityTimer();
        const msg = driveControlMode ? "Chiri đây! Bạn muốn ra lệnh gì?" : "Chiri đây! Bạn muốn hỏi gì ạ?";
        addMessage('ai', msg);
        playAudio(msg);
    }
});

driveModeBtn.addEventListener('click', () => {
    driveControlMode = !driveControlMode;
    updateDriveModeUI();
    
    const msg = driveControlMode ?
        "Đã bật chế độ điều khiển xe. Bạn có thể ra lệnh: tiến, lùi, trái, phải, dừng!" :
        "Đã tắt chế độ xe. Chiri sẽ trò chuyện thông minh. Hãy hỏi mình bất cứ điều gì!";
    
    if (isAwake) {
        addMessage('ai', msg);
        playAudio(msg);
    }
});

function init() {
    console.log('🚀 Chiri AI khởi động...');
    setExpression('sleepy');
    statusText.innerHTML = '🎤 Nói "Xin chào" để đánh thức';
    updateDriveModeUI();
    
    connectWebSocket();
    initSpeechRecognition();
    resetInactivityTimer();
}

document.addEventListener('DOMContentLoaded', init);
