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
let gameLoopRunning = false;

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
    // Xóa nút cũ nếu có
    if (restartButton) {
        restartButton.remove();
        restartButton = null;
    }
    
    // Tạo overlay nền mờ
    const overlay = document.createElement("div");
    overlay.id = "gameOverlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.7)";
    overlay.style.zIndex = "99";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.flexDirection = "column";
    document.body.appendChild(overlay);
    
    // Tạo nút chơi lại
    restartButton = document.createElement("button");
    restartButton.innerHTML = "🔄 CHƠI LẠI";
    restartButton.style.padding = "18px 50px";
    restartButton.style.fontSize = "28px";
    restartButton.style.fontFamily = "Orbitron, monospace";
    restartButton.style.fontWeight = "bold";
    restartButton.style.color = "#00ffff";
    restartButton.style.backgroundColor = "rgba(0,0,0,0.9)";
    restartButton.style.border = "3px solid #00ffff";
    restartButton.style.borderRadius = "15px";
    restartButton.style.cursor = "pointer";
    restartButton.style.zIndex = "100";
    restartButton.style.boxShadow = "0 0 30px rgba(0,255,255,0.5)";
    restartButton.style.transition = "all 0.3s ease";
    
    restartButton.onmouseover = () => {
        restartButton.style.backgroundColor = "#00ffff";
        restartButton.style.color = "#000";
        restartButton.style.transform = "scale(1.05)";
        restartButton.style.boxShadow = "0 0 50px rgba(0,255,255,0.8)";
    };
    restartButton.onmouseout = () => {
        restartButton.style.backgroundColor = "rgba(0,0,0,0.9)";
        restartButton.style.color = "#00ffff";
        restartButton.style.transform = "scale(1)";
        restartButton.style.boxShadow = "0 0 30px rgba(0,255,255,0.5)";
    };
    
    restartButton.onclick = () => {
        console.log("🔄 Restarting game...");
        // Xóa overlay và nút
        const overlayEl = document.getElementById("gameOverlay");
        if (overlayEl) overlayEl.remove();
        restartButton.remove();
        restartButton = null;
        resetGame();
    };
    
    overlay.appendChild(restartButton);
    
    // Thêm text điểm số
    const scoreText = document.createElement("div");
    scoreText.innerHTML = `🎯 ĐIỂM CỦA BẠN: ${gameScore}`;
    scoreText.style.color = "#ffff00";
    scoreText.style.fontSize = "24px";
    scoreText.style.fontFamily = "Orbitron, monospace";
    scoreText.style.marginBottom = "20px";
    scoreText.style.textShadow = "0 0 10px #ff00ff";
    overlay.appendChild(scoreText);
}

function resetGame() {
    console.log("🔄 Resetting game...");
    
    // Dừng các interval và animation cũ
    if (obstacleInterval) {
        clearInterval(obstacleInterval);
        obstacleInterval = null;
    }
    if (gameAnimationId) {
        cancelAnimationFrame(gameAnimationId);
        gameAnimationId = null;
    }
    
    // Xóa tất cả vật cản và đạn cũ
    if (gameScene) {
        gameBullets.forEach(bullet => {
            if (bullet.parent) gameScene.remove(bullet);
        });
        gameObstacles.forEach(obstacle => {
            if (obstacle.parent) gameScene.remove(obstacle);
        });
    }
    
    // Reset biến
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameBullets = [];
    gameObstacles = [];
    gameShootCooldown = 0;
    
    // Reset vị trí thuyền
    if (gameShip) {
        gameShip.position.set(0, 0, 0);
        gameShip.rotation.set(0, 0, 0);
    }
    
    // Reset camera
    if (gameCamera) {
        gameCamera.position.set(0, 5, 10);
        gameCamera.lookAt(0, 0, 0);
    }
    
    // Reset UI
    const statusElem = document.getElementById("gameStatus");
    if (statusElem) {
        statusElem.innerHTML = "🎮 GAME RESTARTED!";
        statusElem.style.color = "#ff00ff";
        statusElem.style.fontSize = "14px";
        setTimeout(() => {
            if (statusElem && !gameOverFlag) {
                statusElem.innerHTML = "🎮 READY";
                statusElem.style.color = "#ff00ff";
            }
        }, 2000);
    }
    
    updateGameUI();
    
    // Tạo lại interval tạo vật cản
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag && gameShip) {
            createGameObstacle();
        }
    }, 800);
    
    // Khởi động lại game loop nếu chưa chạy
    if (!gameLoopRunning) {
        startGameLoop();
    }
    
    console.log("🎮 Game reset complete!");
}

export function initGame() {
    if (gameInitialized) {
        console.log("Game already initialized");
        // Nếu game đã khởi tạo nhưng đang game over, reset
        if (gameOverFlag) {
            resetGame();
        }
        return;
    }
    
    console.log("🎮 Initializing Ocean Rush Game...");
    
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameOverFlag = false;
    gameBullets = [];
    gameObstacles = [];
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
    gameRenderer.setClearColor(0x1b6ca8);
    
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.FogExp2(0x1b6ca8, 0.008);
    gameScene.background = new THREE.Color(0x1b6ca8);
    
    gameCamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    gameCamera.position.set(0, 6, 12);
    gameCamera.lookAt(0, 0, 0);
    
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
    const oceanMaterial = new THREE.MeshPhongMaterial({ color: 0x2a6f8f });
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
    
    // Thêm các hạt nước (hiệu ứng)
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 500;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i*3] = (Math.random() - 0.5) * 200;
        particlePositions[i*3+1] = Math.random() * 2 - 1;
        particlePositions[i*3+2] = (Math.random() - 0.5) * 100 - 50;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0x88ccff, size: 0.05 });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    gameScene.add(particles);
    
    // Tàu
    gameShip = createDetailedShip();
    gameScene.add(gameShip);
    
    // Bắt đầu tracking
    startGameTracking();
    
    // Tạo vật cản
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag && gameShip) {
            createGameObstacle();
        }
    }, 800);
    
    // Tạo UI lives
    const hud = document.getElementById("gameHud");
    if (hud && !document.getElementById("gameLives")) {
        const livesDiv = document.createElement("div");
        livesDiv.id = "gameLives";
        livesDiv.innerHTML = `❤️ Lives: ${lives}`;
        hud.appendChild(livesDiv);
    }
    
    // Cập nhật hướng dẫn
    const instruction = document.querySelector(".game-instruction");
    if (instruction) {
        instruction.innerHTML = `🎮 <span>ĐIỀU KHIỂN:</span> Giơ 2 tay như cầm vô lăng → xoay để lái | Đầu nâng cao → tăng tốc | Đầu cúi thấp → giảm tốc | Nắm tay → bắn`;
    }
    
    updateGameUI();
    
    // Bắt đầu game loop
    startGameLoop();
    
    window.addEventListener("resize", handleGameResize);
    
    console.log("🎮 Game initialized!");
}

// Tạo vật cản - DÀN ĐỀU SANG HAI BÊN
function createGameObstacle() {
    if (!gameActive || !gameShip || gameOverFlag) return;
    
    // Chọn loại vật cản
    const types = [
        { color: 0x666666, name: 'rock', size: 0.6 },
        { color: 0x8B5A2B, name: 'barrel', size: 0.5 },
        { color: 0x4a6e8a, name: 'iceberg', size: 0.7 },
        { color: 0x884444, name: 'crate', size: 0.55 }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry;
    if (type.name === 'rock') {
        geometry = new THREE.DodecahedronGeometry(type.size);
    } else if (type.name === 'barrel') {
        geometry = new THREE.CylinderGeometry(type.size, type.size, 0.8, 8);
    } else if (type.name === 'iceberg') {
        geometry = new THREE.ConeGeometry(type.size, type.size * 1.2, 6);
    } else {
        geometry = new THREE.BoxGeometry(type.size, type.size, type.size);
    }
    
    const obstacle = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: type.color, shininess: 30 })
    );
    
    // DÀN ĐỀU VẬT CẢN SANG HAI BÊN
    // 40% bên trái, 40% bên phải, 20% ở giữa
    let randomX;
    const rand = Math.random();
    if (rand < 0.4) {
        // Bên trái
        randomX = -6 - Math.random() * 3;
    } else if (rand < 0.8) {
        // Bên phải
        randomX = 6 + Math.random() * 3;
    } else {
        // Ở giữa
        randomX = (Math.random() - 0.5) * 4;
    }
    
    obstacle.position.set(
        randomX,
        0.3,
        gameShip.position.z - 100
    );
    
    // Lưu thông tin về vật cản
    obstacle.userData = {
        speed: 0.5 + Math.random() * 0.3,
        type: type.name
    };
    
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
}

function fireGameBullet() {
    if (!gameActive || gameOverFlag) return;
    
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    
    bullet.position.copy(gameShip.position);
    bullet.position.z += 1.8;
    bullet.position.y = 0.7;
    bullet.userData = { velocityZ: -3.5 };
    
    gameScene.add(bullet);
    gameBullets.push(bullet);
    playShootSound();
}

function updateGameUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    
    if (speedElem && trackingData) {
        let displaySpeed = (trackingData.speed * 2).toFixed(1);
        if (displaySpeed < 0.1) displaySpeed = "0.0";
        speedElem.innerHTML = `🚤 Speed: ${displaySpeed}`;
    }
    if (scoreElem) scoreElem.innerHTML = `💥 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
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
    
    console.log("💀 GAME OVER! Final score:", gameScore);
    createRestartButton();
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
    gameLoopRunning = true;
    
    function animate() {
        if (!gameActive) {
            if (gameRenderer && gameScene && gameCamera) {
                gameRenderer.render(gameScene, gameCamera);
            }
            requestAnimationFrame(animate);
            return;
        }
        
        gameAnimationId = requestAnimationFrame(animate);
        
        if (invincibleFrames > 0) invincibleFrames--;
        
        // Lấy dữ liệu từ tracking
        let steeringAngle = trackingData.steeringAngle || 0;
        let speed = (trackingData.speed || 0) * 1.2;
        
        // Đảm bảo tốc độ tối thiểu
        if (speed < 0.1) speed = 0.15;
        
        // Di chuyển thuyền theo vô lăng
        const targetX = steeringAngle * 9;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.12;
        gameShip.position.x = Math.min(9, Math.max(-9, gameShip.position.x));
        
        // Xoay thuyền
        gameShip.rotation.z = -steeringAngle * 0.7;
        
        // Di chuyển tàu tiến lên
        gameShip.position.z -= speed * 0.4;
        
        // Bắn đạn
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireGameBullet();
            gameShootCooldown = 8;
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
        
        // Di chuyển vật cản và kiểm tra va chạm
        for (let i = gameObstacles.length - 1; i >= 0; i--) {
            const obstacle = gameObstacles[i];
            const moveSpeed = (speed * 0.4 + 0.6) * (obstacle.userData.speed || 1);
            obstacle.position.z += moveSpeed;
            obstacle.rotation.x += 0.03;
            obstacle.rotation.y += 0.04;
            obstacle.rotation.z += 0.02;
            
            // Kiểm tra va chạm với mũi thuyền
            const shipFrontZ = gameShip.position.z + 1.5;
            const dx = obstacle.position.x - gameShip.position.x;
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
        
        // Va chạm đạn với vật cản
        for (let oi = gameObstacles.length - 1; oi >= 0; oi--) {
            const obstacle = gameObstacles[oi];
            let hit = false;
            
            for (let bi = gameBullets.length - 1; bi >= 0; bi--) {
                const bullet = gameBullets[bi];
                if (obstacle.position.distanceTo(bullet.position) < 0.8) {
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
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.08;
        gameCamera.position.z = gameShip.position.z + 10;
        gameCamera.position.y = 6 + Math.abs(gameShip.position.x) * 0.1;
        gameCamera.lookAt(gameShip.position);
        
        // Sóng động
        if (wavesMesh) {
            wavesMesh.rotation.z = Math.sin(Date.now() * 0.002) * 0.05;
        }
        
        updateGameUI();
        
        // Kiểm tra chiến thắng
        if (gameScore >= 100 && !gameOverFlag) {
            gameActive = false;
            gameOverFlag = true;
            const statusElem = document.getElementById("gameStatus");
            if (statusElem) {
                statusElem.innerHTML = "🎉 VICTORY! YOU WIN! 🎉";
                statusElem.style.color = "#00ff88";
                statusElem.style.fontSize = "24px";
            }
            createRestartButton();
        }
        
        if (gameRenderer && gameScene && gameCamera) {
            gameRenderer.render(gameScene, gameCamera);
        }
    }
    
    animate();
}

function handleGameResize() {
    if (gameRenderer) gameRenderer.setSize(window.innerWidth, window.innerHeight);
    if (gameCamera) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
    }
}

export function stopGame() {
    console.log("🎮 Stopping game...");
    gameActive = false;
    gameLoopRunning = false;
    
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (restartButton) {
        const overlay = document.getElementById("gameOverlay");
        if (overlay) overlay.remove();
        restartButton = null;
    }
    
    stopGameTracking();
    gameInitialized = false;
}

window.initGame = initGame;
window.stopGame = stopGame;
