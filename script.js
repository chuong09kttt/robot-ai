const wakeDot = document.getElementById('wakeDot');
const wakeText = document.getElementById('wakeText');
const robotSvg = document.querySelector('.robot-svg');
const statusText = document.getElementById('statusText');
const chatBox = document.getElementById('chatBox');
const manualWake = document.getElementById('manualWake');
const driveModeBtn = document.getElementById('driveModeBtn');
const sleepTimer = document.getElementById('sleepTimer');

let ws = null;
let recognition = null;

let isAwake = false;
let isListening = false;
let isSpeaking = false;
let isAIProcessing = false;

let inactivityTimer = null;
let currentAudio = null;
let restartTimeout = null;

let driveControlMode = false;
let mouthAnimationInterval = null;
let reconnectAttempts = 0;

// Countdown variables
let countdownInterval = null;
let currentCountdown = 0;
let countdownEndTime = null;

const INACTIVITY_LIMIT = 120000;

const WAKE_WORDS = [
    'xin chào',
    'hello',
    'hi',
    'chào chiri',
    'chiri ơi',
    'hey chiri'
];

// Update sleep timer display
function updateSleepTimerDisplay() {
    if (!sleepTimer) return;
    
    if (!isAwake) {
        sleepTimer.innerHTML = '😴 Đang ngủ';
        sleepTimer.style.opacity = '0.6';
        return;
    }
    
    if (inactivityTimer) {
        // Calculate remaining time        const remaining = Math.max(0, INACTIVITY_LIMIT - (Date.now() - inactivityTimer._idleStart));
        const seconds = Math.ceil(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (minutes > 0) {
            sleepTimer.innerHTML = `⏰ Sẽ ngủ sau ${minutes}:${secs.toString().padStart(2, '0')}`;
        } else {
            sleepTimer.innerHTML = `⏰ Sẽ ngủ sau ${seconds} giây`;
        }
        sleepTimer.style.opacity = '1';
    }
}

// Update sleep timer every second
setInterval(updateSleepTimerDisplay, 1000);

// ================= COUNTDOWN FUNCTIONS =================

function startCountdown(seconds, onTick, onComplete) {
    stopCountdown();
    
    currentCountdown = seconds;
    countdownEndTime = Date.now() + (seconds * 1000);
    
    // Add countdown display
    let countdownDiv = document.getElementById('countdownDisplay');
    if (!countdownDiv) {
        countdownDiv = document.createElement('div');
        countdownDiv.id = 'countdownDisplay';
        countdownDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            color: #ff6a2e;
            padding: 20px 40px;
            border-radius: 60px;
            font-size: 48px;
            font-weight: bold;
            font-family: monospace;
            z-index: 1000;
            text-align: center;
            box-shadow: 0 0 30px rgba(255,106,46,0.5);
            border: 2px solid #ff6a2e;
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(countdownDiv);
    }
    
    countdownDiv.style.display = 'block';
    
    if (onTick) onTick(seconds);
    
    countdownInterval = setInterval(() => {
        currentCountdown--;
        
        // Update display
        const mins = Math.floor(currentCountdown / 60);
        const secs = currentCountdown % 60;
        let displayText = '';
        
        if (mins > 0) {
            displayText = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            displayText = `${currentCountdown} giây`;
        }
        
        countdownDiv.innerHTML = `⏰ ${displayText}`;
        
        // Shake effect when 10 seconds left
        if (currentCountdown <= 10 && currentCountdown > 0) {
            countdownDiv.style.transform = 'translate(-50%, -50%) scale(1.1)';
            setTimeout(() => {
                if (countdownDiv) countdownDiv.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 200);
        }
        
        // Announce at key moments
        if (currentCountdown === 10) {
            fallbackSpeak('Còn 10 giây');
        } else if (currentCountdown === 5) {
            fallbackSpeak('Còn 5 giây');
        } else if (currentCountdown === 3) {
            fallbackSpeak('Ba');
        } else if (currentCountdown === 2) {
            fallbackSpeak('Hai');
        } else if (currentCountdown === 1) {
            fallbackSpeak('Một');
        }
        
        if (onTick) onTick(currentCountdown);
        
        if (currentCountdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            
            if (countdownDiv) {
                countdownDiv.innerHTML = '🔔 HẾT GIỜ! 🔔';
                countdownDiv.style.background = 'rgba(255,0,0,0.9)';
                countdownDiv.style.color = 'white';
                setTimeout(() => {
                    if (countdownDiv) countdownDiv.style.display = 'none';
                }, 2000);
            }
            
            fallbackSpeak('Hết giờ!');
            if (onComplete) onComplete();
        }
    }, 1000);
}

function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    currentCountdown = 0;
    countdownEndTime = null;
    
    const countdownDiv = document.getElementById('countdownDisplay');
    if (countdownDiv) {
        countdownDiv.style.display = 'none';
    }
}

// ================= ROBOT FACE =================

function setExpression(expression) {
    robotSvg.classList.remove(
        'listening',
        'happy',
        'thinking',
        'sleepy',
        'talking'
    );
    
    robotSvg.classList.add(expression);
    
    const mouth = document.querySelector('.robot-mouth');
    const tongue = document.getElementById('tongue');
    
    if (!mouth) return;
    
    stopMouthAnimation();
    
    switch(expression) {
        case 'talking':
            startMouthAnimation();
            if (tongue) tongue.style.opacity = '0.3';
            break;
        case 'listening':
            mouth.style.transform = 'scaleY(0.7)';
            if (tongue) tongue.style.opacity = '0';
            break;
        case 'happy':
            mouth.style.transform = 'scaleY(1.1)';
            if (tongue) tongue.style.opacity = '0.5';
            break;
        case 'thinking':
            mouth.style.transform = 'scaleY(0.2)';
            if (tongue) tongue.style.opacity = '0';
            break;
        case 'sleepy':
            mouth.style.transform = 'scaleY(0.3)';
            if (tongue) tongue.style.opacity = '0';
            break;
    }
}

function startMouthAnimation() {
    if (mouthAnimationInterval) {
        clearInterval(mouthAnimationInterval);
    }
    
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
    const mouth = document.querySelector('.robot-mouth');
    if (mouth) mouth.style.transform = '';
}

// ================= UI =================

function updateWakeIndicator(state) {
    wakeDot.classList.remove('listening');
    
    if (state === 'listening') {
        wakeDot.classList.add('listening');
        wakeText.innerHTML = '🎤 Đang lắng nghe...';
    } else if (state === 'awake') {
        wakeDot.style.background = '#f39c12';
        wakeText.innerHTML = '💬 Đang thức';
    } else {
        wakeDot.style.background = '#2ecc71';
        wakeText.innerHTML = '😴 Đang ngủ';
    }
}

function updateDriveModeUI() {
    if (driveControlMode) {
        driveModeBtn.innerHTML = '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.add('drive-active');
        const driveHint = document.getElementById('driveHint');
        if (driveHint) driveHint.style.background = '#ffcc88';
    } else {
        driveModeBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.remove('drive-active');
        const driveHint = document.getElementById('driveHint');
        if (driveHint) driveHint.style.background = '';
    }
}

function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    while (chatBox.children.length > 30) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================= AUDIO =================

async function playAudio(text) {
    if (!text) return;
    
    isSpeaking = true;
    setExpression('talking');
    
    try {
        const response = await fetch(`/tts?text=${encodeURIComponent(text.slice(0, 300))}`);
        if (response.ok) {
            const blob = await response.blob();
            await playBlobAudio(blob);
        } else {
            await fallbackSpeak(text);
        }
    } catch(e) {
        console.log('TTS error, using fallback');
        await fallbackSpeak(text);
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
        currentAudio.play().catch(resolve);
    });
}

function fallbackSpeak(text) {
    return new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        speechSynthesis.speak(utterance);
    });
}

function finishSpeaking() {
    isSpeaking = false;
    stopMouthAnimation();
    if (isAwake) {
        setExpression('listening');
        setTimeout(() => startListening(), 500);
    }
}

// ================= WAKE =================

function wakeUp() {
    if (isAwake) return;
    
    isAwake = true;
    updateWakeIndicator('awake');
    resetInactivityTimer();
    setExpression('happy');
    
    const greeting = driveControlMode
        ? 'Chiri đã thức. Chế độ lái xe đang bật.'
        : 'Chiri đã thức dậy!';
    
    addMessage('ai', greeting);
    playAudio(greeting);
    
    setTimeout(() => startListening(), 1000);
}

function goToSleep() {
    isAwake = false;
    isListening = false;
    stopCountdown();
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
    
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    addMessage('ai', 'Chiri đi ngủ đây.');
}

// ================= SPEECH =================

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Trình duyệt không hỗ trợ voice');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        console.log('🎤 Microphone started');
        isListening = true;
        updateWakeIndicator('listening');
        setExpression('listening');
    };
    
    recognition.onresult = async (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log('🎙️ Nghe được:', transcript);
        
        if (!transcript) return;
        resetInactivityTimer();
        
        const lower = transcript.toLowerCase();
        
        // WAKE
        if (!isAwake) {
            if (WAKE_WORDS.some(word => lower.includes(word))) {
                wakeUp();
            }
            return;
        }
        
        if (isSpeaking || isAIProcessing) return;
        processCommand(transcript);
    };
    
    recognition.onerror = (event) => {
        console.log('Recognition error:', event.error);
        isListening = false;
        if (isAwake && !isSpeaking) {
            clearTimeout(restartTimeout);
            restartTimeout = setTimeout(() => startListening(), 1000);
        }
    };
    
    recognition.onend = () => {
        console.log('🔴 Recognition ended');
        isListening = false;
        if (isAwake && !isSpeaking) {
            clearTimeout(restartTimeout);
            restartTimeout = setTimeout(() => startListening(), 500);
        }
    };
}

function startListening() {
    if (!recognition || isListening || isSpeaking || isAIProcessing || !isAwake) {
        return;
    }
    
    try { recognition.stop(); } catch(e) {}
    
    setTimeout(() => {
        try { recognition.start(); } catch(e) {
            console.log('start fail');
        }
    }, 200);
}

// ================= COMMAND =================

async function processCommand(text) {
    if (isAIProcessing || isSpeaking) return;
    
    isAIProcessing = true;
    setExpression('thinking');
    statusText.innerHTML = '🤔 Đang suy nghĩ...';
    addMessage('user', text);
    console.log('📤 Gửi lên server:', text);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'voice',
            text: text,
            driveMode: driveControlMode
        }));
    } else {
        addMessage('ai', 'Mất kết nối server. Vui lòng tải lại trang.');
        isAIProcessing = false;
    }
}

// ================= WEBSOCKET =================

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('✅ WebSocket connected');
        statusText.innerHTML = '🎤 Nói "Xin chào" để đánh thức';
    };
    
    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📥 Received:', data);
            
            if (data.type === 'ai') {
                console.log('📥 AI:', data.text);
                isAIProcessing = false;
                addMessage('ai', data.text);
                await playAudio(data.text);
                statusText.innerHTML = '🎤 Đang lắng nghe...';
            }
            
            if (data.type === 'countdown') {
                console.log('⏰ Countdown:', data.seconds);
                addMessage('ai', data.message);
                await playAudio(data.message);
                
                startCountdown(data.seconds, 
                    (remaining) => {
                        // Optional: update UI on each tick
                    },
                    () => {
                        addMessage('ai', '🔔 Hết giờ!');
                        playAudio('Hết giờ rồi!');
                    }
                );
            }
            
            if (data.type === 'error') {
                console.error('Server error:', data.message);
                isAIProcessing = false;
            }
        } catch(e) {
            console.log('Parse error:', e);
            isAIProcessing = false;
        }
    };
    
    ws.onerror = (error) => {
        console.log('WS error:', error);
        statusText.innerHTML = '⚠️ Đang mất kết nối...';
    };
    
    ws.onclose = () => {
        console.log('WS reconnecting...');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), 8000);
        setTimeout(connectWebSocket, delay);
    };
}

// ================= TIMER =================

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    inactivityTimer = setTimeout(() => {
        if (isAwake) {
            goToSleep();
        }
    }, INACTIVITY_LIMIT);
}

// ================= INIT =================

function init() {
    console.log('🚀 Chiri AI v4.0 - Full Feature');
    
    updateWakeIndicator('sleeping');
    updateDriveModeUI();
    setExpression('sleepy');
    
    connectWebSocket();
    initSpeechRecognition();
    
    // Chrome needs user interaction
    document.addEventListener('click', () => {
        const audio = new Audio();
        audio.play().catch(()=>{});
        if (!isAwake) wakeUp();
    }, { once: true });
    
    manualWake.addEventListener('click', wakeUp);
    
    driveModeBtn.addEventListener('click', () => {
        driveControlMode = !driveControlMode;
        updateDriveModeUI();
        const msg = driveControlMode ? 'Đã bật chế độ lái xe' : 'Đã tắt chế độ lái xe';
        addMessage('ai', msg);
        playAudio(msg);
        if (driveControlMode) {
            stopCountdown();
        }
    });
    
    // Blink eyes
    setInterval(() => {
        if (isAwake && !isSpeaking) {
            document.querySelectorAll('.robot-eye').forEach(eye => {
                eye.style.transform = 'scaleY(0.05)';
                setTimeout(() => eye.style.transform = '', 120);
            });
        }
    }, 4500);
}

document.addEventListener('DOMContentLoaded', init);
