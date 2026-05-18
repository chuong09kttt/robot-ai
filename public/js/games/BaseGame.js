// ========== BASE GAME CLASS (CLIENT-SIDE) ==========
export class BaseGame {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.options = options;
        this.isActive = false;
        this.score = 0;
        this.lives = options.lives || 5;
        this.sessionId = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.vehicle = null;
        this.obstacles = [];
        this.powerups = [];
        this.shootCooldown = 0;
        this.animationId = null;
        this.intervals = [];
    }
    
    async initSession() {
        try {
            const response = await fetch('/api/secure-game/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: this.options.mode || 'boat' }),
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                this.sessionId = data.sessionId;
                this.lives = data.gameState.lives;
                this.score = data.gameState.score;
                console.log('✅ Game session created:', this.sessionId);
                return true;
            }
            return false;
        } catch(e) {
            console.error('Session init error:', e);
            return false;
        }
    }
    
    async updateGameState(steering, speed, shooting, position) {
        if (!this.sessionId) return null;
        
        try {
            const response = await fetch('/api/secure-game/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    steering: steering,
                    speed: speed,
                    shooting: shooting,
                    position: position
                }),
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                this.score = data.gameState.score;
                this.lives = data.gameState.lives;
                
                // Thêm vật cản mới từ server
                if (data.newObstacles) {
                    for (const obs of data.newObstacles) {
                        this.addObstacleFromServer(obs);
                    }
                }
                
                // Thêm vật phẩm mới từ server
                if (data.newPowerups) {
                    for (const p of data.newPowerups) {
                        this.addPowerupFromServer(p);
                    }
                }
                
                return data.gameState;
            }
            return null;
        } catch(e) {
            console.error('Game update error:', e);
            return null;
        }
    }
    
    async fetchObstacles() {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch(`/api/secure-game/obstacles/${this.sessionId}`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            // Cập nhật obstacles từ server
            this.updateObstaclesFromServer(data.obstacles);
            this.updatePowerupsFromServer(data.powerups);
        } catch(e) {}
    }
    
    addObstacleFromServer(obsData) {
        const obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.5, 1.0),
            new THREE.MeshPhongMaterial({ color: 0xaa3333 })
        );
        obstacle.position.set(obsData.x, 0.3, obsData.z);
        obstacle.userData = { id: obsData.id };
        this.scene.add(obstacle);
        this.obstacles.push(obstacle);
    }
    
    addPowerupFromServer(powerupData) {
        const powerup = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 16, 16),
            new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00 })
        );
        powerup.position.set(powerupData.x, 0.3, powerupData.z);
        powerup.userData = { id: powerupData.id };
        this.scene.add(powerup);
        this.powerups.push(powerup);
    }
    
    updateObstaclesFromServer(serverObstacles) {
        // Xóa obstacles cũ không còn trên server
        const serverIds = new Set(serverObstacles.map(o => o.id));
        
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            if (!serverIds.has(obs.userData.id)) {
                this.scene.remove(obs);
                this.obstacles.splice(i, 1);
            } else {
                // Cập nhật vị trí
                const serverObs = serverObstacles.find(o => o.id === obs.userData.id);
                if (serverObs) {
                    obs.position.z = serverObs.z;
                }
            }
        }
    }
    
    updatePowerupsFromServer(serverPowerups) {
        const serverIds = new Set(serverPowerups.map(p => p.id));
        
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            if (!serverIds.has(p.userData.id)) {
                this.scene.remove(p);
                this.powerups.splice(i, 1);
            } else {
                const serverP = serverPowerups.find(pw => pw.id === p.userData.id);
                if (serverP) {
                    p.position.z = serverP.z;
                }
            }
        }
    }
    
    initScene() {
        // ... (giữ nguyên code tạo scene 3D)
    }
    
    createVehicle() {
        // ... (giữ nguyên)
    }
    
    updateUI() {
        const speedElem = document.getElementById('gameSpeed');
        const scoreElem = document.getElementById('gameScore');
        const livesElem = document.getElementById('gameLives');
        if (speedElem && window.trackingData) {
            speedElem.innerHTML = `⚡ Speed: ${(window.trackingData.speed * 2).toFixed(1)}`;
        }
        if (scoreElem) scoreElem.innerHTML = `💰 Score: ${this.score}`;
        if (livesElem) livesElem.innerHTML = `❤️ Lives: ${this.lives}`;
    }
    
    async start() {
        const sessionCreated = await this.initSession();
        if (!sessionCreated) {
            alert('Không thể khởi tạo game!');
            return;
        }
        
        this.initScene();
        this.createVehicle();
        this.startGameLoop();
        this.startIntervals();
        this.isActive = true;
        if (window.startGameTracking) window.startGameTracking();
        this.updateUI();
    }
    
    startGameLoop() {
        const animate = async () => {
            if (!this.isActive) {
                if (this.renderer) this.renderer.render(this.scene, this.camera);
                requestAnimationFrame(animate);
                return;
            }
            
            this.animationId = requestAnimationFrame(animate);
            
            const trackingData = window.trackingData || { steeringAngle: 0, speed: 0.15, shooting: false };
            let steering = (trackingData.steeringAngle || 0) * 1.2;
            let speed = Math.max(0.15, (trackingData.speed || 0) * 2);
            
            // Cập nhật game state qua server (ẩn logic)
            const vehicle = this.vehicle;
            if (vehicle) {
                const gameState = await this.updateGameState(steering, speed, trackingData.shooting, {
                    x: vehicle.position.x,
                    z: vehicle.position.z
                });
                
                if (gameState) {
                    // Cập nhật vị trí từ server (đã được tính toán an toàn)
                    vehicle.position.x = gameState.position.x;
                    vehicle.position.z = gameState.position.z;
                    vehicle.rotation.z = -steering * 0.5;
                    
                    if (gameState.isGameOver) {
                        this.gameOver();
                    }
                }
            }
            
            // Lấy obstacles từ server
            await this.fetchObstacles();
            
            // Di chuyển obstacles (client chỉ render)
            for (const obs of this.obstacles) {
                // Vị trí đã được cập nhật từ server
            }
            
            // Bắn đạn (client-side effect, server xác nhận)
            if (trackingData.shooting && this.shootCooldown <= 0) {
                this.fireBullet();
                this.shootCooldown = 10;
            }
            if (this.shootCooldown > 0) this.shootCooldown--;
            
            // Update bullets (client-side only)
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                const b = this.bullets[i];
                b.position.z += b.userData.velocityZ;
                if (b.position.z < -30) {
                    this.scene.remove(b);
                    this.bullets.splice(i, 1);
                }
            }
            
            // Update camera
            if (vehicle) {
                this.camera.position.x += (vehicle.position.x - this.camera.position.x) * 0.06;
                this.camera.position.z = vehicle.position.z + 12;
                this.camera.lookAt(vehicle.position);
            }
            
            this.updateUI();
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }
    
    fireBullet() {
        if (!this.vehicle) return;
        const bullet = new THREE.Mesh(
            new THREE.SphereGeometry(0.12),
            new THREE.MeshBasicMaterial({ color: 0xffaa44 })
        );
        bullet.position.copy(this.vehicle.position);
        bullet.position.z += 1.6;
        bullet.position.y = 0.6;
        bullet.userData = { velocityZ: -5 };
        this.scene.add(bullet);
        this.bullets.push(bullet);
    }
    
    gameOver() {
        this.isActive = false;
        this.intervals.forEach(i => clearInterval(i));
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        // Gửi kết thúc game lên server
        fetch('/api/secure-game/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: this.sessionId }),
            credentials: 'include'
        }).then(() => {
            alert(`💀 GAME OVER! Score: ${this.score}`);
            document.getElementById('gamePanel').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
        }).catch(() => {
            alert(`💀 GAME OVER! Score: ${this.score}`);
            document.getElementById('gamePanel').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
        });
    }
    
    stop() {
        this.isActive = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.intervals.forEach(i => clearInterval(i));
        if (window.stopGameTracking) window.stopGameTracking();
    }
}
