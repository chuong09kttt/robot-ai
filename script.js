// ========== MODE SELECTION & NAVIGATION ==========
function showModeScreen() {
    console.log('showModeScreen called');
    
    const modeScreen = document.getElementById('modeScreen');
    const loginScreen = document.getElementById('loginScreen');
    const chatPanel = document.getElementById('chatPanel');
    const drivePanel = document.getElementById('drivePanel');
    const translatePanel = document.getElementById('translatePanel');
    const cameraPanel = document.getElementById('cameraPanel');
    
    if (modeScreen) modeScreen.style.display = 'block';
    if (loginScreen) loginScreen.style.display = 'none';
    if (chatPanel) chatPanel.style.display = 'none';
    if (drivePanel) drivePanel.style.display = 'none';
    if (translatePanel) translatePanel.style.display = 'none';
    if (cameraPanel) cameraPanel.style.display = 'none';
    
    // Dừng các chế độ đang chạy
    if (typeof window.stopTranslationMode === 'function') window.stopTranslationMode();
    if (typeof window.stopCamera === 'function') window.stopCamera();
    if (window.recognition) {
        try { window.recognition.stop(); } catch(e) {}
    }
}

function showChatMode() {
    console.log('showChatMode called');
    
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'block';
    
    // Khởi tạo chat mode
    if (typeof window.initChatMode === 'function') window.initChatMode();
    else console.error('initChatMode not found');
}

function showDriveMode() {
    console.log('showDriveMode called');
    
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'block';
    
    if (typeof window.initDriveMode === 'function') window.initDriveMode();
    else console.error('initDriveMode not found');
}

function showTranslateMode() {
    console.log('showTranslateMode called');
    
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'block';
    
    if (typeof window.initTranslateMode === 'function') window.initTranslateMode();
    else console.error('initTranslateMode not found');
}

function showCameraMode() {
    console.log('showCameraMode called');
    
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'block';
    
    if (typeof window.initCameraMode === 'function') window.initCameraMode();
    else console.error('initCameraMode not found');
}

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let ws = null;
let recognition = null;
let isAwake = false;
let isListening = false;
let isSpeaking = false;
let isAIProcessing = false;
let driveControlMode = false;
let mouthAnimationInterval = null;
let reconnectAttempts = 0;

// Translation variables
let isTranslatorMode = false;
let sourceLang = 'vi';
let targetLang = 'en';
let translationRecognition = null;
let lastProcessedText = '';
let translationTimeout = null;

// Face Mesh variables
let isCameraActive = false;
let faceMesh = null;
let camera = null;
let videoElement = null;
let canvasElement = null;

// Face Recognition Database
let faceDatabase = new Map();
let lastRecognizedTime = new Map();

// Register mode
let capturedPhotos = [];
let registerVideoStream = null;
let isRecognizing = false;

const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi'];

// ========== CHAT MODE FUNCTIONS ==========
function initChatMode() {
    console.log('Chat mode initialized');
    isAwake = false;
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    
    connectWebSocket();
    initSpeechRecognition();
}

function setExpression(expression) {
    const robotSvg = document.querySelector('.robot-svg');
    if (robotSvg) {
        robotSvg.classList.remove('listening', 'happy', 'thinking', 'sleepy', 'talking');
        robotSvg.classList.add(expression);
    }
    
    const mouth = document.querySelector('.robot-mouth');
    if (!mouth) return;
    
    if (mouthAnimationInterval) clearInterval(mouthAnimationInterval);
    
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
}

function updateWakeIndicator(state) {
    const wakeDot = document.getElementById('wakeDot');
    const statusText = document.getElementById('globalStatusText');
    
    if (state === 'listening') {
        if (wakeDot) wakeDot.style.background = '#f39c12';
        if (statusText) statusText.innerHTML = 'LISTENING...';
    } else if (state === 'awake') {
        if (wakeDot) wakeDot.style.background = '#00ff00';
        if (statusText) statusText.innerHTML = 'AWAKE';
    } else {
        if (wakeDot) wakeDot.style.background = '#666';
        if (statusText) statusText.innerHTML = 'SLEEPING';
    }
}

function addMessage(type, text) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    while (chatBox.children.length > 50) {
        chatBox.removeChild(chatBox.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function speak(text) {
    if (!text) return;
    if (isTranslatorMode) return;
    
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    isSpeaking = true;
    setExpression('talking');
    
    try {
        const response = await fetch(`/tts?text=${encodeURIComponent(text.slice(0, 300))}`);
        if (response.ok) {
            const blob = await response.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            audio.onended = () => finishSpeaking();
            audio.onerror = () => finishSpeaking();
            await audio.play();
        } else {
            fallbackSpeak(text);
        }
    } catch(e) {
        fallbackSpeak(text);
    }
}

function fallbackSpeak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;
    utterance.onend = () => finishSpeaking();
    utterance.onerror = () => finishSpeaking();
    window.speechSynthesis.speak(utterance);
}

function finishSpeaking() {
    isSpeaking = false;
    stopMouthAnimation();
    if (isAwake && !isTranslatorMode) setExpression('listening');
}

function wakeUp() {
    if (isAwake) return;
    isAwake = true;
    updateWakeIndicator('awake');
    setExpression('happy');
    
    const greeting = 'Chào bạn! Chiri đã thức! 💕';
    addMessage('ai', greeting);
    speak(greeting);
    startInactivityCountdown();
}

function goToSleep() {
    if (!isAwake) return;
    isAwake = false;
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
}

let inactivitySeconds = 60;
let inactivityInterval = null;

function startInactivityCountdown() {
    if (inactivityInterval) clearInterval(inactivityInterval);
    inactivitySeconds = 60;
    
    inactivityInterval = setInterval(() => {
        if (!isAwake || isSpeaking || isAIProcessing || isTranslatorMode) {
            inactivitySeconds = 60;
            const timerElem = document.getElementById('sleepTimer');
            if (timerElem) timerElem.innerHTML = 'SLEEP IN 60s';
            return;
        }
        
        if (inactivitySeconds <= 0) {
            clearInterval(inactivityInterval);
            goToSleep();
        } else {
            const timerElem = document.getElementById('sleepTimer');
            if (timerElem) timerElem.innerHTML = `SLEEP IN ${inactivitySeconds}s`;
            inactivitySeconds--;
        }
    }, 1000);
}

// ========== SPEECH RECOGNITION ==========
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Trình duyệt không hỗ trợ!');
        return;
    }
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'vi-VN';
    
    recognition.onstart = () => {
        isListening = true;
        if (!isTranslatorMode) {
            updateWakeIndicator('listening');
            setExpression('listening');
        }
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log('Voice:', transcript);
        
        if (!transcript) return;
        
        const lower = transcript.toLowerCase();
        
        if (!isAwake) {
            if (WAKE_WORDS.some(w => lower.includes(w))) wakeUp();
            return;
        }
        
        if (!isSpeaking && !isAIProcessing) {
            if (lower.includes('bật phiên dịch') || lower.includes('bật dịch')) {
                toggleTranslatorMode();
                return;
            }
            if (lower.includes('tắt phiên dịch') || lower.includes('tắt dịch')) {
                toggleTranslatorMode();
                return;
            }
            processCommand(transcript);
        }
    };
    
    recognition.onend = () => {
        isListening = false;
        if (isAwake && !isSpeaking && !isTranslatorMode) {
            setTimeout(() => recognition.start(), 500);
        }
    };
    
    recognition.start();
}

async function processCommand(text) {
    isAIProcessing = true;
    setExpression('thinking');
    addMessage('user', text);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice', text: text, driveMode: false }));
    } else {
        addMessage('ai', 'Kết nối server thất bại!');
        isAIProcessing = false;
    }
}

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai') {
            isAIProcessing = false;
            addMessage('ai', data.text);
            if (!isTranslatorMode) speak(data.text);
        }
    };
    
    ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), 8000);
        setTimeout(connectWebSocket, delay);
    };
}

// ========== DRIVE MODE FUNCTIONS ==========
function initDriveMode() {
    console.log('Drive mode initialized');
    
    document.querySelectorAll('.drive-btn-gaming').forEach(btn => {
        btn.removeEventListener('mousedown', startDriveCommand);
        btn.removeEventListener('mouseup', stopDriveCommand);
        btn.removeEventListener('mouseleave', stopDriveCommand);
        
        btn.addEventListener('mousedown', startDriveCommand);
        btn.addEventListener('mouseup', stopDriveCommand);
        btn.addEventListener('mouseleave', stopDriveCommand);
    });
}

let currentDriveCommand = null;
let driveTimeout = null;

function startDriveCommand(e) {
    const cmd = e.currentTarget.getAttribute('data-cmd');
    if (!cmd) return;
    
    currentDriveCommand = cmd;
    e.currentTarget.classList.add('active');
    
    const driveStatus = document.getElementById('driveStatusDisplay');
    if (driveStatus) driveStatus.innerHTML = `EXECUTING ${getCommandName(cmd)}...`;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'drive_command', command: cmd, duration: 0 }));
    }
    
    if (driveTimeout) clearTimeout(driveTimeout);
    driveTimeout = setTimeout(() => {
        if (currentDriveCommand) stopDriveCommand();
    }, 5000);
}

function stopDriveCommand(e) {
    if (!currentDriveCommand) return;
    
    const driveStatus = document.getElementById('driveStatusDisplay');
    if (driveStatus) driveStatus.innerHTML = 'STOPPED';
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'drive_command', command: 'STOP', duration: 0 }));
    }
    
    document.querySelectorAll('.drive-btn-gaming').forEach(btn => {
        btn.classList.remove('active');
    });
    
    currentDriveCommand = null;
    if (driveTimeout) clearTimeout(driveTimeout);
}

function getCommandName(cmd) {
    const names = { FORWARD: 'TIẾN', BACKWARD: 'LÙI', LEFT: 'TRÁI', RIGHT: 'PHẢI', STOP: 'DỪNG' };
    return names[cmd] || cmd;
}

// ========== TRANSLATE MODE FUNCTIONS ==========
function initTranslateMode() {
    console.log('Translate mode initialized');
    
    sourceLang = document.getElementById('sourceLang').value;
    targetLang = document.getElementById('targetLang').value;
    
    const swapBtn = document.getElementById('swapLangBtn');
    const speakBtn = document.getElementById('speakTranslationBtn');
    const clearBtn = document.getElementById('clearTranslationBtn');
    
    if (swapBtn) swapBtn.onclick = swapLanguages;
    if (speakBtn) speakBtn.onclick = speakCurrentTranslation;
    if (clearBtn) clearBtn.onclick = clearTranslation;
    
    startTranslationMode();
}

function toggleTranslatorMode() {
    isTranslatorMode = !isTranslatorMode;
    
    if (isTranslatorMode) {
        startTranslationMode();
        addMessage('ai', 'Đã bật chế độ phiên dịch real-time!');
        speak('Đã bật chế độ phiên dịch');
    } else {
        stopTranslationMode();
        addMessage('ai', 'Đã tắt chế độ phiên dịch.');
        speak('Đã tắt chế độ phiên dịch');
    }
}

function startTranslationMode() {
    if (translationRecognition) {
        try { translationRecognition.stop(); } catch(e) {}
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Trình duyệt không hỗ trợ!');
        return;
    }
    
    translationRecognition = new SpeechRecognition();
    translationRecognition.continuous = true;
    translationRecognition.interimResults = true;
    translationRecognition.lang = getLanguageCode(sourceLang);
    
    translationRecognition.onstart = () => {
        const statusElem = document.getElementById('translateStatusText');
        if (statusElem) {
            statusElem.innerHTML = 'LISTENING...';
        }
    };
    
    translationRecognition.onresult = async (event) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalText += event.results[i][0].transcript;
            }
        }
        
        if (finalText && finalText !== lastProcessedText) {
            const originalElem = document.getElementById('originalText');
            if (originalElem) originalElem.innerHTML = escapeHtml(finalText);
            
            if (translationTimeout) clearTimeout(translationTimeout);
            translationTimeout = setTimeout(async () => {
                const translated = await translateText(finalText, sourceLang, targetLang);
                const translatedElem = document.getElementById('translatedText');
                if (translatedElem) translatedElem.innerHTML = escapeHtml(translated);
                lastProcessedText = finalText;
            }, 500);
        }
    };
    
    translationRecognition.onerror = (event) => {
        console.error('Translation error:', event.error);
    };
    
    translationRecognition.onend = () => {
        if (isTranslatorMode) {
            setTimeout(() => {
                if (isTranslatorMode && translationRecognition) translationRecognition.start();
            }, 500);
        }
    };
    
    translationRecognition.start();
}

function stopTranslationMode() {
    if (translationRecognition) {
        translationRecognition.stop();
        translationRecognition = null;
    }
    if (translationTimeout) clearTimeout(translationTimeout);
}

async function translateText(text, source, target) {
    if (!text || text.trim() === '') return '';
    
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.responseData && data.responseData.translatedText) {
            let translated = data.responseData.translatedText;
            translated = translated.replace(/^\[ERROR\]\s*/, '');
            return translated;
        }
        return text;
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

function getLanguageCode(lang) {
    const codes = {
        'vi': 'vi-VN', 'en': 'en-US', 'zh': 'zh-CN', 'ja': 'ja-JP',
        'ko': 'ko-KR', 'fr': 'fr-FR', 'de': 'de-DE', 'es': 'es-ES'
    };
    return codes[lang] || 'en-US';
}

function swapLanguages() {
    const temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;
    
    const sourceSelect = document.getElementById('sourceLang');
    const targetSelect = document.getElementById('targetLang');
    if (sourceSelect) sourceSelect.value = sourceLang;
    if (targetSelect) targetSelect.value = targetLang;
    
    clearTranslation();
}

function clearTranslation() {
    const originalElem = document.getElementById('originalText');
    const translatedElem = document.getElementById('translatedText');
    if (originalElem) originalElem.innerHTML = 'AWAITING INPUT...';
    if (translatedElem) translatedElem.innerHTML = 'AWAITING INPUT...';
    lastProcessedText = '';
}

function speakCurrentTranslation() {
    const translatedElem = document.getElementById('translatedText');
    const text = translatedElem ? translatedElem.innerText : '';
    if (text && text !== 'AWAITING INPUT...') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getLanguageCode(targetLang);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

// ========== CAMERA MODE FUNCTIONS ==========
async function initCameraMode() {
    console.log('Camera mode initialized');
    
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    
    if (!videoElement || !canvasElement) {
        console.log('Camera elements not found');
        return;
    }
    
    // Kiểm tra thư viện FaceMesh đã load chưa
    if (typeof FaceMesh === 'undefined') {
        console.error('FaceMesh library not loaded yet');
        const statusText = document.getElementById('cameraStatusText');
        if (statusText) statusText.innerHTML = 'ERROR: LIBRARY NOT LOADED';
        return;
    }
    
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    
    faceMesh.setOptions({
        maxNumFaces: 4,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    faceMesh.onResults(onFaceMeshResults);
    
    const toggleBtn = document.getElementById('cameraToggleBtn');
    const registerBtn = document.getElementById('registerFaceBtn');
    const recognizeBtn = document.getElementById('recognizeFaceBtn');
    
    if (toggleBtn) toggleBtn.onclick = toggleCamera;
    if (registerBtn) registerBtn.onclick = openRegisterModal;
    if (recognizeBtn) recognizeBtn.onclick = startFaceRecognition;
}

async function toggleCamera() {
    if (!isCameraActive) {
        await startCamera();
    } else {
        stopCamera();
    }
}

async function startCamera() {
    if (!videoElement) return;
    
    try {
        if (typeof Camera === 'undefined') {
            console.error('Camera library not loaded');
            return;
        }
        
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isCameraActive && faceMesh) {
                    await faceMesh.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        isCameraActive = true;
        
        const toggleBtn = document.getElementById('cameraToggleBtn');
        const statusText = document.getElementById('cameraStatusText');
        const faceText = document.getElementById('faceText');
        
        if (toggleBtn) toggleBtn.textContent = 'TẮT CAMERA';
        if (statusText) statusText.innerHTML = 'ACTIVE';
        if (faceText) faceText.textContent = 'CAMERA ACTIVE';
        
        addMessage('ai', 'Camera đã được bật!');
    } catch (error) {
        console.error('Camera error:', error);
        addMessage('ai', 'Không thể bật camera!');
    }
}

function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    isCameraActive = false;
    
    const toggleBtn = document.getElementById('cameraToggleBtn');
    const statusText = document.getElementById('cameraStatusText');
    const faceText = document.getElementById('faceText');
    
    if (toggleBtn) toggleBtn.textContent = 'BẬT CAMERA';
    if (statusText) statusText.innerHTML = 'OFFLINE';
    if (faceText) faceText.textContent = 'CAMERA OFFLINE';
}

// ========== DETECT GLASSES AND HAT ==========
function detectGlasses(landmarks) {
    const leftEyeInner = landmarks[133];
    const leftEyeOuter = landmarks[33];
    const rightEyeInner = landmarks[362];
    const rightEyeOuter = landmarks[263];
    
    if (!leftEyeInner || !leftEyeOuter || !rightEyeInner || !rightEyeOuter) return false;
    
    const leftWidth = Math.hypot(leftEyeInner.x - leftEyeOuter.x, leftEyeInner.y - leftEyeOuter.y);
    const rightWidth = Math.hypot(rightEyeInner.x - rightEyeOuter.x, rightEyeInner.y - rightEyeOuter.y);
    const avgWidth = (leftWidth + rightWidth) / 2;
    
    const noseBridge = landmarks[168];
    const noseTip = landmarks[1];
    if (!noseBridge || !noseTip) return false;
    
    const noseHeight = Math.hypot(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);
    
    return avgWidth / noseHeight > 1.3;
}

function detectHat(landmarks) {
    const foreheadTop = landmarks[10];
    const leftCheek = landmarks[234];
    const chin = landmarks[152];
    
    if (!foreheadTop || !leftCheek || !chin) return false;
    
    const foreheadY = foreheadTop.y;
    const chinY = chin.y;
    const cheekY = leftCheek.y;
    
    const foreheadRatio = (cheekY - foreheadY) / (chinY - foreheadY);
    return foreheadRatio < 0.25;
}

// ========== FACE MESH RESULTS HANDLER ==========
function onFaceMeshResults(results) {
    if (!isCameraActive || !canvasElement) return;
    
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    let hasGlasses = false;
    let hasHat = false;
    let faceCount = 0;
    let recognizedNames = [];
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceCount = results.multiFaceLandmarks.length;
        
        for (let i = 0; i < results.multiFaceLandmarks.length; i++) {
            const landmarks = results.multiFaceLandmarks[i];
            const descriptor = extractFaceDescriptor(landmarks);
            
            drawLandmarks(canvasCtx, landmarks, i);
            
            const glasses = detectGlasses(landmarks);
            const hat = detectHat(landmarks);
            if (glasses) hasGlasses = true;
            if (hat) hasHat = true;
            
            let recognizedName = null;
            if (isRecognizing) {
                recognizedName = findMatchingFace(descriptor);
            }
            
            if (recognizedName) {
                recognizedNames.push(recognizedName);
                drawTextOnCanvas(canvasCtx, landmarks, recognizedName, '#00ff00', -40);
                
                const now = Date.now();
                const lastTime = lastRecognizedTime.get(recognizedName) || 0;
                if (now - lastTime > 30000) {
                    lastRecognizedTime.set(recognizedName, now);
                    const greeting = `Xin chào ${recognizedName}!`;
                    addMessage('ai', greeting);
                    if (isAwake && !isSpeaking && !isTranslatorMode) {
                        speak(greeting);
                    }
                }
            } else if (isRecognizing) {
                drawTextOnCanvas(canvasCtx, landmarks, 'Người lạ', '#ffaa00', -40);
            }
            
            if (glasses) drawTextOnCanvas(canvasCtx, landmarks, 'Có kính', '#ffff00', -60);
            if (hat) drawTextOnCanvas(canvasCtx, landmarks, 'Có mũ', '#ff8800', -80);
        }
        
        updateFaceUI(faceCount, hasGlasses, hasHat, recognizedNames);
    } else {
        updateFaceUI(0, false, false, []);
    }
    
    canvasCtx.restore();
}

function drawLandmarks(ctx, landmarks, index) {
    const colors = ['#00ff00', '#ff00ff', '#00ffff', '#ffff00'];
    const color = colors[index % colors.length];
    
    ctx.fillStyle = color;
    for (let i = 0; i < landmarks.length; i += 10) {
        const x = landmarks[i].x * canvasElement.width;
        const y = landmarks[i].y * canvasElement.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawTextOnCanvas(ctx, landmarks, text, color, yOffset = 0) {
    const nose = landmarks[1];
    if (!nose) return;
    const x = nose.x * canvasElement.width - 40;
    const y = nose.y * canvasElement.height - 50 + yOffset;
    
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function updateFaceUI(faceCount, hasGlasses, hasHat, recognizedNames) {
    const faceEmoji = document.getElementById('faceEmoji');
    const faceText = document.getElementById('faceText');
    const glassesStatus = document.getElementById('glassesStatus');
    const hatStatus = document.getElementById('hatStatus');
    const recognizedSpan = document.getElementById('recognizedPerson');
    
    if (!faceEmoji) return;
    
    if (faceCount === 0) {
        faceEmoji.textContent = '😔';
        if (faceText) faceText.textContent = 'No face detected';
        if (glassesStatus) glassesStatus.innerHTML = '🕶️ --';
        if (hatStatus) hatStatus.innerHTML = '🧢 --';
        if (recognizedSpan) recognizedSpan.innerHTML = '👤 --';
    } else {
        faceEmoji.textContent = faceCount > 1 ? '👥' : '😊';
        if (faceText) faceText.textContent = `${faceCount} face(s)`;
        if (glassesStatus) {
            glassesStatus.innerHTML = hasGlasses ? '🕶️ GLASSES ✅' : '👓 NO GLASSES';
            glassesStatus.style.background = hasGlasses ? '#4caf50' : '#666';
        }
        if (hatStatus) {
            hatStatus.innerHTML = hasHat ? '🧢 HAT ✅' : '⛑️ NO HAT';
            hatStatus.style.background = hasHat ? '#4caf50' : '#666';
        }
        
        if (recognizedSpan) {
            if (recognizedNames.length > 0) {
                recognizedSpan.innerHTML = `👤 ${recognizedNames.join(', ')}`;
                recognizedSpan.style.background = '#4caf50';
            } else if (isRecognizing) {
                recognizedSpan.innerHTML = '👤 Unknown';
                recognizedSpan.style.background = '#ff9800';
            } else {
                recognizedSpan.innerHTML = '👤 --';
                recognizedSpan.style.background = '#666';
            }
        }
    }
}

// ========== FACE RECOGNITION FUNCTIONS ==========
async function loadFaceDatabase() {
    try {
        const saved = localStorage.getItem('chiri_face_database');
        if (saved) {
            const data = JSON.parse(saved);
            for (const [name, descriptors] of Object.entries(data)) {
                faceDatabase.set(name, descriptors);
            }
            console.log(`Loaded ${faceDatabase.size} faces`);
        }
    } catch(e) { console.log('No saved face data'); }
}

function saveFaceDatabase() {
    const data = {};
    for (const [name, descriptors] of faceDatabase) {
        data[name] = descriptors;
    }
    localStorage.setItem('chiri_face_database', JSON.stringify(data));
}

function extractFaceDescriptor(landmarks) {
    const keyIndices = [1, 33, 61, 133, 152, 199, 263, 291, 362, 454];
    const descriptor = [];
    for (const idx of keyIndices) {
        if (landmarks[idx]) {
            descriptor.push(landmarks[idx].x, landmarks[idx].y, landmarks[idx].z || 0);
        }
    }
    return descriptor;
}

function compareFaces(desc1, desc2, threshold = 0.15) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return false;
    
    let sumSquaredDiff = 0;
    for (let i = 0; i < desc1.length; i++) {
        sumSquaredDiff += Math.pow(desc1[i] - desc2[i], 2);
    }
    const distance = Math.sqrt(sumSquaredDiff / desc1.length);
    return distance < threshold;
}

function findMatchingFace(descriptor) {
    let bestMatch = null;
    let bestDistance = 1;
    
    for (const [name, descriptors] of faceDatabase) {
        for (const savedDesc of descriptors) {
            if (compareFaces(descriptor, savedDesc)) {
                let distance = 0;
                for (let i = 0; i < descriptor.length; i++) {
                    distance += Math.abs(descriptor[i] - savedDesc[i]);
                }
                distance /= descriptor.length;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = name;
                }
            }
        }
    }
    return bestMatch;
}

function startFaceRecognition() {
    if (isRecognizing) {
        addMessage('ai', 'Already recognizing!');
        return;
    }
    
    isRecognizing = true;
    addMessage('ai', 'Starting face recognition...');
    speak('Bắt đầu nhận diện khuôn mặt');
}

// ========== FACE REGISTRATION ==========
function openRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.style.display = 'flex';
    capturedPhotos = [];
    updatePhotoCount();
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    startRegisterCamera();
}

function closeRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.style.display = 'none';
    
    if (registerVideoStream) {
        registerVideoStream.getTracks().forEach(track => track.stop());
        registerVideoStream = null;
    }
    
    if (isCameraActive) {
        setTimeout(() => startCamera(), 500);
    }
}

async function startRegisterCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        registerVideoStream = stream;
        
        const previewCanvas = document.getElementById('previewCanvas');
        if (!previewCanvas) return;
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        
        const ctx = previewCanvas.getContext('2d');
        
        const processFrame = () => {
            if (video.videoWidth > 0) {
                previewCanvas.width = video.videoWidth;
                previewCanvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
                
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.strokeRect(
                    previewCanvas.width * 0.2,
                    previewCanvas.height * 0.2,
                    previewCanvas.width * 0.6,
                    previewCanvas.height * 0.6
                );
                ctx.fillStyle = '#00ffff';
                ctx.font = '10px monospace';
                ctx.fillText('Place face in frame', previewCanvas.width * 0.35, previewCanvas.height * 0.15);
            }
            requestAnimationFrame(processFrame);
        };
        processFrame();
        
        window.registerVideo = video;
        
        const statusElem = document.getElementById('previewStatus');
        if (statusElem) {
            statusElem.innerHTML = 'Camera ready';
            statusElem.style.color = '#00ffff';
        }
        
    } catch (error) {
        console.error('Register camera error:', error);
        const statusElem = document.getElementById('previewStatus');
        if (statusElem) {
            statusElem.innerHTML = 'Camera error!';
            statusElem.style.color = '#ff4444';
        }
    }
}

function capturePhoto() {
    if (capturedPhotos.length >= 3) {
        alert('Already captured 3 photos!');
        return;
    }
    
    capturedPhotos.push([Date.now()]);
    updatePhotoCount();
    
    const previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
        const ctx = previewCanvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    
    const statusElem = document.getElementById('previewStatus');
    if (statusElem) {
        statusElem.innerHTML = `Captured ${capturedPhotos.length}/3`;
    }
}

function updatePhotoCount() {
    const countElem = document.getElementById('photoCount');
    if (countElem) countElem.innerHTML = `📸 ${capturedPhotos.length}/3 CAPTURED`;
}

function saveFaceRegistration() {
    const name = document.getElementById('faceNameInput').value.trim();
    if (!name) {
        alert('Enter username!');
        return;
    }
    if (capturedPhotos.length < 3) {
        alert('Capture 3 photos first!');
        return;
    }
    
    if (!faceDatabase.has(name)) {
        faceDatabase.set(name, []);
    }
    faceDatabase.get(name).push([Date.now()]);
    saveFaceDatabase();
    
    addMessage('ai', `Registered Face ID for ${name}`);
    speak(`Đã đăng ký Face ID cho ${name}`);
    
    closeRegisterModal();
    document.getElementById('faceNameInput').value = '';
}

// ========== LOGIN ==========
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!username || !password) {
        if (errorDiv) errorDiv.textContent = 'Please enter username and password!';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (data.success) {
            currentUser = { username: data.username, name: data.name };
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
            document.getElementById('userNameDisplay').innerHTML = `👤 ${data.name}`;
            
            loadFaceDatabase();
            connectWebSocket();
            
            // Mode card click handlers
            document.querySelectorAll('.mode-card').forEach(card => {
                card.onclick = () => {
                    const mode = card.getAttribute('data-mode');
                    if (mode === 'chat') showChatMode();
                    else if (mode === 'drive') showDriveMode();
                    else if (mode === 'translate') showTranslateMode();
                    else if (mode === 'camera') showCameraMode();
                };
            });
            
            // Back button handlers
            document.querySelectorAll('.back-btn').forEach(btn => {
                btn.onclick = showModeScreen;
            });
            
            // Manual wake button
            const manualWakeBtn = document.getElementById('manualWakeBtn');
            if (manualWakeBtn) {
                manualWakeBtn.onclick = () => {
                    if (!isAwake) wakeUp();
                    else {
                        addMessage('ai', 'Chiri is awake!');
                        speak('Chiri is awake!');
                    }
                };
            }
            
            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = () => {
                    if (isTranslatorMode) stopTranslationMode();
                    if (isCameraActive) stopCamera();
                    if (ws) ws.close();
                    if (recognition) recognition.stop();
                    if (inactivityInterval) clearInterval(inactivityInterval);
                    
                    document.getElementById('modeScreen').style.display = 'none';
                    document.getElementById('loginScreen').style.display = 'flex';
                    document.getElementById('loginUsername').value = '';
                    document.getElementById('loginPassword').value = '';
                };
            }
            
            // Modal close button
            const closeModalBtn = document.getElementById('closeModalBtn');
            if (closeModalBtn) closeModalBtn.onclick = closeRegisterModal;
            
            // Capture and save buttons
            const captureBtn = document.getElementById('capturePhotoBtn');
            if (captureBtn) captureBtn.onclick = capturePhoto;
            
            const saveBtn = document.getElementById('saveFaceBtn');
            if (saveBtn) saveBtn.onclick = saveFaceRegistration;
            
            startInactivityCountdown();
            
        } else {
            if (errorDiv) errorDiv.textContent = data.message;
        }
    } catch(e) {
        console.error('Login error:', e);
        if (errorDiv) errorDiv.textContent = 'Connection error!';
    }
}

// Initialize
document.getElementById('loginBtn').onclick = login;
document.getElementById('loginPassword').onkeypress = (e) => {
    if (e.key === 'Enter') login();
};

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('registerModal');
    if (event.target === modal) closeRegisterModal();
}

// Export functions to window for global access
window.initChatMode = initChatMode;
window.initDriveMode = initDriveMode;
window.initTranslateMode = initTranslateMode;
window.initCameraMode = initCameraMode;
window.stopTranslationMode = stopTranslationMode;
window.stopCamera = stopCamera;
window.recognition = recognition;
