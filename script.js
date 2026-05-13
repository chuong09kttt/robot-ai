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

let isAIProcessing = false;
let isSpeaking = false;

let inactivityTimer = null;
let currentAudio = null;
let lastActivityTime = Date.now();

let driveControlMode = false;
let mouthAnimationInterval = null;

let reconnectAttempts = 0;
let ttsQueue = [];
let restartTimeout = null;

const INACTIVITY_LIMIT = 120000;

const WAKE_WORDS = [
    'xin chào',
    'hello',
    'hi',
    'chào chiri',
    'chiri ơi',
    'hey chiri'
];

// ================== ROBOT FACE ==================

function setExpression(expression) {

    robotSvg.classList.remove(
        'listening',
        'happy',
        'thinking',
        'surprised',
        'sleepy',
        'talking'
    );

    robotSvg.classList.add(expression);

    const mouth = document.querySelector('.robot-mouth');

    if (!mouth) return;

    stopMouthAnimation();

    switch (expression) {

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

    if (mouthAnimationInterval) {
        clearInterval(mouthAnimationInterval);
    }

    let frame = 0;

    const mouth = document.querySelector('.robot-mouth');

    mouthAnimationInterval = setInterval(() => {

        frame++;

        const scale =
            0.4 + Math.sin(frame * 0.8) * 0.45;

        mouth.style.transform = `scaleY(${scale})`;

    }, 80);
}

function stopMouthAnimation() {

    if (mouthAnimationInterval) {
        clearInterval(mouthAnimationInterval);
        mouthAnimationInterval = null;
    }

    const mouth = document.querySelector('.robot-mouth');

    if (mouth) {
        mouth.style.transform = '';
    }
}

// ================== UI ==================

function updateDriveModeUI() {

    if (driveControlMode) {

        driveModeBtn.innerHTML =
            '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';

        driveModeBtn.classList.add('drive-active');

        if (isAwake) {
            statusText.innerHTML =
                '🎮 CHẾ ĐỘ LÁI XE';
        }

    } else {

        driveModeBtn.innerHTML =
            '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';

        driveModeBtn.classList.remove('drive-active');

        if (isAwake) {
            statusText.innerHTML =
                '💬 CHẾ ĐỘ TRÒ CHUYỆN';
        }
    }
}

function updateWakeIndicator(state) {

    wakeDot.classList.remove('listening');

    if (state === 'listening') {

        wakeDot.classList.add('listening');

        wakeText.innerHTML =
            '🎤 Đang nghe...';

    } else if (state === 'awake') {

        wakeDot.style.background = '#f39c12';

        wakeText.innerHTML =
            '💬 Đang thức';

    } else {

        wakeDot.style.background = '#2ecc71';

        wakeText.innerHTML =
            '😴 Đang ngủ';
    }
}

function addMessage(type, text) {

    const messageDiv =
        document.createElement('div');

    messageDiv.className =
        `message ${type}`;

    messageDiv.innerHTML =
        `<div class="bubble">${escapeHtml(text)}</div>`;

    chatBox.appendChild(messageDiv);

    chatBox.scrollTop =
        chatBox.scrollHeight;

    while (chatBox.children.length > 30) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {

    const div = document.createElement('div');

    div.textContent = text;

    return div.innerHTML;
}

// ================== AUDIO ==================

async function playAudio(text) {

    if (!text) return;

    ttsQueue.push(text);

    processTTSQueue();
}

async function processTTSQueue() {

    if (
        currentAudio ||
        isSpeaking ||
        ttsQueue.length === 0
    ) {
        return;
    }

    isSpeaking = true;

    const textToPlay = ttsQueue.shift();

    setExpression('talking');

    try {

        const response = await fetch(
            `/tts?text=${encodeURIComponent(
                textToPlay.slice(0, 300)
            )}`
        );

        if (response.ok) {

            const blob =
                await response.blob();

            await playBlobAudio(blob);

        } else {

            await fallbackSpeak(textToPlay);
        }

    } catch (e) {

        console.error('TTS error:', e);

        await fallbackSpeak(textToPlay);
    }

    finishSpeaking();
}

function playBlobAudio(blob) {

    return new Promise(resolve => {

        const url =
            URL.createObjectURL(blob);

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

        currentAudio.play()
            .catch(() => resolve());
    });
}

function fallbackSpeak(text) {

    if (!('speechSynthesis' in window)) {
        return Promise.resolve();
    }

    return new Promise(resolve => {

        const utterance =
            new SpeechSynthesisUtterance(
                text.slice(0, 200)
            );

        utterance.lang = 'vi-VN';
        utterance.rate = 0.95;
        utterance.pitch = 1.05;

        utterance.onend = () => resolve();

        utterance.onerror = () => resolve();

        speechSynthesis.speak(utterance);
    });
}

function finishSpeaking() {

    isSpeaking = false;

    stopMouthAnimation();

    if (isAwake) {

        setExpression('listening');

        setTimeout(() => {

            if (!isListening) {
                startListening();
            }

        }, 700);
    }

    processTTSQueue();
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
        ? 'Chiri đã thức! Chế độ điều khiển xe đang bật.'
        : 'Chiri đã thức dậy! Mình sẵn sàng trò chuyện rồi ❤️';

    addMessage('ai', greeting);

    playAudio(greeting);

    setExpression('happy');

    setTimeout(() => {

        if (!isListening) {
            startListening();
        }

    }, 1200);
}

function goToSleep() {

    if (!isAwake) return;

    isAwake = false;

    isListening = false;

    if (recognition) {
        recognition.abort();
    }

    stopMouthAnimation();

    updateWakeIndicator('sleeping');

    setExpression('sleepy');

    const msg =
        "Chiri đi ngủ đây. Nói 'Xin chào' để đánh thức mình nhé!";

    addMessage('ai', msg);

    playAudio(msg);

    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
}

// ================== SPEECH RECOGNITION ==================

function initSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        statusText.innerHTML =
            '❌ Trình duyệt không hỗ trợ nhận diện giọng nói!';

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

        const transcript =
            event.results[
                event.results.length - 1
            ][0].transcript.trim();

        console.log(`🎙️ Nghe được: "${transcript}"`);

        if (transcript.length < 2) return;

        lastActivityTime = Date.now();

        resetInactivityTimer();

        const lower =
            transcript.toLowerCase();

        // WAKE
        if (!isAwake) {

            if (
                WAKE_WORDS.some(word =>
                    lower.includes(word)
                )
            ) {
                wakeUp();
            }

            return;
        }

        // BỎ QUA KHI ĐANG NÓI
        if (isSpeaking || isAIProcessing) {
            return;
        }

        // KHÔNG GỬI WAKE WORD LÊN AI
        if (
            WAKE_WORDS.some(word =>
                lower === word
            )
        ) {
            return;
        }

        processCommand(transcript);
    };

    recognition.onerror = (event) => {

        console.error(
            '❌ Recognition error:',
            event.error
        );

        isListening = false;

        if (
            isAwake &&
            !isAIProcessing &&
            !isSpeaking
        ) {

            clearTimeout(restartTimeout);

            restartTimeout =
                setTimeout(() => {

                    startListening();

                }, 1200);
        }
    };

    recognition.onend = () => {

        isListening = false;

        console.log('🔴 Recognition ended');

        if (
            isAwake &&
            !isAIProcessing &&
            !isSpeaking
        ) {

            clearTimeout(restartTimeout);

            restartTimeout =
                setTimeout(() => {

                    startListening();

                }, 900);
        }
    };
}

function startListening() {

    if (
        !recognition ||
        isListening ||
        isAIProcessing ||
        isSpeaking ||
        !isAwake
    ) {
        return;
    }

    try {

        recognition.start();

    } catch (e) {

        console.error(
            'Start recognition failed:',
            e
        );

        setTimeout(startListening, 1500);
    }
}

// ================== COMMAND ==================

async function processCommand(text) {

    if (isAIProcessing || isSpeaking) {

        console.log('⚠️ Busy...');

        return;
    }

    isAIProcessing = true;

    console.log(
        `📤 Gửi lệnh lên server: "${text}"`
    );

    addMessage('user', text);

    setExpression('thinking');

    statusText.innerHTML =
        '🤔 Chiri đang suy nghĩ...';

    if (
        ws &&
        ws.readyState === WebSocket.OPEN
    ) {

        ws.send(JSON.stringify({

            type: 'voice',

            text: text,

            driveMode: driveControlMode
        }));

    } else {

        console.error(
            '❌ WebSocket không kết nối'
        );

        addMessage(
            'ai',
            'Mất kết nối với server. Đang thử kết nối lại...'
        );

        isAIProcessing = false;

        setExpression('listening');

        setTimeout(startListening, 1000);
    }
}

// ================== WEBSOCKET ==================

function connectWebSocket() {

    const protocol =
        location.protocol === 'https:'
            ? 'wss:'
            : 'ws:';

    ws = new WebSocket(
        `${protocol}//${location.host}`
    );

    ws.onopen = () => {

        reconnectAttempts = 0;

        console.log(
            '✅ WebSocket connected'
        );
    };

    ws.onmessage = (event) => {

        try {

            const data =
                JSON.parse(event.data);

            if (data.type === 'ai') {

                isAIProcessing = false;

                console.log(
                    '📥 Nhận phản hồi từ AI'
                );

                addMessage('ai', data.text);

                playAudio(data.text);

                statusText.innerHTML =
                    driveControlMode
                        ? '🎮 Đang nghe lệnh xe...'
                        : '🎤 Đang lắng nghe...';
            }

        } catch (e) {

            console.error(
                'Lỗi parse message:',
                e
            );

            isAIProcessing = false;
        }
    };

    ws.onclose = () => {

        console.log(
            '🔌 WebSocket closed'
        );

        const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts++),
            8000
        );

        setTimeout(connectWebSocket, delay);
    };

    ws.onerror = (e) => {

        console.error(
            '❌ WebSocket error:',
            e
        );
    };
}

// ================== TIMER ==================

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

// ================== INIT ==================

function init() {

    console.log(
        '🚀 Chiri AI v5.3 Stable'
    );

    setExpression('sleepy');

    updateWakeIndicator('sleeping');

    updateDriveModeUI();

    connectWebSocket();

    initSpeechRecognition();

    resetInactivityTimer();

    // Chrome cần user interaction
    document.body.addEventListener('click', () => {

        if (!isAwake) {
            wakeUp();
        }

    }, { once: true });

    // Nút đánh thức
    manualWake.addEventListener('click', () => {

        if (!isAwake) {

            wakeUp();

        } else {

            resetInactivityTimer();

            const msg = driveControlMode
                ? 'Chiri sẵn sàng nhận lệnh xe!'
                : 'Chiri đây! Bạn muốn hỏi gì?';

            addMessage('ai', msg);

            playAudio(msg);

            setExpression('happy');
        }
    });

    // Drive mode
    driveModeBtn.addEventListener('click', () => {

        driveControlMode =
            !driveControlMode;

        updateDriveModeUI();

        const msg = driveControlMode
            ? 'Đã bật chế độ điều khiển xe!'
            : 'Đã chuyển sang chế độ trò chuyện!';

        addMessage('ai', msg);

        playAudio(msg);

        setExpression('happy');
    });

    // Blink eyes
    setInterval(() => {

        if (
            isAwake &&
            !isAIProcessing &&
            !isSpeaking
        ) {

            document
                .querySelectorAll('.robot-eye')
                .forEach(eye => {

                    eye.style.transform =
                        'scaleY(0.05)';

                    setTimeout(() => {

                        eye.style.transform = '';

                    }, 120);
                });
        }

    }, 4500);
}

document.addEventListener(
    'DOMContentLoaded',
    init
);
