// ========== OCEAN RUSH GAME - BOAT & PLANE MODES ==========
// Game state
let gameActive = false;
let gameInitialized = false;
let gameMode = 'boat'; // 'boat' or 'plane'
let gameScene = null;
let gameCamera = null;
let gameRenderer = null;
let gameVehicle = null;
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
let particles = [];
let clouds = [];
let waterMesh = null;
let waveOffset = 0;

// Tracking data (will be set by tracking.js)
let trackingData = {
    steeringAngle: 0,
    speed: 0,
    shooting: false,
    headX: 0.5,
    headY: 0.5
};

// ========== SHARED FUNCTIONS ==========
function playSound(frequency, duration, volume = 0.1) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        oscillator.type = 'sine';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        oscillator.stop(audioCtx.currentTime + duration);
        setTimeout(() => audioCtx.close(), duration * 1000 + 100);
    } catch(e) {}
}

function createExplosion(position, color = 0xff6600) {
    if (!gameScene) return;
    for (let i = 0; i < 15; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshBasicMaterial({ color: color })
        );
        particle.position.copy(position);
        particle.userData = {
            velocityX: (Math.random() - 0.5) * 0.3,
            velocityY: Math.random() * 0.3,
            velocityZ: (Math.random() - 0.5) * 0.3,
            life: 25
        };
        gameScene.add(particle);
        particles.push(particle);
    }
    playSound(200, 0.3, 0.15);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life--;
        p.position.x += p.userData.velocityX;
        p.position.y += p.userData.velocityY;
        p.position.z += p.userData.velocityZ;
        if (p.userData.life <= 0) {
            gameScene.remove(p);
            particles.splice(i, 1);
        }
    }
}

// ========== CREATE BOAT (CHI TIẾT) ==========
function createBoat(color, isPlayer = false) {
    const boat = new THREE.Group();
    
    // Thân thuyền
    const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12),
        new THREE.MeshPhongMaterial({ color: color, shininess: 80 })
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.2;
    boat.add(hull);
    
    // Boong
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.12, 2.2),
        new THREE.MeshPhongMaterial({ color: 0xD2B48C })
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
    }
    
    return boat;
}

// ========== CREATE PLANE (CHI TIẾT) ==========
function createPlane(color, isPlayer = false) {
    const plane = new THREE.Group();
    
    // Thân máy bay
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.35, 1.2, 8),
        new THREE.MeshPhongMaterial({ color: color, shininess: 90 })
    );
    body.rotation.z = Math.PI / 2;
    plane.add(body);
    
    // Cánh chính
    const wing = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.08, 0.5),
        new THREE.MeshPhongMaterial({ color: color })
    );
    wing.position.set(0, 0.1, 0);
    plane.add(wing);
    
    // Cánh đuôi
    const tailWing = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.08, 0.4),
        new THREE.MeshPhongMaterial({ color: color })
    );
    tailWing.position.set(0, 0.15, -0.6);
    plane.add(tailWing);
    
    // Đuôi đứng
    const tailVertical = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.4, 4),
        new THREE.MeshPhongMaterial({ color: color })
    );
    tailVertical.position.set(0, 0.35, -0.6);
    plane.add(tailVertical);
    
    // Buồng lái
    const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0x88ccff, shininess: 100 })
    );
    cockpit.position.set(0, 0.2, 0.5);
    plane.add(cockpit);
    
    // Động cơ (cánh quạt)
    const propeller = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.05, 0.1),
        new THREE.MeshPhongMaterial({ color: 0xaa8866 })
    );
    propeller.position.set(0, 0, 0.9);
    plane.add(propeller);
    plane.propeller = propeller;
    
    if (isPlayer) {
        // Súng máy
        const gun1 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4),
            new THREE.MeshPhongMaterial({ color: 0x666666 })
        );
        gun1.rotation.x = Math.PI / 2;
        gun1.position.set(0.3, 0, 0.7);
        plane.add(gun1);
        
        const gun2 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4),
            new THREE.MeshPhongMaterial({ color: 0x666666 })
        );
        gun2.rotation.x = Math.PI / 2;
        gun2.position.set(-0.3, 0, 0.7);
        plane.add(gun2);
    }
    
    return plane;
}

// ========== CREATE OBSTACLES ==========
function createObstacle() {
    if (!gameActive || gameOverFlag) return;
    
    if (gameMode === 'boat') {
        const colors = [0xaa3333, 0x3333aa, 0x444444];
        const obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.5, 1.0),
            new THREE.MeshPhongMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
        );
        const randX = Math.random() < 0.4 ? -6 - Math.random() * 3 : (Math.random() < 0.7 ? 6 + Math.random() * 3 : (Math.random() - 0.5) * 5);
        obstacle.position.set(randX, 0.3, gameVehicle ? gameVehicle.position.z - 90 : -90);
        gameScene.add(obstacle);
        gameObstacles.push(obstacle);
    } else {
        const colors = [0xaa3333, 0x884444, 0x44aa44];
        const enemy = createPlane(colors[Math.floor(Math.random() * colors.length)], false);
        enemy.scale.set(0.7, 0.7, 0.7);
        const randX = (Math.random() - 0.5) * 12;
        enemy.position.set(randX, 1 + Math.random() * 3, gameVehicle ? gameVehicle.position.z - 90 : -90);
        gameScene.add(enemy);
        gameObstacles.push(enemy);
    }
}

// ========== CREATE POWERUPS ==========
function createPowerup() {
    if (!gameActive || gameOverFlag) return;
    
    const types = [
        { color: 0xffdd44, reward: 10, name: 'coin' },
        { color: 0x44ddff, reward: 25, name: 'diamond' }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry;
    if (type.name === 'coin') {
        geometry = new THREE.SphereGeometry(0.25, 16, 16);
    } else {
        geometry = new THREE.OctahedronGeometry(0.22);
    }
    
    const powerup = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: type.color, emissive: type.color, emissiveIntensity: 0.3 })
    );
    
    const randX = (Math.random() - 0.5) * 14;
    const randY = gameMode === 'plane' ? 1 + Math.random() * 3 : 0.3;
    powerup.position.set(randX, randY, gameVehicle ? gameVehicle.position.z - 80 - Math.random() * 40 : -100);
    powerup.userData = { reward: type.reward };
    
    gameScene.add(powerup);
    gamePowerups.push(powerup);
}

// ========== CREATE WATER (CHẾ ĐỘ THUYỀN) ==========
function createWater() {
    const geometry = new THREE.PlaneGeometry(500, 400, 100, 80);
    const material = new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 100, transparent: true, opacity: 0.92 });
    waterMesh = new THREE.Mesh(geometry, material);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.3;
    gameScene.add(waterMesh);
}

// ========== CREATE SKY (CHẾ ĐỘ MÁY BAY) ==========
function createSky() {
    gameScene.background = new THREE.Color(0x87CEEB);
    gameScene.fog = new THREE.FogExp2(0x87CEEB, 0.008);
    
    for (let i = 0; i < 25; i++) {
        const cloudGroup = new THREE.Group();
        const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        const sizes = [0.7, 0.5, 0.6, 0.4, 0.5];
        sizes.forEach((size, idx) => {
            const part = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 7), cloudMat);
            part.position.set((idx - 2) * 0.5, 0, (idx % 2) * 0.3);
            cloudGroup.add(part);
        });
        cloudGroup.position.set((Math.random() - 0.5) * 40, 3 + Math.random() * 5, (Math.random() - 0.5) * 100 - 50);
        gameScene.add(cloudGroup);
        clouds.push(cloudGroup);
    }
}

// ========== FIRE BULLET ==========
function fireBullet() {
    if (!gameActive || gameOverFlag) return;
    
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.1),
        new THREE.MeshBasicMaterial({ color: 0xffaa44 })
    );
    
    if (gameMode === 'boat') {
        bullet.position.copy(gameVehicle.position);
        bullet.position.z += 1.6;
        bullet.position.y = 0.6;
    } else {
        bullet.position.copy(gameVehicle.position);
        bullet.position.z += 1.2;
        bullet.position.y = 0.3;
    }
    bullet.userData = { velocityZ: -5 };
    
    gameScene.add(bullet);
    gameBullets.push(bullet);
    playSound(880, 0.12, 0.1);
}

// ========== UPDATE UI ==========
function updateGameUI() {
    const speedElem = document.getElementById('gameSpeed');
    const scoreElem = document.getElementById('gameScore');
    const livesElem = document.getElementById('gameLives');
    const statusElem = document.getElementById('gameStatus');
    
    if (speedElem) {
        let sp = (trackingData.speed * 2.5).toFixed(1);
        speedElem.innerHTML = gameMode === 'plane' ? `✈️ Speed: ${sp}` : `🚤 Speed: ${sp}`;
    }
    if (scoreElem) scoreElem.innerHTML = `💰 Score: ${gameScore}`;
    if (livesElem) livesElem.innerHTML = `❤️ Lives: ${lives}`;
    if (statusElem && !gameOverFlag) statusElem.innerHTML = gameMode === 'plane' ? '✈️ FLYING' : '🌊 RACING';
}

function showRestartButton() {
    const existing = document.getElementById('gameOverlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'gameOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 1000;
        display: flex; justify-content: center; align-items: center;
        flex-direction: column;
    `;
    document.body.appendChild(overlay);
    
    const box = document.createElement('div');
    box.style.cssText = `
        background: linear-gradient(135deg, #0a0a2a, #1a1a3a);
        border: 3px solid #00ffff; border-radius: 20px;
        padding: 40px; text-align: center; box-shadow: 0 0 50px rgba(0,255,255,0.5);
        min-width: 320px;
    `;
    overlay.appendChild(box);
    
    const title = document.createElement('div');
    title.innerHTML = lives <= 0 ? '💀 GAME OVER 💀' : '🎉 VICTORY! 🎉';
    title.style.cssText = `
        font-size: 48px; font-family: Orbitron, monospace; font-weight: bold;
        color: ${lives <= 0 ? '#ff4444' : '#00ff88'}; margin-bottom: 20px;
    `;
    box.appendChild(title);
    
    const scoreText = document.createElement('div');
    scoreText.innerHTML = `💰 SCORE: ${gameScore} 💰`;
    scoreText.style.cssText = `font-size: 32px; color: #ffff00; margin-bottom: 30px;`;
    box.appendChild(scoreText);
    
    const restartBtn = document.createElement('button');
    restartBtn.innerHTML = '🔄 PLAY AGAIN';
    restartBtn.style.cssText = `
        padding: 15px 50px; font-size: 24px; background: #00ffff; color: #000;
        border: none; border-radius: 15px; cursor: pointer; margin-bottom: 20px;
        font-family: Orbitron, monospace; font-weight: bold;
    `;
    restartBtn.onclick = () => { overlay.remove(); resetGame(); };
    box.appendChild(restartBtn);
    
    const homeBtn = document.createElement('button');
    homeBtn.innerHTML = '🏠 HOME';
    homeBtn.style.cssText = `
        padding: 12px 40px; font-size: 20px; background: #ff00ff; color: #000;
        border: none; border-radius: 15px; cursor: pointer;
        font-family: Orbitron, monospace; font-weight: bold;
    `;
    homeBtn.onclick = () => {
        overlay.remove();
        if (typeof stopGame === 'function') stopGame();
        if (typeof window.showGameTypeScreen === 'function') window.showGameTypeScreen();
    };
    box.appendChild(homeBtn);
}

function gameOver() {
    if (gameOverFlag) return;
    gameOverFlag = true;
    gameActive = false;
    showRestartButton();
}

function resetGame() {
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    
    if (gameScene) {
        gameBullets.forEach(b => gameScene.remove(b));
        gameObstacles.forEach(o => gameScene.remove(o));
        gamePowerups.forEach(p => gameScene.remove(p));
        particles.forEach(p => gameScene.remove(p));
    }
    
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameBullets = [];
    gameObstacles = [];
    gamePowerups = [];
    particles = [];
    gameShootCooldown = 0;
    
    if (gameVehicle) {
        gameVehicle.position.set(0, gameMode === 'plane' ? 2 : 0, 0);
        gameVehicle.rotation.set(0, 0, 0);
    }
    if (gameCamera) gameCamera.position.set(0, gameMode === 'plane' ? 6 : 7, 14);
    
    updateGameUI();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createObstacle();
    }, 1200);
    
    powerupInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createPowerup();
    }, 2500);
    
    const statusElem = document.getElementById('gameStatus');
    if (statusElem) statusElem.innerHTML = gameMode === 'plane' ? '✈️ TAKE OFF!' : '🌊 SET SAIL!';
}

// ========== MAIN INIT FUNCTION ==========
export function initGameWithMode(mode) {
    if (gameInitialized) return;
    
    gameMode = mode;
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 5;
    
    const gameCanvas = document.getElementById('gameCanvas');
    if (!gameCanvas || typeof THREE === 'undefined') {
        console.error('Canvas or THREE not ready');
        return;
    }
    
    gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setClearColor(gameMode === 'plane' ? 0x87CEEB : 0x0a1030);
    
    gameScene = new THREE.Scene();
    if (gameMode === 'plane') {
        createSky();
    } else {
        gameScene.background = new THREE.Color(0x0a1030);
        gameScene.fog = new THREE.FogExp2(0x0a1030, 0.008);
        createWater();
    }
    
    gameCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    gameCamera.position.set(0, gameMode === 'plane' ? 6 : 7, 14);
    
    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.7);
    gameScene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(5, 15, 5);
    gameScene.add(sun);
    
    // Create vehicle
    if (gameMode === 'plane') {
        gameVehicle = createPlane(0xff4444, true);
    } else {
        gameVehicle = createBoat(0xff4444, true);
    }
    gameScene.add(gameVehicle);
    
    // Start intervals
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createObstacle();
    }, 1200);
    
    powerupInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createPowerup();
    }, 2500);
    
    // UI elements
    const hud = document.getElementById('gameHud');
    if (hud && !document.getElementById('gameLives')) {
        const livesDiv = document.createElement('div');
        livesDiv.id = 'gameLives';
        livesDiv.innerHTML = '❤️ Lives: 5';
        hud.appendChild(livesDiv);
    }
    
    updateGameUI();
    startGameLoop();
    window.addEventListener('resize', handleResize);
    
    console.log(`🎮 ${gameMode === 'plane' ? 'PLANE' : 'BOAT'} mode initialized!`);
}

function startGameLoop() {
    function animate() {
        if (!gameActive) {
            if (gameRenderer) gameRenderer.render(gameScene, gameCamera);
            requestAnimationFrame(animate);
            return;
        }
        
        gameAnimationId = requestAnimationFrame(animate);
        if (invincibleFrames > 0) invincibleFrames--;
        
        // Get tracking data from window
        if (window.trackingData) {
            trackingData = window.trackingData;
        }
        
        let steering = (trackingData.steeringAngle || 0) * 1.2;
        let speed = Math.max(0.15, (trackingData.speed || 0) * 2.2);
        
        if (gameMode === 'plane') {
            // Plane control: arms spread out
            const targetX = steering * 9;
            gameVehicle.position.x += (targetX - gameVehicle.position.x) * 0.1;
            gameVehicle.position.x = Math.min(9, Math.max(-9, gameVehicle.position.x));
            gameVehicle.rotation.z = -steering * 0.6;
            gameVehicle.rotation.x = Math.abs(steering) * 0.15;
            gameVehicle.position.z -= speed * 0.55;
            gameVehicle.position.y = 2 + Math.sin(Date.now() * 0.005) * 0.1;
            
            // Propeller spin
            if (gameVehicle.propeller) gameVehicle.propeller.rotation.x += 0.2;
            
            // Move clouds
            clouds.forEach(cloud => {
                cloud.position.z += speed * 0.25;
                if (cloud.position.z > 30) cloud.position.z -= 100;
            });
        } else {
            // Boat control: steering wheel
            const targetX = steering * 8.5;
            gameVehicle.position.x += (targetX - gameVehicle.position.x) * 0.1;
            gameVehicle.position.x = Math.min(8.5, Math.max(-8.5, gameVehicle.position.x));
            gameVehicle.rotation.z = -steering * 0.5;
            gameVehicle.position.z -= speed * 0.48;
            
            // Animate waves
            if (waterMesh) {
                waveOffset += 0.02;
                const positions = waterMesh.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i+1] = Math.sin(positions[i] * 0.3 + waveOffset) * 0.05 + Math.cos(positions[i+2] * 0.2 + waveOffset) * 0.05;
                }
                waterMesh.geometry.attributes.position.needsUpdate = true;
            }
        }
        
        // Shooting
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireBullet();
            gameShootCooldown = 10;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        // Update bullets
        for (let i = gameBullets.length - 1; i >= 0; i--) {
            const b = gameBullets[i];
            b.position.z += b.userData.velocityZ;
            if (b.position.z < -30 || b.position.z > 30) {
                gameScene.remove(b);
                gameBullets.splice(i, 1);
            }
        }
        
        // Update obstacles and check collision
        for (let i = gameObstacles.length - 1; i >= 0; i--) {
            const o = gameObstacles[i];
            o.position.z += speed * 0.45 + 0.6;
            if (gameMode === 'plane') {
                o.rotation.y += 0.05;
                o.rotation.z += 0.03;
            }
            
            if (o.position.z > 28) {
                gameScene.remove(o);
                gameObstacles.splice(i, 1);
                continue;
            }
            
            const dx = o.position.x - gameVehicle.position.x;
            const dz = o.position.z - gameVehicle.position.z;
            const dy = gameMode === 'plane' ? Math.abs(o.position.y - gameVehicle.position.y) : 0;
            const distance = Math.sqrt(dx*dx + dz*dz + dy*dy);
            
            if (distance < 0.9 && invincibleFrames === 0) {
                lives--;
                invincibleFrames = 50;
                playSound(300, 0.35, 0.2);
                createExplosion(o.position, 0xff4444);
                gameScene.remove(o);
                gameObstacles.splice(i, 1);
                updateGameUI();
                if (lives <= 0) gameOver();
            }
        }
        
        // Bullet vs obstacle collision
        for (let oi = gameObstacles.length - 1; oi >= 0; oi--) {
            const o = gameObstacles[oi];
            for (let bi = gameBullets.length - 1; bi >= 0; bi--) {
                const b = gameBullets[bi];
                if (o.position.distanceTo(b.position) < 0.8) {
                    gameScene.remove(o);
                    gameScene.remove(b);
                    gameObstacles.splice(oi, 1);
                    gameBullets.splice(bi, 1);
                    gameScore += 10;
                    updateGameUI();
                    playSound(600, 0.15, 0.12);
                    createExplosion(o.position, 0xffaa44);
                    break;
                }
            }
        }
        
        // Collect powerups
        for (let i = gamePowerups.length - 1; i >= 0; i--) {
            const p = gamePowerups[i];
            p.position.z += speed * 0.45 + 0.5;
            p.rotation.y += 0.05;
            
            const dx = p.position.x - gameVehicle.position.x;
            const dz = p.position.z - gameVehicle.position.z;
            const dy = gameMode === 'plane' ? Math.abs(p.position.y - gameVehicle.position.y) : 0;
            const distance = Math.sqrt(dx*dx + dz*dz + dy*dy);
            
            if (distance < 0.9) {
                gameScore += p.userData.reward;
                gameScene.remove(p);
                gamePowerups.splice(i, 1);
                updateGameUI();
                playSound(800, 0.1, 0.08);
            } else if (p.position.z > 28) {
                gameScene.remove(p);
                gamePowerups.splice(i, 1);
            }
        }
        
        // Update particles
        updateParticles();
        
        // Camera follow
        gameCamera.position.x += (gameVehicle.position.x - gameCamera.position.x) * 0.08;
        gameCamera.position.z = gameVehicle.position.z + 12;
        gameCamera.lookAt(gameVehicle.position);
        
        updateGameUI();
        
        // Victory condition
        if (gameScore >= 300 && !gameOverFlag) {
            gameActive = false;
            gameOverFlag = true;
            showRestartButton();
        }
        
        gameRenderer.render(gameScene, gameCamera);
    }
    
    animate();
}

function handleResize() {
    if (gameRenderer) gameRenderer.setSize(window.innerWidth, window.innerHeight);
    if (gameCamera) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
    }
}

export function stopGame() {
    gameActive = false;
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (powerupInterval) clearInterval(powerupInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    gameInitialized = false;
}

// Export to window for script.js
window.initGameWithMode = initGameWithMode;
window.stopGame = stopGame;
