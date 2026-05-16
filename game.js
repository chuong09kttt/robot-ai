// ========== OCEAN RUSH GAME - URBAN RACING STYLE ==========
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
let gameOpponents = [];
let gameShootCooldown = 0;
let gameScore = 0;
let gameAnimationId = null;
let obstacleInterval = null;
let opponentInterval = null;
let lives = 5;
let invincibleFrames = 0;
let gameOverFlag = false;
let gameLoopRunning = false;
let roadLines = [];
let buildings = [];
let speedLines = [];

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

function createExplosion(position) {
    if (!gameScene) return;
    
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xff6600 })
        );
        particle.position.copy(position);
        particle.userData = {
            velocityX: (Math.random() - 0.5) * 0.4,
            velocityY: Math.random() * 0.3,
            velocityZ: (Math.random() - 0.5) * 0.4,
            life: 20
        };
        gameScene.add(particle);
        
        setTimeout(() => {
            if (particle.parent) gameScene.remove(particle);
        }, 500);
    }
    playSound(200, 0.3, 0.2);
}

// Tạo thuyền chi tiết hơn (phong cách game24h)
function createBoat(color, isPlayer = false) {
    const boat = new THREE.Group();
    
    // Thân thuyền
    const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.9, 1.8, 8),
        new THREE.MeshPhongMaterial({ color: color, shininess: 70 })
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.2;
    boat.add(hull);
    
    // Boong
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.15, 2.2),
        new THREE.MeshPhongMaterial({ color: 0xD2B48C })
    );
    deck.position.y = 0.55;
    boat.add(deck);
    
    // Mũi thuyền
    const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.8, 6),
        new THREE.MeshPhongMaterial({ color: color })
    );
    bow.position.set(0, 0.4, 1.3);
    bow.rotation.x = 0.2;
    boat.add(bow);
    
    if (isPlayer) {
        // Cột buồm và buồm cho thuyền người chơi
        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 1.2, 4),
            new THREE.MeshPhongMaterial({ color: 0x8B4513 })
        );
        mast.position.set(0, 1, -0.3);
        boat.add(mast);
        
        const sail = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 1.0),
            new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
        );
        sail.position.set(0, 1.1, 0);
        boat.add(sail);
        
        // Cờ đỏ
        const flag = new THREE.Mesh(
            new THREE.PlaneGeometry(0.35, 0.2),
            new THREE.MeshPhongMaterial({ color: 0xFF3333, side: THREE.DoubleSide })
        );
        flag.position.set(0.15, 1.5, -0.2);
        flag.rotation.z = 0.3;
        boat.add(flag);
        
        // Pháo
        const cannon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6),
            new THREE.MeshPhongMaterial({ color: 0x666666 })
        );
        cannon.rotation.z = Math.PI / 2;
        cannon.position.set(0, 0.5, 1.1);
        boat.add(cannon);
        boat.cannon = cannon;
    }
    
    return boat;
}

// Tạo tòa nhà (phong cách thành phố)
function createBuilding(x, z, width, height, depth, color) {
    const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshPhongMaterial({ color: color })
    );
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = false;
    return building;
}

// Tạo đối thủ
function createOpponent() {
    const colors = [0x44aa44, 0xaa4444, 0x4444aa, 0xaa44aa];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const boat = createBoat(color, false);
    
    boat.position.set(
        (Math.random() - 0.5) * 10,
        0,
        gameShip ? gameShip.position.z - 60 - Math.random() * 30 : -80
    );
    boat.userData = {
        speed: 0.3 + Math.random() * 0.3,
        type: 'opponent'
    };
    
    gameScene.add(boat);
    gameOpponents.push(boat);
    return boat;
}

// Tạo vật cản (phong cách đa dạng)
function createObstacle() {
    const types = [
        { color: 0x666666, name: 'rock', size: 0.5, height: 0.4 },
        { color: 0x8B5A2B, name: 'barrel', size: 0.5, height: 0.6 },
        { color: 0x4a6e8a, name: 'buoy', size: 0.4, height: 0.5 },
        { color: 0xffaa33, name: 'floating', size: 0.6, height: 0.2 }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry;
    if (type.name === 'rock') {
        geometry = new THREE.DodecahedronGeometry(type.size);
    } else if (type.name === 'barrel') {
        geometry = new THREE.CylinderGeometry(type.size, type.size, type.height, 8);
    } else if (type.name === 'buoy') {
        geometry = new THREE.ConeGeometry(type.size, type.height, 6);
    } else {
        geometry = new THREE.BoxGeometry(type.size, type.height, type.size);
    }
    
    const obstacle = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({ color: type.color, shininess: 40 })
    );
    
    // Dàn đều vật cản
    let randomX;
    const rand = Math.random();
    if (rand < 0.35) randomX = -7 - Math.random() * 2.5;
    else if (rand < 0.7) randomX = 7 + Math.random() * 2.5;
    else randomX = (Math.random() - 0.5) * 6;
    
    obstacle.position.set(randomX, type.height / 2, gameShip ? gameShip.position.z - 90 : -90);
    obstacle.userData = { type: 'obstacle' };
    
    gameScene.add(obstacle);
    gameObstacles.push(obstacle);
    return obstacle;
}

// Tạo vạch kẻ đường
function createRoadLines() {
    for (let i = -50; i < 200; i += 4) {
        const lineMat = new THREE.MeshPhongMaterial({ color: 0xffff99 });
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 1.5), lineMat);
        line.position.set(0, 0.02, i);
        gameScene.add(line);
        roadLines.push(line);
    }
}

// Tạo tòa nhà hai bên đường
function createCityBuildings() {
    const colors = [0x6688aa, 0x88aacc, 0x6688cc, 0x7799bb, 0x5588aa];
    const buildingColors = [0xccaa88, 0xaa8866, 0x886644, 0x996633];
    
    // Bên trái
    for (let z = -40; z < 150; z += 12) {
        const width = 1.5 + Math.random() * 1;
        const height = 2 + Math.random() * 3.5;
        const depth = 1.5 + Math.random() * 1;
        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const building = createBuilding(-10.5, z, width, height, depth, color);
        gameScene.add(building);
        buildings.push(building);
        
        // Thêm cửa sổ
        const windowMat = new THREE.MeshPhongMaterial({ color: 0xffcc66 });
        for (let h = 0.5; h < height; h += 0.7) {
            const windowLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), windowMat);
            windowLight.position.set(-10.5, h, z + 0.5);
            gameScene.add(windowLight);
        }
    }
    
    // Bên phải
    for (let z = -40; z < 150; z += 14) {
        const width = 1.5 + Math.random() * 1;
        const height = 2 + Math.random() * 4;
        const depth = 1.5 + Math.random() * 1;
        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const building = createBuilding(10.5, z, width, height, depth, color);
        gameScene.add(building);
        buildings.push(building);
    }
}

// Nút chơi lại
function showRestartButton() {
    const existingOverlay = document.getElementById("gameOverlay");
    if (existingOverlay) existingOverlay.remove();
    
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
    scoreText.innerHTML = `🎯 SCORE: ${gameScore}`;
    scoreText.style.cssText = `
        font-size: 32px; font-family: Orbitron, monospace; color: #ffff00;
        margin-bottom: 30px; font-weight: bold;
    `;
    box.appendChild(scoreText);
    
    const restartBtn = document.createElement("button");
    restartBtn.innerHTML = "🔄 PLAY AGAIN";
    restartBtn.style.cssText = `
        padding: 15px 50px; font-size: 28px; font-family: Orbitron, monospace;
        font-weight: bold; color: #00ffff; background: rgba(0,0,0,0.9);
        border: 3px solid #00ffff; border-radius: 15px; cursor: pointer;
        transition: all 0.3s; margin-bottom: 20px;
    `;
    restartBtn.onmouseover = () => {
        restartBtn.style.backgroundColor = "#00ffff";
        restartBtn.style.color = "#000";
        restartBtn.style.transform = "scale(1.05)";
    };
    restartBtn.onmouseout = () => {
        restartBtn.style.backgroundColor = "rgba(0,0,0,0.9)";
        restartBtn.style.color = "#00ffff";
        restartBtn.style.transform = "scale(1)";
    };
    restartBtn.onclick = () => {
        overlay.remove();
        resetGame();
    };
    box.appendChild(restartBtn);
    
    const homeBtn = document.createElement("button");
    homeBtn.innerHTML = "🏠 HOME";
    homeBtn.style.cssText = `
        padding: 12px 40px; font-size: 20px; font-family: Orbitron, monospace;
        font-weight: bold; color: #ff00ff; background: rgba(0,0,0,0.9);
        border: 3px solid #ff00ff; border-radius: 15px; cursor: pointer;
        transition: all 0.3s;
    `;
    homeBtn.onmouseover = () => {
        homeBtn.style.backgroundColor = "#ff00ff";
        homeBtn.style.color = "#000";
    };
    homeBtn.onmouseout = () => {
        homeBtn.style.backgroundColor = "rgba(0,0,0,0.9)";
        homeBtn.style.color = "#ff00ff";
    };
    homeBtn.onclick = () => {
        overlay.remove();
        if (typeof window.stopGame === 'function') window.stopGame();
        if (typeof window.showModeScreen === 'function') window.showModeScreen();
    };
    box.appendChild(homeBtn);
}

function resetGame() {
    if (obstacleInterval) clearInterval(obstacleInterval);
    if (opponentInterval) clearInterval(opponentInterval);
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    
    if (gameScene) {
        gameBullets.forEach(b => { if(b.parent) gameScene.remove(b); });
        gameObstacles.forEach(o => { if(o.parent) gameScene.remove(o); });
        gameOpponents.forEach(o => { if(o.parent) gameScene.remove(o); });
    }
    
    gameActive = true;
    gameOverFlag = false;
    gameScore = 0;
    lives = 5;
    invincibleFrames = 0;
    gameBullets = [];
    gameObstacles = [];
    gameOpponents = [];
    gameShootCooldown = 0;
    
    if (gameShip) {
        gameShip.position.set(0, 0, 0);
        gameShip.rotation.set(0, 0, 0);
    }
    if (gameCamera) gameCamera.position.set(0, 8, 12);
    
    updateGameUI();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createObstacle();
    }, 1000);
    
    opponentInterval = setInterval(() => {
        if (gameActive && !gameOverFlag && gameOpponents.length < 3) createOpponent();
    }, 4000);
    
    const statusElem = document.getElementById("gameStatus");
    if (statusElem) {
        statusElem.innerHTML = "🎮 RACE START!";
        setTimeout(() => { if(statusElem && !gameOverFlag) statusElem.innerHTML = "🎮 RACING"; }, 2000);
    }
}

export function initGame() {
    if (gameInitialized) return;
    
    console.log("🎮 Initializing Urban Boat Racing...");
    
    gameActive = true;
    gameInitialized = true;
    gameScore = 0;
    lives = 5;
    gameBullets = [];
    gameObstacles = [];
    gameOpponents = [];
    
    if (!gameCanvas || typeof THREE === 'undefined') {
        console.error("Canvas or THREE not ready");
        return;
    }
    
    initAudio();
    
    gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setClearColor(0x0a1030);
    
    gameScene = new THREE.Scene();
    gameScene.fog = new THREE.FogExp2(0x0a1030, 0.01);
    gameScene.background = new THREE.Color(0x0a1030);
    
    gameCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    gameCamera.position.set(0, 8, 12);
    gameCamera.lookAt(0, 0, 0);
    
    // Ánh sáng
    const ambient = new THREE.AmbientLight(0x404060, 0.7);
    gameScene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(5, 15, 5);
    gameScene.add(sun);
    const fillLight = new THREE.PointLight(0x4466cc, 0.4);
    fillLight.position.set(0, 5, 0);
    gameScene.add(fillLight);
    
    // Mặt nước
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 90, transparent: true, opacity: 0.9 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.2;
    gameScene.add(water);
    
    // Vạch kẻ đường
    createRoadLines();
    
    // Tòa nhà hai bên
    createCityBuildings();
    
    // Thuyền người chơi
    gameShip = createBoat(0xff4444, true);
    gameScene.add(gameShip);
    
    startGameTracking();
    
    obstacleInterval = setInterval(() => {
        if (gameActive && !gameOverFlag) createObstacle();
    }, 1000);
    
    opponentInterval = setInterval(() => {
        if (gameActive && !gameOverFlag && gameOpponents.length < 4) createOpponent();
    }, 3500);
    
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
        instruction.innerHTML = `🎮 <span>CONTROLS:</span> 2 hands like steering wheel → turn | Head up → speed up | Head down → slow | Close hand → shoot`;
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
    bullet.position.z += 1.5;
    bullet.position.y = 0.6;
    bullet.userData = { velocityZ: -4 };
    
    gameScene.add(bullet);
    gameBullets.push(bullet);
    playSound(880, 0.2, 0.12);
}

function updateGameUI() {
    const speedElem = document.getElementById("gameSpeed");
    const scoreElem = document.getElementById("gameScore");
    const livesElem = document.getElementById("gameLives");
    
    if (speedElem && trackingData) {
        let sp = (trackingData.speed * 2.5).toFixed(1);
        speedElem.innerHTML = `⚡ Speed: ${sp}`;
    }
    if (scoreElem) scoreElem.innerHTML = `🏆 Score: ${gameScore}`;
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
        
        let steering = trackingData.steeringAngle || 0;
        let speed = Math.max(0.15, (trackingData.speed || 0) * 2);
        
        const targetX = steering * 8;
        gameShip.position.x += (targetX - gameShip.position.x) * 0.12;
        gameShip.position.x = Math.min(8, Math.max(-8, gameShip.position.x));
        gameShip.rotation.z = -steering * 0.6;
        gameShip.position.z -= speed * 0.45;
        
        if (trackingData.shooting && gameShootCooldown <= 0 && !gameOverFlag) {
            fireBullet();
            gameShootCooldown = 10;
        }
        if (gameShootCooldown > 0) gameShootCooldown--;
        
        // Di chuyển đạn
        for (let i = gameBullets.length-1; i>=0; i--) {
            const b = gameBullets[i];
            b.position.z += b.userData.velocityZ;
            if (b.position.z < -30 || b.position.z > 30) {
                gameScene.remove(b);
                gameBullets.splice(i,1);
            }
        }
        
        // Di chuyển vật cản
        for (let i = gameObstacles.length-1; i>=0; i--) {
            const o = gameObstacles[i];
            o.position.z += speed * 0.4 + 0.5;
            if (o.position.z > 25) {
                gameScene.remove(o);
                gameObstacles.splice(i,1);
                continue;
            }
            const dz = o.position.z - (gameShip.position.z + 1.3);
            const dx = o.position.x - gameShip.position.x;
            if (Math.sqrt(dx*dx + dz*dz) < 0.9 && invincibleFrames === 0) {
                lives--;
                invincibleFrames = 50;
                playSound(300, 0.3, 0.25);
                createExplosion(o.position);
                gameScene.remove(o);
                gameObstacles.splice(i,1);
                updateGameUI();
                if (lives <= 0) gameOver();
            }
        }
        
        // Di chuyển đối thủ
        for (let i = gameOpponents.length-1; i>=0; i--) {
            const opp = gameOpponents[i];
            opp.position.z += speed * 0.4 + 0.6;
            if (opp.position.z > 25) {
                gameScene.remove(opp);
                gameOpponents.splice(i,1);
            }
        }
        
        // Va chạm đạn với đối thủ
        for (let oi = gameOpponents.length-1; oi>=0; oi--) {
            const opp = gameOpponents[oi];
            for (let bi = gameBullets.length-1; bi>=0; bi--) {
                const bull = gameBullets[bi];
                if (opp.position.distanceTo(bull.position) < 0.8) {
                    gameScene.remove(opp);
                    gameScene.remove(bull);
                    gameOpponents.splice(oi,1);
                    gameBullets.splice(bi,1);
                    gameScore += 20;
                    updateGameUI();
                    playSound(600, 0.2, 0.15);
                    createExplosion(opp.position);
                    break;
                }
            }
        }
        
        // Di chuyển vạch kẻ đường
        roadLines.forEach(line => { line.position.z += speed * 0.45; if(line.position.z > 30) line.position.z -= 80; });
        
        // Cập nhật camera
        gameCamera.position.x += (gameShip.position.x - gameCamera.position.x) * 0.08;
        gameCamera.position.z = gameShip.position.z + 10;
        gameCamera.lookAt(gameShip.position);
        
        updateGameUI();
        
        if (gameScore >= 150 && !gameOverFlag) {
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
    if (opponentInterval) clearInterval(opponentInterval);
    stopGameTracking();
    gameInitialized = false;
}

window.initGame = initGame;
window.stopGame = stopGame;
