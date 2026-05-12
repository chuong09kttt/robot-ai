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
let inactivityTimer = null;
let countdownInterval = null;
let isProcessing = false;
let currentAudio = null;
let lastActivityTime = Date.now();
let driveControlMode = false;
let mouthAnimationInterval = null;
let reconnectAttempts = 0;
let ttsQueue = [];

const INACTIVITY_LIMIT = 120000;
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi', 'hey chiri'];

function startMouthAnimation() {
    if (mouthAnimationInterval) clearInterval(mouthAnimationInterval);
    let frame = 0;
    const mouth = document.querySelector('.robot-mouth');
    if (!mouth) return;
    const originalTransform = mouth.style.transform;
    mouthAnimationInterval = setInterval(() => {
        if (!isProcessing && !currentAudio && !window.speechSynthesis?.speaking) {
            if (mouthAnimationInterval) {
                clearInterval(mouthAnimationInterval);
                mouthAnimationInterval = null;
                mouth.style.transform = originalTransform;
            }
            return;
        }
        frame++;
        const scale = 0.4 + Math.sin(frame * 0.8) * 0.4;
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

function setExpression(expression) {
    robotSvg.classList.remove('listening', 'happy', 'thinking', 'surprised', 'sleepy', 'talking');
    robotSvg.classList.add(expression);
    const mouth = document.querySelector('.robot-mouth');
    switch(expression) {
        case 'talking':
            if (!mouthAnimationInterval) startMouthAnimation();
            break;
        case 'listening':
            stopMouthAnimation();
            if (mouth) mouth.style.transform = 'scaleY(0.7)';
            break;
        case 'happy':
            stopMouthAnimation();
            if (mouth) mouth.style.transform = 'scaleY(1.1) scaleX(1.1)';
            break;
        case 'thinking':
            stopMouthAnimation();
            if (mouth) mouth.style.transform = 'scaleY(0.2)';
            break;
        case 'sleepy':
            stopMouthAnimation();
            if (mouth) mouth.style.transform = 'scaleY(0.3)';
            break;
        default:
            stopMouthAnimation();
            if (mouth) mouth.style.transform = '';
    }
}

function updateDriveModeUI() {
    if (driveControlMode) {
        driveModeBtn.innerHTML = '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.add('drive-active');
        if (isAwake) statusText.innerHTML = '🎮 CHẾ ĐỘ LÁI XE: nói tiến, lùi, trái, phải, dừng';
    } else {
        driveModeBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.remove('drive-active');
        if (isAwake) statusText.innerHTML = '💬 CHẾ ĐỘ TRÒ CHUYỆN: hỏi đáp thông minh';
    }
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
    while (chatBox.children.length > 30) chatBox.removeChild(chatBox.firstChild);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Optimized audio playback with queue
async function playAudio(text) {
    if (!text) return;
    
    ttsQueue.push(text);
    if (currentAudio) return;
    
    while (ttsQueue.length > 0) {
        const textToPlay = ttsQueue.shift();
        try {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            setExpression('talking');
            const url = `/tts?text=${encodeURIComponent(textToPlay.slice(0, 300))}`;
            const response = await fetch(url);
            if (response.ok && response.headers.get('content-type') === 'audio/mpeg') {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                currentAudio = new Audio(audioUrl);
                await new Promise((resolve) => {
                    currentAudio.onended = () => {
                        URL.revokeObjectURL(audioUrl);
                        currentAudio = null;
                        resolve();
                    };
                    currentAudio.onerror = () => {
                        URL.revokeObjectURL(audioUrl);
                        currentAudio = null;
                        resolve();
                    };
                    currentAudio.play().catch(resolve);
                });
            } else {
                fallbackSpeak(textToPlay);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            fallbackSpeak(textToPlay);
        }
    }
    stopMouthAnimation();
    if (isAwake) setExpression('listening');
    isProcessing = false;
}

function fallbackSpeak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 200));
        utterance.lang = 'vi-VN';
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        const voices = window.speechSynthesis.getVoices();
        const vietnameseVoice = voices.find(voice => voice.lang.includes('vi'));
        if (vietnameseVoice) utterance.voice = vietnameseVoice;
        utterance.onstart = () => {
            setExpression('talking');
            startMouthAnimation();
        };
        utterance.onend = () => {
            stopMouthAnimation();
            if (isAwake) setExpression('listening');
        };
        utterance.onerror = () => {
            stopMouthAnimation();
            if (isAwake) setExpression('listening');
        };
        window.speechSynthesis.speak(utterance);
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
        "Chiri đã thức! Mình sẵn sàng trò chuyện. Bạn có thể hỏi mình bất cứ điều gì nhé!";
    addMessage('ai', greeting);
    setExpression('happy');
    playAudio(greeting);
}

function goToSleep() {
    if (!isAwake) return;
    console.log('😴 Chiri đi ngủ');
    isAwake = false;
    stopMouthAnimation();
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
        if (isAwake && (Date.now() - lastActivityTime) >= INACTIVITY_LIMIT) goToSleep();
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

let recognitionActive = false;

function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        statusText.innerHTML = '❌ Trình duyệt không hỗ trợ! Dùng Chrome/Edge!';
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        console.log('🎤 Micro đang lắng nghe...');
        recognitionActive = true;
        if (isAwake) setExpression('listening');
    };
    
    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (event.results[i].isFinal && transcript) {
                console.log(`🎙️ Nghe: "${transcript}"`);
                if (transcript.length < 3) continue;
                if (!isAwake && !isProcessing) {
                    for (const word of WAKE_WORDS) {
                        if (transcript.includes(word)) { wakeUp(); break; }
                    }
                } else if (isAwake && !isProcessing && transcript.length > 2) {
                    let isOnlyWakeWord = WAKE_WORDS.some(w => transcript === w);
                    if (!isOnlyWakeWord) processCommand(transcript);
                }
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Lỗi recognition:', event.error);
        if (event.error === 'not-allowed') statusText.innerHTML = '❌ Cần cấp quyền micro!';
        if (event.error === 'no-speech') return;
        recognitionActive = false;
    };
    
    recognition.onend = () => {
        recognitionActive = false;
        if (!isProcessing && isAwake) {
            setTimeout(() => { 
                if (!recognitionActive && isAwake) {
                    try { recognition.start(); } catch(e) {}
                }
            }, 500);
        }
    };
    
    recognition.start();
    console.log('✅ Speech Recognition started');
}

// WebSocket with exponential backoff
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}`;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttempts = 0;
        if (isAwake) statusText.innerHTML = driveControlMode ? '🎤 Đang nghe lệnh xe...' : '🎤 Đang lắng nghe...';
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            playAudio(data.text);
            statusText.innerHTML = driveControlMode ? '🎤 Đang nghe lệnh xe...' : '🎤 Đang lắng nghe...';
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        reconnectAttempts++;
        setTimeout(connectWebSocket, delay);
    };
    
    ws.onerror = (error) => console.error('WebSocket error:', error);
}

manualWake.addEventListener('click', () => {
    if (!isAwake) wakeUp();
    else {
        resetInactivityTimer();
        const msg = driveControlMode ? "Chiri đây! Bạn muốn ra lệnh gì?" : "Chiri đây! Bạn muốn hỏi gì ạ?";
        addMessage('ai', msg);
        setExpression('happy');
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
        setExpression('happy');
        playAudio(msg);
    }
});

function init() {
    console.log('🚀 Chiri AI khởi động v4.0...');
    setExpression('sleepy');
    statusText.innerHTML = '🎤 Nói "Xin chào" để đánh thức';
    updateDriveModeUI();
    connectWebSocket();
    initSpeechRecognition();
    resetInactivityTimer();
    
    // Blink effect
    setInterval(() => {
        if (isAwake && !isProcessing && !currentAudio) {
            const eyes = document.querySelectorAll('.robot-eye');
            eyes.forEach(eye => {
                eye.style.transform = 'scaleY(0.05)';
                setTimeout(() => { if (eye) eye.style.transform = ''; }, 100);
            });
        }
    }, 4000);
}

document.addEventListener('DOMContentLoaded', init);
