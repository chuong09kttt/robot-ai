// ========== BODY TRACKING FOR GAME - FIXED ==========
export const trackingData = {
    steeringAngle: 0,
    speed: 0,
    shooting: false,
    headX: 0.5,
    headY: 0.5,
    leftArmAngle: 0,
    rightArmAngle: 0
};

let video = null;
let pose = null;
let hands = null;
let camera = null;
let isTrackingActive = false;
let lastSteering = 0;
let lastSpeed = 0;

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            } 
        });
        video = document.getElementById("webcam");
        if (video) {
            video.srcObject = stream;
            await video.play();
            console.log("✅ Camera started successfully");
        }
    } catch(e) { 
        console.error("Camera error:", e);
        const statusElem = document.getElementById("gameStatus");
        if (statusElem) statusElem.innerHTML = "⚠️ Camera not available";
    }
}

function initPose() {
    if (pose) return;
    pose = new Pose({ 
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` 
    });
    pose.setOptions({ 
        modelComplexity: 1, 
        smoothLandmarks: true,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
    });
    
    pose.onResults((results) => {
        if (!isTrackingActive || !results.poseLandmarks) return;
        
        const lm = results.poseLandmarks;
        const nose = lm[0];
        const leftShoulder = lm[11];
        const rightShoulder = lm[12];
        const leftElbow = lm[13];
        const rightElbow = lm[14];
        const leftWrist = lm[15];
        const rightWrist = lm[16];
        
        // Cập nhật vị trí đầu
        if (nose) {
            trackingData.headX = Math.min(0.95, Math.max(0.05, nose.x));
            trackingData.headY = Math.min(0.95, Math.max(0.05, nose.y));
            
            // Tốc độ dựa trên độ cao của đầu (cúi xuống = giảm tốc, ngước lên = tăng tốc)
            let speedRaw = (0.3 - nose.y) * 3;
            trackingData.speed = Math.max(0.1, Math.min(1.2, speedRaw));
        }
        
        // TÍNH GÓC CÁNH TAY CHO MÁY BAY
        if (leftShoulder && leftWrist) {
            const dx = leftWrist.x - leftShoulder.x;
            const dy = leftWrist.y - leftShoulder.y;
            trackingData.leftArmAngle = Math.atan2(dy, dx);
        }
        
        if (rightShoulder && rightWrist) {
            const dx = rightWrist.x - rightShoulder.x;
            const dy = rightWrist.y - rightShoulder.y;
            trackingData.rightArmAngle = Math.atan2(dy, dx);
        }
        
        // TÍNH GÓC LÁI (dùng góc giữa 2 tay cho máy bay)
        if (leftWrist && rightWrist) {
            // Góc giữa 2 tay
            let angle = (rightWrist.x - leftWrist.x) * 1.2;
            trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, angle));
        } else if (rightWrist && rightShoulder) {
            // Fallback: dùng tay phải
            trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, (rightWrist.x - rightShoulder.x) * 1.5));
        } else {
            // Giảm dần về 0 khi không có tín hiệu
            trackingData.steeringAngle *= 0.95;
        }
        
        // Debug log
        if (Math.random() < 0.05) {
            console.log(`🕹️ Steering: ${trackingData.steeringAngle.toFixed(2)}, Speed: ${trackingData.speed.toFixed(2)}, L: ${trackingData.leftArmAngle.toFixed(2)}, R: ${trackingData.rightArmAngle.toFixed(2)}`);
        }
    });
}

function initHands() {
    if (hands) return;
    hands = new Hands({ 
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` 
    });
    hands.setOptions({ 
        maxNumHands: 2,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
    });
    
    hands.onResults((results) => {
        if (!isTrackingActive) {
            trackingData.shooting = false;
            return;
        }
        trackingData.shooting = false;
        if (!results.multiHandLandmarks) return;
        
        // Kiểm tra nắm tay (bắn đạn)
        for (const hand of results.multiHandLandmarks) {
            if (hand && hand[8] && hand[5]) {
                const tip = hand[8];
                const mcp = hand[5];
                // Nếu ngón tay gập lại (nắm tay)
                if (tip.y > mcp.y) {
                    trackingData.shooting = true;
                    break;
                }
            }
        }
    });
}

function initCamera() {
    if (camera) return;
    if (!video) video = document.getElementById("webcam");
    if (video && typeof Camera !== 'undefined') {
        camera = new Camera(video, {
            onFrame: async () => {
                if (!isTrackingActive) return;
                if (pose) await pose.send({ image: video });
                if (hands) await hands.send({ image: video });
            }
        });
    }
}

export async function startGameTracking() {
    console.log("🎮 Starting game tracking...");
    isTrackingActive = true;
    if (!video) await setupCamera();
    initPose();
    initHands();
    initCamera();
    if (camera) await camera.start();
    console.log("✅ Game tracking active!");
}

export function stopGameTracking() {
    console.log("🎮 Stopping game tracking...");
    isTrackingActive = false;
    if (camera) camera.stop();
}

// Auto-update global trackingData
setInterval(() => {
    if (typeof window !== 'undefined') {
        window.trackingData = trackingData;
    }
}, 16);
