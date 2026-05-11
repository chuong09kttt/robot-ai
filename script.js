// Đợi DOM load xong mới chạy
document.addEventListener('DOMContentLoaded', function() {
    
let ws = null;
let recognition = null;
let isAwake = true;
let inactivityTimer = null;
let isProcessing = false;
let currentAudio = null;

// Cấu hình
const INACTIVITY_LIMIT = 120000;
const WAKE_WORDS = ['chiri', 'chào chiri', 'xin chào', 'hello chiri', 'hi chiri', 'chiri ơi', 'hey chiri', 'chào bạn', 'alô', 'chào'];

let lastActivityTime = Date.now();
let countdownInterval = null;

// Lấy elements
const wakeDot = document.getElementById('wakeDot');
const wakeText = document.getElementById('wakeText');
const sleepTimer = document.getElementById('sleepTimer');
const robotFace = document.getElementById('robotFace');
const statusText = document.getElementById('statusText');
const chatBox = document.getElementById('chatBox');
const manualWake = document.getElementById('manualWake');

// Kiểm tra elements tồn tại
console.log('Elements check:', {
    wakeDot: !!wakeDot,
    wakeText: !!wakeText,
    sleepTimer: !!sleepTimer,
    robotFace: !!robotFace,
    statusText: !!statusText,
    chatBox: !!chatBox,
    manualWake: !!manualWake
});

// Hàm debug
function logDebug(msg) {
    console.log(`[DEBUG] ${new Date().toLocaleTimeString()}: ${msg}`);
}

// Cập nhật indicator
function updateWakeIndicator(state) {
    if (!wakeDot || !wakeText) return;
    
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

// Khởi tạo Speech Recognition
function initSpeechRecognition() {
    logDebug('Khởi tạo Speech Recognition...');
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onstart = () => {
            logDebug('🎤 Micro đang lắng nghe...');
            updateWakeIndicator('listening');
            if (statusText) statusText.innerHTML = '🎤 Đang lắng nghe... Hãy nói!';
        };
        
        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase().trim();
                const isFinal = event.results[i].isFinal;
                
                if (transcript && isFinal) {
                    logDebug(`🎙️ Nghe: "${transcript}"`);
                    
                    if (!isAwake && !isProcessing) {
                        for (const word of WAKE_WORDS) {
                            if (transcript.includes(word)) {
                                logDebug(`🔊 Wake word: "${word}"`);
                                wakeUp();
                                break;
                            }
                        }
                    }
                    
                    if (isAwake && !isProcessing && transcript.length > 2) {
                        let isOnlyWakeWord = false;
                        for (const word of WAKE_WORDS) {
                            if (transcript === word) {
                                isOnlyWakeWord = true;
                                break;
                            }
                        }
                        if (!isOnlyWakeWord) {
                            processCommand(transcript);
                        }
                    }
                }
            }
        };
        
        recognition.onerror = (event) => {
            logDebug(`❌ Lỗi: ${event.error}`);
            if (event.error === 'not-allowed') {
                if (statusText) statusText.innerHTML = '❌ Cần cấp quyền micro! Nhấn ổ khóa trên thanh địa chỉ!';
                alert('⚠️ Vui lòng cho phép truy cập micro!\n\nNhấn biểu tượng ổ khóa 🔒 → Cho phép quyền Micro → Refresh');
            }
        };
        
        recognition.onend = () => {
            logDebug('Recognition kết thúc, restart...');
            if (!isProcessing) {
                setTimeout(() => {
                    try { recognition.start(); } catch(e) {}
                }, 500);
            }
        };
        
        recognition.start();
        logDebug('✅ Recognition started');
        
    } else {
        logDebug('❌ Trình duyệt không hỗ trợ!');
        if (statusText) statusText.innerHTML = '⚠️ Dùng Chrome/Edge trên máy tính!';
    }
}

function wakeUp() {
    if (isAwake) return;
    
    logDebug('🔊 Robot thức dậy!');
    isAwake = true;
    lastActivityTime = Date.now();
    
    resetInactivityTimer();
    
    if (robotFace) robotFace.classList.remove('sleeping');
    updateWakeIndicator('awake');
    
    const greeting = "Dạ, CHIRI đây ạ! Có gì cần giúp không ạ?";
    addMessage('ai', greeting);
    playAudio(greeting);
    
    if (statusText) statusText.innerHTML = '🎤 CHIRI đang lắng nghe... Hãy nói!';
}

function goToSleep() {
    if (!isAwake) return;
    
    logDebug('😴 Robot đi ngủ');
    isAwake = false;
    
    if (robotFace) robotFace.classList.add('sleeping');
    updateWakeIndicator('sleeping');
    
    const sleepMsg = "CHIRI đi ngủ đây ạ. Khi nào cần hãy gọi CHIRI nhé!";
    addMessage('ai', sleepMsg);
    playAudio(sleepMsg);
    
    if (statusText) statusText.innerHTML = '😴 CHIRI đang ngủ - Hãy nói "Chào CHIRI" để đánh thức';
    
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    if (sleepTimer) sleepTimer.innerHTML = '😴 Đang ngủ';
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
        if (isAwake && sleepTimer) {
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
    
    logDebug(`📝 Xử lý: "${text}"`);
    isProcessing = true;
    resetInactivityTimer();
    
    addMessage('user', text);
    if (robotFace) robotFace.classList.add('thinking');
    if (statusText) statusText.innerHTML = '🤔 CHIRI đang suy nghĩ...';
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text: text }));
    } else {
        logDebug('WebSocket chưa kết nối');
        addMessage('ai', 'Xin lỗi, CHIRI đang mất kết nối!');
        if (robotFace) robotFace.classList.remove('thinking');
        isProcessing = false;
    }
}

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
        
        currentAudio.onplay = () => {
            if (robotFace) robotFace.classList.add('speaking');
        };
        
        currentAudio.onended = () => {
            if (robotFace) robotFace.classList.remove('speaking');
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            if (robotFace) robotFace.classList.remove('thinking');
            isProcessing = false;
        };
        
        currentAudio.onerror = () => {
            fallbackSpeak(text);
        };
        
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
        
        utterance.onstart = () => {
            if (robotFace) robotFace.classList.add('speaking');
        };
        
        utterance.onend = () => {
            if (robotFace) robotFace.classList.remove('speaking');
            if (robotFace) robotFace.classList.remove('thinking');
            isProcessing = false;
        };
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } else {
        if (robotFace) robotFace.classList.remove('thinking');
        isProcessing = false;
    }
}

function addMessage(type, text) {
    if (!chatBox) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    while (chatBox.children.length > 20) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// WebSocket
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
        logDebug('✅ WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            addMessage('ai', data.text);
            playAudio(data.text);
        }
    };
    
    ws.onclose = () => {
        logDebug('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

// Manual wake button
if (manualWake) {
    manualWake.addEventListener('click', () => {
        logDebug('Manual wake clicked');
        if (!isAwake) {
            wakeUp();
        } else {
            resetInactivityTimer();
            const msg = "Dạ, CHIRI đây! Bạn cần gì ạ?";
            addMessage('ai', msg);
            playAudio(msg);
        }
    });
}

// Khởi tạo
logDebug('🚀 CHIRI khởi động...');
connectWebSocket();
initSpeechRecognition();
resetInactivityTimer();

}); // End DOMContentLoaded
