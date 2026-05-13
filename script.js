const wakeDot = document.getElementById('wakeDot');
const wakeText = document.getElementById('wakeText');
const sleepTimer = document.getElementById('sleepTimer');
const robotSvg = document.querySelector('.robot-svg');
const statusText = document.getElementById('statusText');
const chatBox = document.getElementById('chatBox');
const manualWake = document.getElementById('manualWake');
const driveModeBtn = document.getElementById('driveModeBtn');

let ws = null;
let recognition = null;
let isAwake = false;
let isListening = false;
let inactivityTimer = null;
let countdownInterval = null;
let isProcessing = false;
let currentAudio = null;
let lastActivityTime = Date.now();
let driveControlMode = false;
let mouthAnimationInterval = null;
let reconnectAttempts = 0;
let ttsQueue = [];
let restartTimeout = null;

const INACTIVITY_LIMIT = 120000; // 2 phút
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi', 'hey chiri'];

function setExpression(expression) {
    robotSvg.classList.remove('listening', 'happy', 'thinking', 'surprised', 'sleepy', 'talking');
    robotSvg.classList.add(expression);
   
    const mouth = document.querySelector('.robot-mouth');
    if (!mouth) return;
   
    stopMouthAnimation();
   
    switch(expression) {
        case 'talking':
            startMouthAnimation();
            break;
        case 'listening':
            mouth.style.transform = 'scaleY(0.7)';
            break;
        case 'happy':
            mouth.style.transform = 'scaleY(1.1) scaleX(1.1)';
            break;
        case 'thinking':
            mouth.style.transform = 'scaleY(0.2)';
            break;
        case 'sleepy':
            mouth.style.transform = 'scaleY(0.3)';
            break;
    }
}

function startMouthAnimation() {
    if (mouthAnimationInterval) clearInterval(mouthAnimationInterval);
    let frame = 0;
    const mouth = document.querySelector('.robot-mouth');
    mouthAnimationInterval = setInterval(() => {
        frame++;
        const scale = 0.4 + Math.sin(frame * 0.8) * 0.45;
        mouth.style.transform = `scaleY(${scale})`;
    }, 80);
}

function stopMouthAnimation() {
    if (mouthAnimationInterval) {
        clearInterval(mouthAnimationInterval);
        mouthAnimationInterval = null;
    }
    const mouth = document.querySelector('.robot-mouth');
    if (mouth) mouth.style.transform = '';
}

function updateDriveModeUI() {
    if (driveControlMode) {
        driveModeBtn.innerHTML = '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.add('drive-active');
        if (isAwake) statusText.innerHTML = '🎮 CHẾ ĐỘ LÁI XE - Nói: tiến, lùi, trái, phải, dừng';
    } else {
        driveModeBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.remove('drive-active');
        if (isAwake) statusText.innerHTML = '💬 CHẾ ĐỘ TRÒ CHUYỆN';
    }
}

function updateWakeIndicator(state) {
    wakeDot.classList.remove('listening');
    if (state === 'listening') {
        wakeDot.classList.add('listening');
        wakeText.innerHTML = '🎤 Đang nghe...';
    } else if (state === 'awake') {
        wakeDot.style.background = '#f39c12';
        wakeText.innerHTML = '💬 Đang thức';
    } else if (state === 'sleeping') {
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
   
    while (chatBox.children.length > 30) chatBox.removeChild(chatBox.firstChild);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================== AUDIO & TTS ==================
async function playAudio(text) {
    if (!text) return;
    ttsQueue.push(text);
    processTTSQueue();
}

async function processTTSQueue() {
    if (currentAudio || isProcessing || ttsQueue.length === 0) return;
   
    isProcessing = true;
    const textToPlay = ttsQueue.shift();
   
    setExpression('talking');
   
    try {
        const response = await fetch(`/tts?text=${encodeURIComponent(textToPlay.slice(0, 300))}`);
        if (response.ok) {
            const blob = await response.blob();
            await playBlobAudio(blob);
        } else {
            await fallbackSpeak(textToPlay);
        }
    } catch (e) {
        await fallbackSpeak(textToPlay);
    }
   
    finishSpeaking();
}

function playBlobAudio(blob) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        currentAudio = new Audio(url);
       
        currentAudio.onended = () => {
            URL.revokeObjectURL(url);
            currentAudio = null;
            resolve();
        };
        currentAudio.onerror = () => {
            URL.revokeObjectURL(url);
            currentAudio = null;
            resolve();
        };
       
        currentAudio.play().catch(() => {
            currentAudio = null;
            resolve();
        });
    });
}

function fallbackSpeak(text) {
    if (!('speechSynthesis' in window)) return Promise.resolve();
   
    return new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 200));
        utterance.lang = 'vi-VN';
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
       
        utterance.onend = () => { resolve(); };
        utterance.onerror = () => { resolve(); };
       
        window.speechSynthesis.speak(utterance);
    });
}

function finishSpeaking() {
    isProcessing = false;
    stopMouthAnimation();
    if (isAwake) {
        setExpression('listening');
        startListening();
    }
}

// ================== WAKE & SLEEP ==================
function wakeUp() {
    if (isAwake) return;
    isAwake = true;
    lastActivityTime = Date.now();
    resetInactivityTimer();
    updateWakeIndicator('awake');
    updateDriveModeUI();
   
    const greeting = driveControlMode
        ? "Chiri đã thức! Chế độ điều khiển xe đang bật."
        : "Chiri đã thức dậy! Mình sẵn sàng trò chuyện rồi ❤️";
   
    addMessage('ai', greeting);
    playAudio(greeting);
    setExpression('happy');
    
    // Fix mic: Bắt đầu nghe ngay sau khi wake
    setTimeout(startListening, 800);
}

function goToSleep() {
    if (!isAwake) return;
    isAwake = false;
    isListening = false;
    if (recognition) recognition.abort();
    stopMouthAnimation();
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
   
    const msg = "Chiri đi ngủ đây. Nói 'Xin chào' để đánh thức mình nhé!";
    addMessage('ai', msg);
    playAudio(msg);
   
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (countdownInterval) clearInterval(countdownInterval);
}

// ================== SPEECH RECOGNITION (ĐÃ FIX MẤT MIC) ==================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        statusText.innerHTML = '❌ Trình duyệt không hỗ trợ nhận diện giọng nói!';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        console.log('🎤 Microphone started');
        setExpression('listening');
        updateWakeIndicator('listening');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log(`🎙️ Nghe được: "${transcript}"`);

        if (transcript.length < 2) return;

        lastActivityTime = Date.now();
        resetInactivityTimer();

        if (!isAwake) {
            if (WAKE_WORDS.some(word => transcript.toLowerCase().includes(word))) {
                wakeUp();
            }
        } else if (!isProcessing) {
            if (!WAKE_WORDS.some(w => transcript.toLowerCase() === w)) {
                processCommand(transcript);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('❌ Recognition error:', event.error);
        isListening = false;
        if (event.error === 'not-allowed') {
            statusText.innerHTML = '❌ Cần cấp quyền Microphone!';
        }
    };

    recognition.onend = () => {
        isListening = false;
        console.log('🔴 Recognition ended');

        if (isAwake && !isProcessing) {
            clearTimeout(restartTimeout);
            restartTimeout = setTimeout(startListening, 700);
        }
    };
}

function startListening() {
    if (!recognition || isListening || isProcessing || !isAwake) return;
    try {
        recognition.start();
    } catch (e) {
        console.error('Start recognition failed:', e);
        setTimeout(startListening, 1000);
    }
}

// ================== COMMAND & WEBSOCKET ==================
async function processCommand(text) {
    if (isProcessing) return;
    isProcessing = true;
   
    addMessage('user', text);
    setExpression('thinking');
    statusText.innerHTML = '🤔 Chiri đang suy nghĩ...';

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'voice',
            text: text,
            driveMode: driveControlMode
        }));
    } else {
        addMessage('ai', 'Mất kết nối với server. Đang thử kết nối lại...');
        setExpression('listening');
        isProcessing = false;
    }
}

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('✅ WebSocket connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            playAudio(data.text);
            statusText.innerHTML = driveControlMode ? '🎮 Đang nghe lệnh xe...' : '🎤 Đang lắng nghe...';
        }
    };

    ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), 8000);
        setTimeout(connectWebSocket, delay);
    };
}

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (isAwake) goToSleep();
    }, INACTIVITY_LIMIT);
}

// ================== INIT ==================
function init() {
    console.log('🚀 Chiri AI v5.1 - Professional Edition');
    setExpression('sleepy');
    updateWakeIndicator('sleeping');
    updateDriveModeUI();
   
    connectWebSocket();
    initSpeechRecognition();
    resetInactivityTimer();

    // Manual wake
    manualWake.addEventListener('click', () => {
        if (!isAwake) wakeUp();
        else {
            resetInactivityTimer();
            const msg = driveControlMode ? "Chiri sẵn sàng nhận lệnh xe!" : "Chiri đây! Bạn muốn hỏi gì?";
            addMessage('ai', msg);
            playAudio(msg);
            setExpression('happy');
        }
    });

    driveModeBtn.addEventListener('click', () => {
        driveControlMode = !driveControlMode;
        updateDriveModeUI();
        const msg = driveControlMode
            ? "Đã bật chế độ điều khiển xe!"
            : "Đã chuyển sang chế độ trò chuyện thông minh!";
        addMessage('ai', msg);
        playAudio(msg);
        setExpression('happy');
    });

    // Blink eyes
    setInterval(() => {
        if (isAwake && !isProcessing && !currentAudio) {
            document.querySelectorAll('.robot-eye').forEach(eye => {
                eye.style.transform = 'scaleY(0.05)';
                setTimeout(() => eye.style.transform = '', 120);
            });
        }
    }, 4500);
}

document.addEventListener('DOMContentLoaded', init);
