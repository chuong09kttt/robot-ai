// ========== PLANE MODE - SKY RACING ==========
import { trackingData, startGameTracking, stopGameTracking } from "./tracking.js";

let gameActive = false;
let gameInitialized = false;
let gameScene = null;
let gameCamera = null;
let gameRenderer = null;
let gamePlane = null;
let gameBullets = [];
let gameObstacles = [];
let gamePowerups = [];
let gameShootCooldown = 0;
let gameScore = 0;
let gameAnimationId = null;
let obstacleInterval = null;
let powerupInterval = null;
let lives = 3;
let invincibleFrames = 0;
let gameOverFlag = false;
let clouds = [];

export function initPlaneMode() {
    if (gameInitialized) {
        resetPlaneGame();
        return;
    }
    
    console.log("✈️ Initializing PLANE mode...");
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 3;
    gameBullets = [];
    gameObstacles = [];
    gamePowerups = [];
    clouds = [];
    
    const gameCanvas = document.getElementById("gameCanvas");
    if (!gameCanvas || typeof THREE === 'undefined') {
        console.error("Canvas or THREE not ready");
        return;
    }
    
    gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setClearColor(0x87CEEB);
    
    gameScene = new THREE.Scene();
    gameScene.background = new THREE.Color(0x87CEEB);
    gameScene.fog = new THREE.FogExp2(0x87CEEB, 0.008);
    
    gameCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    gameCamera.position.set(0, 5, 12);
    
    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.7);
    gameScene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(5, 15, 5);
    gameScene.add(sun);
    
    // Clouds
    for (let i = 0; i < 30; i++) {
        createCloud((Math.random() - 0.5) * 40, 3 + Math.random() * 5, (Math.random() - 0.5) * 100 - 50);
    }
    
    // Plane
    gamePlane = createPlane();
    gameScene.add(gamePlane);
    
    startGameTracking();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createPlaneObstacle();
    }, 1200);
    
    powerupInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createPowerup();
    }, 2000);
    
    updatePlaneUI();
    startPlaneLoop();
    window.addEventListener("resize", handlePlaneResize);
}

function createPlane() {
    const plane = new THREE.Group();
    
    // Thân
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), new THREE.MeshPhongMaterial({ color: 0xff4444, shininess: 90 }));
    body.rotation.z = Math.PI / 2;
    plane.add(body);
    
    // Cánh chính
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
    wing.position.set(0, 0.1, 0);
    plane.add(wing);
    
    // Cánh đuôi
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.4), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
    tailWing.position.set(0, 0.15, -0.6);
    plane.add(tailWing);
    
    // Đuôi đứng
    const tailVertical = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
    tailVertical.position.set(0, 0.35, -0.6);
    plane.add(tailVertical);
    
    // Buồng lái
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshPhongMaterial({ color: 0x88ccff }));
    cockpit.position.set(0, 0.2, 0.5);
    plane.add(cockpit);
    
    // Động cơ
    const propeller = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.1), new THREE.MeshPhongMaterial({ color: 0xaa8866 }));
    propeller.position.set(0, 0, 0.9);
    plane.add(propeller);
    plane.propeller = propeller;
    
    // Súng
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4), new THREE.MeshPhongMaterial({ color: 0x666666 }));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0.3, 0, 0.7);
    plane.add(gun);
    
    const gun2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4), new THREE.MeshPhongMaterial({ color: 0x666666 }));
    gun2.rotation.x = Math.PI / 2;
    gun2.position.set(-0.3, 0, 0.7);
    plane.add(gun2);
    
    return plane;
}

function createCloud(x, y, z) {
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    [0.7, 0.5, 0.6, 0.4, 0.5].forEach((size, i) => {
        const part = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 7), cloudMat);
        part.position.set((i - 2) * 0.5, 0, (i % 2) * 0.3);
        cloudGroup.add(part);
    });
    cloudGroup.position.set(x, y, z);
    gameScene.add(cloudGroup);
    clouds.push(cloudGroup);
}

function createPlaneObstacle() {
    const enemy = createPlane();
    enemy.children.forEach(child => { if (child.material) child.material.color.setHex(0xaa3333); });
    enemy.position.set((Math.random() - 0.5) * 12, 1 + Math.random() * 4, gamePlane.position.z - 80);
    gameScene.add(enemy);
    gameObstacles.push(enemy);
}

function createPowerup() {
    const geometry = new THREE.OctahedronGeometry(0.22);
    const powerup = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.3 }));
    powerup.position.set((Math.random() - 0.5) * 14, 1 + Math.random() * 3, gamePlane.position.z - 80);
    gameScene.add(powerup);
    gamePowerups.push(powerup);
}

function firePlaneBullet() {
    if (!gameActive || gameOverFlag) return;
    const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
    bullet.position.copy(gamePlane.position);
    bullet.position.z += 1.2;
    bullet.userData = { velocityZ: -5 };
    gameScene.add(bullet);
    gameBullets.push(bullet);
    playSound(880, 0.12, 0.1);
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

function updatePlaneUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    if (speedElem) speedElem.innerHTML = `✈️ Speed: ${(trackingData.speed * 2).toFixed(1)}`;
    if (scoreElem) scoreElem.innerHTML = `💰 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
}

function createExplosion(position) {
    for (let i = 0; i < 15; i++) {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
        particle.position.copy(position);
        gameScene.add(particle);
        setTimeout(() => gameScene.remove(particle), 400);
    }
    playSound(200, 0.3, 0.15);
}

function showRestartButton() {
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
    restartBtn.onclick = () => { overlay.remove(); resetPlaneGame(); };
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

function gamePlaneOver() {
    if (gameOverFlag) return;
    gameOverFlag = true;
    gameActive = false;
    showRestartButton();
}

function resetPlaneGame() {
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    
    gameBullets.forEach(b => gameScene.remove(b));
    gameObstacles.forEach(o => gameScene.remove(o));
    gamePowerups.forEach(p => gameScene.remove(p));
    
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 3;
    gameBullets = [];
    gameObstacles = [];
    gamePowerups = [];
    invincibleFrames = 0;
    
    if (gamePlane) gamePlane.position.set(0, 2, 0);
    if (gameCamera) gameCamera.position.set(0, 5, 12);
    
    updatePlaneUI();
    startPlaneLoop();
}

function startPlaneLoop() {
    function animate() {
        if (!gameActive) {
            if (gameRenderer) gameRenderer.render(gameScene, gameCamera);
            requestAnimationFrame(animate);
            return;
        }
        
        gameAnimationId = requestAnimationFrame(animate);
        if (invincibleFrames > 0) invincibleFrames--;
        
        // ĐIỀU KHIỂN MÁY BAY BẰNG CÁNH TAY NGANG
        // steeringAngle từ -0.9 đến 0.9 (âm là trái, dương là phải)
        let steering = trackingData.steeringAngle || 0;
        let speed = Math.max(0.2, (trackingData.speed || 0) * 2);
        
        // Di chuyển theo cánh tay
        const targetX = steering * 10;
        gamePlane.position.x += (targetX - gamePlane.position.x) * 0.12;
        gamePlane.position.x = Math.min(9, Math.max(-9, gamePlane.position.x));
        
        // Nghiêng máy bay theo hướng rẽ
        gamePlane.rotation.z = -steering * 0.8;
        gamePlane.rotation.x = Math.abs(steering) * 0.2;
        
        // Di chuyển tới
        gamePlane.position.z -= speed * 0.6;
        
        // Lắc nhẹ theo chiều dọc
        gamePlane.position.y = 2 + Math.sin(Date.now() * 0.005) * 0.1;
        
        // Quay cánh quạt
        if (gamePlane.propeller) gamePlane.propeller.rotation.x += 0.2;
        
        // Bắn đạn
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            firePlaneBullet();
            gameShootCooldown = 8;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        // Di chuyển đạn
        for (let i = gameBullets.length-1; i>=0; i--) {
            const b = gameBullets[i];
            b.position.z += b.userData.velocityZ;
            if (b.position.z < -30) { gameScene.remove(b); gameBullets.splice(i,1); }
        }
        
        // Di chuyển mây
        clouds.forEach(cloud => {
            cloud.position.z += speed * 0.3;
            if (cloud.position.z > 30) cloud.position.z -= 100;
        });
        
        // Di chuyển vật cản và va chạm
        for (let i = gameObstacles.length-1; i>=0; i--) {
            const o = gameObstacles[i];
            o.position.z += speed * 0.5 + 0.6;
            o.rotation.y += 0.05;
            if (o.position.z > 30) { gameScene.remove(o); gameObstacles.splice(i,1); continue; }
            
            const dz = o.position.z - gamePlane.position.z;
            const dx = o.position.x - gamePlane.position.x;
            const dy = Math.abs(o.position.y - gamePlane.position.y);
            const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
            
            if (dist < 0.9 && invincibleFrames === 0) {
                lives--;
                invincibleFrames = 50;
                playSound(300, 0.35, 0.2);
                createExplosion(o.position);
                gameScene.remove(o);
                gameObstacles.splice(i,1);
                updatePlaneUI();
                if (lives <= 0) gamePlaneOver();
            }
        }
        
        // Nhặt vật phẩm
        for (let i = gamePowerups.length-1; i>=0; i--) {
            const p = gamePowerups[i];
            p.position.z += speed * 0.5 + 0.5;
            p.rotation.y += 0.05;
            p.rotation.x += 0.03;
            
            const dz = p.position.z - gamePlane.position.z;
            const dx = p.position.x - gamePlane.position.x;
            const dy = Math.abs(p.position.y - gamePlane.position.y);
            const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
            
            if (dist < 0.9) {
                gameScore += 10;
                gameScene.remove(p);
                gamePowerups.splice(i,1);
                updatePlaneUI();
                playSound(800, 0.1, 0.08);
            } else if (p.position.z > 30) {
                gameScene.remove(p);
                gamePowerups.splice(i,1);
            }
        }
        
        // Camera theo máy bay
        gameCamera.position.x += (gamePlane.position.x - gameCamera.position.x) * 0.08;
        gameCamera.position.z = gamePlane.position.z + 10;
        gameCamera.lookAt(gamePlane.position);
        
        updatePlaneUI();
        
        if (gameScore >= 300 && !gameOverFlag) gamePlaneOver();
        if (gameRenderer) gameRenderer.render(gameScene, gameCamera);
    }
    animate();
}

function handlePlaneResize() {
    if (gameRenderer) gameRenderer.setSize(window.innerWidth, window.innerHeight);
    if (gameCamera) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
    }
}

export function stopPlaneMode() {
    gameActive = false;
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    stopGameTracking();
    gameInitialized = false;
}
