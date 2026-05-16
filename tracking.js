// ========== BODY TRACKING CHO GAME ==========

// Khai báo trackingData một lần duy nhất
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
      video: { width: 640, height: 480 }
    });
    
    video = document.getElementById("webcam");
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    console.log("📷 Camera setup complete");
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
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  
  pose.onResults((results) => {
    if (!isTrackingActive) return;
    if (!results.poseLandmarks) return;
    
    const landmarks = results.poseLandmarks;
    const nose = landmarks[0];
    const shoulder = landmarks[12];
    const wrist = landmarks[16];
    
    if (nose) {
      gameTrackingData.headX = Math.min(1, Math.max(0, nose.x));
      gameTrackingData.headY = Math.min(1, Math.max(0, nose.y));
    }
    
    if (nose) {
      gameTrackingData.speed = Math.max(0, Math.min(1, 1 - nose.y)) * 1.5;
    }
    
    if (shoulder && wrist) {
      const dx = wrist.x - shoulder.x;
      const dy = wrist.y - shoulder.y;
      gameTrackingData.cannonAngle = Math.atan2(dy, dx);
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
    maxNumHands: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  
  hands.onResults((results) => {
    if (!isTrackingActive) {
      gameTrackingData.shooting = false;
      return;
    }
    
    gameTrackingData.shooting = false;
    if (!results.multiHandLandmarks) return;
    
    const hand = results.multiHandLandmarks[0];
    if (hand && hand[8] && hand[6]) {
      const tip = hand[8];
      const pip = hand[6];
      if (tip.y < pip.y) {
        gameTrackingData.shooting = true;
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

// Bắt đầu tracking cho game
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
  }
  
  console.log("🎮 Game tracking started!");
}

// Dừng tracking
export function stopGameTracking() {
  console.log("🎮 Stopping game tracking...");
  isTrackingActive = false;
  
  if (camera) {
    camera.stop();
  }
}

// Export trackingData với tên duy nhất
export { gameTrackingData as trackingData };
