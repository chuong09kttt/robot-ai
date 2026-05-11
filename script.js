// DOM elements
const app = document.getElementById('app');
const robotSvg = document.querySelector('.robot-svg');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const statusText = document.getElementById('statusText');
const countdownBadge = document.getElementById('countdownBadge');
const chatMessages = document.getElementById('chatMessages');

// State
let recognition = null;
let isAwake = false;  // Bắt đầu ở trạng thái ngủ, chờ wake word
let sleepTimer = null;
let countdownInterval = null;
let secondsLeft = 60;
let isSpeaking = false;
let synth = window.speechSynthesis;
let currentUtterance = null;

// Các từ khóa đánh thức
const WAKE_WORDS = ['hello pika', 'xin chào pika', 'hey robot', 'pika ơi', 'chào pika', 'hello', 'xin chào'];

// ========== BIỂU CẢM KHUÔN MẶT ==========
function setExpression(expression) {
    robotSvg.classList.remove('happy', 'sad', 'surprised', 'sleepy', 'listening', 'thinking');
    if (expression === 'happy') robotSvg.classList.add('happy');
    else if (expression === 'sad') robotSvg.classList.add('sad');
    else if (expression === 'surprised') robotSvg.classList.add('surprised');
    else if (expression === 'sleepy') robotSvg.classList.add('sleepy');
    else if (expression === 'listening') robotSvg.classList.add('listening');
    else if (expression === 'thinking') robotSvg.classList.add('thinking');
}

// Nhấp nháy mắt
setInterval(() => {
    if (!isAwake) return;
    const pupils = document.querySelectorAll('.pupil');
    pupils.forEach(pupil => {
        pupil.style.opacity = '0';
        setTimeout(() => pupil.style.opacity = '1', 150);
    });
}, 4000);

// ========== HIỂN THỊ TIN NHẮN ==========
function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-${role}`;
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
    
    while (chatMessages.children.length > 20) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

// ========== TEXT TO SPEECH ==========
async function speak(text) {
    if (currentUtterance) {
        synth.cancel();
    }
    
    return new Promise((resolve) => {
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
            if (isAwake) {
                statusText.innerText = '🎤 Đang lắng nghe...';
                setExpression('listening');
            } else {
                statusText.innerText = '💤 Đang ngủ... Nói "Hello Pika" để đánh thức';
                setExpression('sleepy');
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

// ========== KIỂM TRA TỪ KHÓA ĐÁNH THỨC ==========
function isWakeWord(text) {
    const lowerText = text.toLowerCase().trim();
    return WAKE_WORDS.some(word => lowerText.includes(word));
}

// ========== XỬ LÝ AI ==========
async function processAI(userText) {
    if (!userText.trim() || isSpeaking) return;
    
    addMessage('user', userText);
    setExpression('thinking');
    statusText.innerText = '🤔 Đang suy nghĩ...';
    
    resetSleepTimer();
    
    let reply = '';
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes('xin chào') || lowerText.includes('hello') || lowerText.includes('hi')) {
        reply = 'Xin chào bạn! Mình là Pika AI. Rất vui được trò chuyện với bạn!';
    } else if (lowerText.includes('tên')) {
        reply = 'Tên của mình là Pika! Mình là trợ lý AI thông minh đây ạ!';
    } else if (lowerText.includes('cảm ơn')) {
        reply = 'Không có gì đâu ạ! Rất vui khi được giúp bạn!';
    } else if (lowerText.includes('tạm biệt')) {
        reply = 'Tạm biệt bạn nhé! Hẹn gặp lại! Mình sẽ đi ngủ đây.';
        addMessage('ai', reply);
        await speak(reply);
        goToSleep();
        return;
    } else if (lowerText.includes('khỏe') || lowerText.includes('ổn không')) {
        reply = 'Mình vẫn khỏe, cảm ơn bạn! Bạn thì sao?';
    } else if (lowerText.includes('làm gì') || lowerText.includes('giúp')) {
        reply = 'Mình có thể trò chuyện, trả lời câu hỏi, hoặc giúp bạn học tiếng Anh!';
    } else {
        reply = `Mình nghe bạn nói: "${userText}". Thú vị quá! Bạn có thể kể thêm được không?`;
    }
    
    addMessage('ai', reply);
    await speak(reply);
    
    if (isAwake && !isSpeaking) {
        statusText.innerText = '🎤 Đang lắng nghe...';
        setExpression('listening');
    }
}

// ========== TIMER TỰ ĐỘNG NGỦ ==========
function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    
    secondsLeft = 60;
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        if (isAwake && secondsLeft > 0) {
            secondsLeft--;
            updateCountdownDisplay();
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                goToSleep();
            }
        }
    }, 1000);
    
    sleepTimer = setTimeout(() => {
        if (isAwake) goToSleep();
    }, 60000);
}

function updateCountdownDisplay() {
    if (!isAwake) {
        countdownBadge.innerHTML = '😴 Ngủ';
    } else {
        countdownBadge.innerHTML = `⏱️ ${secondsLeft}s`;
        if (secondsLeft <= 10) {
            countdownBadge.style.animation = 'pulse 1s infinite';
        } else {
            countdownBadge.style.animation = 'none';
        }
    }
}

// ========== ĐI NGỦ ==========
function goToSleep() {
    if (!isAwake) return;
    
    isAwake = false;
    setExpression('sleepy');
    statusText.innerText = '💤 Đang ngủ... Nói "Hello Pika" để đánh thức';
    countdownBadge.innerHTML = '😴 Ngủ zzz';
    
    if (countdownInterval) clearInterval(countdownInterval);
    if (sleepTimer) clearTimeout(sleepTimer);
}

// ========== ĐÁNH THỨC ==========
async function wakeUp() {
    if (isAwake) return;
    
    isAwake = true;
    setExpression('happy');
    statusText.innerText = '🎤 Đang lắng nghe...';
    
    addMessage('ai', 'Dạ! Mình thức rồi. Bạn cần mình giúp gì ạ?');
    await speak('Dạ! Mình thức rồi. Bạn cần mình giúp gì ạ?');
    
    resetSleepTimer();
    setExpression('listening');
}

// ========== MICROPHONE - LUÔN LẮNG NGHE ==========
async function initMicrophone() {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
        statusText.innerText = '❌ Trình duyệt không hỗ trợ micro';
        return false;
    }
    
    try {
        // Xin quyền micro
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Đã có quyền micro');
        
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;  // Lấy kết quả tạm thời để phản hồi nhanh
        recognition.lang = 'vi-VN';
        
        recognition.onstart = () => {
            console.log('🎤 Micro đang lắng nghe...');
            if (isAwake) {
                statusText.innerText = '🎤 Đang lắng nghe...';
                setExpression('listening');
            } else {
                statusText.innerText = '💤 Đang ngủ... Nói "Hello Pika" để đánh thức';
            }
        };
        
        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.trim();
                if (event.results[i].isFinal) {
                    console.log('🎙️ Nhận dạng:', transcript);
                    
                    // Nếu đang ngủ, kiểm tra từ khóa đánh thức
                    if (!isAwake) {
                        if (isWakeWord(transcript)) {
                            console.log('🔊 Đánh thức bằng:', transcript);
                            wakeUp();
                        }
                        return;
                    }
                    
                    // Đang thức: xử lý câu hỏi
                    if (transcript.length > 0 && !isSpeaking) {
                        resetSleepTimer();
                        processAI(transcript);
                    }
                }
            }
        };
        
        recognition.onerror = (event) => {
            console.error('❌ Lỗi micro:', event.error);
            if (event.error === 'not-allowed') {
                statusText.innerText = '❌ Chưa cấp quyền micro. Hãy refresh và cho phép!';
            }
        };
        
        recognition.onend = () => {
            console.log('🔴 Micro kết thúc, khởi động lại...');
            // Tự động khởi động lại micro
            if (recognition) {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch(e) {
                        console.log('Khởi động lại micro sau 1s');
                        setTimeout(() => {
                            try { recognition.start(); } catch(e) {}
                        }, 1000);
                    }
                }, 500);
            }
        };
        
        recognition.start();
        return true;
        
    } catch(err) {
        console.error('❌ Không thể truy cập micro:', err);
        statusText.innerText = '❌ Cần cấp quyền micro. Hãy refresh trang!';
        return false;
    }
}

// ========== FULL MÀN HÌNH ==========
toggleChatBtn.onclick = () => {
    app.classList.toggle('fullscreen');
    toggleChatBtn.innerHTML = app.classList.contains('fullscreen') ? '🔼 HIỆN CHAT' : '🔽 ẨN CHAT';
};

// ========== KHỞI TẠO ==========
window.onload = async () => {
    setExpression('sleepy');
    statusText.innerText = '💤 Đang khởi động...';
    
    // Khởi tạo micro và bắt đầu lắng nghe
    await initMicrophone();
    
    // Chào mừng sau 1s
    setTimeout(() => {
        addMessage('ai', '🤖 Chào bạn! Mình là Pika AI. Hãy nói "Hello Pika" để đánh thức và trò chuyện nhé!');
        statusText.innerText = '💤 Đang ngủ... Nói "Hello Pika" để đánh thức';
    }, 1500);
};
