// ========== OCEAN RUSH GAME - TÍCH HỢP VÀO CHIRI AI ==========
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
    
    // Kiểm tra canvas tồn tại
    if (!gameCanvas) {
        console.error("Game canvas not found!");
        return;
    }
    
    // Kiểm tra THREE đã load
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
    
    // Bắt đầu tracking
    startGameTracking();
    
    // Kết nối socket cho game
    initGameSocket();
    
    // Lắng nghe người chơi khác
    listenPlayers((players) => {
        updateGamePlayersUI(players);
        
        Object.entries(players).forEach(([id, data]) => {
            if (!gameOtherPlayers[id]) {
                const mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 1, 4),
                    new THREE.MeshPhongMaterial({ color: 0x00ffcc })
                );
                mesh.position.y = 0.5;
                gameScene.add(mesh);
                gameOtherPlayers[id] = mesh;
            }
            if (gameOtherPlayers[id]) {
                gameOtherPlayers[id].position.x = data.x;
                gameOtherPlayers[id].position.z = data.z;
                gameOtherPlayers[id].rotation.z = data.rotation;
            }
        });
        
        // Xóa người chơi đã rời
        Object.keys(gameOtherPlayers).forEach(id => {
            if (!players[id]) {
                gameScene.remove(gameOtherPlayers[id]);
                delete gameOtherPlayers[id];
            }
        });
    });
    
    // Tạo chướng ngại vật định kỳ
    obstacleInterval = setInterval(() => {
        if (gameActive) createGameObstacle();
    }, 800);
    
    // Bắt đầu animation
    startGameLoop();
    
    // Xử lý resize
    window.addEventListener("resize", handleGameResize);
    
    // Cập nhật UI
    updateGameUI(0, 0, "🎮 GAME STARTED!");
    
    console.log("🎮 Game initialized successfully!");
}

// Tạo chướng ngại vật
function createGameObstacle() {
    if (!gameActive || !gameShip) return;
    
    const colors = [0x333333, 0x552222, 0x225522];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const obstacle = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.5, 1.5),
        new THREE.MeshPhongMaterial({ color: color })
    );
    obstacle.position.set(
        (Math.random() - 0.5) * 16,
        0.8,
        gameShip.position.z - 120
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
}

// Cập nhật UI game
function updateGamePlayersUI(players) {
    const playersElem = document.getElementById("gamePlayers");
    if (playersElem) playersElem.innerHTML = `👥 Players: ${Object.keys(players).length}`;
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
        
        // Lấy dữ liệu tracking
        const targetX = (trackingData.headX - 0.5) * 18;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.08;
        
        const speed = trackingData.speed * 0.8;
        gameShip.position.z -= speed;
        gameShip.rotation.z = -(trackingData.headX - 0.5) * 0.8;
        
        if (gameShip.cannon) {
            gameShip.cannon.rotation.y = -trackingData.cannonAngle;
        }
        
        // Bắn đạn
        if (trackingData.shooting && gameShootCooldown <= 0) {
            fireGameBullet();
            updateGameUI(speed, gameScore, "💥 FIRE!");
            gameShootCooldown = 15;
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
            obstacle.position.z += speed + 0.7;
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
                }
            });
        });
        
        // Gửi vị trí đến server
        sendPlayer({
            x: gameShip.position.x,
            z: gameShip.position.z,
            rotation: gameShip.rotation.z
        });
        
        // Cập nhật camera
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.05;
        gameCamera.position.z = gameShip.position.z + 12;
        gameCamera.lookAt(gameShip.position);
        
        // Cập nhật UI tốc độ
        updateGameUI(speed, gameScore, null);
        
        // Render scene
        if (gameRenderer && gameScene && gameCamera) {
            gameRenderer.render(gameScene, gameCamera);
        }
    }
    
    animate();
}

// Xử lý resize
function handleGameResize() {
    if (!gameActive) return;
    if (gameRenderer) gameRenderer.setSize(window.innerWidth, window.innerHeight);
    if (gameCamera) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
    }
}

// Dừng game
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
    
    // Dọn dẹp scene
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

// Xuất các hàm ra window
window.initGame = initGame;
window.stopGame = stopGame;
