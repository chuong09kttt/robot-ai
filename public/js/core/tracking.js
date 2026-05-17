// ========== BODY TRACKING MODULE ==========
let video = null;
let pose = null;
let hands = null;
let camera = null;
let isTrackingActive = false;

export const trackingData = {
    steeringAngle: 0,
    speed: 0.15,
    shooting: false,
    headX: 0.5,
    headY: 0.5
};

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video = document.getElementById('webcam');
        if (video) {
            video.srcObject = stream;
            await video.play();
        }
    } catch(e) { console.error('Camera error:', e); }
}

function initPose() {
    if (pose) return;
    if (typeof Pose === 'undefined') { console.log('Pose not loaded'); return; }
    
    pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.3 });
    
    pose.onResults((results) => {
        if (!isTrackingActive || !results.poseLandmarks) return;
        const lm = results.poseLandmarks;
        const nose = lm[0];
        const leftWrist = lm[15];
        const rightWrist = lm[16];
        const leftShoulder = lm[11];
        const rightShoulder = lm[12];
        
        if (nose) {
            trackingData.speed = Math.max(0.1, Math.min(1.2, (0.3 - nose.y) * 3));
        }
        
        if (leftWrist && rightWrist) {
            trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, (rightWrist.x - leftWrist.x) * 1.5));
        } else if (rightWrist && rightShoulder) {
            trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, (rightWrist.x - rightShoulder.x) * 1.5));
        } else {
            trackingData.steeringAngle *= 0.95;
        }
    });
}

function initHands() {
    if (hands) return;
    if (typeof Hands === 'undefined') { console.log('Hands not loaded'); return; }
    
    hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 1, minDetectionConfidence: 0.3 });
    
    hands.onResults((results) => {
        if (!isTrackingActive) { trackingData.shooting = false; return; }
        trackingData.shooting = false;
        if (!results.multiHandLandmarks) return;
        const hand = results.multiHandLandmarks[0];
        if (hand && hand[8] && hand[5] && hand[8].y > hand[5].y) {
            trackingData.shooting = true;
        }
    });
}

function initCameraTracking() {
    if (camera) return;
    if (!video) video = document.getElementById('webcam');
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

export async function startTracking() {
    isTrackingActive = true;
    if (!video) await setupCamera();
    initPose();
    initHands();
    initCameraTracking();
    if (camera) await camera.start();
}

export function stopTracking() {
    isTrackingActive = false;
    if (camera) camera.stop();
}

// Auto-update global
setInterval(() => {
    if (typeof window !== 'undefined') {
        window.trackingData = trackingData;
    }
}, 50);
