const wakeDot = document.getElementById('wakeDot');
const wakeText = document.getElementById('wakeText');
const robotSvg = document.querySelector('.robot-svg');
const statusText = document.getElementById('statusText');
const chatBox = document.getElementById('chatBox');
const manualWake = document.getElementById('manualWake');
const driveModeBtn = document.getElementById('driveModeBtn');

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

const INACTIVITY_LIMIT = 120000;

const WAKE_WORDS = [
    'xin chào',
    'hello',
    'hi',
    'chào chiri',
    'chiri ơi',
    'hey chiri'
];

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
            mouth.style.transform = 'scaleY(1.1)';
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

    const mouth = document.querySelector('.robot-mouth');

    let frame = 0;

    mouthAnimationInterval = setInterval(() => {

        frame++;

        const scale =
            0.4 + Math.sin(frame * 0.8) * 0.45;

        mouth.style.transform =
            `scaleY(${scale})`;

    }, 80);
}

function stopMouthAnimation() {

    if (mouthAnimationInterval) {

        clearInterval(mouthAnimationInterval);

        mouthAnimationInterval = null;
    }

    const mouth =
        document.querySelector('.robot-mouth');

    if (mouth) {
        mouth.style.transform = '';
    }
}

// ================= UI =================

function updateWakeIndicator(state) {

    wakeDot.classList.remove('listening');

    if (state === 'listening') {

        wakeDot.classList.add('listening');

        wakeText.innerHTML =
            '🎤 Đang lắng nghe...';

    } else if (state === 'awake') {

        wakeDot.style.background =
            '#f39c12';

        wakeText.innerHTML =
            '💬 Đang thức';

    } else {

        wakeDot.style.background =
            '#2ecc71';

        wakeText.innerHTML =
            '😴 Đang ngủ';
    }
}

function updateDriveModeUI() {

    if (driveControlMode) {

        driveModeBtn.innerHTML =
            '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';

        driveModeBtn.classList.add(
            'drive-active'
        );

    } else {

        driveModeBtn.innerHTML =
            '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';

        driveModeBtn.classList.remove(
            'drive-active'
        );
    }
}

function addMessage(type, text) {

    const messageDiv =
        document.createElement('div');

    messageDiv.className =
        `message ${type}`;

    messageDiv.innerHTML = `
        <div class="bubble">
            ${escapeHtml(text)}
        </div>
    `;

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

// ================= AUDIO =================

async function playAudio(text) {

    if (!text) return;

    isSpeaking = true;

    setExpression('talking');

    try {

        const response = await fetch(
            `/tts?text=${encodeURIComponent(text.slice(0,300))}`
        );

        if (!response.ok) {
            throw new Error('TTS error');
        }

        const blob =
            await response.blob();

        await playBlobAudio(blob);

    } catch(e) {

        console.log('Fallback TTS');

        await fallbackSpeak(text);
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
            .catch(resolve);
    });
}

function fallbackSpeak(text) {

    return new Promise(resolve => {

        const utterance =
            new SpeechSynthesisUtterance(text);

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

        setTimeout(() => {

            startListening();

        }, 500);
    }
}

// ================= WAKE =================

function wakeUp() {

    if (isAwake) return;

    isAwake = true;

    updateWakeIndicator('awake');

    resetInactivityTimer();

    setExpression('happy');

    const greeting =
        driveControlMode
        ? 'Chiri đã thức. Chế độ lái xe đang bật.'
        : 'Chiri đã thức dậy!';

    addMessage('ai', greeting);

    playAudio(greeting);

    setTimeout(() => {

        startListening();

    }, 1000);
}

function goToSleep() {

    isAwake = false;

    isListening = false;

    if (recognition) {

        try {
            recognition.stop();
        } catch(e){}
    }

    updateWakeIndicator('sleeping');

    setExpression('sleepy');

    addMessage(
        'ai',
        'Chiri đi ngủ đây.'
    );
}

// ================= SPEECH =================

function initSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        alert(
            'Trình duyệt không hỗ trợ voice'
        );

        return;
    }

    recognition =
        new SpeechRecognition();

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

        const transcript =
            event.results[
                event.results.length - 1
            ][0].transcript.trim();

        console.log(
            '🎙️ Nghe được:',
            transcript
        );

        if (!transcript) return;

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

        if (
            isSpeaking ||
            isAIProcessing
        ) return;

        processCommand(transcript);
    };

    recognition.onerror = (event) => {

        console.log(
            'Recognition error:',
            event.error
        );

        isListening = false;

        if (
            isAwake &&
            !isSpeaking
        ) {

            clearTimeout(restartTimeout);

            restartTimeout =
                setTimeout(() => {

                    startListening();

                }, 1000);
        }
    };

    recognition.onend = () => {

        console.log(
            '🔴 Recognition ended'
        );

        isListening = false;

        if (
            isAwake &&
            !isSpeaking
        ) {

            clearTimeout(restartTimeout);

            restartTimeout =
                setTimeout(() => {

                    startListening();

                }, 500);
        }
    };
}

function startListening() {

    if (
        !recognition ||
        isListening ||
        isSpeaking ||
        isAIProcessing ||
        !isAwake
    ) {
        return;
    }

    try {

        recognition.stop();

    } catch(e){}

    setTimeout(() => {

        try {

            recognition.start();

        } catch(e) {

            console.log(
                'start fail'
            );
        }

    }, 200);
}

// ================= COMMAND =================

async function processCommand(text) {

    if (
        isAIProcessing ||
        isSpeaking
    ) return;

    isAIProcessing = true;

    setExpression('thinking');

    statusText.innerHTML =
        '🤔 Đang suy nghĩ...';

    addMessage('user', text);

    console.log(
        '📤 Gửi lên server:',
        text
    );

    if (
        ws &&
        ws.readyState === WebSocket.OPEN
    ) {

        ws.send(JSON.stringify({

            type: 'voice',

            text,

            driveMode:
                driveControlMode
        }));

    } else {

        addMessage(
            'ai',
            'Mất kết nối server'
        );

        isAIProcessing = false;
    }
}

// ================= WEBSOCKET =================

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

    ws.onmessage = async (event) => {

        try {

            const data =
                JSON.parse(event.data);

            if (data.type === 'ai') {

                console.log(
                    '📥 AI:',
                    data.text
                );

                isAIProcessing = false;

                addMessage(
                    'ai',
                    data.text
                );

                await playAudio(data.text);

                statusText.innerHTML =
                    '🎤 Đang lắng nghe...';
            }

        } catch(e) {

            console.log(e);

            isAIProcessing = false;
        }
    };

    ws.onclose = () => {

        console.log(
            'WS reconnecting...'
        );

        const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts++),
            8000
        );

        setTimeout(
            connectWebSocket,
            delay
        );
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

    console.log(
        '🚀 Chiri AI Stable'
    );

    updateWakeIndicator('sleeping');

    updateDriveModeUI();

    setExpression('sleepy');

    connectWebSocket();

    initSpeechRecognition();

    // Chrome cần user interaction
    document.addEventListener('click', () => {

        const audio = new Audio();

        audio.play().catch(()=>{});

        if (!isAwake) {

            wakeUp();
        }

    }, { once: true });

    manualWake.addEventListener(
        'click',
        wakeUp
    );

    driveModeBtn.addEventListener(
        'click',
        () => {

            driveControlMode =
                !driveControlMode;

            updateDriveModeUI();

            const msg =
                driveControlMode
                ? 'Đã bật chế độ lái xe'
                : 'Đã tắt chế độ lái xe';

            addMessage('ai', msg);

            playAudio(msg);
        }
    );

    // Blink eyes
    setInterval(() => {

        if (
            isAwake &&
            !isSpeaking
        ) {

            document
                .querySelectorAll('.robot-eye')
                .forEach(eye => {

                    eye.style.transform =
                        'scaleY(0.05)';

                    setTimeout(() => {

                        eye.style.transform =
                            '';

                    }, 120);
                });
        }

    }, 4500);
}

document.addEventListener(
    'DOMContentLoaded',
    init
);
