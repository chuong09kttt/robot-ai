// ========== OCEAN RUSH GAME - PREMIUM BOAT RACING ==========
import { trackingData, startGameTracking, stopGameTracking } from "./tracking.js";

// Game variables
let gameActive = false;
let gameInitialized = false;
let gameScene = null;
let gameCamera = null;
let gameRenderer = null;
let gameShip = null;
let gameBullets = [];
let gameObstacles = [];
let gamePowerups = [];
let gameShootCooldown = 0;
let gameScore = 0;
let gameAnimationId = null;
let obstacleInterval = null;
let powerupInterval = null;
let lives = 5;
let invincibleFrames = 0;
let gameOverFlag = false;
let wakeParticles = [];
let waterMesh = null;
let waveOffset = 0;

// DOM elements
const gameCanvas = document.getElementById("gameCanvas");

// Audio
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(frequency, duration, volume = 0.15) {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        oscillator.type = 'sine';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
        oscillator.stop(audioContext.currentTime + duration);
    } catch(e) {}
}

// Tạo hiệu ứng sóng phía sau thuyền
function createWakeEffect() {
    if (!gameShip || !gameActive) return;
    
    const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 })
    );
    particle.position.copy(gameShip.position);
    particle.position.z += 0.5;
    particle.position.y = 0.1;
    particle.userData = { life: 30, velocityZ: -0.5 };
    gameScene.add(particle);
    wakeParticles.push(particle);
    
    // Thêm hạt nước bắn lên
    const splash = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 3, 3),
        new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.8 })
    );
    splash.position.copy(gameShip.position);
    splash.position.z -= 1;
    splash.position.y = 0.3;
    splash.userData = { life: 20, velocityZ: -0.3, velocityY: 0.1 };
    gameScene.add(splash);
    wakeParticles.push(splash);
}

// Tạo thuyền chi tiết
function createBoat(color, isPlayer = false) {
    const boat = new THREE.Group();
    
    // Thân thuyền
    const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12),
        new THREE.MeshPhongMaterial({ color: color, shininess: 80, emissive: isPlayer ? 0x331100 : 0x000000 })
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.2;
    boat.add(hull);
    
    // Boong
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.12, 2.2),
        new THREE.MeshPhongMaterial({ color: 0xD2B48C, shininess: 60 })
    );
    deck.position.y = 0.55;
    boat.add(deck);
    
    // Mũi thuyền
    const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.7, 8),
        new THREE.MeshPhongMaterial({ color: color })
    );
    bow.position.set(0, 0.4, 1.3);
    bow.rotation.x = 0.2;
    boat.add(bow);
    
    if (isPlayer) {
        // Cột buồm
        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 1.3, 6),
            new THREE.MeshPhongMaterial({ color: 0x8B4513 })
        );
        mast.position.set(0, 1.0, -0.2);
        boat.add(mast);
        
        // Buồm
        const sail = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 1.0),
            new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
        );
        sail.position.set(0, 1.1, 0);
        boat.add(sail);
        
        // Cờ
        const flag = new THREE.Mesh(
            new THREE.PlaneGeometry(0.4, 0.25),
            new THREE.MeshPhongMaterial({ color: 0xFF4444, side: THREE.DoubleSide })
        );
        flag.position.set(0.15, 1.55, -0.2);
        flag.rotation.z = 0.3;
        boat.add(flag);
        
        // Pháo
        const cannon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6),
            new THREE.MeshPhongMaterial({ color: 0x888888 })
        );
        cannon.rotation.z = Math.PI / 2;
        cannon.position.set(0, 0.5, 1.2);
        boat.add(cannon);
        boat.cannon = cannon;
        
        // Hiệu ứng glow
        const glow = new THREE.PointLight(0xff6600, 0.5, 5);
        glow.position.set(0, 0.3, 1);
        boat.add(glow);
    }
    
    return boat;
}

// Tạo vật cản (tàu địch, bom ngư lôi)
function createObstacle() {
    const types = [
        { color: 0xaa3333, name: 'enemy_ship', size: 0.7, height: 0.5, reward: -10, danger: true },
        { color: 0x3333aa, name: 'enemy_boat', size: 0.6, height: 0.4, reward: -15, danger: true },
        { color: 0x444444, name: 'torpedo', size: 0.3, height: 0.2, reward: -20, danger: true }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry;
    if (type.name === 'enemy_ship') {
        geometry = new THREE.BoxGeometry(type.size * 1.5, type.height, type.size * 2);
    } else if (type.name === 'enemy_boat') {
        geometry = new THREE.CylinderGeometry(type.size, type.size * 1.2, type.height, 6);
    } else {
        geometry = new THREE.CylinderGeometry(type.size, type.size, type.height, 8);
    }
    
    const obstacle = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: type.color, shininess: 40, emissive: 0x220000 })
    );
    
    let randomX;
    const rand = Math.random();
    if (rand < 0.4) randomX = -7 - Math.random() * 2;
    else if (rand < 0.7) randomX = 7 + Math.random() * 2;
    else randomX = (Math.random() - 0.5) * 6;
    
    obstacle.position.set(randomX, type.height / 2, gameShip ? gameShip.position.z - 90 : -90);
    obstacle.userData = { type: 'obstacle', danger: type.danger, reward: type.reward };
    
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
    return obstacle;
}

// Tạo vật phẩm (xu, kim cương, vàng)
function createPowerup() {
    const types = [
        { color: 0xffdd44, name: 'coin', size: 0.25, reward: 10, shape: 'sphere' },
        { color: 0x44ddff, name: 'diamond', size: 0.22, reward: 25, shape: 'diamond' },
        { color: 0xffaa33, name: 'gold', size: 0.28, reward: 50, shape: 'star' }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry;
    if (type.shape === 'sphere') {
        geometry = new THREE.SphereGeometry(type.size, 16, 16);
    } else if (type.shape === 'diamond') {
        geometry = new THREE.OctahedronGeometry(type.size);
    } else {
        geometry = new THREE.DodecahedronGeometry(type.size);
    }
    
    const powerup = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: type.color, shininess: 90, emissive: type.color, emissiveIntensity: 0.3 })
    );
    
    powerup.position.set(
        (Math.random() - 0.5) * 14,
        0.3,
        gameShip ? gameShip.position.z - 80 - Math.random() * 40 : -100
    );
    powerup.userData = { type: 'powerup', reward: type.reward, name: type.name };
    
    gameScene.add(powerup);
    gamePowerups.push(powerup);
    return powerup;
}

// Tạo mặt nước động
function createWater() {
    const geometry = new THREE.PlaneGeometry(500, 400, 100, 80);
    const material = new THREE.MeshPhongMaterial({
        color: 0x2a6f8f,
        shininess: 100,
        transparent: true,
        opacity: 0.92,
        emissive: 0x113355
    });
    waterMesh = new THREE.Mesh(geometry, material);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.3;
    gameScene.add(waterMesh);
    return waterMesh;
}

// Hiệu ứng nổ
function createExplosion(position, color = 0xff6600) {
    if (!gameScene) return;
    
    for (let i = 0; i < 12; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshBasicMaterial({ color: color })
        );
        particle.position.copy(position);
        particle.userData = {
            velocityX: (Math.random() - 0.5) * 0.4,
            velocityY: Math.random() * 0.3,
            velocityZ: (Math.random() - 0.5) * 0.4,
            life: 25
        };
        gameScene.add(particle);
        setTimeout(() => { if(particle.parent) gameScene.remove(particle); }, 400);
    }
    playSound(250, 0.3, 0.2);
}

// Nút chơi lại
function showRestartButton() {
    const existing = document.getElementById("gameOverlay");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "gameOverlay";
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 1000;
        display: flex; justify-content: center; align-items: center;
        flex-direction: column; backdrop-filter: blur(5px);
    `;
    document.body.appendChild(overlay);
    
    const box = document.createElement("div");
    box.style.cssText = `
        background: linear-gradient(135deg, #0a0a2a, #1a1a3a);
        border: 3px solid #00ffff; border-radius: 20px;
        padding: 40px; text-align: center; box-shadow: 0 0 50px rgba(0,255,255,0.5);
        min-width: 320px;
    `;
    overlay.appendChild(box);
    
    const title = document.createElement("div");
    title.innerHTML = lives <= 0 ? "💀 GAME OVER 💀" : "🎉 VICTORY! 🎉";
    title.style.cssText = `
        font-size: 48px; font-family: Orbitron, monospace; font-weight: bold;
        color: ${lives <= 0 ? '#ff4444' : '#00ff88'}; margin-bottom: 20px;
        text-shadow: 0 0 10px currentColor;
    `;
    box.appendChild(title);
    
    const scoreText = document.createElement("div");
    scoreText.innerHTML = `💰 SCORE: ${gameScore} 💰`;
    scoreText.style.cssText = `
        font-size: 32px; font-family: Orbitron, monospace; color: #ffff00;
        margin-bottom: 30px; font-weight: bold;
    `;
    box.appendChild(scoreText);
    
    const btn = document.createElement("button");
    btn.innerHTML = "🔄 PLAY AGAIN";
    btn.style.cssText = `
        padding: 15px 50px; font-size: 28px; font-family: Orbitron, monospace;
        font-weight: bold; color: #00ffff; background: rgba(0,0,0,0.9);
        border: 3px solid #00ffff; border-radius: 15px; cursor: pointer;
        transition: all 0.3s; margin-bottom: 20px;
    `;
    btn.onmouseover = () => { btn.style.backgroundColor = "#00ffff"; btn.style.color = "#000"; };
    btn.onmouseout = () => { btn.style.backgroundColor = "rgba(0,0,0,0.9)"; btn.style.color = "#00ffff"; };
    btn.onclick = () => { overlay.remove(); resetGame(); };
    box.appendChild(btn);
    
    const homeBtn = document.createElement("button");
    homeBtn.innerHTML = "🏠 HOME";
    homeBtn.style.cssText = `
        padding: 12px 40px; font-size: 20px; font-family: Orbitron, monospace;
        font-weight: bold; color: #ff00ff; background: rgba(0,0,0,0.9);
        border: 3px solid #ff00ff; border-radius: 15px; cursor: pointer;
        transition: all 0.3s;
    `;
    homeBtn.onmouseover = () => { homeBtn.style.backgroundColor = "#ff00ff"; homeBtn.style.color = "#000"; };
    homeBtn.onmouseout = () => { homeBtn.style.backgroundColor = "rgba(0,0,0,0.9)"; homeBtn.style.color = "#ff00ff"; };
    homeBtn.onclick = () => {
        overlay.remove();
        if (typeof window.stopGame === 'function') window.stopGame();
        if (typeof window.showModeScreen === 'function') window.showModeScreen();
    };
    box.appendChild(homeBtn);
}

function resetGame() {
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    
    if (gameScene) {
        gameBullets.forEach(b => { if(b.parent) gameScene.remove(b); });
        gameObstacles.forEach(o => { if(o.parent) gameScene.remove(o); });
        gamePowerups.forEach(p => { if(p.parent) gameScene.remove(p); });
        wakeParticles.forEach(w => { if(w.parent) gameScene.remove(w); });
    }
    
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameBullets = [];
    gameObstacles = [];
    gamePowerups = [];
    wakeParticles = [];
    gameShootCooldown = 0;
    
    if (gameShip) {
        gameShip.position.set(0, 0, 0);
        gameShip.rotation.set(0, 0, 0);
    }
    if (gameCamera) gameCamera.position.set(0, 7, 14);
    
    updateGameUI();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createObstacle();
    }, 1200);
    
    powerupInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createPowerup();
    }, 2500);
    
    const statusElem = document.getElementById("gameStatus");
    if (statusElem) {
        statusElem.innerHTML = "🌊 SET SAIL!";
        setTimeout(() => { if(statusElem && !gameOverFlag) statusElem.innerHTML = "🌊 RACING"; }, 2000);
    }
}

export function initGame() {
    if (gameInitialized) return;
    
    console.log("🎮 Initializing Ocean Racing Game...");
    
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 5;
    gameBullets = [];
    gameObstacles = [];
    gamePowerups = [];
    
    if (!gameCanvas || typeof THREE === 'undefined') {
        console.error("Canvas or THREE not ready");
        return;
    }
    
    initAudio();
    
    gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setClearColor(0x0a1030);
    
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.FogExp2(0x0a1030, 0.008);
    gameScene.background = new THREE.Color(0x0a1030);
    
    gameCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    gameCamera.position.set(0, 7, 14);
    gameCamera.lookAt(0, 0, 0);
    
    // Ánh sáng
    const ambient = new THREE.AmbientLight(0x404060, 0.7);
    gameScene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(5, 15, 5);
    gameScene.add(sun);
    const fillLight = new THREE.PointLight(0x4488aa, 0.5);
    fillLight.position.set(0, 5, 0);
    gameScene.add(fillLight);
    
    // Mặt nước động
    createWater();
    
    // Thêm mây
    const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 15; i++) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.8, 5, 5), cloudMat);
        cloud.position.set((Math.random() - 0.5) * 30, 6 + Math.random() * 4, (Math.random() - 0.5) * 60);
        gameScene.add(cloud);
    }
    
    // Thuyền
    gameShip = createBoat(0xff4444, true);
    gameScene.add(gameShip);
    
    startGameTracking();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createObstacle();
    }, 1200);
    
    powerupInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createPowerup();
    }, 2500);
    
    // UI
    const hud = document.getElementById("gameHud");
    if (hud && !document.getElementById("gameLives")) {
        const livesDiv = document.createElement("div");
        livesDiv.id = "gameLives";
        livesDiv.innerHTML = `❤️ Lives: ${lives}`;
        hud.appendChild(livesDiv);
    }
    
    const instruction = document.querySelector(".game-instruction");
    if (instruction) {
        instruction.innerHTML = `🎮 <span>ĐIỀU KHIỂN:</span> Giơ 2 tay như vô lăng → lái | Đầu cao → tăng tốc | Đầu thấp → giảm tốc | Nắm tay → bắn`;
    }
    
    updateGameUI();
    startGameLoop();
    window.addEventListener("resize", handleGameResize);
}

function fireBullet() {
    if (!gameActive || gameOverFlag) return;
    
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: 0xffaa44 })
    );
    bullet.position.copy(gameShip.position);
    bullet.position.z += 1.6;
    bullet.position.y = 0.6;
    bullet.userData = { velocityZ: -4.5 };
    
    gameScene.add(bullet);
    gameBullets.push(bullet);
    playSound(880, 0.15, 0.1);
}

function updateGameUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    
    if (speedElem && trackingData) {
        let sp = (trackingData.speed * 2.5).toFixed(1);
        speedElem.innerHTML = `⚡ Speed: ${sp}`;
    }
    if (scoreElem) scoreElem.innerHTML = `💰 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
}

function gameOver() {
    if (gameOverFlag) return;
    gameOverFlag = true;
    gameActive = false;
    const statusElem = document.getElementById("gameStatus");
    if (statusElem) statusElem.innerHTML = "💀 GAME OVER 💀";
    showRestartButton();
}

function startGameLoop() {
    function animate() {
        if (!gameActive) {
            if (gameRenderer && gameScene && gameCamera) gameRenderer.render(gameScene, gameCamera);
            requestAnimationFrame(animate);
            return;
        }
        
        gameAnimationId = requestAnimationFrame(animate);
        if (invincibleFrames > 0) invincibleFrames--;
        
        // Lấy dữ liệu điều khiển
        let steering = (trackingData.steeringAngle || 0) * 1.2;
        let speed = Math.max(0.2, (trackingData.speed || 0) * 2.2);
        
        // CẢI THIỆN CẢM GIÁC LÁI - mượt hơn
        const targetX = steering * 8.5;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.08;
        gameShip.position.x = Math.min(8.5, Math.max(-8.5, gameShip.position.x));
        
        // Nghiêng thuyền khi rẽ
        gameShip.rotation.z = -steering * 0.5;
        gameShip.rotation.x = Math.abs(steering) * 0.15;
        
        // Di chuyển
        gameShip.position.z -= speed * 0.48;
        
        // Tạo hiệu ứng sóng phía sau
        if (Math.random() < 0.3) createWakeEffect();
        
        // Bắn đạn
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireBullet();
            gameShootCooldown = 8;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        // Di chuyển đạn và va chạm
        for (let i = gameBullets.length-1; i>=0; i--) {
            const b = gameBullets[i];
            b.position.z += b.userData.velocityZ;
            if (b.position.z < -30 || b.position.z > 30) {
                gameScene.remove(b);
                gameBullets.splice(i,1);
            }
        }
        
        // Di chuyển vật cản (tàu địch, bom)
        for (let i = gameObstacles.length-1; i>=0; i--) {
            const o = gameObstacles[i];
            o.position.z += speed * 0.45 + 0.6;
            o.rotation.y += 0.03;
            
            if (o.position.z > 28) {
                gameScene.remove(o);
                gameObstacles.splice(i,1);
                continue;
            }
            
            const dz = o.position.z - (gameShip.position.z + 1.3);
            const dx = o.position.x - gameShip.position.x;
            if (Math.sqrt(dx*dx + dz*dz) < 0.9 && invincibleFrames === 0 && o.userData.danger) {
                lives--;
                invincibleFrames = 50;
                playSound(300, 0.35, 0.25);
                createExplosion(o.position, 0xff4444);
                gameScene.remove(o);
                gameObstacles.splice(i,1);
                updateGameUI();
                if (lives <= 0) gameOver();
            }
        }
        
        // Va chạm đạn với vật cản
        for (let oi = gameObstacles.length-1; oi>=0; oi--) {
            const o = gameObstacles[oi];
            for (let bi = gameBullets.length-1; bi>=0; bi--) {
                const b = gameBullets[bi];
                if (o.position.distanceTo(b.position) < 0.8) {
                    gameScene.remove(o);
                    gameScene.remove(b);
                    gameObstacles.splice(oi,1);
                    gameBullets.splice(bi,1);
                    gameScore += o.userData.reward ? Math.abs(o.userData.reward) : 10;
                    updateGameUI();
                    playSound(600, 0.2, 0.15);
                    createExplosion(o.position, 0xffaa44);
                    break;
                }
            }
        }
        
        // NHẶT VẬT PHẨM (xu, kim cương, vàng)
        for (let i = gamePowerups.length-1; i>=0; i--) {
            const p = gamePowerups[i];
            p.position.z += speed * 0.45 + 0.5;
            p.rotation.y += 0.05;
            p.rotation.x += 0.03;
            
            const dz = p.position.z - gameShip.position.z;
            const dx = p.position.x - gameShip.position.x;
            if (Math.sqrt(dx*dx + dz*dz) < 1.0) {
                gameScore += p.userData.reward;
                gameScene.remove(p);
                gamePowerups.splice(i,1);
                updateGameUI();
                playSound(800, 0.1, 0.08);
                
                // Hiệu ứng nhặt được
                const glow = new THREE.PointLight(p.material.color.getHex(), 0.5, 2);
                glow.position.copy(p.position);
                gameScene.add(glow);
                setTimeout(() => gameScene.remove(glow), 150);
            } else if (p.position.z > 28) {
                gameScene.remove(p);
                gamePowerups.splice(i,1);
            }
        }
        
        // Di chuyển hạt sóng
        for (let i = wakeParticles.length-1; i>=0; i--) {
            const w = wakeParticles[i];
            w.userData.life--;
            w.position.z += (w.userData.velocityZ || -0.3);
            if (w.userData.velocityY) w.position.y += w.userData.velocityY;
            w.material.opacity = w.userData.life / 30;
            if (w.userData.life <= 0) {
                gameScene.remove(w);
                wakeParticles.splice(i,1);
            }
        }
        
        // Cập nhật mặt nước động
        if (waterMesh) {
            waveOffset += 0.02;
            const positions = waterMesh.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const z = positions[i+2];
                positions[i+1] = Math.sin(x * 0.3 + waveOffset) * 0.05 + Math.cos(z * 0.2 + waveOffset) * 0.05;
            }
            waterMesh.geometry.attributes.position.needsUpdate = true;
        }
        
        // Camera theo thuyền
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.06;
        gameCamera.position.z = gameShip.position.z + 12;
        gameCamera.position.y = 7 + Math.abs(gameShip.position.x) * 0.1;
        gameCamera.lookAt(gameShip.position);
        
        updateGameUI();
        
        // Chiến thắng
        if (gameScore >= 300 && !gameOverFlag) {
            gameActive = false;
            gameOverFlag = true;
            showRestartButton();
        }
        
        if (gameRenderer && gameScene && gameCamera) gameRenderer.render(gameScene, gameCamera);
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
    gameActive = false;
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    stopGameTracking();
    gameInitialized = false;
}

window.initGame = initGame;
window.stopGame = stopGame;
