// ========== BODY TRACKING MODULE ==========
(function() {
    console.log('🎮 Loading tracking module...');
    
    let video = null;
    let pose = null;
    let hands = null;
    let camera = null;
    let isTrackingActive = false;
    
    const trackingData = {
        steeringAngle: 0,
        speed: 0.15,
        shooting: false,
        headX: 0.5,
        headY: 0.5
    };
    
    async function setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: "user" }
            });
            video = document.getElementById('webcam');
            if (video) {
                video.srcObject = stream;
                await video.play();
                console.log('✅ Camera started');
            } else {
                console.log('⚠️ Webcam element not found, creating one');
                // Fallback: tạo video element nếu chưa có
                video = document.createElement('video');
                video.id = 'webcam';
                video.autoplay = true;
                video.muted = true;
                video.style.position = 'absolute';
                video.style.bottom = '20px';
                video.style.right = '20px';
                video.style.width = '200px';
                video.style.borderRadius = '10px';
                video.style.border = '2px solid #00ffff';
                video.srcObject = stream;
                document.body.appendChild(video);
            }
        } catch(e) {
            console.error('Camera error:', e);
        }
    }
    
    function initPose() {
        if (pose) return;
        if (typeof Pose === 'undefined') {
            console.error('Pose library not loaded');
            return;
        }
        
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
                // Speed based on head height (head up = faster)
                let rawSpeed = (0.3 - nose.y) * 3;
                trackingData.speed = Math.max(0.1, Math.min(1.2, rawSpeed));
                trackingData.headY = nose.y;
            }
            
            // Steering angle based on hand positions (like steering wheel)
            if (leftWrist && rightWrist) {
                let angle = (rightWrist.x - leftWrist.x) * 1.5;
                trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, angle));
            } else if (rightWrist && rightShoulder) {
                trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, (rightWrist.x - rightShoulder.x) * 1.5));
            } else if (leftWrist && leftShoulder) {
                trackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, (leftWrist.x - leftShoulder.x) * 1.5));
            } else {
                trackingData.steeringAngle *= 0.95;
            }
            
            // Debug log every second
            if (Math.random() < 0.02) {
                console.log(`🎮 Steering: ${trackingData.steeringAngle.toFixed(2)}, Speed: ${trackingData.speed.toFixed(2)}`);
            }
        });
    }
    
    function initHands() {
        if (hands) return;
        if (typeof Hands === 'undefined') {
            console.error('Hands library not loaded');
            return;
        }
        
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
            
            for (const hand of results.multiHandLandmarks) {
                if (hand && hand[8] && hand[5]) {
                    const tip = hand[8];
                    const mcp = hand[5];
                    // Fist closed = shooting
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
        if (camera) {
            await camera.start();
            console.log('✅ Camera tracking started');
        }
    };
    
    window.stopGameTracking = function() {
        console.log('🎮 Stopping game tracking...');
        isTrackingActive = false;
        if (camera) camera.stop();
    };
    
    // Auto-update global trackingData
    setInterval(() => {
        if (typeof window !== 'undefined') {
            window.trackingData = trackingData;
        }
    }, 50);
    
    console.log('✅ Tracking module loaded');
})();
