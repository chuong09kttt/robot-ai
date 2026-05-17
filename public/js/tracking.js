
// ========== BODY TRACKING CHO GAME - VÔ LĂNG ==========

const gameTrackingData = {
  steeringAngle: 0,    // Góc vô lăng (-1 đến 1, 0 là thẳng)
  headY: 0.5,          // Vị trí đầu theo chiều dọc
  speed: 0,            // Tốc độ (0-1.2)
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
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    
    if (nose) {
      // Vị trí đầu theo chiều dọc (để điều khiển tốc độ)
      // Đầu nâng cao (y nhỏ) -> tăng tốc
      // Đầu hạ thấp (y lớn) -> giảm tốc
      let headYNormalized = nose.y;
      // Đảo ngược: y càng nhỏ (đầu cao) thì speed càng lớn
      let rawSpeed = (0.3 - headYNormalized) * 3;
      gameTrackingData.speed = Math.max(0, Math.min(1.2, rawSpeed));
      gameTrackingData.headY = headYNormalized;
    }
    
    // NHẬN DIỆN VÔ LĂNG - Dùng 2 tay để tạo thành vô lăng
    // Khi người dùng giơ 2 tay lên ngang vai và xoay, góc giữa 2 tay xác định hướng
    
    if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
      // Tính góc giữa 2 tay (vô lăng)
      const dx = rightWrist.x - leftWrist.x;
      const dy = rightWrist.y - leftWrist.y;
      let angle = Math.atan2(dy, dx);
      
      // Chuyển đổi góc thành giá trị từ -1 đến 1
      // angle ~ -0.5 (trái) đến 0.5 (phải)
      let steeringRaw = angle * 2;
      gameTrackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, steeringRaw));
      
      // Debug log
      if (Math.abs(gameTrackingData.steeringAngle) > 0.3) {
        console.log(`🎮 Steering: ${gameTrackingData.steeringAngle.toFixed(2)}, Speed: ${gameTrackingData.speed.toFixed(2)}`);
      }
    } else {
      // Fallback dùng 1 tay nếu không thấy 2 tay
      if (rightWrist && rightShoulder) {
        let armAngle = (rightWrist.x - rightShoulder.x) * 1.5;
        gameTrackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, armAngle));
      } else if (leftWrist && leftShoulder) {
        let armAngle = (leftWrist.x - leftShoulder.x) * 1.5;
        gameTrackingData.steeringAngle = Math.max(-0.9, Math.min(0.9, armAngle));
      } else {
        // Không thấy tay, giữ nguyên góc
        if (Math.abs(gameTrackingData.steeringAngle) > 0.01) {
          gameTrackingData.steeringAngle *= 0.95;
        }
      }
    }
  });
}

// Khởi tạo Hands detection cho bắn đạn
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
        
        // Nắm tay hoặc giơ ngón trỏ = bắn
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
  console.log("🎮 Starting game tracking with steering wheel...");
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
  
  console.log("🎮 Game tracking started! Hold your hands like a steering wheel!");
}

export function stopGameTracking() {
  console.log("🎮 Stopping game tracking...");
  isTrackingActive = false;
  
  if (camera) {
    camera.stop();
  }
}

export { gameTrackingData as trackingData };
