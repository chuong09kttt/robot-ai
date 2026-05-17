// ========== BODY TRACKING MODULE ==========
(function() {
    let video = null;
    let pose = null;
    let hands = null;
    let camera = null;
    let isTrackingActive = false;
    
    const trackingData = {
        steeringAngle: 0,
        speed: 0,
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
                console.log('✅ Camera started');
            }
        } catch(e) {
            console.error('Camera error:', e);
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
            const leftWrist = lm[15];
            const rightWrist = lm[16];
            const leftShoulder = lm[11];
            const rightShoulder = lm[12];
            
            if (nose) {
                trackingData.speed = Math.max(0.1, Math.min(1.2, (0.3 - nose.y) * 3));
            }
            
            if (leftWrist && rightWrist) {
                let angle = (rightWrist.x - leftWrist.x) * 1.2;
                trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, angle));
            } else if (rightWrist && rightShoulder) {
                trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, (rightWrist.x - rightShoulder.x) * 1.5));
            }
        });
    }
    
    function initHands() {
        if (hands) return;
        hands = new Hands({
            locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        });
        hands.setOptions({
            maxNumHands: 1,
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
            const hand = results.multiHandLandmarks[0];
            if (hand && hand[8] && hand[5] && hand[8].y < hand[5].y - 0.05) {
                trackingData.shooting = true;
            }
        });
    }
    
    function initCamera() {
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
    
    window.startGameTracking = async function() {
        console.log('🎮 Starting game tracking...');
        isTrackingActive = true;
        if (!video) await setupCamera();
        initPose();
        initHands();
        initCamera();
        if (camera) await camera.start();
    };
    
    window.stopGameTracking = function() {
        console.log('🎮 Stopping game tracking...');
        isTrackingActive = false;
        if (camera) camera.stop();
    };
    
    setInterval(() => {
        if (typeof window !== 'undefined') {
            window.trackingData = trackingData;
        }
    }, 16);
})();
