// ========== BODY TRACKING CHO GAME ==========

const gameTrackingData = {
  headX: 0.5,
  headY: 0.5,
  speed: 0,
  cannonAngle: 0,
  shooting: false
};

let video = null;
let pose = null;
let hands = null;
let camera = null;
let isTrackingActive = false;

// Khởi tạo camera
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
      console.log("📷 Camera setup complete");
    }
  } catch (error) {
    console.error("Camera error:", error);
  }
}

// Khởi tạo Pose detection
function initPose() {
  if (pose) return;
  
  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });
  
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.3,
    minTrackingConfidence: 0.3
  });
  
  pose.onResults((results) => {
    if (!isTrackingActive) return;
    if (!results.poseLandmarks || results.poseLandmarks.length === 0) return;
    
    const landmarks = results.poseLandmarks;
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    
    if (nose) {
      // Head X từ 0-1 (0: trái, 1: phải)
      gameTrackingData.headX = Math.min(0.95, Math.max(0.05, nose.x));
      
      // Tốc độ dựa vào vị trí đầu theo Y (cúi xuống = tăng tốc)
      let speedRaw = (nose.y - 0.25) * 2.5;
      gameTrackingData.speed = Math.max(0, Math.min(1.2, speedRaw));
    }
    
    // Tính góc pháo
    if (rightWrist && rightShoulder) {
      gameTrackingData.cannonAngle = (rightWrist.x - rightShoulder.x) * 1.5;
    } else if (leftWrist && leftShoulder) {
      gameTrackingData.cannonAngle = (leftWrist.x - leftShoulder.x) * 1.5;
    }
  });
}

// Khởi tạo Hands detection
function initHands() {
  if (hands) return;
  
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.3,
    minTrackingConfidence: 0.3
  });
  
  hands.onResults((results) => {
    if (!isTrackingActive) {
      gameTrackingData.shooting = false;
      return;
    }
    
    gameTrackingData.shooting = false;
    
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    
    for (const hand of results.multiHandLandmarks) {
      if (hand && hand[8] && hand[5]) {
        const tip = hand[8];
        const mcp = hand[5];
        
        if (tip.y < mcp.y - 0.05) {
          gameTrackingData.shooting = true;
          break;
        }
      }
    }
  });
}

// Khởi tạo Camera
function initCamera() {
  if (camera) return;
  
  if (!video) {
    video = document.getElementById("webcam");
  }
  
  if (video && typeof Camera !== 'undefined') {
    camera = new Camera(video, {
      onFrame: async () => {
        if (!isTrackingActive) return;
        if (pose) await pose.send({ image: video });
        if (hands) await hands.send({ image: video });
      },
      width: 640,
      height: 480
    });
  }
}

export async function startGameTracking() {
  console.log("🎮 Starting game tracking...");
  isTrackingActive = true;
  
  if (!video) {
    await setupCamera();
  }
  
  initPose();
  initHands();
  initCamera();
  
  if (camera) {
    await camera.start();
    console.log("🎮 Camera started!");
  }
  
  console.log("🎮 Game tracking started!");
}

export function stopGameTracking() {
  console.log("🎮 Stopping game tracking...");
  isTrackingActive = false;
  
  if (camera) {
    camera.stop();
  }
}

export { gameTrackingData as trackingData };
