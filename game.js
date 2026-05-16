// ========== OCEAN RUSH GAME ==========
import { trackingData, startGameTracking, stopGameTracking } from "./tracking.js";
import { sendPlayer, listenPlayers, initGameSocket } from "./networking.js";

let gameActive = false;
let gameInitialized = false;
let gameScene = null;
let gameCamera = null;
let gameRenderer = null;
let gameShip = null;
let gameBullets = [];
let gameObstacles = [];
let gameOtherPlayers = {};
let gameShootCooldown = 0;
let gameScore = 0;
let gameAnimationId = null;
let obstacleInterval = null;

// DOM elements
const gameCanvas = document.getElementById("gameCanvas");
const gameHud = document.getElementById("gameHud");

// Test mode - cho phép test bằng bàn phím nếu tracking không hoạt động
let testMode = true;  // Bật test mode để debug

// Điều khiển test bằng bàn phím
function setupKeyboardControls() {
  window.addEventListener('keydown', (e) => {
    if (!testMode) return;
    
    switch(e.key) {
      case 'ArrowLeft':
        trackingData.headX = Math.max(0, trackingData.headX - 0.1);
        console.log(`← Left pressed: headX=${trackingData.headX}`);
        break;
      case 'ArrowRight':
        trackingData.headX = Math.min(1, trackingData.headX + 0.1);
        console.log(`→ Right pressed: headX=${trackingData.headX}`);
        break;
      case 'ArrowUp':
        trackingData.speed = Math.min(1.2, trackingData.speed + 0.2);
        console.log(`↑ Speed up: speed=${trackingData.speed}`);
        break;
      case 'ArrowDown':
        trackingData.speed = Math.max(0, trackingData.speed - 0.2);
        console.log(`↓ Speed down: speed=${trackingData.speed}`);
        break;
      case ' ':
      case 'Space':
        trackingData.shooting = true;
        console.log(`🔫 SPACE: Shooting!`);
        setTimeout(() => { trackingData.shooting = false; }, 100);
        break;
      case 't':
      case 'T':
        testMode = !testMode;
        console.log(`Test mode: ${testMode ? 'ON' : 'OFF'}`);
        break;
    }
  });
  
  console.log("🎮 Keyboard controls enabled: ←→ move, ↑↓ speed, SPACE shoot, T toggle test mode");
}

// Khởi tạo game
export function initGame() {
    if (gameInitialized) {
        console.log("Game already initialized");
        return;
    }
    
    console.log("🎮 Initializing Ocean Rush Game...");
    
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    gameBullets = [];
    gameObstacles = [];
    gameOtherPlayers = {};
    
    // Setup keyboard controls
    setupKeyboardControls();
    
    // Kiểm tra canvas
    if (!gameCanvas) {
        console.error("Game canvas not found!");
        return;
    }
    
    if (typeof THREE === 'undefined') {
        console.error("THREE.js not loaded!");
        return;
    }
    
    // Tạo WebGL Renderer
    gameRenderer = new THREE.WebGLRenderer({ 
        canvas: gameCanvas, 
        antialias: true 
    });
    
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Tạo Scene
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.Fog(0x1b6ca8, 10, 120);
    gameScene.background = new THREE.Color(0x1b6ca8);
    
    // Tạo Camera
    gameCamera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    gameCamera.position.set(0, 6, 12);
    
    // Ánh sáng
    const ambient = new THREE.AmbientLight(0xffffff, 1);
    gameScene.add(ambient);
    
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(10, 20, 10);
    gameScene.add(sun);
    
    // Đại dương
    const ocean = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400, 50, 50),
        new THREE.MeshPhongMaterial({ color: 0x1b6ca8, flatShading: true })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.5;
    gameScene.add(ocean);
    
    // Tàu của người chơi
    gameShip = new THREE.Group();
    
    const hull = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1, 4),
        new THREE.MeshPhongMaterial({ color: 0xff4444 })
    );
    hull.position.y = 0.5;
    gameShip.add(hull);
    
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 3.5),
        new THREE.MeshPhongMaterial({ color: 0xccaa66 })
    );
    deck.position.y = 1;
    gameShip.add(deck);
    
    const cannon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 2),
        new THREE.MeshPhongMaterial({ color: 0x222222 })
    );
    cannon.rotation.z = Math.PI / 2;
    cannon.position.set(0, 1, -1);
    gameShip.add(cannon);
    gameShip.cannon = cannon;
    
    gameScene.add(gameShip);
    
    // Bắt đầu tracking (vẫn chạy nhưng có test mode)
    startGameTracking();
    
    // Tạo chướng ngại vật
    obstacleInterval = setInterval(() => {
        if (gameActive) createGameObstacle();
    }, 800);
    
    // Bắt đầu animation
    startGameLoop();
    
    // Xử lý resize
    window.addEventListener("resize", handleGameResize);
    
    // Cập nhật UI
    updateGameUI(0, 0, "🎮 GAME STARTED! (Press T for test mode)");
    
    console.log("🎮 Game initialized successfully!");
    console.log("🎮 TEST MODE: Use arrow keys to move, SPACE to shoot!");
}

// Tạo chướng ngại vật
function createGameObstacle() {
    if (!gameActive || !gameShip) return;
    
    const obstacle = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.5, 1.5),
        new THREE.MeshPhongMaterial({ color: 0x333333 })
    );
    obstacle.position.set(
        (Math.random() - 0.5) * 16,
        0.8,
        gameShip.position.z - 100
    );
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
}

// Bắn đạn
function fireGameBullet() {
    if (!gameActive) return;
    
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    bullet.position.copy(gameShip.position);
    bullet.position.y = 1;
    bullet.userData = { velocityZ: -2 };
    gameScene.add(bullet);
    gameBullets.push(bullet);
    
    console.log(`🔫 Bullet fired! Total bullets: ${gameBullets.length}`);
}

function updateGameUI(speed, score, status) {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const statusElem = document.getElementById("gameStatus");
    
    if (speedElem) speedElem.innerHTML = `🚤 Speed: ${speed.toFixed(2)}`;
    if (scoreElem) scoreElem.innerHTML = `💥 Score: ${score}`;
    if (statusElem && status) statusElem.innerHTML = status;
}

// Vòng lặp game
function startGameLoop() {
    function animate() {
        if (!gameActive) return;
        
        gameAnimationId = requestAnimationFrame(animate);
        
        // Lấy dữ liệu tracking (hoặc từ test mode)
        let headX = trackingData.headX;
        let speed = trackingData.speed;
        let shooting = trackingData.shooting;
        
        // Giới hạn giá trị
        headX = Math.min(0.9, Math.max(0.1, headX));
        
        // Di chuyển tàu theo đầu
        const targetX = (headX - 0.5) * 18;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.1;
        
        // Giới hạn vị trí tàu
        gameShip.position.x = Math.min(8, Math.max(-8, gameShip.position.x));
        
        // Di chuyển tàu theo trục Z (tốc độ)
        gameShip.position.z -= speed * 0.5;
        
        // Xoay tàu
        gameShip.rotation.z = -(headX - 0.5) * 0.8;
        
        // Bắn đạn
        if (shooting && gameShootCooldown <= 0) {
            fireGameBullet();
            updateGameUI(speed, gameScore, "💥 FIRE!");
            gameShootCooldown = 15;
            trackingData.shooting = false; // Reset shooting flag
        }
        gameShootCooldown--;
        
        // Di chuyển đạn
        gameBullets.forEach((bullet, i) => {
            bullet.position.z += bullet.userData.velocityZ;
            if (bullet.position.z < -20 || bullet.position.z > 20) {
                gameScene.remove(bullet);
                gameBullets.splice(i, 1);
            }
        });
        
        // Di chuyển chướng ngại vật
        gameObstacles.forEach((obstacle, i) => {
            obstacle.position.z += speed * 0.5 + 0.3;
            obstacle.rotation.x += 0.02;
            obstacle.rotation.y += 0.03;
            
            if (obstacle.position.z > 20) {
                gameScene.remove(obstacle);
                gameObstacles.splice(i, 1);
            }
        });
        
        // Xử lý va chạm
        gameObstacles.forEach((obstacle, oi) => {
            gameBullets.forEach((bullet, bi) => {
                if (obstacle.position.distanceTo(bullet.position) < 1.2) {
                    gameScene.remove(obstacle);
                    gameScene.remove(bullet);
                    gameObstacles.splice(oi, 1);
                    gameBullets.splice(bi, 1);
                    gameScore += 10;
                    updateGameUI(speed, gameScore, "🎯 HIT! +10");
                    console.log(`💥 HIT! Score: ${gameScore}`);
                }
            });
        });
        
        // Cập nhật camera
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.05;
        gameCamera.position.z = gameShip.position.z + 12;
        gameCamera.lookAt(gameShip.position);
        
        // Cập nhật UI
        updateGameUI(speed, gameScore, null);
        
        // Render scene
        if (gameRenderer && gameScene && gameCamera) {
            gameRenderer.render(gameScene, gameCamera);
        }
    }
    
    animate();
}

function handleGameResize() {
    if (!gameActive) return;
    if (gameRenderer) gameRenderer.setSize(window.innerWidth, window.innerHeight);
    if (gameCamera) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
    }
}

export function stopGame() {
    console.log("🎮 Stopping game...");
    gameActive = false;
    
    if (gameAnimationId) {
        cancelAnimationFrame(gameAnimationId);
        gameAnimationId = null;
    }
    
    if (obstacleInterval) {
        clearInterval(obstacleInterval);
        obstacleInterval = null;
    }
    
    stopGameTracking();
    
    if (gameScene) {
        gameBullets.forEach(bullet => gameScene.remove(bullet));
        gameObstacles.forEach(obstacle => gameScene.remove(obstacle));
        Object.values(gameOtherPlayers).forEach(player => gameScene.remove(player));
        if (gameShip) gameScene.remove(gameShip);
    }
    
    gameBullets = [];
    gameObstacles = [];
    gameOtherPlayers = {};
    gameScore = 0;
    gameInitialized = false;
}

window.initGame = initGame;
window.stopGame = stopGame;
