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

// Debug function
function logTrackingStatus() {
    const statusDiv = document.getElementById('gameStatus');
    if (statusDiv) {
        statusDiv.innerHTML = `🎮 Head: ${gameTrackingData.headX.toFixed(2)} | Speed: ${gameTrackingData.speed.toFixed(2)} | Shoot: ${gameTrackingData.shooting ? 'YES' : 'NO'}`;
    }
}

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
      console.log("📷 Camera setup complete - video playing");
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
    modelComplexity: 1,  // Tăng độ chính xác
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.3,  // Giảm ngưỡng để dễ nhận diện
    minTrackingConfidence: 0.3    // Giảm ngưỡng để dễ nhận diện
  });
  
  pose.onResults((results) => {
    if (!isTrackingActive) return;
    
    if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
      console.log("No pose detected");
      return;
    }
    
    const landmarks = results.poseLandmarks;
    
    // Lấy các điểm quan trọng
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (nose) {
      // Head X từ -1 đến 1, chuyển về 0-1
      gameTrackingData.headX = Math.min(0.9, Math.max(0.1, nose.x));
      
      // Tốc độ dựa vào vị trí đầu theo Y (cúi xuống = tăng tốc)
      // nose.y: 0=đỉnh đầu, 1=cằm (khi cúi, nose.y tăng)
      let speedRaw = (nose.y - 0.3) * 2;  // Cúi xuống làm tăng speed
      gameTrackingData.speed = Math.max(0, Math.min(1.2, speedRaw));
      
      console.log(`Pose: headX=${gameTrackingData.headX.toFixed(2)}, noseY=${nose.y.toFixed(2)}, speed=${gameTrackingData.speed.toFixed(2)}`);
    }
    
    // Tính góc pháo dựa vào tay phải hoặc tay trái (bên nào cao hơn)
    let wristY = 1;
    let shoulderY = 0.5;
    
    if (rightWrist && rightShoulder) {
      wristY = rightWrist.y;
      shoulderY = rightShoulder.y;
      gameTrackingData.cannonAngle = (rightWrist.x - rightShoulder.x) * 2;
    } else if (leftWrist && leftShoulder) {
      wristY = leftWrist.y;
      shoulderY = leftShoulder.y;
      gameTrackingData.cannonAngle = (leftWrist.x - leftShoulder.x) * 2;
    }
    
    // Debug
    logTrackingStatus();
  });
}

// Khởi tạo Hands detection - CẢI TIẾN
function initHands() {
  if (hands) return;
  
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.3,  // Giảm ngưỡng
    minTrackingConfidence: 0.3    // Giảm ngưỡng
  });
  
  hands.onResults((results) => {
    if (!isTrackingActive) {
      gameTrackingData.shooting = false;
      return;
    }
    
    gameTrackingData.shooting = false;
    
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }
    
    // Kiểm tra cả 2 tay
    for (const hand of results.multiHandLandmarks) {
      if (hand && hand[8] && hand[5]) {
        const tip = hand[8];      // Đầu ngón tay
        const mcp = hand[5];      // Khớp đốt bàn tay
        
        // Nếu ngón tay cao hơn khớp bàn tay (giơ tay lên)
        if (tip.y < mcp.y - 0.05) {  // Giảm ngưỡng để dễ kích hoạt
          gameTrackingData.shooting = true;
          console.log("🔫 SHOOTING DETECTED!");
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
    console.log("🎮 Camera started!");
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

// Xuất trackingData
export { gameTrackingData as trackingData };
