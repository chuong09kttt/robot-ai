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

// ========== MEDIAPIPE FACE MESH (468 điểm) ==========
let isCameraActive = false;
let cameraButton = null;
let videoElement = null;
let canvasElement = null;
let faceMesh = null;
let camera = null;

// Trạng thái nhận diện
let lastFaceState = { hasFace: false, glasses: false, hat: false, eyeOpen: true };
let detectionStableCount = 0;
let lastDetectionTime = 0;
const REQUIRED_STABLE_COUNT = 3;

// Các chỉ số landmarks cho Face Mesh
const LANDMARKS = {
    // Mắt trái
    LEFT_EYE: {
        INNER: 133,
        OUTER: 33,
        TOP: 159,
        BOTTOM: 145,
        IRIS: 468
    },
    // Mắt phải
    RIGHT_EYE: {
        INNER: 362,
        OUTER: 263,
        TOP: 386,
        BOTTOM: 374,
        IRIS: 473
    },
    // Lông mày
    LEFT_EYEBROW: {
        INNER: 55,
        OUTER: 46
    },
    RIGHT_EYEBROW: {
        INNER: 285,
        OUTER: 276
    },
    // Mũi
    NOSE: {
        TIP: 1,
        BRIDGE: 168,
        BOTTOM: 2
    },
    // Miệng
    MOUTH: {
        LEFT: 61,
        RIGHT: 291,
        TOP: 13,
        BOTTOM: 14
    },
    // Viền mặt
    FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
};

async function initFaceMesh() {
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
        if (faceText) faceText.textContent = '📷 Đang khởi tạo Face Mesh...';
        
        // Khởi tạo MediaPipe Face Mesh (468 điểm)
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,  // Làm mịn landmarks, bao gồm iris
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        faceMesh.onResults(onFaceMeshResults);
        
        // Khởi tạo camera
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
        cameraButton.textContent = '📷 TẮT CAMERA (FACE MESH)';
        cameraButton.classList.add('active');
        
        if (faceText) faceText.textContent = '📷 Face Mesh đang hoạt động! 468 điểm theo dõi';
        document.getElementById('faceEmoji').textContent = '🔍';
        
        addMessage('ai', '📷 Camera đã được bật! Chiri đang sử dụng Face Mesh để nhìn thấy bạn chi tiết hơn!');
        
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
    cameraButton.textContent = '📷 BẬT CAMERA (FACE MESH)';
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
    document.getElementById('eyeStatus').innerHTML = '👁️ --';
    
    addMessage('ai', '📷 Camera đã tắt.');
}

// Xử lý kết quả từ Face Mesh (468 landmarks)
function onFaceMeshResults(results) {
    if (!isCameraActive || !canvasElement) return;
    
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    let hasFace = false;
    let hasGlasses = false;
    let hasHat = false;
    let leftEyeOpen = true;
    let rightEyeOpen = true;
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        hasFace = true;
        const landmarks = results.multiFaceLandmarks[0];
        
        // Vẽ tất cả 468 điểm landmarks lên canvas
        drawLandmarks(canvasCtx, landmarks);
        
        // PHÁT HIỆN KÍNH - Dựa trên khoảng cách và tỷ lệ mắt
        const glassesResult = detectGlassesFromLandmarks(landmarks);
        hasGlasses = glassesResult.hasGlasses;
        leftEyeOpen = glassesResult.leftEyeOpen;
        rightEyeOpen = glassesResult.rightEyeOpen;
        
        // PHÁT HIỆN MŨ BẢO HỘ - Dựa trên vùng trán và đỉnh đầu
        hasHat = detectHatFromLandmarks(landmarks, results.image);
        
        // Vẽ các vùng đặc biệt
        drawEyeRegions(canvasCtx, landmarks);
        drawHatRegion(canvasCtx, landmarks, hasHat);
        
        // Hiển thị thông tin
        drawInfoText(canvasCtx, landmarks, hasGlasses, hasHat);
    }
    
    canvasCtx.restore();
    updateFaceStatusUI(hasFace, hasGlasses, hasHat, leftEyeOpen && rightEyeOpen);
}

// Vẽ 468 điểm landmarks
function drawLandmarks(ctx, landmarks) {
    // Vẽ các điểm
    ctx.fillStyle = '#00ff00';
    for (let i = 0; i < landmarks.length; i++) {
        const x = landmarks[i].x * canvasElement.width;
        const y = landmarks[i].y * canvasElement.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Vẽ đường nối viền mặt
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < LANDMARKS.FACE_OVAL.length; i++) {
        const idx = LANDMARKS.FACE_OVAL[i];
        const x = landmarks[idx].x * canvasElement.width;
        const y = landmarks[idx].y * canvasElement.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
}

// Vẽ vùng mắt
function drawEyeRegions(ctx, landmarks) {
    // Mắt trái
    const leftEye = LANDMARKS.LEFT_EYE;
    const leftEyePoints = [
        landmarks[leftEye.INNER], landmarks[leftEye.OUTER],
        landmarks[leftEye.TOP], landmarks[leftEye.BOTTOM]
    ];
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const point of leftEyePoints) {
        const x = point.x * canvasElement.width;
        const y = point.y * canvasElement.height;
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
    }
    ctx.stroke();
    
    // Mắt phải
    const rightEye = LANDMARKS.RIGHT_EYE;
    const rightEyePoints = [
        landmarks[rightEye.INNER], landmarks[rightEye.OUTER],
        landmarks[rightEye.TOP], landmarks[rightEye.BOTTOM]
    ];
    
    ctx.beginPath();
    for (const point of rightEyePoints) {
        const x = point.x * canvasElement.width;
        const y = point.y * canvasElement.height;
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
    }
    ctx.stroke();
}

// Vẽ vùng phát hiện mũ
function drawHatRegion(ctx, landmarks, hasHat) {
    // Lấy điểm đỉnh đầu (landmark 10)
    const topHead = landmarks[10];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    
    const hatY = (topHead.y - 0.05) * canvasElement.height;
    const hatHeight = (topHead.y - leftCheek.y) * canvasElement.height * 0.8;
    const hatWidth = (rightCheek.x - leftCheek.x) * canvasElement.width * 1.2;
    const hatX = (leftCheek.x - (rightCheek.x - leftCheek.x) * 0.1) * canvasElement.width;
    
    ctx.strokeStyle = hasHat ? '#ff6600' : '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(hatX, hatY, hatWidth, hatHeight);
    
    if (hasHat) {
        ctx.fillStyle = 'rgba(255, 102, 0, 0.2)';
        ctx.fillRect(hatX, hatY, hatWidth, hatHeight);
    }
}

// PHÁT HIỆN KÍNH DỰA TRÊN LANDMARKS
function detectGlassesFromLandmarks(landmarks) {
    // Lấy tọa độ mắt
    const leftEyeInner = landmarks[LANDMARKS.LEFT_EYE.INNER];
    const leftEyeOuter = landmarks[LANDMARKS.LEFT_EYE.OUTER];
    const leftEyeTop = landmarks[LANDMARKS.LEFT_EYE.TOP];
    const leftEyeBottom = landmarks[LANDMARKS.LEFT_EYE.BOTTOM];
    
    const rightEyeInner = landmarks[LANDMARKS.RIGHT_EYE.INNER];
    const rightEyeOuter = landmarks[LANDMARKS.RIGHT_EYE.OUTER];
    const rightEyeTop = landmarks[LANDMARKS.RIGHT_EYE.TOP];
    const rightEyeBottom = landmarks[LANDMARKS.RIGHT_EYE.BOTTOM];
    
    // Tính chiều rộng và chiều cao mắt
    const leftEyeWidth = Math.hypot(leftEyeInner.x - leftEyeOuter.x, leftEyeInner.y - leftEyeOuter.y);
    const leftEyeHeight = Math.hypot(leftEyeTop.x - leftEyeBottom.x, leftEyeTop.y - leftEyeBottom.y);
    const rightEyeWidth = Math.hypot(rightEyeInner.x - rightEyeOuter.x, rightEyeInner.y - rightEyeOuter.y);
    const rightEyeHeight = Math.hypot(rightEyeTop.x - rightEyeBottom.x, rightEyeTop.y - rightEyeBottom.y);
    
    // Tỷ lệ chiều rộng/cao của mắt
    const leftEyeRatio = leftEyeWidth / leftEyeHeight;
    const rightEyeRatio = rightEyeWidth / rightEyeHeight;
    const avgEyeRatio = (leftEyeRatio + rightEyeRatio) / 2;
    
    // Lấy điểm sống mũi để so sánh
    const noseBridge = landmarks[LANDMARKS.NOSE.BRIDGE];
    const noseTip = landmarks[LANDMARKS.NOSE.TIP];
    const noseHeight = Math.hypot(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);
    
    // PHÁT HIỆN KÍNH:
    // 1. Mắt thường có tỷ lệ width/height ~ 1.5-2.0
    // 2. Kính đeo mắt thường làm thay đổi tỷ lệ này (gọng kính làm tăng chiều rộng biểu kiến)
    // 3. Kính có thể tạo ra vùng tối xung quanh mắt
    
    let hasGlasses = false;
    
    // Tiêu chí 1: Tỷ lệ mắt bất thường
    if (avgEyeRatio > 2.2 || avgEyeRatio < 1.2) {
        hasGlasses = true;
    }
    
    // Tiêu chí 2: So sánh với kích thước mũi
    const avgEyeSize = (leftEyeWidth + rightEyeWidth) / 2;
    if (avgEyeSize / noseHeight > 1.5) {
        hasGlasses = true;
    }
    
    // Tiêu chí 3: Khoảng cách giữa 2 mắt
    const eyeDistance = Math.hypot(leftEyeOuter.x - rightEyeOuter.x, leftEyeOuter.y - rightEyeOuter.y);
    const faceWidth = Math.hypot(landmarks[454].x - landmarks[234].x, landmarks[454].y - landmarks[234].y);
    if (eyeDistance / faceWidth < 0.3) {
        hasGlasses = true;
    }
    
    // Phát hiện mở mắt (dùng để biết người dùng có đang nhìn không)
    const leftEyeOpen = leftEyeHeight / leftEyeWidth > 0.3;
    const rightEyeOpen = rightEyeHeight / rightEyeWidth > 0.3;
    
    return { hasGlasses, leftEyeOpen, rightEyeOpen };
}

// PHÁT HIỆN MŨ BẢO HỘ
function detectHatFromLandmarks(landmarks, image) {
    // Lấy điểm đỉnh trán (landmark 10)
    const foreheadTop = landmarks[10];
    // Lấy điểm má
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    // Lấy điểm cằm
    const chin = landmarks[152];
    
    // Tính tỷ lệ giữa vùng trán và toàn bộ khuôn mặt
    const faceHeight = Math.abs(foreheadTop.y - chin.y);
    const foreheadToCheekL = Math.abs(foreheadTop.y - leftCheek.y);
    const foreheadToCheekR = Math.abs(foreheadTop.y - rightCheek.y);
    const avgForeheadToCheek = (foreheadToCheekL + foreheadToCheekR) / 2;
    
    const foreheadRatio = avgForeheadToCheek / faceHeight;
    
    // Nếu tỷ lệ này nhỏ (< 0.25), có thể đang đội mũ che mất trán
    let hasHat = foreheadRatio < 0.25;
    
    // Kiểm tra thêm qua pixel analysis nếu cần
    if (!hasHat && image && canvasElement) {
        const ctx = canvasElement.getContext('2d');
        const hatY = Math.max(0, foreheadTop.y - 0.15);
        const hatX = Math.max(0, leftCheek.x - 0.05);
        const hatWidth = Math.min(1 - hatX, rightCheek.x - leftCheek.x + 0.1);
        const hatHeight = Math.min(0.3, foreheadTop.y - hatY);
        
        if (hatY > 0 && hatWidth > 0 && hatHeight > 0) {
            try {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = canvasElement.width;
                tempCanvas.height = canvasElement.height;
                tempCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
                
                const imageData = tempCtx.getImageData(
                    hatX * canvasElement.width,
                    hatY * canvasElement.height,
                    hatWidth * canvasElement.width,
                    hatHeight * canvasElement.height
                );
                
                // Phân tích texture - mũ thường có nhiều cạnh
                let edgeCount = 0;
                for (let i = 0; i < imageData.data.length; i += 16) {
                    if (i + 16 < imageData.data.length) {
                        const diff = Math.abs(imageData.data[i] - imageData.data[i + 16]) +
                                    Math.abs(imageData.data[i + 1] - imageData.data[i + 17]) +
                                    Math.abs(imageData.data[i + 2] - imageData.data[i + 18]);
                        if (diff > 100) edgeCount++;
                    }
                }
                const edgeRatio = edgeCount / (imageData.data.length / 16);
                if (edgeRatio > 0.15) hasHat = true;
            } catch(e) {}
        }
    }
    
    return hasHat;
}

// Vẽ thông tin lên canvas
function drawInfoText(ctx, landmarks, hasGlasses, hasHat) {
    const noseTip = landmarks[LANDMARKS.NOSE.TIP];
    const textX = noseTip.x * canvasElement.width - 50;
    const textY = (noseTip.y * canvasElement.height) - 50;
    
    ctx.font = 'bold 16px Arial';
    ctx.shadowBlur = 0;
    
    if (hasGlasses) {
        ctx.fillStyle = '#ff4444';
        ctx.fillText('👓 PHÁT HIỆN KÍNH', textX, textY);
    } else {
        ctx.fillStyle = '#44ff44';
        ctx.fillText('👓 KHÔNG KÍNH', textX, textY);
    }
    
    if (hasHat) {
        ctx.fillStyle = '#ff8800';
        ctx.fillText('🧢 PHÁT HIỆN MŨ', textX, textY + 25);
    } else {
        ctx.fillStyle = '#44ff44';
        ctx.fillText('🧢 KHÔNG MŨ', textX, textY + 25);
    }
}

// Cập nhật UI
function updateFaceStatusUI(hasFace, hasGlasses, hasHat, eyesOpen) {
    const faceEmoji = document.getElementById('faceEmoji');
    const faceText = document.getElementById('faceText');
    const glassesStatus = document.getElementById('glassesStatus');
    const hatStatus = document.getElementById('hatStatus');
    const eyeStatus = document.getElementById('eyeStatus');
    
    if (!faceEmoji || !faceText) return;
    
    const currentState = { hasFace, glasses: hasGlasses, hat: hasHat, eyesOpen };
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
        faceEmoji.textContent = eyesOpen ? '😊' : '😑';
        faceText.textContent = `✅ Face Mesh: ${hasFace ? 'Đã phát hiện' : 'Chưa phát hiện'} | 468 điểm`;
        
        // Cập nhật trạng thái kính
        glassesStatus.innerHTML = hasGlasses ? '🕶️ ĐANG ĐEO KÍNH ✅' : '👓 KHÔNG ĐEO KÍNH';
        glassesStatus.style.background = hasGlasses ? '#4caf50' : '#666';
        
        // Cập nhật trạng thái mũ
        hatStatus.innerHTML = hasHat ? '🧢 ĐANG ĐỘI MŨ ✅' : '⛑️ KHÔNG ĐỘI MŨ';
        hatStatus.style.background = hasHat ? '#4caf50' : '#666';
        
        // Cập nhật trạng thái mắt
        eyeStatus.innerHTML = eyesOpen ? '👁️ MẮT MỞ' : '😴 MẮT NHẮM';
        eyeStatus.style.background = eyesOpen ? '#2196f3' : '#ff9800';
        
        // Thông báo bằng giọng nói khi có thay đổi
        const now = Date.now();
        if (isStable && (hasGlasses !== lastFaceState.glasses || hasHat !== lastFaceState.hat)) {
            if (now - lastDetectionTime > 8000) {
                lastDetectionTime = now;
                if (hasGlasses && hasHat) {
                    speak('Chiri thấy bạn đang đeo kính và đội mũ!');
                    addMessage('ai', '👓🧢 Chiri thấy bạn đang đeo kính và đội mũ!');
                } else if (hasGlasses && !lastFaceState.glasses) {
                    speak('Chiri thấy bạn đang đeo kính!');
                    addMessage('ai', '👓 Chiri thấy bạn đang đeo kính!');
                } else if (hasHat && !lastFaceState.hat) {
                    speak('Chiri thấy bạn đang đội mũ bảo hộ!');
                    addMessage('ai', '🧢 Chiri thấy bạn đang đội mũ bảo hộ!');
                } else if (!hasGlasses && !hasHat && (lastFaceState.glasses || lastFaceState.hat)) {
                    speak('Chiri thấy bạn đã tháo kính hoặc mũ!');
                    addMessage('ai', '😊 Chiri thấy bạn đã tháo kính hoặc mũ!');
                }
            }
        }
        
        lastFaceState = { ...currentState };
        
    } else if (!hasFace && isStable) {
        faceEmoji.textContent = '😔';
        faceText.textContent = '❌ Chưa phát hiện khuôn mặt';
        glassesStatus.innerHTML = '🕶️ --';
        hatStatus.innerHTML = '🧢 --';
        eyeStatus.innerHTML = '👁️ --';
        lastFaceState = { hasFace: false, glasses: false, hat: false, eyesOpen: true };
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
    console.log('🚀 Chiri AI v8.0 - MediaPipe Face Mesh (468 landmarks)');
    console.log('📋 Features: Face Mesh Detection, Glasses Detection, Hat Detection, Voice Control');
    
    updateWakeIndicator('sleeping');
    updateDriveModeUI();
    setExpression('sleepy');
    
    connectWebSocket();
    initSpeechRecognition();
    initFaceMesh();
    
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
