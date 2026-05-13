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
let driveControlMode = false;
let mouthAnimationInterval = null;
let reconnectAttempts = 0;
let countdownInterval = null;
let currentLang = 'vi-VN';

const INACTIVITY_LIMIT = 60000;
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi', 'hey chiri', 'alô', 'chào', 'hey', 'wake up'];

// ========== FACE DETECTION - PHIÊN BẢN ĐƠN GIẢN ==========
let isCameraActive = false;
let cameraButton = null;
let videoElement = null;
let stream = null;
let detectionInterval = null;

async function initFaceDetection() {
    cameraButton = document.getElementById('cameraToggleBtn');
    videoElement = document.getElementById('video');
    
    if (!cameraButton) {
        console.log('⚠️ Camera button not found');
        return;
    }
    
    cameraButton.addEventListener('click', async () => {
        if (!isCameraActive) {
            await startCamera();
        } else {
            stopCamera();
        }
    });
}

async function startCamera() {
    try {
        // Request camera permission
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            } 
        });
        
        // Display video
        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.style.display = 'block';
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            await videoElement.play();
        }
        
        isCameraActive = true;
        cameraButton.textContent = '📷 TẮT CAMERA';
        cameraButton.classList.add('active');
        
        // Update status
        const faceEmoji = document.getElementById('faceEmoji');
        const faceText = document.getElementById('faceText');
        if (faceEmoji) faceEmoji.textContent = '📷';
        if (faceText) faceText.textContent = 'Camera đang hoạt động! Đang phát hiện...';
        
        // Start simple face detection
        startSimpleFaceDetection();
        
        addMessage('ai', '📷 Camera đã được bật! Chiri đang nhìn thấy bạn!');
        
    } catch (error) {
        console.error('Camera error:', error);
        addMessage('ai', '⚠️ Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập!');
        
        const faceText = document.getElementById('faceText');
        if (faceText) faceText.textContent = '❌ Không thể truy cập camera';
    }
}

function stopCamera() {
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        stream = null;
    }
    
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement.style.display = 'none';
    }
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    isCameraActive = false;
    cameraButton.textContent = '📷 BẬT CAMERA';
    cameraButton.classList.remove('active');
    
    const faceEmoji = document.getElementById('faceEmoji');
    const faceText = document.getElementById('faceText');
    const glassesStatus = document.getElementById('glassesStatus');
    const hatStatus = document.getElementById('hatStatus');
    
    if (faceEmoji) faceEmoji.textContent = '🤖';
    if (faceText) faceText.textContent = 'Camera đã tắt';
    if (glassesStatus) glassesStatus.textContent = '🕶️ Đang kiểm tra';
    if (hatStatus) hatStatus.textContent = '🧢 Đang kiểm tra';
    
    addMessage('ai', '📷 Camera đã tắt.');
}

function startSimpleFaceDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    // Create hidden canvas for analysis
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    detectionInterval = setInterval(() => {
        if (!isCameraActive || !videoElement || videoElement.paused || videoElement.readyState !== 4) {
            return;
        }
        
        // Set canvas dimensions to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        if (canvas.width === 0 || canvas.height === 0) return;
        
        // Draw current video frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Get image data for analysis
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Detect face by skin color
        const hasFace = detectFaceBySkinColor(imageData);
        
        // Detect glasses and hat (simplified)
        const hasGlasses = detectGlassesSimple(imageData);
        const hasHat = detectHatSimple(imageData);
        
        // Update UI
        updateFaceStatusUI(hasFace, hasGlasses, hasHat);
        
        // Speak when face is detected
        if (hasFace && isAwake && !isSpeaking && !isAIProcessing) {
            const lastStatus = localStorage.getItem('lastFaceStatus');
            const currentStatus = `${hasGlasses}-${hasHat}`;
            
            if (lastStatus !== currentStatus) {
                localStorage.setItem('lastFaceStatus', currentStatus);
                
                if (hasGlasses && hasHat) {
                    addMessage('ai', 'Chiri thấy bạn đang đeo kính và đội mũ! Trông thật phong cách! 😎🧢');
                    speak('Chiri thấy bạn đang đeo kính và đội mũ! Trông thật phong cách!');
                } else if (hasGlasses) {
                    addMessage('ai', 'Chiri thấy bạn đang đeo kính! Rất là ngầu! 😎');
                    speak('Chiri thấy bạn đang đeo kính! Rất là ngầu!');
                } else if (hasHat) {
                    addMessage('ai', 'Chiri thấy bạn đang đội mũ! Đẹp quá! 🧢');
                    speak('Chiri thấy bạn đang đội mũ! Đẹp quá!');
                } else if (lastStatus === '') {
                    addMessage('ai', 'Chiri nhìn thấy bạn rồi! Bạn thật dễ thương! 😊');
                    speak('Chiri nhìn thấy bạn rồi! Bạn thật dễ thương!');
                }
            }
        }
        
    }, 500); // Check every 500ms
}

function detectFaceBySkinColor(imageData) {
    let skinPixelCount = 0;
    const width = imageData.width;
    const height = imageData.height;
    
    // Check center region of image
    const centerX = width / 2;
    const centerY = height / 2;
    const regionWidth = width * 0.4;
    const regionHeight = height * 0.4;
    
    const startX = Math.max(0, centerX - regionWidth / 2);
    const endX = Math.min(width, centerX + regionWidth / 2);
    const startY = Math.max(0, centerY - regionHeight / 2);
    const endY = Math.min(height, centerY + regionHeight / 2);
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const idx = (y * width + x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            
            // Skin color detection (RGB range for Asian skin)
            if (r > 80 && g > 40 && b > 20 && r > g && Math.abs(r - g) > 15) {
                skinPixelCount++;
            }
        }
    }
    
    const totalPixels = (endX - startX) * (endY - startY);
    const skinPercentage = skinPixelCount / totalPixels;
    
    return skinPercentage > 0.1; // At least 10% skin color in center region
}

function detectGlassesSimple(imageData) {
    // Simplified detection: look for dark regions in upper half of face area
    const width = imageData.width;
    const height = imageData.height;
    const centerY = height * 0.45; // Eye level
    
    let darkPixelCount = 0;
    const checkWidth = width * 0.3;
    const leftX = width * 0.35;
    const rightX = width * 0.65;
    
    // Check left eye area
    for (let x = leftX; x < leftX + checkWidth / 2; x++) {
        for (let y = centerY - 20; y < centerY + 20; y++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 0 && idx < imageData.data.length) {
                const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                if (brightness < 80) darkPixelCount++;
            }
        }
    }
    
    // Check right eye area
    for (let x = rightX; x < rightX + checkWidth / 2; x++) {
        for (let y = centerY - 20; y < centerY + 20; y++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 0 && idx < imageData.data.length) {
                const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                if (brightness < 80) darkPixelCount++;
            }
        }
    }
    
    return darkPixelCount > 30; // Threshold for glasses detection
}

function detectHatSimple(imageData) {
    // Simplified detection: look for patterns above face
    const width = imageData.width;
    const height = imageData.height;
    const topY = height * 0.15;
    const bottomY = height * 0.35;
    
    let edgeCount = 0;
    const startX = width * 0.3;
    const endX = width * 0.7;
    
    for (let x = startX; x < endX; x++) {
        for (let y = topY; y < bottomY; y++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 4 && idx < imageData.data.length - 4) {
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];
                
                // Look for color variations (hat rims)
                const nextIdx = (Math.floor(y) * width + Math.floor(x + 1)) * 4;
                const rNext = imageData.data[nextIdx];
                const gNext = imageData.data[nextIdx + 1];
                const bNext = imageData.data[nextIdx + 2];
                
                const diff = Math.abs(r - rNext) + Math.abs(g - gNext) + Math.abs(b - bNext);
                if (diff > 100) edgeCount++;
            }
        }
    }
    
    return edgeCount > 50;
}

function updateFaceStatusUI(hasFace, hasGlasses, hasHat) {
    const faceEmoji = document.getElementById('faceEmoji');
    const faceText = document.getElementById('faceText');
    const glassesStatus = document.getElementById('glassesStatus');
    const hatStatus = document.getElementById('hatStatus');
    
    if (!faceEmoji || !faceText) return;
    
    if (hasFace) {
        faceEmoji.textContent = '😊';
        faceText.textContent = 'Đã phát hiện khuôn mặt!';
        
        if (glassesStatus) {
            glassesStatus.innerHTML = hasGlasses ? '🕶️ ĐANG ĐEO KÍNH ✅' : '🕶️ KHÔNG ĐEO KÍNH';
            glassesStatus.style.background = hasGlasses ? '#4caf50' : '#666';
        }
        
        if (hatStatus) {
            hatStatus.innerHTML = hasHat ? '🧢 ĐANG ĐỘI MŨ ✅' : '🧢 KHÔNG ĐỘI MŨ';
            hatStatus.style.background = hasHat ? '#4caf50' : '#666';
        }
    } else {
        faceEmoji.textContent = '😔';
        faceText.textContent = 'Chưa phát hiện khuôn mặt';
        if (glassesStatus) {
            glassesStatus.innerHTML = '🕶️ Chưa phát hiện';
            glassesStatus.style.background = '#666';
        }
        if (hatStatus) {
            hatStatus.innerHTML = '🧢 Chưa phát hiện';
            hatStatus.style.background = '#666';
        }
    }
}

// ========== COUNTDOWN FUNCTION ==========
function startCountdown(seconds, onComplete) {
    if (countdownInterval) clearInterval(countdownInterval);
    
    let countdownDiv = document.getElementById('countdownDisplay');
    if (!countdownDiv) {
        countdownDiv = document.createElement('div');
        countdownDiv.id = 'countdownDisplay';
        countdownDiv.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a2a3a, #0f1a24);
            color: #ff6a2e;
            padding: 25px 50px;
            border-radius: 80px;
            font-size: 56px;
            font-weight: bold;
            font-family: monospace;
            z-index: 1000;
            text-align: center;
            box-shadow: 0 0 50px rgba(255,106,46,0.6);
            border: 2px solid #ff6a2e;
            backdrop-filter: blur(10px);
            white-space: nowrap;
        `;
        document.body.appendChild(countdownDiv);
    }
    
    countdownDiv.style.display = 'block';
    let remaining = seconds;
    
    const updateDisplay = () => {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        if (mins > 0) {
            countdownDiv.innerHTML = `⏰ ${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            countdownDiv.innerHTML = `⏰ ${remaining} giây`;
        }
        
        if (remaining <= 10 && remaining > 0) {
            countdownDiv.style.transform = 'translate(-50%, -50%) scale(1.1)';
            countdownDiv.style.color = '#ff4444';
            setTimeout(() => {
                if (countdownDiv) countdownDiv.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 200);
        } else {
            countdownDiv.style.color = '#ff6a2e';
        }
    };
    
    updateDisplay();
    
    countdownInterval = setInterval(() => {
        remaining--;
        updateDisplay();
        
        if (remaining <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownDiv.innerHTML = '🔔 HẾT GIỜ! 🔔';
            countdownDiv.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
            countdownDiv.style.color = 'white';
            setTimeout(() => {
                if (countdownDiv) countdownDiv.style.display = 'none';
            }, 2000);
            if (onComplete) onComplete();
        }
    }, 1000);
}

function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    const countdownDiv = document.getElementById('countdownDisplay');
    if (countdownDiv) countdownDiv.style.display = 'none';
}

// ========== TTS ==========
let currentUtterance = null;

async function speak(text) {
    if (!text) return;
    
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    if (currentUtterance) {
        currentUtterance = null;
    }
    
    isSpeaking = true;
    setExpression('talking');
    
    const isVietnamese = /[àáảãạăâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i.test(text);
    const ttsLang = isVietnamese ? 'vi' : 'en';
    
    try {
        const response = await fetch(`/tts?text=${encodeURIComponent(text.slice(0, 500))}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            
            audio.onended = () => {
                URL.revokeObjectURL(audio.src);
                finishSpeaking();
            };
            audio.onerror = () => {
                URL.revokeObjectURL(audio.src);
                finishSpeaking();
            };
            
            await audio.play();
        } else {
            await fallbackSpeak(text, ttsLang);
        }
    } catch (error) {
        console.log('Server TTS failed, using fallback');
        await fallbackSpeak(text, ttsLang);
    }
}

function fallbackSpeak(text, lang = 'vi') {
    return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        currentUtterance = utterance;
        
        utterance.onend = () => {
            currentUtterance = null;
            resolve();
            finishSpeaking();
        };
        utterance.onerror = () => {
            currentUtterance = null;
            resolve();
            finishSpeaking();
        };
        
        window.speechSynthesis.speak(utterance);
    });
}

function finishSpeaking() {
    isSpeaking = false;
    stopMouthAnimation();
    if (isAwake) {
        setExpression('listening');
        setTimeout(() => startListening(), 300);
    }
}

// ========== ROBOT FACE ==========
function setExpression(expression) {
    robotSvg.classList.remove('listening', 'happy', 'thinking', 'sleepy', 'talking');
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
    if (mouthAnimationInterval) clearInterval(mouthAnimationInterval);
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

// ========== UI ==========
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
    } else {
        driveModeBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        driveModeBtn.classList.remove('drive-active');
    }
}

function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    while (chatBox.children.length > 40) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== WAKE/SLEEP ==========
function wakeUp() {
    if (isAwake) return;
    isAwake = true;
    updateWakeIndicator('awake');
    resetInactivityTimer();
    setExpression('happy');
    
    const greeting = driveControlMode 
        ? 'Chào bạn! Chế độ lái xe đang bật. Hãy nói: Tiến, Lùi, Trái, Phải, hoặc Dừng!'
        : 'Chào bạn! Chiri đã thức dậy. Bạn có thể hỏi mình bất cứ điều gì!';
    
    addMessage('ai', greeting);
    speak(greeting);
    setTimeout(() => startListening(), 1000);
}

function goToSleep() {
    if (!isAwake) return;
    
    isAwake = false;
    isListening = false;
    stopCountdown();
    
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
    
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    addMessage('ai', 'Chiri đi ngủ đây. Nói "Xin chào" để đánh thức mình nhé! 😴');
}

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        if (isAwake && !isSpeaking && !isAIProcessing) {
            console.log('💤 Auto-sleep after 60 seconds inactivity');
            goToSleep();
        }
    }, INACTIVITY_LIMIT);
}

// ========== SPEECH RECOGNITION ==========
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói!');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = 'vi-VN';
    
    recognition.onstart = () => {
        console.log('🎤 Microphone started - Language:', recognition.lang);
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
        
        if (!isAwake) {
            if (WAKE_WORDS.some(word => lower.includes(word))) {
                wakeUp();
            }
            return;
        }
        
        if (!isSpeaking && !isAIProcessing) {
            processCommand(transcript);
        }
    };
    
    recognition.onerror = (event) => {
        console.log('Recognition error:', event.error);
        isListening = false;
        if (isAwake && !isSpeaking) {
            setTimeout(() => startListening(), 1000);
        }
    };
    
    recognition.onend = () => {
        console.log('🔴 Recognition ended');
        isListening = false;
        if (isAwake && !isSpeaking && !isAIProcessing) {
            setTimeout(() => startListening(), 500);
        }
    };
}

function startListening() {
    if (!recognition || isListening || isSpeaking || isAIProcessing || !isAwake) return;
    
    try {
        recognition.stop();
    } catch(e) {}
    
    setTimeout(() => {
        try {
            recognition.start();
            console.log('🎤 Listening started with language:', recognition.lang);
        } catch(e) {
            console.log('Start listening failed:', e);
            setTimeout(() => {
                try { recognition.start(); } catch(e) {}
            }, 500);
        }
    }, 200);
}

// ========== COMMAND PROCESSING ==========
async function processCommand(text) {
    if (isAIProcessing || isSpeaking) return;
    
    isAIProcessing = true;
    setExpression('thinking');
    statusText.innerHTML = '🤔 Đang suy nghĩ...';
    addMessage('user', text);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'voice',
            text: text,
            driveMode: driveControlMode
        }));
    } else {
        addMessage('ai', '🔌 Mất kết nối server. Đang thử kết nối lại...');
        isAIProcessing = false;
        connectWebSocket();
    }
}

// ========== WEBSOCKET ==========
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('✅ WebSocket connected');
        statusText.innerHTML = '🎤 Nói "Xin chào" để đánh thức Chiri!';
    };
    
    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'ai') {
                isAIProcessing = false;
                addMessage('ai', data.text);
                await speak(data.text);
                statusText.innerHTML = '🎤 Đang lắng nghe...';
                resetInactivityTimer();
            }
            
            if (data.type === 'countdown') {
                addMessage('ai', data.message);
                speak(data.message);
                startCountdown(data.seconds, () => {
                    addMessage('ai', '🔔 Hết giờ rồi!');
                    speak('Hết giờ rồi!');
                });
            }
        } catch(e) {
            console.log('Parse error:', e);
            isAIProcessing = false;
        }
    };
    
    ws.onerror = (error) => {
        console.log('WS error:', error);
        statusText.innerHTML = '⚠️ Đang mất kết nối server...';
    };
    
    ws.onclose = () => {
        console.log('WS disconnected');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), 8000);
        setTimeout(connectWebSocket, delay);
    };
}

// ========== INITIALIZATION ==========
function init() {
    console.log('🚀 Chiri AI v6.0 - Full Feature');
    console.log('📋 Features: Tiếng Việt, ChatGPT, Voice Control, Countdown, Drive Mode, Face Detection');
    
    updateWakeIndicator('sleeping');
    updateDriveModeUI();
    setExpression('sleepy');
    
    connectWebSocket();
    initSpeechRecognition();
    initFaceDetection();
    
    document.addEventListener('click', () => {
        const audio = new Audio();
        audio.play().catch(()=>{});
        if (!isAwake) {
            wakeUp();
        }
    }, { once: true });
    
    manualWake.addEventListener('click', () => {
        if (!isAwake) {
            wakeUp();
        } else {
            resetInactivityTimer();
            addMessage('ai', 'Chiri vẫn đang thức đây! Bạn cần gì ạ? 😊');
            speak('Chiri vẫn đang thức đây! Bạn cần gì ạ?');
        }
    });
    
    driveModeBtn.addEventListener('click', () => {
        driveControlMode = !driveControlMode;
        updateDriveModeUI();
        const msg = driveControlMode 
            ? 'Đã bật chế độ lái xe. Nói: Tiến, Lùi, Trái, Phải, Dừng! 🚗'
            : 'Đã tắt chế độ lái xe. Chiri sẽ trò chuyện bình thường! 💬';
        addMessage('ai', msg);
        speak(msg);
    });
    
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
