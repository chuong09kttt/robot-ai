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
let mediaStream = null;

// ========== BIỂU CẢM KHUÔN MẶT ==========
function setExpression(expression) {
    robotSvg.classList.remove('happy', 'sad', 'surprised', 'sleepy');
    if (expression === 'happy') robotSvg.classList.add('happy');
    else if (expression === 'sad') robotSvg.classList.add('sad');
    else if (expression === 'surprised') robotSvg.classList.add('surprised');
    else if (expression === 'sleepy') robotSvg.classList.add('sleepy');
}

// Nhấp nháy mắt định kỳ
setInterval(() => {
    if (!isAsleep && robotSvg) {
        robotSvg.style.transform = 'scale(1)';
        setTimeout(() => {
            const pupils = document.querySelectorAll('.pupil');
            pupils.forEach(pupil => {
                pupil.style.opacity = '0';
                setTimeout(() => pupil.style.opacity = '1', 100);
            });
        }, 0);
    }
}, 3000);

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
    setExpression('happy');
    statusText.innerText = '🔊 Đang nói...';
    isSpeaking = true;
    
    return new Promise((resolve) => {
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'vi-VN';
        currentUtterance.rate = 0.95;
        currentUtterance.onend = () => {
            isSpeaking = false;
            if (!isAsleep && isListening) {
                statusText.innerText = '🎤 Đang lắng nghe...';
            } else if (!isAsleep) {
                statusText.innerText = '🎙️ Sẵn sàng';
            }
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

// ========== KIỂM TRA TỪ KHÓA ĐÁNH THỨC ==========
function isWakeWord(text) {
    const lowerText = text.toLowerCase().trim();
    const wakeWords = ['hello', 'hi', 'xin chào', 'chào', 'hey', 'hé lô', 'chào bạn'];
    return wakeWords.some(word => lowerText.includes(word));
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
        reply = 'Xin chào bạn! Rất vui được gặp bạn! Tôi có thể giúp gì cho bạn ạ?';
    } else if (lowerText.includes('tên')) {
        reply = 'Tôi là Pika AI, trợ lý tiếng Anh thông minh! Rất hân hạnh được phục vụ bạn!';
    } else if (lowerText.includes('cảm ơn') || lowerText.includes('thank')) {
        reply = 'Không có gì đâu ạ! Rất vui được giúp đỡ bạn!';
    } else if (lowerText.includes('tạm biệt') || lowerText.includes('bye')) {
        reply = 'Tạm biệt bạn nhé! Chúc bạn một ngày tốt lành!';
        addMessage('ai', reply);
        await speak(reply);
        setTimeout(() => goToSleep(), 2000);
        return;
    } else if (lowerText.includes('khỏe') || lowerText.includes('ổn')) {
        reply = 'Mình vẫn khỏe, cảm ơn bạn đã hỏi! Bạn thì sao?';
    } else {
        reply = `Mình nghe bạn nói: "${userText}". Bạn có thể kể thêm được không ạ?`;
    }
    
    addMessage('ai', reply);
    await speak(reply);
    
    if (!isAsleep && isListening) {
        statusText.innerText = '🎤 Đang lắng nghe...';
        setExpression('happy');
    }
}

// ========== TIMER ==========
function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    
    secondsLeft = 60;
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        if (!isAsleep && secondsLeft > 0) {
            secondsLeft--;
            updateCountdownDisplay();
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

function updateCountdownDisplay() {
    if (secondsLeft <= 0) {
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
    if (isAsleep) return;
    isAsleep = true;
    isListening = false;
    
    if (recognition) {
        try {
            recognition.stop();
        } catch(e) {}
        recognition = null;
    }
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    setExpression('sleepy');
    statusText.innerText = '💤 Robot đang ngủ... Hãy nói "Hello", "Hi" hoặc "Xin chào" để đánh thức';
    microBtn.innerHTML = '💤 ĐÁNH THỨC';
    countdownBadge.innerHTML = '😴 Ngủ zzz';
}

// ========== ĐÁNH THỨC ==========
async function wakeUp() {
    if (!isAsleep) return;
    
    isAsleep = false;
    setExpression('happy');
    statusText.innerText = '🎤 Đang khởi động micro...';
    microBtn.innerHTML = '🎙️ ĐANG LẮNG NGHE...';
    
    addMessage('ai', 'Dạ! Tôi thức rồi đây! Bạn cần tôi giúp gì ạ?');
    await speak('Dạ! Tôi thức rồi đây! Bạn cần tôi giúp gì ạ?');
    
    resetSleepTimer();
    startMicrophone();
}

// ========== MICROPHONE (ĐÃ SỬA LỖI) ==========
async function startMicrophone() {
    // Dừng recognition cũ nếu có
    if (recognition) {
        try {
            recognition.stop();
        } catch(e) {}
        recognition = null;
    }
    
    // Đóng media stream cũ
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    // Kiểm tra hỗ trợ
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
        alert('Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói');
        statusText.innerText = '❌ Trình duyệt không hỗ trợ';
        return false;
    }
    
    try {
        // Xin quyền micro trước
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Đã có quyền micro');
        
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'vi-VN';
        
        recognition.onstart = () => {
            console.log('🎤 Micro đang chạy');
            isListening = true;
            statusText.innerText = '🎤 Đang lắng nghe... Hãy nói!';
            microBtn.innerHTML = '🔴 ĐANG NGHE';
            setExpression('happy');
        };
        
        recognition.onresult = (event) => {
            const text = event.results[event.results.length - 1][0].transcript.trim();
            console.log('🎙️ Nhận dạng:', text);
            
            // Nếu đang ngủ và có từ khóa đánh thức
            if (isAsleep && isWakeWord(text)) {
                console.log('🔊 Phát hiện từ khóa đánh thức:', text);
                wakeUp();
                return;
            }
            
            // Nếu không ngủ và có nội dung
            if (!isAsleep && text.length > 0 && !isSpeaking) {
                resetSleepTimer();
                processAI(text);
            }
        };
        
        recognition.onerror = (event) => {
            console.error('❌ Lỗi micro:', event.error);
            if (event.error === 'not-allowed') {
                statusText.innerText = '❌ Chưa cấp quyền micro. Hãy nhấn nút và cho phép!';
                microBtn.innerHTML = '🎙️ BẬT MICRO';
                isListening = false;
            } else if (event.error === 'no-speech') {
                // Không có giọng nói, vẫn giữ nguyên trạng thái
                console.log('Không nghe thấy giọng nói');
            } else if (!isAsleep) {
                statusText.innerText = '⚠️ Lỗi, thử lại...';
                setTimeout(() => {
                    if (!isAsleep && recognition) {
                        try {
                            recognition.start();
                        } catch(e) {}
                    }
                }, 1000);
            }
        };
        
        recognition.onend = () => {
            console.log('🔴 Micro kết thúc');
            isListening = false;
            if (!isAsleep) {
                statusText.innerText = '🎙️ Nhấn nút micro để nói';
                microBtn.innerHTML = '🎙️ BẬT MICRO';
            }
        };
        
        recognition.start();
        return true;
        
    } catch(err) {
        console.error('❌ Không thể truy cập micro:', err);
        alert('Vui lòng cho phép truy cập micro để sử dụng!');
        statusText.innerText = '❌ Cần cấp quyền micro';
        microBtn.innerHTML = '🎙️ BẬT MICRO';
        return false;
    }
}

// ========== XỬ LÝ NÚT MICRO ==========
microBtn.onclick = async () => {
    if (isAsleep) {
        await wakeUp();
        return;
    }
    
    if (isListening && recognition) {
        // Đang nghe thì dừng lại
        try {
            recognition.stop();
        } catch(e) {}
        isListening = false;
        statusText.innerText = '🎙️ Đã dừng, nhấn để bắt đầu';
        microBtn.innerHTML = '🎙️ BẬT MICRO';
    } else {
        // Bắt đầu nghe
        await startMicrophone();
        resetSleepTimer();
    }
};

// ========== FULL MÀN HÌNH ==========
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
    statusText.innerText = '🎙️ Nhấn nút "BẬT MICRO" để bắt đầu';
    microBtn.innerHTML = '🎙️ BẬT MICRO';
    
    // Tự động xin quyền micro khi load trang
    setTimeout(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Quyền micro đã được cấp từ trước');
            statusText.innerText = '🎙️ Nhấn nút để bắt đầu';
        } catch(e) {
            console.log('Chưa có quyền micro');
        }
    }, 100);
};
