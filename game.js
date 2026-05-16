// ========== OCEAN RUSH GAME - STEERING WHEEL CONTROL ==========
import { trackingData, startGameTracking, stopGameTracking } from "./tracking.js";
import { sendPlayer, listenPlayers, initGameSocket } from "./networking.js";

// Game variables
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
let lives = 5;
let invincibleFrames = 0;
let gameOverFlag = false;
let wavesMesh = null;
let restartButton = null;

// DOM elements
const gameCanvas = document.getElementById("gameCanvas");

// Audio contexts
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playShootSound() {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.15;
        oscillator.type = 'sine';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch(e) { console.log("Audio error:", e); }
}

function playExplosionSound() {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 200;
        gainNode.gain.value = 0.2;
        oscillator.type = 'sawtooth';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) { console.log("Audio error:", e); }
}

function playHitSound() {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 440;
        gainNode.gain.value = 0.1;
        oscillator.type = 'triangle';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch(e) { console.log("Audio error:", e); }
}

function createExplosion(position) {
    if (!gameScene) return;
    
    const particleCount = 20;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xff6600 })
        );
        particle.position.copy(position);
        particle.userData = {
            velocityX: (Math.random() - 0.5) * 0.5,
            velocityY: Math.random() * 0.5,
            velocityZ: (Math.random() - 0.5) * 0.5,
            life: 30
        };
        gameScene.add(particle);
        particles.push(particle);
    }
    
    function animateParticles() {
        let anyAlive = false;
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            if (particle.userData.life > 0) {
                anyAlive = true;
                particle.userData.life--;
                particle.position.x += particle.userData.velocityX;
                particle.position.y += particle.userData.velocityY;
                particle.position.z += particle.userData.velocityZ;
                particle.material.opacity = particle.userData.life / 30;
                particle.material.transparent = true;
            } else {
                gameScene.remove(particle);
                particles.splice(i, 1);
            }
        }
        if (anyAlive && gameActive) {
            requestAnimationFrame(animateParticles);
        }
    }
    animateParticles();
    
    playExplosionSound();
}

function createDetailedShip() {
    const ship = new THREE.Group();
    
    // Thân tàu
    const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.2, 2.5, 8),
        new THREE.MeshPhongMaterial({ color: 0x8B4513, shininess: 60 })
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.3;
    ship.add(hull);
    
    // Boong tàu
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.2, 2.8),
        new THREE.MeshPhongMaterial({ color: 0xD2B48C })
    );
    deck.position.y = 0.7;
    ship.add(deck);
    
    // Mũi tàu
    const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1, 8),
        new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    );
    bow.position.set(0, 0.5, 1.6);
    bow.rotation.x = 0.3;
    ship.add(bow);
    
    // Đuôi tàu
    const stern = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.5),
        new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    );
    stern.position.set(0, 0.6, -1.4);
    ship.add(stern);
    
    // Cột buồm
    const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 1.8, 6),
        new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    );
    mast.position.set(0, 1.2, -0.2);
    ship.add(mast);
    
    // Buồm
    const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.5),
        new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
    );
    sail.position.set(0, 1.4, 0);
    ship.add(sail);
    
    // Cờ
    const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.3),
        new THREE.MeshPhongMaterial({ color: 0xFF0000, side: THREE.DoubleSide })
    );
    flag.position.set(0.1, 2, -0.2);
    flag.rotation.z = 0.2;
    ship.add(flag);
    
    // Pháo
    const cannon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6),
        new THREE.MeshPhongMaterial({ color: 0x333333 })
    );
    cannon.rotation.z = Math.PI / 2;
    cannon.position.set(0, 0.6, 1.2);
    ship.add(cannon);
    ship.cannon = cannon;
    
    return ship;
}

// Tạo nút chơi lại
function createRestartButton() {
    if (restartButton) {
        restartButton.remove();
        restartButton = null;
    }
    
    restartButton = document.createElement("button");
    restartButton.innerHTML = "🔄 CHƠI LẠI";
    restartButton.style.position = "absolute";
    restartButton.style.top = "60%";
    restartButton.style.left = "50%";
    restartButton.style.transform = "translate(-50%, -50%)";
    restartButton.style.padding = "15px 40px";
    restartButton.style.fontSize = "24px";
    restartButton.style.fontFamily = "Orbitron, monospace";
    restartButton.style.fontWeight = "bold";
    restartButton.style.color = "#00ffff";
    restartButton.style.backgroundColor = "rgba(0,0,0,0.8)";
    restartButton.style.border = "2px solid #00ffff";
    restartButton.style.borderRadius = "10px";
    restartButton.style.cursor = "pointer";
    restartButton.style.zIndex = "100";
    restartButton.style.boxShadow = "0 0 20px rgba(0,255,255,0.5)";
    restartButton.style.transition = "all 0.3s";
    
    restartButton.onmouseover = () => {
        restartButton.style.backgroundColor = "#00ffff";
        restartButton.style.color = "#000";
        restartButton.style.transform = "translate(-50%, -50%) scale(1.05)";
    };
    restartButton.onmouseout = () => {
        restartButton.style.backgroundColor = "rgba(0,0,0,0.8)";
        restartButton.style.color = "#00ffff";
        restartButton.style.transform = "translate(-50%, -50%) scale(1)";
    };
    
    restartButton.onclick = () => {
        console.log("🔄 Restarting game...");
        restartButton.remove();
        restartButton = null;
        resetGame();
    };
    
    document.body.appendChild(restartButton);
}

// Reset game
function resetGame() {
    // Dọn dẹp game cũ
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    
    if (gameScene) {
        gameBullets.forEach(bullet => gameScene.remove(bullet));
        gameObstacles.forEach(obstacle => gameScene.remove(obstacle));
        Object.values(gameOtherPlayers).forEach(player => gameScene.remove(player));
        if (gameShip) gameScene.remove(gameShip);
    }
    
    // Reset variables
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameBullets = [];
    gameObstacles = [];
    gameOtherPlayers = {};
    gameShootCooldown = 0;
    
    // Reset ship position
    if (gameShip) {
        gameShip.position.set(0, 0, 0);
        gameShip.rotation.set(0, 0, 0);
    }
    
    // Reset camera
    if (gameCamera) {
        gameCamera.position.set(0, 5, 10);
    }
    
    // Reset UI
    const statusElem = document.getElementById("gameStatus");
    if (statusElem) {
        statusElem.innerHTML = "🎮 GAME RESTARTED!";
        statusElem.style.color = "#ff00ff";
        statusElem.style.fontSize = "14px";
    }
    
    updateGameUI();
    
    // Tạo lại obstacles interval
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createGameObstacle();
    }, 1000);
    
    // Chạy lại animation
    startGameLoop();
    
    console.log("🎮 Game restarted!");
}

export function initGame() {
    if (gameInitialized) {
        console.log("Game already initialized");
        return;
    }
    
    console.log("🎮 Initializing Ocean Rush Game with Steering Wheel...");
    
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameOverFlag = false;
    gameBullets = [];
    gameObstacles = [];
    gameOtherPlayers = {};
    gameShootCooldown = 0;
    
    if (!gameCanvas) {
        console.error("Game canvas not found!");
        return;
    }
    
    if (typeof THREE === 'undefined') {
        console.error("THREE.js not loaded!");
        return;
    }
    
    initAudio();
    
    gameRenderer = new THREE.WebGLRenderer({ 
        canvas: gameCanvas, 
        antialias: true 
    });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setPixelRatio(window.devicePixelRatio);
    
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.FogExp2(0x1b6ca8, 0.008);
    gameScene.background = new THREE.Color(0x1b6ca8);
    
    gameCamera = new THREE.PerspectiveCamera(
        65,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    gameCamera.position.set(0, 5, 10);
    
    // Ánh sáng
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    gameScene.add(ambient);
    
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sun.position.set(10, 20, 5);
    gameScene.add(sun);
    
    const backLight = new THREE.PointLight(0x4466cc, 0.5);
    backLight.position.set(0, 5, -10);
    gameScene.add(backLight);
    
    // Đại dương
    const oceanGeometry = new THREE.PlaneGeometry(400, 400, 100, 100);
    const oceanMaterial = new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 80 });
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.8;
    gameScene.add(ocean);
    
    // Sóng
    const waveGeometry = new THREE.PlaneGeometry(400, 400, 100, 100);
    const waveMaterial = new THREE.MeshPhongMaterial({ color: 0x3a8faf, transparent: true, opacity: 0.4 });
    wavesMesh = new THREE.Mesh(waveGeometry, waveMaterial);
    wavesMesh.rotation.x = -Math.PI / 2;
    wavesMesh.position.y = -0.6;
    gameScene.add(wavesMesh);
    
    // Mây
    function addCloud(x, z, scale) {
        const cloudGroup = new THREE.Group();
        const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        const parts = [0.8, 0.6, 0.7, 0.5, 0.6];
        parts.forEach((size, i) => {
            const part = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), cloudMat);
            part.position.set((i - 2) * 0.6, 0, (i % 2) * 0.4);
            cloudGroup.add(part);
        });
        cloudGroup.position.set(x, 4 + Math.random() * 2, z);
        cloudGroup.scale.set(scale, scale, scale);
        gameScene.add(cloudGroup);
    }
    
    for (let i = 0; i < 20; i++) {
        addCloud((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 100 - 50, 0.8 + Math.random() * 0.7);
    }
    
    gameShip = createDetailedShip();
    gameScene.add(gameShip);
    
    startGameTracking();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createGameObstacle();
    }, 1000);
    
    startGameLoop();
    
    window.addEventListener("resize", handleGameResize);
    
    const hud = document.getElementById("gameHud");
    if (hud && !document.getElementById("gameLives")) {
        const livesDiv = document.createElement("div");
        livesDiv.id = "gameLives";
        livesDiv.innerHTML = `❤️ Lives: ${lives}`;
        hud.appendChild(livesDiv);
    }
    
    const instruction = document.querySelector(".game-instruction");
    if (instruction) {
        instruction.innerHTML = `🎮 <span>ĐIỀU KHIỂN:</span> Giơ 2 tay như cầm vô lăng → xoay để lái | Đầu nâng cao → tăng tốc | Đầu cúi thấp → giảm tốc | Nắm tay → bắn đạn`;
    }
    
    updateGameUI();
    
    console.log("🎮 Game initialized! Hold your hands like a steering wheel!");
}

function createGameObstacle() {
    if (!gameActive || !gameShip || gameOverFlag) return;
    
    const geometry = new THREE.DodecahedronGeometry(0.6);
    const obstacle = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: 0x666666, shininess: 30 })
    );
    obstacle.position.set(
        (Math.random() - 0.5) * 14,
        0.3,
        gameShip.position.z - 80
    );
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
}

function fireGameBullet() {
    if (!gameActive || gameOverFlag) return;
    
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.15),
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    
    // Đạn bay ra từ mũi tàu
    bullet.position.copy(gameShip.position);
    bullet.position.z += 1.8;  // Phía trước mũi thuyền
    bullet.position.y = 0.8;
    bullet.userData = { velocityZ: -3 };
    
    gameScene.add(bullet);
    gameBullets.push(bullet);
    
    playShootSound();
}

function updateGameUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    
    if (speedElem && trackingData) {
        speedElem.innerHTML = `🚤 Speed: ${(trackingData.speed * 2).toFixed(1)}`;
    }
    if (scoreElem) scoreElem.innerHTML = `💥 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
    
    if (gameScore >= 100 && !gameOverFlag) {
        gameActive = false;
        gameOverFlag = true;
        const statusElem = document.getElementById("gameStatus");
        if (statusElem) {
            statusElem.innerHTML = "🎉 VICTORY! YOU WIN! 🎉";
            statusElem.style.color = "#00ff88";
        }
        createRestartButton();
    }
}

function gameOver() {
    if (gameOverFlag) return;
    
    gameOverFlag = true;
    gameActive = false;
    
    const statusElem = document.getElementById("gameStatus");
    if (statusElem) {
        statusElem.innerHTML = "💀 GAME OVER! 💀";
        statusElem.style.color = "#ff4444";
        statusElem.style.fontSize = "24px";
    }
    
    createRestartButton();
    
    console.log("💀 GAME OVER! Final score:", gameScore);
}

function handleShipCollision(obstacle) {
    if (invincibleFrames > 0) return;
    
    lives--;
    invincibleFrames = 60;
    
    playHitSound();
    createExplosion(obstacle.position);
    
    gameScene.remove(obstacle);
    const index = gameObstacles.indexOf(obstacle);
    if (index > -1) gameObstacles.splice(index, 1);
    
    updateGameUI();
    
    if (lives <= 0) {
        gameOver();
    }
}

function startGameLoop() {
    function animate() {
        if (!gameActive) {
            if (gameRenderer && gameScene && gameCamera) {
                gameRenderer.render(gameScene, gameCamera);
            }
            requestAnimationFrame(animate);
            return;
        }
        
        gameAnimationId = requestAnimationFrame(animate);
        
        if (invincibleFrames > 0) {
            invincibleFrames--;
        }
        
        // ĐIỀU KHIỂN BẰNG VÔ LĂNG
        let steeringAngle = trackingData.steeringAngle || 0;
        let speed = trackingData.speed * 1.2;
        
        // Xoay thuyền theo góc vô lăng
        gameShip.rotation.z = -steeringAngle * 0.8;
        
        // Di chuyển thuyền theo hướng vô lăng
        // steeringAngle > 0 (xoay phải) -> di chuyển sang phải
        // steeringAngle < 0 (xoay trái) -> di chuyển sang trái
        const moveX = steeringAngle * 5;
        gameShip.position.x += (moveX - gameShip.position.x) * 0.1;
        
        // Giới hạn vị trí
        gameShip.position.x = Math.min(9, Math.max(-9, gameShip.position.x));
        
        // Di chuyển tàu theo trục Z (tốc độ)
        gameShip.position.z -= speed * 0.35;
        
        // Xoay cột buồm
        const mast = gameShip.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.y > 1);
        if (mast) mast.rotation.z = Math.sin(Date.now() * 0.003) * 0.03;
        
        // Bắn đạn
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireGameBullet();
            gameShootCooldown = 10;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        // Di chuyển đạn
        for (let i = gameBullets.length - 1; i >= 0; i--) {
            const bullet = gameBullets[i];
            bullet.position.z += bullet.userData.velocityZ;
            if (bullet.position.z < -30 || bullet.position.z > 30) {
                gameScene.remove(bullet);
                gameBullets.splice(i, 1);
            }
        }
        
        // Di chuyển chướng ngại vật và xử lý va chạm
        for (let i = gameObstacles.length - 1; i >= 0; i--) {
            const obstacle = gameObstacles[i];
            obstacle.position.z += speed * 0.4 + 0.5;
            obstacle.rotation.x += 0.03;
            obstacle.rotation.y += 0.04;
            
            // Kiểm tra va chạm với MŨI THUYỀN (phía trước)
            const shipFrontX = gameShip.position.x;
            const shipFrontZ = gameShip.position.z + 1.2; // Mũi thuyền
            
            const dx = obstacle.position.x - shipFrontX;
            const dz = obstacle.position.z - shipFrontZ;
            const distance = Math.sqrt(dx*dx + dz*dz);
            
            if (distance < 1.0) {
                handleShipCollision(obstacle);
                continue;
            }
            
            if (obstacle.position.z > 25) {
                gameScene.remove(obstacle);
                gameObstacles.splice(i, 1);
            }
        }
        
        // Xử lý va chạm đạn với vật cản
        for (let oi = gameObstacles.length - 1; oi >= 0; oi--) {
            const obstacle = gameObstacles[oi];
            let hit = false;
            
            for (let bi = gameBullets.length - 1; bi >= 0; bi--) {
                const bullet = gameBullets[bi];
                if (obstacle.position.distanceTo(bullet.position) < 0.9) {
                    gameScene.remove(obstacle);
                    gameScene.remove(bullet);
                    gameObstacles.splice(oi, 1);
                    gameBullets.splice(bi, 1);
                    gameScore += 10;
                    updateGameUI();
                    createExplosion(obstacle.position);
                    hit = true;
                    break;
                }
            }
            if (hit) continue;
        }
        
        // Cập nhật camera
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.06;
        gameCamera.position.z = gameShip.position.z + 8;
        gameCamera.lookAt(gameShip.position);
        
        if (wavesMesh) {
            wavesMesh.rotation.z = Math.sin(Date.now() * 0.002) * 0.05;
        }
        
        updateGameUI();
        
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
    
    if (restartButton) {
        restartButton.remove();
        restartButton = null;
    }
    
    stopGameTracking();
    
    if (gameScene) {
        gameBullets.forEach(bullet => gameScene.remove(bullet));
        gameObstacles.forEach(obstacle => gameScene.remove(obstacle));
        Object.values(gameOtherPlayers).forEach(player => gameScene.remove(player));
        if (gameShip) gameScene.remove(gameShip);
        if (wavesMesh) gameScene.remove(wavesMesh);
    }
    
    gameBullets = [];
    gameObstacles = [];
    gameOtherPlayers = {};
    gameScore = 0;
    lives = 5;
    gameInitialized = false;
    gameOverFlag = false;
    wavesMesh = null;
}

window.initGame = initGame;
window.stopGame = stopGame;
