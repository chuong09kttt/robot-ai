// ========== BOAT MODE - OCEAN RACING ==========
import { trackingData, startGameTracking, stopGameTracking } from "./tracking.js";

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

export function initBoatMode() {
    if (gameInitialized) {
        resetBoatGame();
        return;
    }
    
    console.log("🚤 Initializing BOAT mode...");
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 5;
    
    const gameCanvas = document.getElementById("gameCanvas");
    if (!gameCanvas || typeof THREE === 'undefined') {
        console.error("Canvas or THREE not ready");
        return;
    }
    
    gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setClearColor(0x0a1030);
    
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.FogExp2(0x0a1030, 0.008);
    gameScene.background = new THREE.Color(0x0a1030);
    
    gameCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    gameCamera.position.set(0, 7, 14);
    
    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.7);
    gameScene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(5, 15, 5);
    gameScene.add(sun);
    
    createWater();
    
    // Clouds
    const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 15; i++) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.8, 5, 5), cloudMat);
        cloud.position.set((Math.random() - 0.5) * 30, 6 + Math.random() * 4, (Math.random() - 0.5) * 60);
        gameScene.add(cloud);
    }
    
    gameShip = createBoat();
    gameScene.add(gameShip);
    
    startGameTracking();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createBoatObstacle();
    }, 1200);
    
    powerupInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createBoatPowerup();
    }, 2500);
    
    updateBoatUI();
    startBoatLoop();
    window.addEventListener("resize", handleBoatResize);
}

function createBoat() {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12), new THREE.MeshPhongMaterial({ color: 0xff4444, shininess: 80 }));
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.2;
    boat.add(hull);
    
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 2.2), new THREE.MeshPhongMaterial({ color: 0xD2B48C }));
    deck.position.y = 0.55;
    boat.add(deck);
    
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 8), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
    bow.position.set(0, 0.4, 1.3);
    bow.rotation.x = 0.2;
    boat.add(bow);
    
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.3, 6), new THREE.MeshPhongMaterial({ color: 0x8B4513 }));
    mast.position.set(0, 1.0, -0.2);
    boat.add(mast);
    
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide }));
    sail.position.set(0, 1.1, 0);
    boat.add(sail);
    
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshPhongMaterial({ color: 0xFF4444, side: THREE.DoubleSide }));
    flag.position.set(0.15, 1.55, -0.2);
    flag.rotation.z = 0.3;
    boat.add(flag);
    
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    cannon.rotation.z = Math.PI / 2;
    cannon.position.set(0, 0.5, 1.2);
    boat.add(cannon);
    boat.cannon = cannon;
    
    return boat;
}

function createWater() {
    const geometry = new THREE.PlaneGeometry(500, 400, 100, 80);
    const material = new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 100, transparent: true, opacity: 0.92 });
    waterMesh = new THREE.Mesh(geometry, material);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.3;
    gameScene.add(waterMesh);
}

function createBoatObstacle() {
    const colors = [0xaa3333, 0x3333aa, 0x444444];
    const obstacle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.0), new THREE.MeshPhongMaterial({ color: colors[Math.floor(Math.random() * colors.length)] }));
    let randomX = Math.random() < 0.4 ? -6 - Math.random() * 3 : (Math.random() < 0.7 ? 6 + Math.random() * 3 : (Math.random() - 0.5) * 5);
    obstacle.position.set(randomX, 0.3, gameShip.position.z - 90);
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
}

function createBoatPowerup() {
    const powerup = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.3 }));
    powerup.position.set((Math.random() - 0.5) * 14, 0.3, gameShip.position.z - 80);
    gameScene.add(powerup);
    gamePowerups.push(powerup);
}

function fireBoatBullet() {
    if (!gameActive || gameOverFlag) return;
    const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
    bullet.position.copy(gameShip.position);
    bullet.position.z += 1.6;
    bullet.position.y = 0.6;
    bullet.userData = { velocityZ: -4.5 };
    gameScene.add(bullet);
    gameBullets.push(bullet);
    playSound(880, 0.15, 0.1);
}

function playSound(frequency, duration, volume) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = frequency;
        gain.gain.value = volume;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
        setTimeout(() => audioCtx.close(), duration * 1000 + 100);
    } catch(e) {}
}

function updateBoatUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    if (speedElem) speedElem.innerHTML = `🚤 Speed: ${(trackingData.speed * 2).toFixed(1)}`;
    if (scoreElem) scoreElem.innerHTML = `💰 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
}

function createExplosion(position, color = 0xff6600) {
    for (let i = 0; i < 12; i++) {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshBasicMaterial({ color: color }));
        particle.position.copy(position);
        gameScene.add(particle);
        setTimeout(() => gameScene.remove(particle), 400);
    }
    playSound(250, 0.3, 0.2);
}

function showBoatRestartButton() {
    const existing = document.getElementById("gameOverlay");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "gameOverlay";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000;display:flex;justify-content:center;align-items:center;flex-direction:column`;
    document.body.appendChild(overlay);
    
    const box = document.createElement("div");
    box.style.cssText = `background:linear-gradient(135deg,#0a0a2a,#1a1a3a);border:2px solid #00d4ff;border-radius:20px;padding:40px;text-align:center;min-width:300px`;
    overlay.appendChild(box);
    
    const title = document.createElement("div");
    title.innerHTML = lives <= 0 ? "💀 GAME OVER 💀" : "🎉 VICTORY! 🎉";
    title.style.cssText = `font-size:48px;color:${lives <= 0 ? '#ff4444' : '#00ff88'};margin-bottom:20px`;
    box.appendChild(title);
    
    const scoreText = document.createElement("div");
    scoreText.innerHTML = `💰 SCORE: ${gameScore}`;
    scoreText.style.cssText = `font-size:32px;color:#ffff00;margin-bottom:30px`;
    box.appendChild(scoreText);
    
    const restartBtn = document.createElement("button");
    restartBtn.innerHTML = "🔄 PLAY AGAIN";
    restartBtn.style.cssText = `padding:15px 40px;font-size:24px;background:#00d4ff;border:none;border-radius:15px;cursor:pointer;margin-bottom:20px`;
    restartBtn.onclick = () => { overlay.remove(); resetBoatGame(); };
    box.appendChild(restartBtn);
    
    const homeBtn = document.createElement("button");
    homeBtn.innerHTML = "🏠 HOME";
    homeBtn.style.cssText = `padding:12px 35px;font-size:20px;background:#ff00ff;border:none;border-radius:15px;cursor:pointer`;
    homeBtn.onclick = () => {
        overlay.remove();
        if (typeof window.showModeScreen === 'function') window.showModeScreen();
    };
    box.appendChild(homeBtn);
}

function boatGameOver() {
    if (gameOverFlag) return;
    gameOverFlag = true;
    gameActive = false;
    showBoatRestartButton();
}

function resetBoatGame() {
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    
    gameBullets.forEach(b => gameScene.remove(b));
    gameObstacles.forEach(o => gameScene.remove(o));
    gamePowerups.forEach(p => gameScene.remove(p));
    
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 5;
    gameBullets = [];
    gameObstacles = [];
    gamePowerups = [];
    invincibleFrames = 0;
    
    if (gameShip) gameShip.position.set(0, 0, 0);
    if (gameCamera) gameCamera.position.set(0, 7, 14);
    
    updateBoatUI();
    startBoatLoop();
}

function startBoatLoop() {
    function animate() {
        if (!gameActive) {
            if (gameRenderer) gameRenderer.render(gameScene, gameCamera);
            requestAnimationFrame(animate);
            return;
        }
        
        gameAnimationId = requestAnimationFrame(animate);
        if (invincibleFrames > 0) invincibleFrames--;
        
        let steering = (trackingData.steeringAngle || 0) * 1.2;
        let speed = Math.max(0.15, (trackingData.speed || 0) * 2);
        
        const targetX = steering * 8.5;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.1;
        gameShip.position.x = Math.min(8.5, Math.max(-8.5, gameShip.position.x));
        gameShip.rotation.z = -steering * 0.5;
        gameShip.position.z -= speed * 0.48;
        
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireBoatBullet();
            gameShootCooldown = 8;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        for (let i = gameBullets.length-1; i>=0; i--) {
            const b = gameBullets[i];
            b.position.z += b.userData.velocityZ;
            if (b.position.z < -30) { gameScene.remove(b); gameBullets.splice(i,1); }
        }
        
        for (let i = gameObstacles.length-1; i>=0; i--) {
            const o = gameObstacles[i];
            o.position.z += speed * 0.45 + 0.6;
            if (o.position.z > 28) { gameScene.remove(o); gameObstacles.splice(i,1); continue; }
            
            const dz = o.position.z - gameShip.position.z;
            const dx = o.position.x - gameShip.position.x;
            if (Math.sqrt(dx*dx + dz*dz) < 0.9 && invincibleFrames === 0) {
                lives--;
                invincibleFrames = 50;
                playSound(300, 0.35, 0.2);
                createExplosion(o.position, 0xff4444);
                gameScene.remove(o);
                gameObstacles.splice(i,1);
                updateBoatUI();
                if (lives <= 0) boatGameOver();
            }
        }
        
        for (let i = gamePowerups.length-1; i>=0; i--) {
            const p = gamePowerups[i];
            p.position.z += speed * 0.45 + 0.5;
            p.rotation.y += 0.05;
            if (Math.abs(p.position.x - gameShip.position.x) < 1.0 && Math.abs(p.position.z - gameShip.position.z) < 1.3) {
                gameScore += 10;
                gameScene.remove(p);
                gamePowerups.splice(i,1);
                updateBoatUI();
                playSound(800, 0.1, 0.08);
            } else if (p.position.z > 28) {
                gameScene.remove(p);
                gamePowerups.splice(i,1);
            }
        }
        
        if (waterMesh) {
            waveOffset += 0.02;
            const positions = waterMesh.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i+1] = Math.sin(positions[i] * 0.3 + waveOffset) * 0.05 + Math.cos(positions[i+2] * 0.2 + waveOffset) * 0.05;
            }
            waterMesh.geometry.attributes.position.needsUpdate = true;
        }
        
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.06;
        gameCamera.position.z = gameShip.position.z + 12;
        gameCamera.lookAt(gameShip.position);
        
        updateBoatUI();
        
        if (gameScore >= 300 && !gameOverFlag) boatGameOver();
        if (gameRenderer) gameRenderer.render(gameScene, gameCamera);
    }
    animate();
}

function handleBoatResize() {
    if (gameRenderer) gameRenderer.setSize(window.innerWidth, window.innerHeight);
    if (gameCamera) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
    }
}

export function stopBoatMode() {
    gameActive = false;
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    stopGameTracking();
    gameInitialized = false;
}

// Cuối file game.js, thêm:
export { initBoatMode, stopBoatMode };
