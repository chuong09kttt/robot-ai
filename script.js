// DOM elements
const app = document.getElementById('app');
const robotSvg = document.querySelector('.robot-svg');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const statusText = document.getElementById('statusText');
const countdownBadge = document.getElementById('countdownBadge');
const chatMessages = document.getElementById('chatMessages');

// State
let isAwake = false;      // Bắt đầu ở trạng thái ngủ
let sleepTimer = null;
let countdownInterval = null;
let secondsLeft = 60;
let isSpeaking = false;
let synth = window.speechSynthesis;
let currentUtterance = null;
let recognition = null;
let isListening = false;

// Từ khóa đánh thức
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào', 'hey', 'chào robot', 'pika'];

// ========== BIỂU CẢM ==========
function setExpression(expr) {
    robotSvg.classList.remove('listening', 'thinking', 'sleepy', 'happy');
    if (expr === 'listening') robotSvg.classList.add('listening');
    else if (expr === 'thinking') robotSvg.classList.add('thinking');
    else if (expr === 'sleepy') robotSvg.classList.add('sleepy');
    else if (expr === 'happy') robotSvg.classList.add('happy');
}

// Nhấp nháy mắt định kỳ
setInterval(() => {
    if (isAwake) {
        const pupils = document.querySelectorAll('.pupil');
        pupils.forEach(pupil => {
            pupil.style.transform = 'scaleY(1)';
            pupil.style.animation = 'blink 0.2s ease';
            setTimeout(() => {
                pupil.style.animation = '';
            }, 200);
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
    while (chatMessages.children.length > 25) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

// ========== TEXT TO SPEECH ==========
function speak(text) {
    return new Promise((resolve) => {
        if (currentUtterance) {
            synth.cancel();
        }
        
        // Đợi một chút nếu synth đang bận
        if (synth.speaking) {
            synth.cancel();
        }
        
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'vi-VN';
        currentUtterance.rate = 0.92;
        currentUtterance.pitch = 1.1;
        
        currentUtterance.onstart = () => {
            isSpeaking = true;
            setExpression('happy');
            statusText.innerText = '🔊 Đang trả lời...';
            console.log('🎤 Đang nói:', text.substring(0, 50));
        };
        
        currentUtterance.onend = () => {
            isSpeaking = false;
            if (isAwake) {
                statusText.innerText = '🎤 Đang lắng nghe...';
                setExpression('listening');
            } else {
                statusText.innerText = '💤 Đang ngủ... Hãy nói "Xin chào" để đánh thức';
                setExpression('sleepy');
            }
            resolve();
        };
        
        currentUtterance.onerror = (e) => {
            console.error('TTS lỗi:', e);
            isSpeaking = false;
            resolve();
        };
        
        synth.speak(currentUtterance);
    });
}

// ========== KIỂM TRA TỪ KHÓA ĐÁNH THỨC ==========
function isWakeWord(text) {
    const lowerText = text.toLowerCase().trim();
    for (const word of WAKE_WORDS) {
        if (lowerText.includes(word)) {
            console.log('🔊 Phát hiện từ khóa đánh thức:', word);
            return true;
        }
    }
    return false;
}

// ========== XỬ LÝ AI ==========
async function processAI(userText) {
    if (!userText.trim()) return;
    if (isSpeaking) {
        console.log('Đang nói, bỏ qua câu hỏi mới');
        return;
    }
    
    console.log('🤔 Xử lý câu hỏi:', userText);
    addMessage('user', userText);
    setExpression('thinking');
    statusText.innerText = '🤔 Đang suy nghĩ...';
    resetSleepTimer();
    
    const lower = userText.toLowerCase();
    let reply = '';
    
    if (lower.includes('xin chào') || lower.includes('hello') || lower.includes('hi')) {
        reply = 'Xin chào bạn! Rất vui được trò chuyện cùng bạn!';
    } else if (lower.includes('tên') || lower.includes('ai')) {
        reply = 'Tôi là Pika AI, trợ lý thông minh thế hệ mới! Rất hân hạnh được phục vụ bạn!';
    } else if (lower.includes('cảm ơn') || lower.includes('thank')) {
        reply = 'Không có gì đâu ạ! Đó là niềm vui của tôi!';
    } else if (lower.includes('tạm biệt') || lower.includes('bye')) {
        reply = 'Tạm biệt bạn nhé! Chúc bạn một ngày tốt lành! Tôi sẽ đi ngủ đây.';
        addMessage('ai', reply);
        await speak(reply);
        goToSleep();
        return;
    } else if (lower.includes('khỏe') || lower.includes('ổn không')) {
        reply = 'Mình vẫn khỏe, cảm ơn bạn! Còn bạn thì sao?';
    } else if (lower.includes('làm gì') || lower.includes('giúp')) {
        reply = 'Mình có thể trò chuyện, trả lời câu hỏi và cùng bạn học tiếng Anh mỗi ngày!';
    } else if (lower.includes('thích') || lower.includes('yêu')) {
        reply = 'Mình thích được trò chuyện và giúp đỡ bạn nhất!';
    } else {
        reply = `Mình nghe bạn nói: "${userText}". Thật thú vị! Bạn có thể kể thêm được không?`;
    }
    
    addMessage('ai', reply);
    await speak(reply);
    
    if (isAwake && !isSpeaking) {
        statusText.innerText = '🎤 Đang lắng nghe...';
        setExpression('listening');
    }
}

// ========== TIMER TỰ ĐỘNG NGỦ (60s) ==========
function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    if (!isAwake) return;
    
    secondsLeft = 60;
    countdownBadge.innerHTML = `⏱️ ${secondsLeft}s`;
    countdownBadge.style.animation = 'none';
    countdownBadge.style.background = 'rgba(0,0,0,0.6)';
    
    countdownInterval = setInterval(() => {
        if (isAwake && secondsLeft > 0) {
            secondsLeft--;
            countdownBadge.innerHTML = secondsLeft <= 0 ? '😴 Ngủ' : `⏱️ ${secondsLeft}s`;
            
            if (secondsLeft <= 10 && secondsLeft > 0) {
                countdownBadge.style.animation = 'pulse 1s infinite';
                countdownBadge.style.background = '#ff4444';
            } else {
                countdownBadge.style.animation = 'none';
                countdownBadge.style.background = 'rgba(0,0,0,0.6)';
            }
            
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                goToSleep();
            }
        }
    }, 1000);
    
    sleepTimer = setTimeout(() => {
        if (isAwake) {
            console.log('⏰ Hết 60s, robot đi ngủ');
            goToSleep();
        }
    }, 60000);
}

function goToSleep() {
    if (!isAwake) return;
    
    console.log('💤 Robot đi ngủ');
    isAwake = false;
    
    setExpression('sleepy');
    statusText.innerText = '💤 Đang ngủ... Hãy nói "Xin chào" hoặc "Hello" để đánh thức';
    countdownBadge.innerHTML = '😴 Ngủ zzz';
    countdownBadge.style.animation = 'none';
    
    if (countdownInterval) clearInterval(countdownInterval);
    if (sleepTimer) clearTimeout(sleepTimer);
}

function wakeUp() {
    if (isAwake) return;
    
    console.log('🔊 Robot thức dậy!');
    isAwake = true;
    setExpression('happy');
    statusText.innerText = '🎤 Đã thức! Đang lắng nghe...';
    countdownBadge.innerHTML = '⏱️ 60s';
    resetSleepTimer();
    
    // Chào mừng khi thức dậy
    addMessage('ai', 'Dạ! Tôi thức rồi đây! Bạn cần tôi giúp gì ạ?');
    speak('Dạ! Tôi thức rồi đây! Bạn cần tôi giúp gì ạ?');
    
    // Sau khi chào, chuyển sang trạng thái lắng nghe
    setTimeout(() => {
        if (isAwake && !isSpeaking) {
            setExpression('listening');
            statusText.innerText = '🎤 Đang lắng nghe...';
        }
    }, 1500);
}

// ========== KHỞI TẠO MICRO - LUÔN LẮNG NGHE ==========
async function initMicrophone() {
    console.log('🎤 Khởi tạo micro...');
    
    // Kiểm tra hỗ trợ trình duyệt
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
        statusText.innerText = '❌ Trình duyệt không hỗ trợ micro! Hãy dùng Chrome!';
        console.error('Không hỗ trợ Speech Recognition');
        return false;
    }
    
    try {
        // Xin quyền micro
        console.log('📢 Đang xin quyền micro...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Đã có quyền micro!');
        stream.getTracks().forEach(track => track.stop());
        
        // Khởi tạo recognition
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;      // Luôn lắng nghe liên tục
        recognition.interimResults = true;  // Lấy kết quả tạm thời
        recognition.lang = 'vi-VN';
        
        recognition.onstart = () => {
            console.log('🎤 Micro đang lắng nghe...');
            isListening = true;
            if (!isAwake) {
                statusText.innerText = '💤 Đang ngủ... Hãy nói "Xin chào" để đánh thức';
                setExpression('sleepy');
            } else {
                statusText.innerText = '🎤 Đang lắng nghe...';
                setExpression('listening');
            }
        };
        
        recognition.onresult = (event) => {
            // Lấy kết quả cuối cùng (ổn định nhất)
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalText = event.results[i][0].transcript.trim();
                    break;
                }
            }
            
            if (finalText) {
                console.log('🎙️ Nghe thấy:', finalText);
                
                // Nếu đang ngủ, chỉ lắng nghe từ khóa đánh thức
                if (!isAwake) {
                    if (isWakeWord(finalText)) {
                        console.log('🔊 Đánh thức robot!');
                        wakeUp();
                    }
                    return;
                }
                
                // Nếu đang thức, xử lý câu hỏi
                if (isAwake && !isSpeaking && finalText.length > 2) {
                    // Bỏ qua nếu chỉ là từ khóa đánh thức khi đã thức
                    if (!isWakeWord(finalText) || finalText.length > 10) {
                        resetSleepTimer();
                        processAI(finalText);
                    }
                }
            }
        };
        
        recognition.onerror = (event) => {
            console.error('❌ Lỗi recognition:', event.error);
            if (event.error === 'not-allowed') {
                statusText.innerText = '❌ Chưa cấp quyền micro! Refresh trang và cho phép!';
                alert('⚠️ Vui lòng cho phép truy cập micro! Refresh trang và đồng ý cấp quyền.');
            } else if (event.error === 'no-speech') {
                // Bình thường, không có gì để nói
                console.log('Không nghe thấy giọng nói');
            }
        };
        
        recognition.onend = () => {
            console.log('🔴 Micro kết thúc, khởi động lại sau 0.5s...');
            isListening = false;
            // Tự động khởi động lại micro
            setTimeout(() => {
                if (recognition) {
                    try {
                        recognition.start();
                        console.log('🔄 Đã khởi động lại micro');
                    } catch(e) {
                        console.error('Lỗi khởi động lại micro:', e);
                    }
                }
            }, 500);
        };
        
        // Bắt đầu lắng nghe
        recognition.start();
        console.log('✅ Micro đã sẵn sàng!');
        return true;
        
    } catch(err) {
        console.error('❌ Lỗi micro:', err);
        statusText.innerText = '❌ Lỗi micro: ' + err.message;
        alert('Không thể truy cập micro!\n\nHãy:\n1. Dùng Chrome/Edge\n2. Nhấn biểu tượng ổ khóa 🔒 trên thanh địa chỉ\n3. Cho phép quyền micro\n4. Refresh trang');
        return false;
    }
}

// ========== TOGGLE FULL MÀN HÌNH ==========
toggleChatBtn.onclick = () => {
    app.classList.toggle('fullscreen');
    toggleChatBtn.innerHTML = app.classList.contains('fullscreen') ? '🔼 HIỆN CHAT' : '🔽 ẨN CHAT';
};

// ========== KHỞI TẠO TRANG ==========
window.onload = async () => {
    console.log('🚀 Pika AI khởi động...');
    setExpression('sleepy');
    statusText.innerText = '🎤 Đang khởi tạo micro...';
    
    // Khởi tạo micro
    await initMicrophone();
    
    // Chào mừng sau khi khởi tạo
    setTimeout(() => {
        addMessage('ai', '🤖 Pika AI đã sẵn sàng! Hãy nói <span style="color:#f5576c">"Xin chào"</span> hoặc <span style="color:#f5576c">"Hello"</span> để đánh thức tôi nhé!');
        if (!isAwake) {
            statusText.innerText = '💤 Đang ngủ... Hãy nói "Xin chào" để đánh thức';
            setExpression('sleepy');
        }
    }, 1000);
};

// Thông báo khi trang đóng
window.onbeforeunload = () => {
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
    if (synth) {
        synth.cancel();
    }
};
