// ========== MODE SELECTION & NAVIGATION ==========
// Thêm vào đầu file, trước tất cả các biến global

// Hàm chuyển đổi giữa các màn hình
function showModeScreen() {
    document.getElementById('modeScreen').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    
    // Dừng các chế độ đang chạy
    if (isTranslatorMode) toggleTranslatorMode();
    if (isCameraActive) stopCamera();
    if (recognition) recognition.stop();
}

function showChatMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    
    // Khởi tạo lại chat mode
    if (recognition) recognition.stop();
    initSpeechRecognition();
}

function showDriveMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'block';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'none';
    
    // Đảm bảo drive mode được bật
    if (!driveControlMode) {
        driveControlMode = true;
        document.getElementById('driveModeBtn').innerHTML = '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        document.getElementById('driveModeBtn').classList.add('active');
        document.getElementById('driveControls').style.display = 'block';
    }
}

function showTranslateMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'block';
    document.getElementById('cameraPanel').style.display = 'none';
    
    // Bật chế độ dịch
    if (!isTranslatorMode) toggleTranslatorMode();
}

function showCameraMode() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('chatPanel').style.display = 'none';
    document.getElementById('drivePanel').style.display = 'none';
    document.getElementById('translatePanel').style.display = 'none';
    document.getElementById('cameraPanel').style.display = 'block';
    
    // Khởi tạo camera
    initFaceMesh();
}

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
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

// Translation variables
let isTranslatorMode = false;
let sourceLang = 'vi';
let targetLang = 'en';
let isVoiceToVoiceMode = true;
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
let recognizedFaces = new Map();
let currentFaceDescriptors = [];

// Register mode
let isRegisterMode = false;
let capturedPhotos = [];
let registerVideoStream = null;

const INACTIVITY_LIMIT = 60000;
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi'];

// ========== TRANSLATION FUNCTIONS ==========
async function translateText(text, source, target) {
    if (!text || text.trim() === '') return '';
    
    try {
        // Sử dụng API dịch miễn phí (MyMemory)
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.responseData && data.responseData.translatedText) {
            let translated = data.responseData.translatedText;
            // Xóa thông báo lỗi nếu có
            translated = translated.replace(/^\[ERROR\]\s*/, '');
            return translated;
        }
        return text;
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

function toggleTranslatorMode() {
    isTranslatorMode = !isTranslatorMode;
    const panel = document.getElementById('translatorPanel');
    const btn = document.getElementById('translatorModeBtn');
    
    if (isTranslatorMode) {
        panel.style.display = 'block';
        btn.classList.add('active');
        btn.innerHTML = '🌐 ĐANG PHIÊN DỊCH...';
        startTranslationMode();
        addMessage('ai', '🌐 Đã bật chế độ phiên dịch real-time! Chọn ngôn ngữ và bắt đầu nói.');
        speak('Đã bật chế độ phiên dịch real time');
    } else {
        panel.style.display = 'none';
        btn.classList.remove('active');
        btn.innerHTML = '🌐 PHIÊN DỊCH REAL-TIME';
        stopTranslationMode();
        addMessage('ai', '🌐 Đã tắt chế độ phiên dịch.');
        speak('Đã tắt chế độ phiên dịch');
    }
}

function startTranslationMode() {
    if (translationRecognition) {
        try { translationRecognition.stop(); } catch(e) {}
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Trình duyệt không hỗ trợ nhận diện giọng nói!');
        return;
    }
    
    translationRecognition = new SpeechRecognition();
    translationRecognition.continuous = true;
    translationRecognition.interimResults = true;
    translationRecognition.lang = getLanguageCode(sourceLang);
    
    translationRecognition.onstart = () => {
        document.getElementById('translationStatus').innerHTML = '🎤 Đang lắng nghe... Hãy nói!';
        document.getElementById('translationStatus').style.color = '#4caf50';
    };
    
    translationRecognition.onresult = async (event) => {
        let interimText = '';
        let finalText = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalText += transcript;
            } else {
                interimText += transcript;
            }
        }
        
        const displayText = finalText || interimText;
        if (displayText && displayText !== lastProcessedText) {
            // Hiển thị nguyên bản
            document.getElementById('originalText').innerHTML = escapeHtml(displayText);
            
            // Debounce translation
            if (translationTimeout) clearTimeout(translationTimeout);
            translationTimeout = setTimeout(async () => {
                const translated = await translateText(displayText, sourceLang, targetLang);
                document.getElementById('translatedText').innerHTML = escapeHtml(translated);
                
                // Tự động đọc bản dịch nếu ở chế độ voice-to-voice
                if (isVoiceToVoiceMode && finalText && translated && translated !== displayText) {
                    await speakTranslation(translated);
                }
                
                lastProcessedText = displayText;
            }, 500);
        }
    };
    
    translationRecognition.onerror = (event) => {
        console.error('Translation recognition error:', event.error);
        document.getElementById('translationStatus').innerHTML = `⚠️ Lỗi: ${event.error}`;
        document.getElementById('translationStatus').style.color = '#ff4444';
    };
    
    translationRecognition.onend = () => {
        if (isTranslatorMode) {
            document.getElementById('translationStatus').innerHTML = '🔄 Đang khởi động lại...';
            setTimeout(() => {
                if (isTranslatorMode) translationRecognition.start();
            }, 500);
        } else {
            document.getElementById('translationStatus').innerHTML = '⏸️ Đã dừng phiên dịch';
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

async function speakTranslation(text) {
    if (!text || isSpeaking) return;
    
    try {
        const lang = targetLang;
        const ttsLang = getTTSLanguage(lang);
        const response = await fetch(`/tts?text=${encodeURIComponent(text.slice(0, 300))}&lang=${ttsLang}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            audio.play();
        } else {
            // Fallback browser TTS
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = ttsLang;
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    } catch(e) {
        console.error('Speak translation error:', e);
    }
}

function updateTranslationLanguage() {
    sourceLang = document.getElementById('sourceLang').value;
    targetLang = document.getElementById('targetLang').value;
    
    if (isTranslatorMode && translationRecognition) {
        // Restart recognition with new language
        translationRecognition.lang = getLanguageCode(sourceLang);
        translationRecognition.stop();
        setTimeout(() => translationRecognition.start(), 500);
    }
    
    // Update display
    const translatedBoxHeader = document.querySelector('#translatePanel .translated-box .box-header-gaming');
    if (translatedBoxHeader) {
        translatedBoxHeader.innerHTML = `🌐 Dịch sang ${getLanguageName(targetLang)}`;
    }
}

function swapLanguages() {
    const temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;
    
    document.getElementById('sourceLang').value = sourceLang;
    document.getElementById('targetLang').value = targetLang;
    
    updateTranslationLanguage();
    
    // Clear display
    document.getElementById('originalText').innerHTML = 'Chưa có dữ liệu...';
    document.getElementById('translatedText').innerHTML = 'Chưa có dữ liệu...';
}

function getLanguageCode(lang) {
    const codes = {
        'vi': 'vi-VN',
        'en': 'en-US',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'es': 'es-ES'
    };
    return codes[lang] || 'en-US';
}

function getLanguageName(lang) {
    const names = {
        'vi': 'Tiếng Việt',
        'en': 'Tiếng Anh',
        'zh': 'Tiếng Trung',
        'ja': 'Tiếng Nhật',
        'ko': 'Tiếng Hàn',
        'fr': 'Tiếng Pháp',
        'de': 'Tiếng Đức',
        'es': 'Tiếng Tây Ban Nha'
    };
    return names[lang] || lang;
}

function getTTSLanguage(lang) {
    const ttsMap = {
        'vi': 'vi',
        'en': 'en',
        'zh': 'zh',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'de': 'de',
        'es': 'es'
    };
    return ttsMap[lang] || 'en';
}

function setVoiceToVoiceMode(active) {
    isVoiceToVoiceMode = active;
    const voiceBtn = document.getElementById('voiceToVoiceMode');
    const listenBtn = document.getElementById('listenOnlyMode');
    if (voiceBtn) voiceBtn.classList.toggle('active', active);
    if (listenBtn) listenBtn.classList.toggle('active', !active);
}

function clearTranslation() {
    document.getElementById('originalText').innerHTML = 'Chưa có dữ liệu...';
    document.getElementById('translatedText').innerHTML = 'Chưa có dữ liệu...';
    lastProcessedText = '';
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
            console.log(`✅ Loaded ${faceDatabase.size} faces from database`);
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
    const keyIndices = [
        1, 33, 61, 133, 152, 199, 263, 291, 362, 454,
        10, 338, 297, 332, 284, 251, 389, 356,
        46, 53, 55, 65, 66, 69, 70, 105, 107,
        266, 276, 283, 285, 295, 296, 299, 300, 334, 336
    ];
    
    const descriptor = [];
    for (const idx of keyIndices) {
        if (landmarks[idx]) {
            descriptor.push(landmarks[idx].x, landmarks[idx].y, landmarks[idx].z || 0);
        }
    }
    return descriptor;
}

function compareFaces(desc1, desc2, threshold = 0.12) {
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
            if (compareFaces(descriptor, savedDesc, 0.12)) {
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

// ========== FACE MESH INIT ==========
async function initFaceMesh() {
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    
    if (!videoElement || !canvasElement) {
        console.log('Camera elements not found');
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
        const camBtn = document.getElementById('cameraToggleBtn');
        if (camBtn) camBtn.textContent = '📷 TẮT CAMERA';
        const faceText = document.getElementById('faceText');
        if (faceText) faceText.textContent = '📷 Đang nhận diện...';
        
        addMessage('ai', '📷 Camera đã được bật! Chiri đang nhìn thấy bạn!');
    } catch (error) {
        console.error('Camera error:', error);
        addMessage('ai', '⚠️ Không thể bật camera!');
    }
}

function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    isCameraActive = false;
    const camBtn = document.getElementById('cameraToggleBtn');
    if (camBtn) camBtn.textContent = '📷 BẬT CAMERA';
    const faceText = document.getElementById('faceText');
    if (faceText) faceText.textContent = 'Camera đã tắt';
}

// ========== FACE REGISTRATION MODAL ==========
function openRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.style.display = 'flex';
    capturedPhotos = [];
    currentFaceDescriptors = [];
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
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        registerVideoStream = stream;
        
        const previewCanvas = document.getElementById('previewCanvas');
        if (!previewCanvas) return;
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        
        const ctx = previewCanvas.getContext('2d');
        const drawInterval = setInterval(() => {
            if (video.videoWidth > 0) {
                previewCanvas.width = video.videoWidth;
                previewCanvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
                
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.strokeRect(
                    previewCanvas.width * 0.2,
                    previewCanvas.height * 0.2,
                    previewCanvas.width * 0.6,
                    previewCanvas.height * 0.6
                );
                ctx.fillStyle = '#00ff00';
                ctx.font = '14px Arial';
                ctx.fillText('Đặt khuôn mặt vào khung', previewCanvas.width * 0.3, previewCanvas.height * 0.15);
            }
        }, 100);
        
        window.registerDrawInterval = drawInterval;
        
        const registerFaceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        registerFaceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5
        });
        
        registerFaceMesh.onResults((results) => {
            if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                const statusElem = document.getElementById('previewStatus');
                if (statusElem) {
                    statusElem.innerHTML = '✅ Đã phát hiện khuôn mặt! Nhấn "CHỤP ẢNH"';
                    statusElem.style.color = '#4caf50';
                }
                window.currentRegisterDescriptor = extractFaceDescriptor(results.multiFaceLandmarks[0]);
            } else {
                const statusElem = document.getElementById('previewStatus');
                if (statusElem) {
                    statusElem.innerHTML = '⚠️ Chưa thấy khuôn mặt. Hãy nhìn vào camera!';
                    statusElem.style.color = '#ffaa00';
                }
            }
        });
        
        const processFrame = async () => {
            if (video.videoWidth > 0 && registerFaceMesh) {
                await registerFaceMesh.send({ image: video });
            }
            requestAnimationFrame(processFrame);
        };
        processFrame();
        
        window.registerFaceMesh = registerFaceMesh;
        window.registerVideo = video;
        
    } catch (error) {
        console.error('Register camera error:', error);
        const statusElem = document.getElementById('previewStatus');
        if (statusElem) {
            statusElem.innerHTML = '❌ Không thể mở camera!';
            statusElem.style.color = '#ff4444';
        }
    }
}

function capturePhoto() {
    if (!window.currentRegisterDescriptor) {
        alert('Vui lòng nhìn vào camera để phát hiện khuôn mặt!');
        return;
    }
    
    if (capturedPhotos.length >= 3) {
        alert('Đã chụp đủ 3 ảnh! Nhấn "LƯU FACE ID" để hoàn tất.');
        return;
    }
    
    capturedPhotos.push([...window.currentRegisterDescriptor]);
    currentFaceDescriptors.push([...window.currentRegisterDescriptor]);
    updatePhotoCount();
    
    const previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
        const ctx = previewCanvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    
    const statusElem = document.getElementById('previewStatus');
    if (statusElem) {
        statusElem.innerHTML = `✅ Đã chụp ảnh ${capturedPhotos.length}/3!`;
    }
    
    if (capturedPhotos.length === 3) {
        const statusElem = document.getElementById('previewStatus');
        if (statusElem) {
            statusElem.innerHTML = '🎉 Đã chụp đủ 3 ảnh! Nhấn "LƯU FACE ID" để hoàn tất.';
        }
    }
}

function updatePhotoCount() {
    const countElem = document.getElementById('photoCount');
    if (countElem) countElem.innerHTML = `Đã chụp: ${capturedPhotos.length}/3 ảnh`;
}

function saveFaceRegistration() {
    const name = document.getElementById('faceNameInput').value.trim();
    
    if (!name) {
        alert('Vui lòng nhập tên người dùng!');
        return;
    }
    
    if (capturedPhotos.length < 3) {
        alert('Vui lòng chụp đủ 3 ảnh khuôn mặt!');
        return;
    }
    
    const avgDescriptor = [];
    for (let i = 0; i < capturedPhotos[0].length; i++) {
        let sum = 0;
        for (let j = 0; j < capturedPhotos.length; j++) {
            sum += capturedPhotos[j][i];
        }
        avgDescriptor.push(sum / capturedPhotos.length);
    }
    
    if (!faceDatabase.has(name)) {
        faceDatabase.set(name, []);
    }
    faceDatabase.get(name).push(avgDescriptor);
    saveFaceDatabase();
    
    addMessage('ai', `✅ Đã đăng ký Face ID cho ${name} thành công!`);
    speak(`Đã đăng ký Face ID cho ${name}`);
    
    closeRegisterModal();
    document.getElementById('faceNameInput').value = '';
}

// ========== FACE RECOGNITION ==========
let isRecognizing = false;
let lastRecognizedTime = new Map();

function startFaceRecognition() {
    if (isRecognizing) {
        addMessage('ai', '🔍 Chiri đang nhận diện rồi!');
        return;
    }
    
    isRecognizing = true;
    addMessage('ai', '🔍 Bắt đầu nhận diện khuôn mặt...');
    speak('Bắt đầu nhận diện khuôn mặt');
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
                drawText(canvasCtx, landmarks, `👤 ${recognizedName}`, '#00ff00', -40);
                
                const now = Date.now();
                const lastTime = lastRecognizedTime.get(recognizedName) || 0;
                if (now - lastTime > 30000) {
                    lastRecognizedTime.set(recognizedName, now);
                    const greeting = `Xin chào ${recognizedName}!`;
                    addMessage('ai', `👋 ${greeting}`);
                    if (isAwake && !isSpeaking && !isTranslatorMode) {
                        speak(greeting);
                    }
                }
            } else if (isRecognizing) {
                drawText(canvasCtx, landmarks, '👤 Người lạ', '#ffaa00', -40);
            }
            
            if (glasses) drawText(canvasCtx, landmarks, '👓 Có kính', '#ffff00', -60);
            if (hat) drawText(canvasCtx, landmarks, '🧢 Có mũ', '#ff8800', -80);
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
    for (let i = 0; i < landmarks.length; i += 5) {
        const x = landmarks[i].x * canvasElement.width;
        const y = landmarks[i].y * canvasElement.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawText(ctx, landmarks, text, color, yOffset = 0) {
    const nose = landmarks[1];
    const x = nose.x * canvasElement.width - 40;
    const y = nose.y * canvasElement.height - 50 + yOffset;
    
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = color;
    ctx.shadowBlur = 0;
    ctx.fillText(text, x, y);
}

function detectGlasses(landmarks) {
    const leftEyeInner = landmarks[133];
    const leftEyeOuter = landmarks[33];
    const rightEyeInner = landmarks[362];
    const rightEyeOuter = landmarks[263];
    
    const leftWidth = Math.hypot(leftEyeInner.x - leftEyeOuter.x, leftEyeInner.y - leftEyeOuter.y);
    const rightWidth = Math.hypot(rightEyeInner.x - rightEyeOuter.x, rightEyeInner.y - rightEyeOuter.y);
    const avgWidth = (leftWidth + rightWidth) / 2;
    
    const noseBridge = landmarks[168];
    const noseTip = landmarks[1];
    const noseHeight = Math.hypot(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);
    
    return avgWidth / noseHeight > 1.3;
}

function detectHat(landmarks) {
    const foreheadTop = landmarks[10];
    const leftCheek = landmarks[234];
    const chin = landmarks[152];
    
    const foreheadY = foreheadTop.y;
    const chinY = chin.y;
    const cheekY = leftCheek.y;
    
    const foreheadRatio = (cheekY - foreheadY) / (chinY - foreheadY);
    return foreheadRatio < 0.25;
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
        if (faceText) faceText.textContent = 'Chưa có khuôn mặt';
        if (glassesStatus) glassesStatus.innerHTML = '🕶️ --';
        if (hatStatus) hatStatus.innerHTML = '🧢 --';
        if (recognizedSpan) recognizedSpan.innerHTML = '👤 --';
    } else {
        faceEmoji.textContent = faceCount > 1 ? '👥' : '😊';
        if (faceText) faceText.textContent = `${faceCount} khuôn mặt`;
        if (glassesStatus) {
            glassesStatus.innerHTML = hasGlasses ? '🕶️ CÓ KÍNH ✅' : '👓 KHÔNG KÍNH';
            glassesStatus.style.background = hasGlasses ? '#4caf50' : '#666';
        }
        if (hatStatus) {
            hatStatus.innerHTML = hasHat ? '🧢 CÓ MŨ ✅' : '⛑️ KHÔNG MŨ';
            hatStatus.style.background = hasHat ? '#4caf50' : '#666';
        }
        
        if (recognizedSpan) {
            if (recognizedNames.length > 0) {
                recognizedSpan.innerHTML = `👤 ${recognizedNames.join(', ')}`;
                recognizedSpan.style.background = '#4caf50';
            } else if (isRecognizing) {
                recognizedSpan.innerHTML = '👤 Người lạ';
                recognizedSpan.style.background = '#ff9800';
            } else {
                recognizedSpan.innerHTML = '👤 --';
                recognizedSpan.style.background = '#666';
            }
        }
    }
}

// ========== SPEECH & UI FUNCTIONS ==========
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
    const wakeText = document.getElementById('wakeText');
    
    if (state === 'listening') {
        if (wakeDot) wakeDot.classList.add('listening');
        if (wakeText) wakeText.innerHTML = '🎤 Đang lắng nghe...';
    } else if (state === 'awake') {
        if (wakeDot) {
            wakeDot.classList.remove('listening');
            wakeDot.style.background = '#f39c12';
        }
        if (wakeText) wakeText.innerHTML = '💬 Đang thức';
    } else {
        if (wakeDot) {
            wakeDot.classList.remove('listening');
            wakeDot.style.background = '#2ecc71';
        }
        if (wakeText) wakeText.innerHTML = '😴 Đang ngủ';
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
    if (isTranslatorMode) return; // Không đọc trong chế độ dịch để tránh xung đột
    
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
    
    const greeting = driveControlMode 
        ? 'Chào bạn! Chế độ lái xe đang bật!'
        : 'Chào bạn! Chiri đã thức!';
    
    addMessage('ai', greeting);
    if (!isTranslatorMode) speak(greeting);
    
    startInactivityCountdown();
}

function goToSleep() {
    if (!isAwake) return;
    isAwake = false;
    isListening = false;
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
            if (timerElem) timerElem.innerHTML = '😴 Sẽ ngủ sau 60s';
            return;
        }
        
        if (inactivitySeconds <= 0) {
            clearInterval(inactivityInterval);
            goToSleep();
        } else {
            const timerElem = document.getElementById('sleepTimer');
            if (timerElem) timerElem.innerHTML = `😴 Sẽ ngủ sau ${inactivitySeconds}s`;
            inactivitySeconds--;
        }
    }, 1000);
}

// ========== DRIVE CONTROL ==========
let currentDriveCommand = null;
let driveStartTime = null;

function startDriveCommand(e) {
    const cmd = e.currentTarget.getAttribute('data-cmd');
    if (!cmd) return;
    
    currentDriveCommand = cmd;
    driveStartTime = Date.now();
    
    e.currentTarget.classList.add('active');
    const driveStatus = document.getElementById('driveStatus');
    if (driveStatus) {
        driveStatus.innerHTML = `🚗 ĐANG ${getCommandName(cmd)}...`;
        driveStatus.style.background = '#4caf50';
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'drive_command', command: cmd, duration: 0 }));
    }
    
    if (window.driveTimeout) clearTimeout(window.driveTimeout);
    window.driveTimeout = setTimeout(() => {
        if (currentDriveCommand) stopDriveCommand();
    }, 5000);
}

function stopDriveCommand(e) {
    if (!currentDriveCommand) return;
    
    const duration = Date.now() - driveStartTime;
    const driveStatus = document.getElementById('driveStatus');
    if (driveStatus) {
        driveStatus.innerHTML = `⏸️ Đã dừng sau ${Math.round(duration/1000)}s`;
        driveStatus.style.background = '#666';
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'drive_command', command: 'STOP', duration: 0 }));
    }
    
    document.querySelectorAll('.drive-arrow, .drive-btn-gaming').forEach(btn => {
        btn.classList.remove('active');
    });
    
    currentDriveCommand = null;
    if (window.driveTimeout) clearTimeout(window.driveTimeout);
}

function getCommandName(cmd) {
    const names = { FORWARD: 'TIẾN', BACKWARD: 'LÙI', LEFT: 'TRÁI', RIGHT: 'PHẢI', STOP: 'DỪNG' };
    return names[cmd] || cmd;
}

function toggleDriveMode() {
    if (isTranslatorMode) {
        addMessage('ai', '⚠️ Vui lòng tắt chế độ phiên dịch trước khi bật điều khiển xe!');
        return;
    }
    
    driveControlMode = !driveControlMode;
    const driveBtn = document.getElementById('driveModeBtn');
    const driveControls = document.getElementById('driveControls');
    
    if (driveControlMode) {
        if (driveBtn) {
            driveBtn.innerHTML = '🚗 TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE';
            driveBtn.classList.add('active');
        }
        if (driveControls) driveControls.style.display = 'block';
        const chatBtn = document.getElementById('chatModeBtn');
        if (chatBtn) chatBtn.classList.remove('active');
        addMessage('ai', 'Đã bật chế độ lái xe! Dùng nút bấm hoặc giọng nói: TIẾN, LÙI, TRÁI, PHẢI, DỪNG');
        if (!isTranslatorMode) speak('Đã bật chế độ lái xe!');
    } else {
        if (driveBtn) {
            driveBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
            driveBtn.classList.remove('active');
        }
        if (driveControls) driveControls.style.display = 'none';
        addMessage('ai', 'Đã tắt chế độ lái xe!');
        if (!isTranslatorMode) speak('Đã tắt chế độ lái xe!');
    }
}

function enableChatMode() {
    if (isTranslatorMode) {
        addMessage('ai', '⚠️ Vui lòng tắt chế độ phiên dịch trước!');
        return;
    }
    
    if (driveControlMode) {
        driveControlMode = false;
        const driveBtn = document.getElementById('driveModeBtn');
        const driveControls = document.getElementById('driveControls');
        if (driveBtn) driveBtn.innerHTML = '🚗 BẬT CHẾ ĐỘ ĐIỀU KHIỂN XE';
        if (driveBtn) driveBtn.classList.remove('active');
        if (driveControls) driveControls.style.display = 'none';
        const chatBtn = document.getElementById('chatModeBtn');
        if (chatBtn) chatBtn.classList.add('active');
        addMessage('ai', 'Đã chuyển sang chế độ trò chuyện! 💬');
        speak('Đã chuyển sang chế độ trò chuyện!');
    }
}

// ========== SPEECH RECOGNITION FOR CHAT MODE ==========
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Trình duyệt không hỗ trợ!');
        return;
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
        console.log('🎙️:', transcript);
        
        if (!transcript) return;
        
        // Voice commands for translator
        const lower = transcript.toLowerCase();
        if (lower.includes('bật phiên dịch') || lower.includes('bật dịch')) {
            if (!isTranslatorMode) toggleTranslatorMode();
            return;
        }
        if (lower.includes('tắt phiên dịch') || lower.includes('tắt dịch')) {
            if (isTranslatorMode) toggleTranslatorMode();
            return;
        }
        
        if (isTranslatorMode) return; // Translator handles its own recognition
        
        if (!isAwake) {
            if (WAKE_WORDS.some(w => lower.includes(w))) wakeUp();
            return;
        }
        
        if (!isSpeaking && !isAIProcessing) {
            if (lower.includes('nhận diện') || lower.includes('face id')) {
                startFaceRecognition();
                return;
            }
            
            if (driveControlMode) {
                let command = null;
                if (lower.includes('tiến')) command = 'FORWARD';
                else if (lower.includes('lùi')) command = 'BACKWARD';
                else if (lower.includes('trái')) command = 'LEFT';
                else if (lower.includes('phải')) command = 'RIGHT';
                else if (lower.includes('dừng')) command = 'STOP';
                
                if (command) {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'drive_command', command: command, duration: 0 }));
                        addMessage('user', transcript);
                        addMessage('ai', `🚗 ${getCommandName(command)}!`);
                        speak(`${getCommandName(command)}!`);
                    }
                    return;
                }
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
        ws.send(JSON.stringify({ type: 'voice', text: text, driveMode: driveControlMode }));
    } else {
        addMessage('ai', 'Mất kết nối!');
        isAIProcessing = false;
    }
}

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('✅ WebSocket connected');
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

// ========== LOGIN & INIT ==========
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
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
            
            // Gắn sự kiện cho các mode card
            document.querySelectorAll('.mode-card').forEach(card => {
                card.addEventListener('click', () => {
                    const mode = card.getAttribute('data-mode');
                    if (mode === 'chat') showChatMode();
                    else if (mode === 'drive') showDriveMode();
                    else if (mode === 'translate') showTranslateMode();
                    else if (mode === 'camera') showCameraMode();
                });
            });
            
            // Gắn sự kiện cho các nút back
            document.querySelectorAll('.back-btn, .back-mode-btn').forEach(btn => {
                btn.addEventListener('click', showModeScreen);
            });
            
            // Khởi tạo app sau khi đăng nhập
            initApp();
        } else {
            errorDiv.textContent = data.message;
        }
    } catch(e) {
        errorDiv.textContent = 'Lỗi kết nối server!';
    }
}

async function initApp() {
    console.log('🚀 Chiri AI v11.0 - Real-time Translation + Face ID');
    await loadFaceDatabase();
    
    // Đảm bảo mainApp được hiển thị (cho chat mode)
    document.getElementById('mainApp').style.display = 'block';
    
    updateWakeIndicator('sleeping');
    setExpression('sleepy');
    
    connectWebSocket();
    initSpeechRecognition();
    initFaceMesh();
    
    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('chatModeBtn').addEventListener('click', enableChatMode);
    document.getElementById('driveModeBtn').addEventListener('click', toggleDriveMode);
    document.getElementById('cameraToggleBtn').addEventListener('click', toggleCamera);
    document.getElementById('registerFaceBtn').addEventListener('click', openRegisterModal);
    document.getElementById('recognizeFaceBtn').addEventListener('click', startFaceRecognition);
    document.getElementById('manualWake').addEventListener('click', () => {
        if (!isAwake) wakeUp();
        else {
            addMessage('ai', 'Chiri đây! Bạn cần gì ạ?');
            if (!isTranslatorMode) speak('Chiri đây! Bạn cần gì ạ?');
        }
    });
    
    // Translator event listeners
    const translatorBtn = document.getElementById('translatorModeBtn');
    if (translatorBtn) translatorBtn.addEventListener('click', toggleTranslatorMode);
    const closeTranslatorBtn = document.getElementById('closeTranslatorBtn');
    if (closeTranslatorBtn) closeTranslatorBtn.addEventListener('click', toggleTranslatorMode);
    const sourceLangSelect = document.getElementById('sourceLang');
    if (sourceLangSelect) sourceLangSelect.addEventListener('change', updateTranslationLanguage);
    const targetLangSelect = document.getElementById('targetLang');
    if (targetLangSelect) targetLangSelect.addEventListener('change', updateTranslationLanguage);
    const swapBtn = document.getElementById('swapLangBtn');
    if (swapBtn) swapBtn.addEventListener('click', swapLanguages);
    const voiceBtn = document.getElementById('voiceToVoiceMode');
    if (voiceBtn) voiceBtn.addEventListener('click', () => setVoiceToVoiceMode(true));
    const listenBtn = document.getElementById('listenOnlyMode');
    if (listenBtn) listenBtn.addEventListener('click', () => setVoiceToVoiceMode(false));
    const speakTransBtn = document.getElementById('speakTranslationBtn');
    if (speakTransBtn) speakTransBtn.addEventListener('click', () => {
        const translated = document.getElementById('translatedText').innerText;
        if (translated && translated !== 'Chưa có dữ liệu...') {
            speakTranslation(translated);
        }
    });
    const clearTransBtn = document.getElementById('clearTranslationBtn');
    if (clearTransBtn) clearTransBtn.addEventListener('click', clearTranslation);
    
    // Modal events
    const closeModal = document.querySelector('.close-modal, .close-modal-gaming');
    if (closeModal) closeModal.addEventListener('click', closeRegisterModal);
    const captureBtn = document.getElementById('capturePhotoBtn');
    if (captureBtn) captureBtn.addEventListener('click', capturePhoto);
    const saveBtn = document.getElementById('saveFaceBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveFaceRegistration);
    
    // Drive control buttons
    document.querySelectorAll('.drive-arrow, .drive-btn-gaming').forEach(btn => {
        btn.addEventListener('mousedown', startDriveCommand);
        btn.addEventListener('mouseup', stopDriveCommand);
        btn.addEventListener('mouseleave', stopDriveCommand);
        btn.addEventListener('touchstart', startDriveCommand);
        btn.addEventListener('touchend', stopDriveCommand);
    });
    
    startInactivityCountdown();
}

function logout() {
    if (isTranslatorMode) toggleTranslatorMode();
    currentUser = null;
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    if (ws) ws.close();
    if (recognition) recognition.stop();
    stopCamera();
    if (inactivityInterval) clearInterval(inactivityInterval);
}

// Đóng modal khi click outside
window.onclick = function(event) {
    const modal = document.getElementById('registerModal');
    if (event.target === modal) closeRegisterModal();
}

// Login event
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});
