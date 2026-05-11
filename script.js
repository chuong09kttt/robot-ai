let robotFace, recognition, mediaStream;
let sleepTimer, countdownInterval;
let active = true;
let isAsleep = false;
let questionQueue = [];
let isSpeaking = false;
let currentTTS = null;

// DOM elements
const robotStage = document.getElementById('robotStage');
const chatBox = document.getElementById('chatBox');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const microBtn = document.getElementById('microBtn');
const statusSpan = document.getElementById('statusText');
const countdownSpan = document.getElementById('countdownTimer');

function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-${role}`;
    // Xử lý dính text: thay \n bằng <br> và dùng textContent an toàn
    const formatted = text.replace(/\n/g, '<br>');
    msgDiv.innerHTML = `<span>${role === 'user' ? '👤' : '🤖'} ${formatted}</span>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    if (!active) return;
    let secondsLeft = 60;
    countdownSpan.innerText = `⏱️ ${secondsLeft}s`;
    countdownInterval = setInterval(() => {
        secondsLeft--;
        countdownSpan.innerText = `⏱️ ${secondsLeft}s`;
        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            goToSleep();
        }
    }, 1000);
    sleepTimer = setTimeout(() => {}, 60000); // chỉ để đồng bộ
}

function goToSleep() {
    if (isAsleep) return;
    isAsleep = true;
    active = false;
    if (recognition) recognition.stop();
    statusSpan.innerText = '💤 Robot đang ngủ... nói "Chiri ơi" để đánh thức';
    robotFace.setExpression('sleepy');
    countdownSpan.innerText = '😴 Ngủ';
}

function wakeUp() {
    if (!isAsleep) return;
    isAsleep = false;
    active = true;
    statusSpan.innerText = '🎤 Đang lắng nghe...';
    robotFace.setExpression('happy');
    resetSleepTimer();
    startListening();
    addMessage('ai', 'Chào bạn! Tôi đã thức dậy, bạn cần gì ạ?');
}

function startListening() {
    if (!window.webkitSpeechRecognition) {
        alert('Trình duyệt không hỗ trợ micro');
        return;
    }
    const SpeechRecognition = window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'vi-VN';

    recognition.onresult = (event) => {
        const text = event.results[event.results.length-1][0].transcript.trim();
        if (!active && text.toLowerCase().includes('chiri ơi')) {
            wakeUp();
            return;
        }
        if (!active) return;
        resetSleepTimer();
        addMessage('user', text);
        processAI(text);
    };

    recognition.onerror = (e) => console.warn('Lỗi micro:', e);
    recognition.start();
}

async function processAI(text) {
    if (isSpeaking) questionQueue.push(text);
    else {
        isSpeaking = true;
        robotFace.setExpression('thinking');
        statusSpan.innerText = '🤔 Đang suy nghĩ...';
        try {
            // Giả lập gọi AI (thay bằng API thật)
            const reply = `Bạn vừa nói: "${text}". Tôi là robot Pika!`;
            addMessage('ai', reply);
            await speak(reply);
        } catch(e) { console.error(e); }
        finally {
            isSpeaking = false;
            robotFace.setExpression('happy');
            statusSpan.innerText = '🎤 Đang nghe...';
            if (questionQueue.length > 0) {
                const next = questionQueue.shift();
                processAI(next);
            }
        }
    }
}

async function speak(text) {
    if (currentTTS) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    currentTTS = utterance;
    window.speechSynthesis.speak(utterance);
}

function toggleFullscreenFace() {
    robotStage.classList.toggle('fullscreen-mode');
    toggleChatBtn.innerText = robotStage.classList.contains('fullscreen-mode') ? '🔼 Hiện chat' : '🔽 Ẩn chat';
}

microBtn.onclick = () => {
    if (!active && !isAsleep) goToSleep();
    else if (isAsleep) wakeUp();
    else {
        if (recognition) recognition.stop();
        startListening();
    }
};

toggleChatBtn.onclick = toggleFullscreenFace;

// Khởi tạo
window.onload = () => {
    robotFace = new RobotFace('robotCanvas');
    robotFace.setExpression('happy');
    resetSleepTimer();
    startListening();
};
