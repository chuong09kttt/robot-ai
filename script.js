// DOM elements
const app = document.getElementById('app');
const robotSvg = document.querySelector('.robot-svg');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const microBtn = document.getElementById('microBtn');
const statusText = document.getElementById('statusText');
const countdownBadge = document.getElementById('countdownBadge');
const chatMessages = document.getElementById('chatMessages');

// State
let isListening = false;
let isAsleep = false;
let sleepTimer = null;
let countdownInterval = null;
let secondsLeft = 60;
let isSpeaking = false;
let synth = window.speechSynthesis;
let currentUtterance = null;
let recognition = null;

// ========== BIỂU CẢM ==========
function setExpression(expr) {
    robotSvg.classList.remove('listening', 'thinking', 'sleepy', 'happy');
    if (expr === 'listening') robotSvg.classList.add('listening');
    else if (expr === 'thinking') robotSvg.classList.add('thinking');
    else if (expr === 'sleepy') robotSvg.classList.add('sleepy');
    else if (expr === 'happy') robotSvg.classList.add('happy');
}

// Nhấp nháy mắt
setInterval(() => {
    if (!isAsleep) {
        const pupils = document.querySelectorAll('.pupil');
        pupils.forEach(p => {
            p.style.opacity = '0';
            setTimeout(() => p.style.opacity = '1', 150);
        });
    }
}, 4000);

// ========== HIỂN THỊ TIN NHẮN ==========
function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-${role}`;
    const escaped = text.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m] || m));
    msgDiv.innerHTML = `<span>${role === 'user' ? '👤' : '🤖'} ${escaped.replace(/\n/g, '<br>')}</span>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    while (chatMessages.children.length > 20) chatMessages.removeChild(chatMessages.firstChild);
}

// ========== TEXT TO SPEECH ==========
function speak(text) {
    return new Promise((resolve) => {
        if (currentUtterance) synth.cancel();
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'vi-VN';
        currentUtterance.rate = 0.95;
        currentUtterance.onstart = () => {
            isSpeaking = true;
            setExpression('happy');
            statusText.innerText = '🔊 Đang nói...';
        };
        currentUtterance.onend = () => {
            isSpeaking = false;
            if (!isAsleep && isListening) {
                statusText.innerText = '🎤 Đang lắng nghe... Hãy nói!';
                setExpression('listening');
            } else if (!isAsleep) {
                statusText.innerText = '🎙️ Nhấn nút để nói';
                setExpression('happy');
            }
            resolve();
        };
        currentUtterance.onerror = () => {
            isSpeaking = false;
            resolve();
        };
        synth.speak(currentUtterance);
    });
}

// ========== XỬ LÝ AI ==========
async function processAI(userText) {
    if (!userText.trim() || isSpeaking) return;
    
    addMessage('user', userText);
    setExpression('thinking');
    statusText.innerText = '🤔 Đang suy nghĩ...';
    resetSleepTimer();
    
    const lower = userText.toLowerCase();
    let reply = '';
    
    if (lower.includes('xin chào') || lower.includes('hello')) {
        reply = 'Xin chào bạn! Rất vui được gặp bạn!';
    } else if (lower.includes('tên')) {
        reply = 'Tôi là Pika AI, trợ lý thông minh của bạn đây!';
    } else if (lower.includes('cảm ơn')) {
        reply = 'Không có gì đâu ạ! Rất vui được giúp bạn!';
    } else if (lower.includes('tạm biệt')) {
        reply = 'Tạm biệt bạn! Hẹn gặp lại nhé!';
        addMessage('ai', reply);
        await speak(reply);
        goToSleep();
        return;
    } else if (lower.includes('khỏe')) {
        reply = 'Mình vẫn khỏe, cảm ơn bạn! Bạn thì sao?';
    } else {
        reply = `Mình nghe bạn nói: "${userText}". Thú vị quá! Kể thêm đi bạn!`;
    }
    
    addMessage('ai', reply);
    await speak(reply);
    
    if (!isAsleep && isListening) {
        statusText.innerText = '🎤 Đang lắng nghe... Hãy nói!';
        setExpression('listening');
    }
}

// ========== TIMER ==========
function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    if (isAsleep) return;
    
    secondsLeft = 60;
    countdownBadge.innerHTML = `⏱️ ${secondsLeft}s`;
    countdownBadge.style.animation = 'none';
    
    countdownInterval = setInterval(() => {
        if (!isAsleep && secondsLeft > 0) {
            secondsLeft--;
            countdownBadge.innerHTML = secondsLeft <= 0 ? '😴 Ngủ' : `⏱️ ${secondsLeft}s`;
            if (secondsLeft <= 10 && secondsLeft > 0) {
                countdownBadge.style.animation = 'pulse 1s infinite';
            }
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                goToSleep();
            }
        }
    }, 1000);
    
    sleepTimer = setTimeout(() => {
        if (!isAsleep) goToSleep();
    }, 60000);
}

function goToSleep() {
    if (isAsleep) return;
    isAsleep = true;
    isListening = false;
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
    
    setExpression('sleepy');
    statusText.innerText = '💤 Robot đang ngủ... Nhấn nút micro để đánh thức';
    microBtn.innerHTML = '🎙️ ĐÁNH THỨC';
    countdownBadge.innerHTML = '😴 Ngủ zzz';
    if (countdownInterval) clearInterval(countdownInterval);
}

function wakeUp() {
    if (!isAsleep) return;
    isAsleep = false;
    setExpression('happy');
    statusText.innerText = '🎙️ Nhấn nút micro để nói';
    microBtn.innerHTML = '🎙️ NHẤN ĐỂ NÓI';
    resetSleepTimer();
    addMessage('ai', 'Chào bạn! Mình đã thức dậy rồi!');
    speak('Chào bạn! Mình đã thức dậy rồi!');
}

// ========== MICROPHONE - ĐƠN GIẢN, ỔN ĐỊNH ==========
async function startListening() {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
        alert('Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge!');
        return false;
    }
    
    // Dừng recognition cũ
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
    
    try {
        // Xin quyền micro
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Chỉ test quyền
        
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;  // Chỉ nghe 1 câu rồi dừng (dễ hơn)
        recognition.interimResults = false;
        recognition.lang = 'vi-VN';
        
        recognition.onstart = () => {
            console.log('🎤 Đang nghe...');
            isListening = true;
            statusText.innerText = '🎤 Đang nghe... Hãy nói!';
            setExpression('listening');
            microBtn.classList.add('recording');
            microBtn.innerHTML = '🔴 ĐANG NGHE...';
        };
        
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript.trim();
            console.log('🎙️ Nhận được:', text);
            if (text.length > 0) {
                processAI(text);
            }
        };
        
        recognition.onerror = (event) => {
            console.error('Lỗi:', event.error);
            if (event.error === 'not-allowed') {
                statusText.innerText = '❌ Chưa cấp quyền micro! Hãy refresh và cho phép!';
            } else {
                statusText.innerText = '⚠️ Lỗi, thử lại...';
            }
            isListening = false;
            microBtn.classList.remove('recording');
            microBtn.innerHTML = '🎙️ NHẤN ĐỂ NÓI';
        };
        
        recognition.onend = () => {
            console.log('🔴 Kết thúc nghe');
            isListening = false;
            microBtn.classList.remove('recording');
            if (!isAsleep) {
                statusText.innerText = '🎙️ Nhấn nút để nói';
                microBtn.innerHTML = '🎙️ NHẤN ĐỂ NÓI';
                setExpression('happy');
            }
        };
        
        recognition.start();
        return true;
        
    } catch(err) {
        console.error('Không thể truy cập micro:', err);
        alert('Vui lòng cho phép truy cập micro! Hãy refresh trang và đồng ý cấp quyền.');
        statusText.innerText = '❌ Cần cấp quyền micro';
        return false;
    }
}

// ========== XỬ LÝ NÚT MICRO ==========
microBtn.onclick = async () => {
    if (isAsleep) {
        wakeUp();
        return;
    }
    
    if (isListening) {
        // Đang nghe thì dừng
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }
    } else {
        // Bắt đầu nghe
        await startListening();
        resetSleepTimer();
    }
};

// ========== TOGGLE FULLSCREEN ==========
toggleChatBtn.onclick = () => {
    app.classList.toggle('fullscreen');
    toggleChatBtn.innerHTML = app.classList.contains('fullscreen') ? '🔼 HIỆN CHAT' : '🔽 ẨN CHAT';
};

// ========== KHỞI TẠO ==========
window.onload = () => {
    setExpression('sleepy');
    statusText.innerText = '💤 Robot đang ngủ... Nhấn nút micro để đánh thức';
    microBtn.innerHTML = '🎙️ ĐÁNH THỨC';
    countdownBadge.innerHTML = '😴 Ngủ';
    
    // Tự động xin quyền micro khi load
    setTimeout(async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Đã có quyền micro');
            statusText.innerText = '💤 Nhấn nút micro để đánh thức robot';
        } catch(e) {
            console.log('Chưa có quyền micro');
            statusText.innerText = '⚠️ Nhấn nút micro và cho phép quyền';
        }
    }, 500);
};
