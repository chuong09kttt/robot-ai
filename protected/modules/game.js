// ========== GAME MODULE ==========
(function() {
    let gameActive = false;
    let gameMode = null;
    let gameScene = null;
    let gameCamera = null;
    let gameRenderer = null;
    let gameShip = null;
    let gamePlane = null;
    let gameBullets = [];
    let gameObstacles = [];
    let gamePowerups = [];
    let gameScore = 0;
    let gameLives = 5;
    let gameAnimationId = null;
    let gameShootCooldown = 0;
    let trackingData = { steeringAngle: 0, speed: 0, shooting: false };
    
    const gameCanvas = document.getElementById('gameCanvas');
    
    function playSound(freq, duration, volume = 0.1) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            gain.gain.value = volume;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
            osc.stop(audioCtx.currentTime + duration);
            setTimeout(() => audioCtx.close(), duration * 1000 + 100);
        } catch(e) {}
    }
    
    function createBoat() {
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
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
        
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), new THREE.MeshPhongMaterial({ color: 0x888888 }));
        cannon.rotation.z = Math.PI / 2;
        cannon.position.set(0, 0.5, 1.2);
        boat.add(cannon);
        
        return boat;
    }
    
    function createPlane() {
        const plane = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
        body.rotation.z = Math.PI / 2;
        plane.add(body);
        
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
        wing.position.set(0, 0.1, 0);
        plane.add(wing);
        
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshPhongMaterial({ color: 0x88ccff }));
        cockpit.position.set(0, 0.2, 0.5);
        plane.add(cockpit);
        
        const propeller = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.1), new THREE.MeshPhongMaterial({ color: 0xaa8866 }));
        propeller.position.set(0, 0, 0.9);
        plane.add(propeller);
        plane.propeller = propeller;
        
        return plane;
    }
    
    function createObstacle() {
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.0), new THREE.MeshPhongMaterial({ color: 0xaa3333 }));
        obstacle.position.set((Math.random() - 0.5) * 14, 0.3, (gameShip?.position.z || 0) - 90);
        gameScene.add(obstacle);
        gameObstacles.push(obstacle);
    }
    
    function createPowerup() {
        const powerup = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00 }));
        powerup.position.set((Math.random() - 0.5) * 14, 0.3, (gameShip?.position.z || 0) - 80);
        gameScene.add(powerup);
        gamePowerups.push(powerup);
    }
    
    function fireBullet() {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
        const vehicle = gameShip || gamePlane;
        if (vehicle) {
            bullet.position.copy(vehicle.position);
            bullet.position.z += 1.6;
            bullet.position.y = 0.6;
            bullet.userData = { velocityZ: -5 };
            gameScene.add(bullet);
            gameBullets.push(bullet);
            playSound(880, 0.15, 0.1);
        }
    }
    
    function updateUI() {
        const speedElem = document.getElementById('gameSpeed');
        const scoreElem = document.getElementById('gameScore');
        const livesElem = document.getElementById('gameLives');
        if (speedElem) speedElem.innerHTML = `⚡ Speed: ${(trackingData.speed * 2).toFixed(1)}`;
        if (scoreElem) scoreElem.innerHTML = `💰 Score: ${gameScore}`;
        if (livesElem) livesElem.innerHTML = `❤️ Lives: ${gameLives}`;
    }
    
    function gameOver() {
        gameActive = false;
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000;display:flex;justify-content:center;align-items:center;flex-direction:column`;
        overlay.innerHTML = `
            <div style="background:linear-gradient(135deg,#0a0a2a,#1a1a3a);border:2px solid #00d4ff;border-radius:20px;padding:40px;text-align:center">
                <div style="font-size:48px;color:#ff4444;margin-bottom:20px">💀 GAME OVER 💀</div>
                <div style="font-size:32px;color:#ffff00;margin-bottom:30px">💰 SCORE: ${gameScore}</div>
                <button id="restartGameBtn" style="padding:15px 40px;font-size:24px;background:#00d4ff;border:none;border-radius:15px;cursor:pointer">🔄 PLAY AGAIN</button>
                <button id="homeGameBtn" style="margin-top:20px;padding:12px 35px;font-size:20px;background:#ff00ff;border:none;border-radius:15px;cursor:pointer">🏠 HOME</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        document.getElementById('restartGameBtn').onclick = () => {
            overlay.remove();
            resetGame();
        };
        document.getElementById('homeGameBtn').onclick = () => {
            overlay.remove();
            document.getElementById('gamePanel').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
        };
    }
    
    function resetGame() {
        gameScore = 0;
        gameLives = 5;
        gameBullets.forEach(b => gameScene.remove(b));
        gameObstacles.forEach(o => gameScene.remove(o));
        gamePowerups.forEach(p => gameScene.remove(p));
        gameBullets = [];
        gameObstacles = [];
        gamePowerups = [];
        if (gameShip) gameShip.position.set(0, 0, 0);
        if (gamePlane) gamePlane.position.set(0, 2, 0);
        gameActive = true;
        updateUI();
    }
    
    function startGameLoop() {
        function animate() {
            if (!gameActive) {
                if (gameRenderer) gameRenderer.render(gameScene, gameCamera);
                requestAnimationFrame(animate);
                return;
            }
            
            gameAnimationId = requestAnimationFrame(animate);
            
            if (window.trackingData) trackingData = window.trackingData;
            
            let steering = (trackingData.steeringAngle || 0) * 1.2;
            let speed = Math.max(0.15, (trackingData.speed || 0) * 2);
            
            if (gameMode === 'boat' && gameShip) {
                const targetX = steering * 8.5;
                gameShip.position.x += (targetX - gameShip.position.x) * 0.1;
                gameShip.position.x = Math.min(8.5, Math.max(-8.5, gameShip.position.x));
                gameShip.rotation.z = -steering * 0.5;
                gameShip.position.z -= speed * 0.48;
            } else if (gameMode === 'plane' && gamePlane) {
                const targetX = steering * 10;
                gamePlane.position.x += (targetX - gamePlane.position.x) * 0.12;
                gamePlane.position.x = Math.min(9, Math.max(-9, gamePlane.position.x));
                gamePlane.rotation.z = -steering * 0.6;
                gamePlane.position.z -= speed * 0.55;
                gamePlane.position.y = 2 + Math.sin(Date.now() * 0.005) * 0.1;
                if (gamePlane.propeller) gamePlane.propeller.rotation.x += 0.2;
            }
            
            if (trackingData.shooting && gameShootCooldown <= 0) {
                fireBullet();
                gameShootCooldown = 10;
            }
            if (gameShootCooldown > 0) gameShootCooldown--;
            
            for (let i = gameBullets.length-1; i>=0; i--) {
                const b = gameBullets[i];
                b.position.z += b.userData.velocityZ;
                if (b.position.z < -30) {
                    gameScene.remove(b);
                    gameBullets.splice(i,1);
                }
            }
            
            for (let i = gameObstacles.length-1; i>=0; i--) {
                const o = gameObstacles[i];
                o.position.z += speed * 0.45 + 0.6;
                if (o.position.z > 28) {
                    gameScene.remove(o);
                    gameObstacles.splice(i,1);
                    continue;
                }
                const vehicle = gameShip || gamePlane;
                if (vehicle && Math.abs(o.position.x - vehicle.position.x) < 0.9 && Math.abs(o.position.z - vehicle.position.z) < 1.3) {
                    gameLives--;
                    gameScene.remove(o);
                    gameObstacles.splice(i,1);
                    updateUI();
                    playSound(300, 0.35, 0.2);
                    if (gameLives <= 0) gameOver();
                }
            }
            
            for (let i = gamePowerups.length-1; i>=0; i--) {
                const p = gamePowerups[i];
                p.position.z += speed * 0.45 + 0.5;
                p.rotation.y += 0.05;
                const vehicle = gameShip || gamePlane;
                if (vehicle && Math.abs(p.position.x - vehicle.position.x) < 1.0 && Math.abs(p.position.z - vehicle.position.z) < 1.3) {
                    gameScore += 10;
                    gameScene.remove(p);
                    gamePowerups.splice(i,1);
                    updateUI();
                    playSound(800, 0.1, 0.08);
                } else if (p.position.z > 28) {
                    gameScene.remove(p);
                    gamePowerups.splice(i,1);
                }
            }
            
            const vehicle = gameShip || gamePlane;
            if (vehicle) {
                gameCamera.position.x += (vehicle.position.x - gameCamera.position.x) * 0.06;
                gameCamera.position.z = vehicle.position.z + 12;
                gameCamera.lookAt(vehicle.position);
            }
            
            updateUI();
            
            if (gameRenderer && gameScene && gameCamera) {
                gameRenderer.render(gameScene, gameCamera);
            }
        }
        
        animate();
    }
    
    function initBoatMode() {
        console.log('🚤 Boat mode starting...');
        gameMode = 'boat';
        gameActive = true;
        gameScore = 0;
        gameLives = 5;
        
        if (!gameCanvas || typeof THREE === 'undefined') {
            console.error('Canvas or THREE not ready');
            return;
        }
        
        gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
        gameRenderer.setSize(window.innerWidth, window.innerHeight);
        gameRenderer.setClearColor(0x0a1030);
        
        gameScene = new THREE.Scene();
        gameScene.background = new THREE.Color(0x0a1030);
        gameScene.fog = new THREE.FogExp2(0x0a1030, 0.008);
        
        gameCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        gameCamera.position.set(0, 7, 14);
        
        const ambient = new THREE.AmbientLight(0x404060, 0.7);
        gameScene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
        sun.position.set(5, 15, 5);
        gameScene.add(sun);
        
        const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 400, 100, 80), new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 100 }));
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.3;
        gameScene.add(water);
        
        gameShip = createBoat();
        gameScene.add(gameShip);
        
        setInterval(() => { if (gameActive) createObstacle(); }, 1200);
        setInterval(() => { if (gameActive) createPowerup(); }, 2500);
        
        startGameLoop();
        if (window.startGameTracking) window.startGameTracking();
        updateUI();
    }
    
    function initPlaneMode() {
        console.log('✈️ Plane mode starting...');
        gameMode = 'plane';
        gameActive = true;
        gameScore = 0;
        gameLives = 5;
        
        if (!gameCanvas || typeof THREE === 'undefined') {
            console.error('Canvas or THREE not ready');
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
        
        const ambient = new THREE.AmbientLight(0x404060, 0.7);
        gameScene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
        sun.position.set(5, 15, 5);
        gameScene.add(sun);
        
        for (let i = 0; i < 30; i++) {
            const cloudGroup = new THREE.Group();
            const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
            [0.7, 0.5, 0.6, 0.4, 0.5].forEach((size, idx) => {
                const part = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 7), cloudMat);
                part.position.set((idx - 2) * 0.5, 0, (idx % 2) * 0.3);
                cloudGroup.add(part);
            });
            cloudGroup.position.set((Math.random() - 0.5) * 40, 3 + Math.random() * 5, (Math.random() - 0.5) * 100 - 50);
            gameScene.add(cloudGroup);
        }
        
        gamePlane = createPlane();
        gameScene.add(gamePlane);
        
        setInterval(() => { if (gameActive) createObstacle(); }, 1200);
        setInterval(() => { if (gameActive) createPowerup(); }, 2500);
        
        startGameLoop();
        if (window.startGameTracking) window.startGameTracking();
        updateUI();
    }
    
    window.initBoatMode = initBoatMode;
    window.initPlaneMode = initPlaneMode;
    window.stopGame = function() {
        gameActive = false;
        if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
        if (window.stopGameTracking) window.stopGameTracking();
    };
    window.startGameWithMode = function(mode) {
        document.getElementById('gameTypeScreen').style.display = 'none';
        document.getElementById('gamePanel').style.display = 'block';
        if (mode === 'boat') initBoatMode();
        else if (mode === 'plane') initPlaneMode();
    };
})();
