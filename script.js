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

const INACTIVITY_LIMIT = 60000;
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi', 'hey chiri', 'alô', 'chào'];

// ========== MEDIAPIPE FACE DETECTION ==========
let isCameraActive = false;
let cameraButton = null;
let videoElement = null;
let canvasElement = null;
let faceDetection = null;
let camera = null;

let lastFaceState = { hasFace: false, glasses: false, hat: false };
let detectionStableCount = 0;
const REQUIRED_STABLE_COUNT = 3;

async function initFaceDetection() {
    cameraButton = document.getElementById('cameraToggleBtn');
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addMessage('ai', '⚠️ Trình duyệt không hỗ trợ camera!');
        return;
    }
    
    try {
        const faceText = document.getElementById('faceText');
        if (faceText) faceText.textContent = '📷 Đang khởi tạo camera...';
        
        // Khởi tạo MediaPipe Face Detection
        faceDetection = new FaceDetection({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            }
        });
        
        faceDetection.setOptions({
            model: 'short',
            minDetectionConfidence: 0.5
        });
        
        faceDetection.onResults(onFaceDetectionResults);
        
        // Khởi tạo camera
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isCameraActive && faceDetection) {
                    await faceDetection.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        
        isCameraActive = true;
        cameraButton.textContent = '📷 TẮT CAMERA';
        cameraButton.classList.add('active');
        
        if (faceText) faceText.textContent = '📷 Camera đang hoạt động!';
        document.getElementById('faceEmoji').textContent = '📷';
        
        addMessage('ai', '📷 Camera đã được bật! Chiri đang nhìn thấy bạn!');
        
        if (canvasElement) {
            canvasElement.style.display = 'block';
            canvasElement.width = 640;
            canvasElement.height = 480;
        }
        
    } catch (error) {
        console.error('Camera error:', error);
        let errorMsg = 'Không thể khởi tạo camera. Vui lòng kiểm tra quyền truy cập!';
        addMessage('ai', '⚠️ ' + errorMsg);
        document.getElementById('faceText').textContent = '❌ ' + errorMsg;
    }
}

function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    if (videoElement) {
        videoElement.srcObject = null;
    }
    
    isCameraActive = false;
    cameraButton.textContent = '📷 BẬT CAMERA';
    cameraButton.classList.remove('active');
    
    if (canvasElement) {
        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasElement.style.display = 'none';
    }
    
    document.getElementById('faceEmoji').textContent = '🤖';
    document.getElementById('faceText').textContent = 'Camera đã tắt';
    document.getElementById('glassesStatus').innerHTML = '🕶️ --';
    document.getElementById('hatStatus').innerHTML = '🧢 --';
    
    addMessage('ai', '📷 Camera đã tắt.');
}

function onFaceDetectionResults(results) {
    if (!isCameraActive || !canvasElement) return;
    
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    let hasFace = false;
    let hasGlasses = false;
    let hasHat = false;
    
    if (results.detections.length > 0) {
        hasFace = true;
        
        for (const detection of results.detections) {
            const bbox = detection.boundingBox;
            // Vẽ khung mặt
            canvasCtx.strokeStyle = '#00ff00';
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeRect(bbox.xMin, bbox.yMin, bbox.xMax - bbox.xMin, bbox.yMax - bbox.yMin);
            
            // Phân tích vùng mắt để phát hiện kính
            hasGlasses = analyzeGlassesRegion(results.image, bbox);
            
            // Phân tích vùng trên đầu để phát hiện mũ
            hasHat = analyzeHatRegion(results.image, bbox);
        }
    }
    
    canvasCtx.restore();
    updateFaceStatusUI(hasFace, hasGlasses, hasHat);
}

function analyzeGlassesRegion(image, bbox) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    const eyeY = bbox.yMin + (bbox.yMax - bbox.yMin) * 0.45;
    const eyeH = (bbox.yMax - bbox.yMin) * 0.15;
    const eyeX = bbox.xMin + (bbox.xMax - bbox.xMin) * 0.3;
    const eyeW = (bbox.xMax - bbox.xMin) * 0.4;
    
    tempCanvas.width = eyeW;
    tempCanvas.height = eyeH;
    tempCtx.drawImage(image, eyeX, eyeY, eyeW, eyeH, 0, 0, eyeW, eyeH);
    
    const imageData = tempCtx.getImageData(0, 0, eyeW, eyeH);
    let darkCount = 0;
    let brightCount = 0;
    let total = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        const brightness = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        total++;
        if (brightness < 50) darkCount++;
        if (brightness > 200) brightCount++;
    }
    
    const darkRatio = darkCount / total;
    const brightRatio = brightCount / total;
    
    return darkRatio > 0.12 && brightRatio > 0.04;
}

function analyzeHatRegion(image, bbox) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    const hatY = Math.max(0, bbox.yMin - (bbox.yMax - bbox.yMin) * 0.4);
    const hatH = (bbox.yMax - bbox.yMin) * 0.35;
    const hatX = bbox.xMin;
    const hatW = bbox.xMax - bbox.xMin;
    
    if (hatY < 0) return false;
    
    tempCanvas.width = hatW;
    tempCanvas.height = hatH;
    tempCtx.drawImage(image, hatX, hatY, hatW, hatH, 0, 0, hatW, hatH);
    
    const imageData = tempCtx.getImageData(0, 0, hatW, hatH);
    let edgeCount = 0;
    let total = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        total++;
        if (i + 4 < imageData.data.length) {
            const r = imageData.data[i];
            const g = imageData.data[i+1];
            const b = imageData.data[i+2];
            const rNext = imageData.data[i+4];
            const gNext = imageData.data[i+5];
            const bNext = imageData.data[i+6];
            const diff = Math.abs(r - rNext) + Math.abs(g - gNext) + Math.abs(b - bNext);
            if (diff > 80) edgeCount++;
        }
    }
    
    const edgeRatio = edgeCount / total;
    return edgeRatio > 0.08;
}

function updateFaceStatusUI(hasFace, hasGlasses, hasHat) {
    const faceEmoji = document.getElementById('faceEmoji');
    const faceText = document.getElementById('faceText');
    const glassesStatus = document.getElementById('glassesStatus');
    const hatStatus = document.getElementById('hatStatus');
    
    if (!faceEmoji || !faceText) return;
    
    const currentState = { hasFace, glasses: hasGlasses, hat: hasHat };
    const isSame = (currentState.hasFace === lastFaceState.hasFace &&
                    currentState.glasses === lastFaceState.glasses &&
                    currentState.hat === lastFaceState.hat);
    
    if (isSame) {
        detectionStableCount++;
    } else {
        detectionStableCount = 0;
    }
    
    const isStable = detectionStableCount >= REQUIRED_STABLE_COUNT;
    
    if (hasFace && isStable) {
        faceEmoji.textContent = '😊';
        faceText.textContent = 'Đã phát hiện khuôn mặt!';
        
        glassesStatus.innerHTML = hasGlasses ? '🕶️ ĐANG ĐEO KÍNH ✅' : '🕶️ KHÔNG ĐEO KÍNH';
        glassesStatus.style.background = hasGlasses ? '#4caf50' : '#666';
        
        hatStatus.innerHTML = hasHat ? '🧢 ĐANG ĐỘI MŨ ✅' : '🧢 KHÔNG ĐỘI MŨ';
        hatStatus.style.background = hasHat ? '#4caf50' : '#666';
        
        if (isStable && (hasGlasses !== lastFaceState.glasses || hasHat !== lastFaceState.hat)) {
            if (hasGlasses && hasHat) {
                speak('Chiri thấy bạn đang đeo kính và đội mũ!');
                addMessage('ai', '👓🧢 Chiri thấy bạn đang đeo kính và đội mũ!');
            } else if (hasGlasses && !lastFaceState.glasses) {
                speak('Chiri thấy bạn đang đeo kính!');
                addMessage('ai', '👓 Chiri thấy bạn đang đeo kính!');
            } else if (hasHat && !lastFaceState.hat) {
                speak('Chiri thấy bạn đang đội mũ!');
                addMessage('ai', '🧢 Chiri thấy bạn đang đội mũ!');
            } else if (!hasGlasses && !hasHat && (lastFaceState.glasses || lastFaceState.hat)) {
                speak('Chiri thấy bạn đã tháo kính/mũ!');
                addMessage('ai', '😊 Chiri thấy bạn đã tháo kính/mũ!');
            }
        }
        
        lastFaceState = { ...currentState };
        
    } else if (!hasFace && isStable) {
        faceEmoji.textContent = '😔';
        faceText.textContent = 'Chưa phát hiện khuôn mặt';
        glassesStatus.innerHTML = '🕶️ --';
        hatStatus.innerHTML = '🧢 --';
        lastFaceState = { hasFace: false, glasses: false, hat: false };
        detectionStableCount = 0;
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
        console.log('🎤 Microphone started');
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
            console.log('🎤 Listening started');
        } catch(e) {
            console.log('Start listening failed:', e);
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
    console.log('🚀 Chiri AI v7.0 - MediaPipe Face Detection');
    console.log('📋 Features: Tiếng Việt, ChatGPT, Voice Control, Countdown, Drive Mode, MediaPipe Face Detection');
    
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
