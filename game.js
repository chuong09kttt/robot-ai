// ========== OCEAN RUSH GAME - FULL FEATURES ==========
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
let wavesMesh = null;  // Khai báo waves mesh

// DOM elements
const gameCanvas = document.getElementById("gameCanvas");

// Audio contexts
let audioContext = null;

// Tạo âm thanh đơn giản bằng Web Audio API
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

function playBackgroundMusic() {
    try {
        initAudio();
        function playLoop() {
            if (!gameActive || gameOverFlag) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 110;
            gainNode.gain.value = 0.03;
            oscillator.type = 'sine';
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 2);
            oscillator.stop(audioContext.currentTime + 2);
            setTimeout(playLoop, 2000);
        }
        playLoop();
    } catch(e) { console.log("Background music error:", e); }
}

// Tạo hiệu ứng nổ
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

// Tạo tàu chi tiết
function createDetailedShip() {
    const ship = new THREE.Group();
    
    // Thân tàu chính
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
    
    // Hiệu ứng glow
    const glowGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0.5, 1.4);
    ship.add(glow);
    
    return ship;
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
    
    // Khởi tạo âm thanh
    initAudio();
    playBackgroundMusic();
    
    // Tạo WebGL Renderer
    gameRenderer = new THREE.WebGLRenderer({ 
        canvas: gameCanvas, 
        antialias: true 
    });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Tạo Scene
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.FogExp2(0x1b6ca8, 0.008);
    gameScene.background = new THREE.Color(0x1b6ca8);
    
    // Tạo Camera
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
    sun.castShadow = true;
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
    
    // Sóng - KHỞI TẠO ĐÚNG BIẾN wavesMesh
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
        return cloudGroup;
    }
    
    for (let i = 0; i < 20; i++) {
        addCloud((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 100 - 50, 0.8 + Math.random() * 0.7);
    }
    
    // Tàu người chơi
    gameShip = createDetailedShip();
    gameScene.add(gameShip);
    
    // Bắt đầu tracking
    startGameTracking();
    
    // Tạo chướng ngại vật
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createGameObstacle();
    }, 1000);
    
    // Bắt đầu animation
    startGameLoop();
    
    // Xử lý resize
    window.addEventListener("resize", handleGameResize);
    
    // Tạo lives display
    const hud = document.getElementById("gameHud");
    if (hud && !document.getElementById("gameLives")) {
        const livesDiv = document.createElement("div");
        livesDiv.id = "gameLives";
        livesDiv.innerHTML = `❤️ Lives: ${lives}`;
        hud.appendChild(livesDiv);
    }
    
    // Cập nhật UI
    updateGameUI();
    
    console.log("🎮 Game initialized successfully!");
}

// Tạo chướng ngại vật
function createGameObstacle() {
    if (!gameActive || !gameShip || gameOverFlag) return;
    
    const types = [
        { color: 0x666666, name: 'rock', scale: 0.8 },
        { color: 0x8B5A2B, name: 'barrel', scale: 0.7 },
        { color: 0x4a6e8a, name: 'iceberg', scale: 1.0 }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry;
    if (type.name === 'rock') {
        geometry = new THREE.DodecahedronGeometry(0.6);
    } else if (type.name === 'barrel') {
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 8);
    } else {
        geometry = new THREE.ConeGeometry(0.7, 0.9, 6);
    }
    
    const obstacle = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: type.color, shininess: 30 })
    );
    obstacle.position.set(
        (Math.random() - 0.5) * 14,
        0.3,
        gameShip.position.z - 80
    );
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
}

// Bắn đạn
function fireGameBullet() {
    if (!gameActive || gameOverFlag) return;
    
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.15),
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    
    bullet.position.copy(gameShip.position);
    bullet.position.z += 1.5;
    bullet.position.y = 0.8;
    bullet.userData = { velocityZ: -2.5 };
    
    gameScene.add(bullet);
    gameBullets.push(bullet);
    
    playShootSound();
    
    if (gameShip.cannon) {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.2),
            new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        );
        flash.position.copy(bullet.position);
        gameScene.add(flash);
        setTimeout(() => gameScene.remove(flash), 50);
    }
}

function updateGameUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    const statusElem = document.getElementById("gameStatus");
    
    if (speedElem && trackingData) {
        speedElem.innerHTML = `🚤 Speed: ${(trackingData.speed * 2).toFixed(1)}`;
    }
    if (scoreElem) scoreElem.innerHTML = `💥 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
    
    if (gameScore >= 100 && !gameOverFlag) {
        gameActive = false;
        if (statusElem) {
            statusElem.innerHTML = "🎉 VICTORY! YOU WIN! 🎉";
            statusElem.style.color = "#00ff88";
        }
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
    
    const gameOverText = document.createElement("div");
    gameOverText.innerHTML = "GAME OVER - Click HOME to play again";
    gameOverText.style.position = "absolute";
    gameOverText.style.top = "50%";
    gameOverText.style.left = "50%";
    gameOverText.style.transform = "translate(-50%, -50%)";
    gameOverText.style.color = "#ff4444";
    gameOverText.style.fontSize = "32px";
    gameOverText.style.fontFamily = "Orbitron, monospace";
    gameOverText.style.zIndex = "100";
    gameOverText.style.textShadow = "0 0 10px red";
    gameOverText.style.backgroundColor = "rgba(0,0,0,0.7)";
    gameOverText.style.padding = "20px";
    gameOverText.style.borderRadius = "10px";
    gameOverText.style.border = "2px solid #ff4444";
    document.body.appendChild(gameOverText);
    
    setTimeout(() => gameOverText.remove(), 3000);
    
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
            if (gameShip.children[0] && Math.floor(Date.now() / 100) % 2 === 0) {
                gameShip.children[0].material.emissive = { r: 1, g: 0, b: 0 };
            } else if (gameShip.children[0]) {
                gameShip.children[0].material.emissive = { r: 0, g: 0, b: 0 };
            }
        }
        
        let headX = trackingData.headX;
        let speed = trackingData.speed * 1.5;
        
        // headX = 0 (trái) -> targetX = -9 (trái)
        // headX = 1 (phải) -> targetX = 9 (phải)
        const targetX = (headX - 0.5) * 18;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.12;
        
        gameShip.position.x = Math.min(9, Math.max(-9, gameShip.position.x));
        gameShip.position.z -= speed * 0.4;
        gameShip.rotation.z = -(targetX / 20);
        
        const mast = gameShip.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.y > 1);
        if (mast) mast.rotation.z = Math.sin(Date.now() * 0.003) * 0.03;
        
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireGameBullet();
            gameShootCooldown = 12;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        for (let i = gameBullets.length - 1; i >= 0; i--) {
            const bullet = gameBullets[i];
            bullet.position.z += bullet.userData.velocityZ;
            if (bullet.position.z < -30 || bullet.position.z > 30) {
                gameScene.remove(bullet);
                gameBullets.splice(i, 1);
            }
        }
        
        for (let i = gameObstacles.length - 1; i >= 0; i--) {
            const obstacle = gameObstacles[i];
            obstacle.position.z += speed * 0.4 + 0.5;
            obstacle.rotation.x += 0.03;
            obstacle.rotation.y += 0.04;
            obstacle.rotation.z += 0.02;
            
            if (obstacle.position.distanceTo(gameShip.position) < 1.2) {
                handleShipCollision(obstacle);
                continue;
            }
            
            if (obstacle.position.z > 25) {
                gameScene.remove(obstacle);
                gameObstacles.splice(i, 1);
            }
        }
        
        for (let oi = gameObstacles.length - 1; oi >= 0; oi--) {
            const obstacle = gameObstacles[oi];
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
                    break;
                }
            }
        }
        
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
