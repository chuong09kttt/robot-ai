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
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi', 'hey chiri', 'alô', 'chào', 'hey', 'wake up'];

// ========== FACE DETECTION ==========
let isCameraActive = false;
let cameraButton = null;
let videoElement = null;
let stream = null;
let detectionInterval = null;
let lastFaceState = { hasFace: false, glasses: false, hat: false };
let faceDetectionStableCount = 0;
const REQUIRED_STABLE_COUNT = 3; // Cần 3 lần liên tiếp giống nhau mới báo

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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Trình duyệt không hỗ trợ camera. Vui lòng dùng Chrome/Edge trên HTTPS.';
        addMessage('ai', '⚠️ ' + errorMsg);
        const faceText = document.getElementById('faceText');
        if (faceText) faceText.textContent = '❌ Trình duyệt không hỗ trợ camera';
        return;
    }
    
    try {
        const faceText = document.getElementById('faceText');
        if (faceText) faceText.textContent = '📷 Đang yêu cầu quyền camera...';
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            } 
        });
        
        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.style.display = 'block';
            
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
        
        if (faceText) faceText.textContent = '📷 Camera đang hoạt động!';
        const faceEmoji = document.getElementById('faceEmoji');
        if (faceEmoji) faceEmoji.textContent = '📷';
        
        addMessage('ai', '📷 Camera đã được bật! Chiri đang nhìn thấy bạn!');
        
        startFaceDetection();
        
    } catch (error) {
        console.error('Camera error:', error);
        
        let errorMsg = '';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg = 'Bạn chưa cho phép truy cập camera. Vui lòng nhấn vào biểu tượng camera trên thanh địa chỉ và chọn "Cho phép".';
        } else if (error.name === 'NotFoundError') {
            errorMsg = 'Không tìm thấy camera trên thiết bị của bạn.';
        } else if (error.name === 'NotReadableError') {
            errorMsg = 'Camera đang được sử dụng bởi ứng dụng khác.';
        } else if (error.message.includes('HTTP')) {
            errorMsg = 'Trang web cần chạy qua HTTPS để sử dụng camera.';
        } else {
            errorMsg = 'Không thể khởi tạo camera: ' + error.message;
        }
        
        addMessage('ai', '⚠️ ' + errorMsg);
        const faceText = document.getElementById('faceText');
        if (faceText) faceText.textContent = '❌ ' + errorMsg.substring(0, 50);
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
    if (glassesStatus) glassesStatus.textContent = '🕶️ --';
    if (hatStatus) hatStatus.textContent = '🧢 --';
    
    addMessage('ai', '📷 Camera đã tắt.');
}

function startFaceDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    detectionInterval = setInterval(() => {
        if (!isCameraActive || !videoElement || videoElement.paused || videoElement.readyState !== 4) {
            return;
        }
        
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        if (canvas.width === 0 || canvas.height === 0) return;
        
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const hasFace = detectFaceBySkinColor(imageData);
        
        let hasGlasses = false;
        let hasHat = false;
        
        if (hasFace) {
            hasGlasses = detectGlassesAccurate(imageData);
            hasHat = detectHatAccurate(imageData);
        }
        
        updateFaceStatusUI(hasFace, hasGlasses, hasHat);
        
    }, 1000);
}

// ========== PHÁT HIỆN KHUÔN MẶT CHÍNH XÁC ==========
function detectFaceBySkinColor(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const regionWidth = width * 0.5;
    const regionHeight = height * 0.5;
    
    const startX = Math.max(0, centerX - regionWidth / 2);
    const endX = Math.min(width, centerX + regionWidth / 2);
    const startY = Math.max(0, centerY - regionHeight / 2);
    const endY = Math.min(height, centerY + regionHeight / 2);
    
    let skinPixelCount = 0;
    let totalPixels = 0;
    let highBrightnessCount = 0;
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 0 && idx < imageData.data.length - 3) {
                totalPixels++;
                
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];
                const brightness = (r + g + b) / 3;
                
                // Điều kiện màu da người châu Á
                const isSkinColor = (r > 70 && g > 35 && b > 25) && 
                                    (r > g) && 
                                    (Math.abs(r - g) > 12) &&
                                    (brightness > 50 && brightness < 220);
                
                if (isSkinColor) {
                    skinPixelCount++;
                }
                
                if (brightness > 200) {
                    highBrightnessCount++;
                }
            }
        }
    }
    
    const skinPercentage = totalPixels > 0 ? skinPixelCount / totalPixels : 0;
    const brightnessPercentage = totalPixels > 0 ? highBrightnessCount / totalPixels : 0;
    
    return skinPercentage > 0.08 && brightnessPercentage < 0.4;
}

// ========== PHÁT HIỆN KÍNH CHÍNH XÁC ==========
function detectGlassesAccurate(imageData) {
    const hasFace = detectFaceBySkinColor(imageData);
    if (!hasFace) return false;
    
    const width = imageData.width;
    const height = imageData.height;
    
    // Vùng mắt (35% - 65% chiều rộng, 40% - 52% chiều cao)
    const eyeYStart = height * 0.4;
    const eyeYEnd = height * 0.52;
    const eyeXStart = width * 0.32;
    const eyeXEnd = width * 0.68;
    
    let darkPixelCount = 0;
    let totalPixels = 0;
    let brightPixelCount = 0;
    let reflectionCount = 0;
    
    for (let y = eyeYStart; y < eyeYEnd; y++) {
        for (let x = eyeXStart; x < eyeXEnd; x++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 0 && idx < imageData.data.length - 3) {
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];
                const brightness = (r + g + b) / 3;
                
                totalPixels++;
                
                // Vùng tối (viền kính)
                if (brightness < 60) {
                    darkPixelCount++;
                }
                
                // Vùng sáng (phản xạ kính)
                if (brightness > 200 && Math.abs(r - g) < 40 && Math.abs(g - b) < 40) {
                    brightPixelCount++;
                }
                
                // Phản xạ đặc trưng của kính (chấm sáng nhỏ)
                if (brightness > 220 && (r > 200 || g > 200 || b > 200)) {
                    reflectionCount++;
                }
            }
        }
    }
    
    const darkPercentage = totalPixels > 0 ? darkPixelCount / totalPixels : 0;
    const brightPercentage = totalPixels > 0 ? brightPixelCount / totalPixels : 0;
    const reflectionPercentage = totalPixels > 0 ? reflectionCount / totalPixels : 0;
    
    // Điều kiện phát hiện kính (chặt chẽ)
    const hasGlasses = (darkPercentage > 0.12 && brightPercentage > 0.04) || 
                       (darkPercentage > 0.15) ||
                       (reflectionPercentage > 0.03 && darkPercentage > 0.08);
    
    if (hasGlasses) {
        console.log(`🕶️ Glasses: dark=${(darkPercentage*100).toFixed(1)}%, bright=${(brightPercentage*100).toFixed(1)}%, ref=${(reflectionPercentage*100).toFixed(1)}%`);
    }
    
    return hasGlasses;
}

// ========== PHÁT HIỆN MŨ CHÍNH XÁC ==========
function detectHatAccurate(imageData) {
    const hasFace = detectFaceBySkinColor(imageData);
    if (!hasFace) return false;
    
    const width = imageData.width;
    const height = imageData.height;
    
    // Vùng trên đầu (8% - 32% chiều cao)
    const hatYStart = height * 0.08;
    const hatYEnd = height * 0.32;
    const hatXStart = width * 0.25;
    const hatXEnd = width * 0.75;
    
    // Vùng mặt để lấy màu da tham chiếu
    const faceYStart = height * 0.35;
    const faceYEnd = height * 0.65;
    const faceXStart = width * 0.3;
    const faceXEnd = width * 0.7;
    
    let avgFaceR = 0, avgFaceG = 0, avgFaceB = 0;
    let facePixelCount = 0;
    
    for (let y = faceYStart; y < faceYEnd; y++) {
        for (let x = faceXStart; x < faceXEnd; x++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 0 && idx < imageData.data.length - 3) {
                avgFaceR += imageData.data[idx];
                avgFaceG += imageData.data[idx + 1];
                avgFaceB += imageData.data[idx + 2];
                facePixelCount++;
            }
        }
    }
    
    if (facePixelCount > 0) {
        avgFaceR /= facePixelCount;
        avgFaceG /= facePixelCount;
        avgFaceB /= facePixelCount;
    }
    
    let edgeCount = 0;
    let totalPixels = 0;
    let nonSkinCount = 0;
    let darkAreaCount = 0;
    
    for (let y = hatYStart; y < hatYEnd; y++) {
        for (let x = hatXStart; x < hatXEnd; x++) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            if (idx >= 4 && idx < imageData.data.length - 4) {
                totalPixels++;
                
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];
                const brightness = (r + g + b) / 3;
                
                // So sánh với màu da
                const colorDiff = Math.abs(r - avgFaceR) + Math.abs(g - avgFaceG) + Math.abs(b - avgFaceB);
                if (colorDiff > 90) {
                    nonSkinCount++;
                }
                
                // Vùng tối (bóng mũ)
                if (brightness < 70) {
                    darkAreaCount++;
                }
                
                // Phát hiện cạnh (viền mũ)
                const nextIdx = (Math.floor(y) * width + Math.floor(x + 1)) * 4;
                if (nextIdx >= 0 && nextIdx < imageData.data.length - 3) {
                    const rNext = imageData.data[nextIdx];
                    const gNext = imageData.data[nextIdx + 1];
                    const bNext = imageData.data[nextIdx + 2];
                    
                    const diff = Math.abs(r - rNext) + Math.abs(g - gNext) + Math.abs(b - bNext);
                    if (diff > 70) {
                        edgeCount++;
                    }
                }
            }
        }
    }
    
    const edgePercentage = totalPixels > 0 ? edgeCount / totalPixels : 0;
    const nonSkinPercentage = totalPixels > 0 ? nonSkinCount / totalPixels : 0;
    const darkPercentage = totalPixels > 0 ? darkAreaCount / totalPixels : 0;
    
    // Điều kiện phát hiện mũ
    const hasHat = (edgePercentage > 0.12 && nonSkinPercentage > 0.35) || 
                   (edgePercentage > 0.18) ||
                   (darkPercentage > 0.25 && nonSkinPercentage > 0.4);
    
    if (hasHat) {
        console.log(`🧢 Hat: edge=${(edgePercentage*100).toFixed(1)}%, non-skin=${(nonSkinPercentage*100).toFixed(1)}%, dark=${(darkPercentage*100).toFixed(1)}%`);
    }
    
    return hasHat;
}

// ========== CẬP NHẬT UI VỚI DEBOUNCE ==========
function updateFaceStatusUI(hasFace, hasGlasses, hasHat) {
    const faceEmoji = document.getElementById('faceEmoji');
    const faceText = document.getElementById('faceText');
    const glassesStatus = document.getElementById('glassesStatus');
    const hatStatus = document.getElementById('hatStatus');
    
    if (!faceEmoji || !faceText) return;
    
    const currentState = { hasFace, glasses: hasGlasses, hat: hasHat };
    const isSameAsLast = (currentState.hasFace === lastFaceState.hasFace &&
                          currentState.glasses === lastFaceState.glasses &&
                          currentState.hat === lastFaceState.hat);
    
    if (isSameAsLast) {
        faceDetectionStableCount++;
    } else {
        faceDetectionStableCount = 0;
    }
    
    const isStable = faceDetectionStableCount >= REQUIRED_STABLE_COUNT;
    
    if (hasFace && isStable) {
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
        
        // Chỉ thông báo khi có thay đổi trạng thái
        if (isStable && (currentState.glasses !== lastFaceState.glasses || currentState.hat !== lastFaceState.hat)) {
            if (hasGlasses && hasHat) {
                const msg = 'Chiri thấy bạn đang đeo kính và đội mũ!';
                speak(msg);
                addMessage('ai', '👓🧢 ' + msg);
            } else if (hasGlasses && !lastFaceState.glasses) {
                const msg = 'Chiri thấy bạn đang đeo kính! Rất phong cách!';
                speak(msg);
                addMessage('ai', '👓 ' + msg);
            } else if (hasHat && !lastFaceState.hat) {
                const msg = 'Chiri thấy bạn đang đội mũ! Đẹp quá!';
                speak(msg);
                addMessage('ai', '🧢 ' + msg);
            } else if (!hasGlasses && !hasHat && (lastFaceState.glasses || lastFaceState.hat)) {
                const msg = 'Chiri thấy bạn đã tháo kính/mũ!';
                speak(msg);
                addMessage('ai', '😊 ' + msg);
            }
        }
        
        lastFaceState = { ...currentState };
        
    } else if (!hasFace) {
        faceEmoji.textContent = '😔';
        faceText.textContent = 'Chưa phát hiện khuôn mặt';
        if (glassesStatus) {
            glassesStatus.innerHTML = '🕶️ --';
            glassesStatus.style.background = '#666';
        }
        if (hatStatus) {
            hatStatus.innerHTML = '🧢 --';
            hatStatus.style.background = '#666';
        }
        
        if (isStable && lastFaceState.hasFace) {
            lastFaceState = { hasFace: false, glasses: false, hat: false };
            faceDetectionStableCount = 0;
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
    console.log('🚀 Chiri AI v6.0 - Full Feature with Accurate Face Detection');
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
