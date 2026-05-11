// DOM elements
const app = document.getElementById('app');
const robotSvg = document.querySelector('.robot-svg');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const microBtn = document.getElementById('microBtn');
const statusText = document.getElementById('statusText');
const countdownBadge = document.getElementById('countdownBadge');
const chatMessages = document.getElementById('chatMessages');

// State
let recognition = null;
let isListening = false;
let isAsleep = false;
let sleepTimer = null;
let countdownInterval = null;
let secondsLeft = 60;
let isSpeaking = false;
let synth = window.speechSynthesis;
let currentUtterance = null;

// ========== BIỂU CẢM KHUÔN MẶT ==========
function setExpression(expression) {
    robotSvg.classList.remove('happy', 'sad', 'surprised', 'sleepy', 'blink');
    if (expression === 'happy') robotSvg.classList.add('happy');
    else if (expression === 'sad') robotSvg.classList.add('sad');
    else if (expression === 'surprised') robotSvg.classList.add('surprised');
    else if (expression === 'sleepy') robotSvg.classList.add('sleepy');
}

// Nhấp nháy mắt định kỳ
setInterval(() => {
    if (!isAsleep) {
        robotSvg.classList.add('blink');
        setTimeout(() => robotSvg.classList.remove('blink'), 200);
    }
}, 3000);

// ========== HIỂN THỊ TIN NHẮN (không bị dính text) ==========
function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-${role}`;
    // Xử lý dính text: thay \n bằng <br> và xử lý HTML an toàn
    const escapedText = text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
    const formatted = escapedText.replace(/\n/g, '<br>');
    msgDiv.innerHTML = `<span>${role === 'user' ? '👤' : '🤖'} ${formatted}</span>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Giới hạn số tin nhắn
    while (chatMessages.children.length > 20) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

// ========== TEXT TO SPEECH (thời gian thực, không chồng chéo) ==========
async function speak(text) {
    if (currentUtterance) {
        synth.cancel();
    }
    setExpression('happy');
    statusText.innerText = '🔊 Đang nói...';
    isSpeaking = true;
    
    return new Promise((resolve) => {
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'vi-VN';
        currentUtterance.rate = 0.95;
        currentUtterance.onend = () => {
            isSpeaking = false;
            statusText.innerText = isListening ? '🎤 Đang lắng nghe...' : '🎙️ Nhấn để bắt đầu';
            setExpression('happy');
            resolve();
        };
        currentUtterance.onerror = () => {
            isSpeaking = false;
            resolve();
        };
        synth.speak(currentUtterance);
    });
}

// ========== XỬ LÝ AI (giả lập - có thể thay bằng API thật) ==========
async function processAI(userText) {
    if (!userText.trim()) return;
    
    addMessage('user', userText);
    setExpression('thinking');
    statusText.innerText = '🤔 Đang suy nghĩ...';
    
    // Reset timer khi có tương tác
    resetSleepTimer();
    
    // Giả lập phản hồi (thay bằng gọi API Gemini/GPT nếu cần)
    let reply = '';
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes('xin chào') || lowerText.includes('hello')) {
        reply = 'Xin chào bạn! Rất vui được gặp bạn!';
    } else if (lowerText.includes('tên')) {
        reply = 'Tôi là Pika AI, trợ lý tiếng Anh thông minh!';
    } else if (lowerText.includes('cảm ơn')) {
        reply = 'Không có gì! Rất vui được giúp bạn.';
    } else if (lowerText.includes('tạm biệt')) {
        reply = 'Tạm biệt bạn! Hẹn gặp lại sau nhé!';
        setTimeout(() => goToSleep(), 1000);
    } else {
        reply = `Bạn vừa nói: "${userText}". Mình có thể giúp gì thêm không?`;
    }
    
    addMessage('ai', reply);
    await speak(reply);
    
    if (!isAsleep) {
        statusText.innerText = isListening ? '🎤 Đang lắng nghe...' : '🎙️ Nhấn micro để nói';
        setExpression('happy');
    }
}

// ========== TIMER TỰ ĐỘNG NGỦ SAU 60s ==========
function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    
    secondsLeft = 60;
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        if (!isAsleep) {
            secondsLeft--;
            updateCountdownDisplay();
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                goToSleep();
            }
        }
    }, 1000);
    
    sleepTimer = setTimeout(() => {
        // Fallback
        if (!isAsleep) goToSleep();
    }, 60000);
}

function updateCountdownDisplay() {
    countdownBadge.innerHTML = secondsLeft <= 0 ? '😴 Ngủ' : `⏱️ ${secondsLeft}s`;
    if (secondsLeft <= 10 && secondsLeft > 0) {
        countdownBadge.style.animation = 'pulse 1s infinite';
    } else {
        countdownBadge.style.animation = 'none';
    }
}

// Thêm keyframes pulse
if (!document.querySelector('#pulseStyle')) {
    const style = document.createElement('style');
    style.id = 'pulseStyle';
    style.textContent = `
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); background: #ff4444; }
        }
    `;
    document.head.appendChild(style);
}

// ========== ĐI NGỦ ==========
function goToSleep() {
    if (isAsleep) return;
    isAsleep = true;
    isListening = false;
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    setExpression('sleepy');
    statusText.innerText = '💤 Robot đang ngủ... Nói "Pika ơi" để đánh thức';
    microBtn.innerHTML = '💤 ĐÁNH THỨC';
    countdownBadge.innerHTML = '😴 Ngủ zzz';
}

// ========== ĐÁNH THỨC ==========
function wakeUp() {
    if (!isAsleep) return;
    isAsleep = false;
    setExpression('happy');
    statusText.innerText = '🎤 Đang khởi động micro...';
    microBtn.innerHTML = '🎙️ BẬT MICRO';
    addMessage('ai', 'Chào bạn! Mình đã thức dậy rồi đây!');
    resetSleepTimer();
    startMicrophone();
}

// ========== MICROPHONE ==========
function startMicrophone() {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
        alert('Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói');
        return;
    }
    
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'vi-VN';
    
    recognition.onstart = () => {
        isListening = true;
        statusText.innerText = '🎤 Đang lắng nghe... Hãy nói!';
        microBtn.innerHTML = '🔴 ĐANG NGHE';
        if (!isAsleep) setExpression('happy');
    };
    
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.trim();
        console.log('Nhận dạng:', text);
        
        // Đánh thức nếu đang ngủ và có từ khóa
        if (isAsleep && (text.toLowerCase().includes('pika ơi') || text.toLowerCase().includes('pika oi') || text.toLowerCase().includes('đánh thức'))) {
            wakeUp();
            return;
        }
        
        if (!isAsleep && text.length > 0) {
            resetSleepTimer();
            processAI(text);
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Lỗi micro:', event.error);
        if (event.error === 'not-allowed') {
            statusText.innerText = '❌ Chưa cấp quyền micro. Hãy nhấn nút và cho phép!';
        } else if (!isAsleep) {
            statusText.innerText = '⚠️ Lỗi micro, thử lại...';
            setTimeout(() => {
                if (recognition && !isAsleep) {
                    try { recognition.start(); } catch(e) {}
                }
            }, 1000);
        }
    };
    
    recognition.onend = () => {
        isListening = false;
        if (!isAsleep) {
            statusText.innerText = '🎙️ Nhấn nút micro để nói';
            microBtn.innerHTML = '🎙️ BẬT MICRO';
            // Tự động bật lại nếu chưa ngủ
            if (!isAsleep && !isSpeaking) {
                setTimeout(() => {
                    if (!isListening && !isAsleep) {
                        try { recognition.start(); } catch(e) {}
                    }
                }, 500);
            }
        }
    };
    
    try {
        recognition.start();
    } catch(e) {
        console.error('Không thể start recognition:', e);
    }
}

// ========== XỬ LÝ NÚT MICRO ==========
microBtn.onclick = async () => {
    if (isAsleep) {
        wakeUp();
        return;
    }
    
    if (recognition) {
        try {
            recognition.stop();
            recognition = null;
        } catch(e) {}
    }
    
    // Xin quyền micro
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        startMicrophone();
        resetSleepTimer();
    } catch(err) {
        alert('Vui lòng cho phép truy cập micro để sử dụng!');
        statusText.innerText = '❌ Cần cấp quyền micro';
    }
};

// ========== FULL MÀN HÌNH (ẨN CHAT) ==========
toggleChatBtn.onclick = () => {
    app.classList.toggle('fullscreen');
    if (app.classList.contains('fullscreen')) {
        toggleChatBtn.innerHTML = '🔼 HIỆN CHAT';
    } else {
        toggleChatBtn.innerHTML = '🔽 ẨN CHAT';
    }
};

// ========== KHỞI TẠO ==========
window.onload = () => {
    setExpression('happy');
    resetSleepTimer();
    statusText.innerText = '🎙️ Nhấn nút "BẬT MICRO" để bắt đầu';
};
