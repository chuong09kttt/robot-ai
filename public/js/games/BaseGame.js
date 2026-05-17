// ========== BASE GAME CLASS ==========
// Tất cả các game đều kế thừa từ class này

export class BaseGame {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.options = options;
        this.isActive = false;
        this.score = 0;
        this.lives = options.lives || 5;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.vehicle = null;
        this.bullets = [];
        this.obstacles = [];
        this.powerups = [];
        this.shootCooldown = 0;
        this.animationId = null;
        this.intervals = [];
    }
    
    // Khởi tạo scene 3D
    initScene() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Ánh sáng cơ bản
        const ambient = new THREE.AmbientLight(0x404060, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
        sun.position.set(5, 15, 5);
        this.scene.add(sun);
    }
    
    // Tạo vật thể (override bởi game con)
    createVehicle() {
        throw new Error('Must implement createVehicle()');
    }
    
    createObstacle() {
        throw new Error('Must implement createObstacle()');
    }
    
    createPowerup() {
        throw new Error('Must implement createPowerup()');
    }
    
    // Cập nhật UI
    updateUI() {
        const speedElem = document.getElementById('gameSpeed');
        const scoreElem = document.getElementById('gameScore');
        const livesElem = document.getElementById('gameLives');
        if (speedElem && window.trackingData) {
            speedElem.innerHTML = `${this.options.speedIcon || '⚡'} Speed: ${(window.trackingData.speed * 2).toFixed(1)}`;
        }
        if (scoreElem) scoreElem.innerHTML = `💰 Score: ${this.score}`;
        if (livesElem) livesElem.innerHTML = `❤️ Lives: ${this.lives}`;
    }
    
    // Bắn đạn
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
        this.playSound(880, 0.15, 0.1);
    }
    
    // Phát âm thanh
    playSound(freq, duration, volume = 0.1) {
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
    
    // Xử lý va chạm
    handleCollision(obstacle) {
        this.lives--;
        this.scene.remove(obstacle);
        this.playSound(300, 0.35, 0.2);
        this.updateUI();
        if (this.lives <= 0) this.gameOver();
    }
    
    handlePowerup(powerup) {
        this.score += 10;
        this.scene.remove(powerup);
        this.updateUI();
        this.playSound(800, 0.1, 0.08);
    }
    
    // Game over
    gameOver() {
        this.isActive = false;
        this.intervals.forEach(i => clearInterval(i));
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000;display:flex;justify-content:center;align-items:center;flex-direction:column`;
        overlay.innerHTML = `
            <div style="background:linear-gradient(135deg,#0a0a2a,#1a1a3a);border:2px solid #00d4ff;border-radius:20px;padding:40px;text-align:center">
                <div style="font-size:48px;color:#ff4444;margin-bottom:20px">💀 GAME OVER 💀</div>
                <div style="font-size:32px;color:#ffff00;margin-bottom:30px">💰 SCORE: ${this.score}</div>
                <button id="restartGameBtn" style="padding:15px 40px;font-size:24px;background:#00d4ff;border:none;border-radius:15px;cursor:pointer">🔄 PLAY AGAIN</button>
                <button id="homeGameBtn" style="margin-top:20px;padding:12px 35px;font-size:20px;background:#ff00ff;border:none;border-radius:15px;cursor:pointer">🏠 HOME</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('restartGameBtn').onclick = () => {
            overlay.remove();
            this.reset();
        };
        document.getElementById('homeGameBtn').onclick = () => {
            overlay.remove();
            document.getElementById('gamePanel').style.display = 'none';
            document.getElementById('modeScreen').style.display = 'block';
            if (window.stopGameTracking) window.stopGameTracking();
        };
    }
    
    // Reset game
    reset() {
        this.score = 0;
        this.lives = this.options.lives || 5;
        this.bullets.forEach(b => this.scene.remove(b));
        this.obstacles.forEach(o => this.scene.remove(o));
        this.powerups.forEach(p => this.scene.remove(p));
        this.bullets = [];
        this.obstacles = [];
        this.powerups = [];
        if (this.vehicle) this.vehicle.position.set(0, 0, 0);
        this.isActive = true;
        this.updateUI();
        this.startGameLoop();
        this.startIntervals();
    }
    
    // Vòng lặp game (override bởi game con nếu cần)
    updateMovement(steering, speed) {
        if (!this.vehicle) return;
        const targetX = steering * 8.5;
        this.vehicle.position.x += (targetX - this.vehicle.position.x) * 0.1;
        this.vehicle.position.x = Math.min(8.5, Math.max(-8.5, this.vehicle.position.x));
        this.vehicle.rotation.z = -steering * 0.5;
        this.vehicle.position.z -= speed * 0.48;
    }
    
    startGameLoop() {
        const animate = () => {
            if (!this.isActive) {
                if (this.renderer) this.renderer.render(this.scene, this.camera);
                requestAnimationFrame(animate);
                return;
            }
            
            this.animationId = requestAnimationFrame(animate);
            
            const trackingData = window.trackingData || { steeringAngle: 0, speed: 0.15, shooting: false };
            let steering = (trackingData.steeringAngle || 0) * 1.2;
            let speed = Math.max(0.15, (trackingData.speed || 0) * 2);
            
            this.updateMovement(steering, speed);
            
            if (trackingData.shooting && this.shootCooldown <= 0) {
                this.fireBullet();
                this.shootCooldown = 10;
            }
            if (this.shootCooldown > 0) this.shootCooldown--;
            
            // Update bullets
            for (let i = this.bullets.length-1; i>=0; i--) {
                const b = this.bullets[i];
                b.position.z += b.userData.velocityZ;
                if (b.position.z < -30) {
                    this.scene.remove(b);
                    this.bullets.splice(i,1);
                }
            }
            
            // Update obstacles & collision
            for (let i = this.obstacles.length-1; i>=0; i--) {
                const o = this.obstacles[i];
                o.position.z += speed * 0.45 + 0.6;
                if (o.position.z > 28) {
                    this.scene.remove(o);
                    this.obstacles.splice(i,1);
                    continue;
                }
                if (this.vehicle && Math.abs(o.position.x - this.vehicle.position.x) < 0.9 && 
                    Math.abs(o.position.z - this.vehicle.position.z) < 1.3) {
                    this.handleCollision(o);
                    this.obstacles.splice(i,1);
                }
            }
            
            // Update powerups
            for (let i = this.powerups.length-1; i>=0; i--) {
                const p = this.powerups[i];
                p.position.z += speed * 0.45 + 0.5;
                p.rotation.y += 0.05;
                if (this.vehicle && Math.abs(p.position.x - this.vehicle.position.x) < 1.0 && 
                    Math.abs(p.position.z - this.vehicle.position.z) < 1.3) {
                    this.handlePowerup(p);
                    this.powerups.splice(i,1);
                } else if (p.position.z > 28) {
                    this.scene.remove(p);
                    this.powerups.splice(i,1);
                }
            }
            
            // Update camera
            if (this.vehicle) {
                this.camera.position.x += (this.vehicle.position.x - this.camera.position.x) * 0.06;
                this.camera.position.z = this.vehicle.position.z + 12;
                this.camera.lookAt(this.vehicle.position);
            }
            
            this.updateUI();
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }
    
    startIntervals() {
        const obstacleInterval = setInterval(() => {
            if (this.isActive && this.vehicle) this.createObstacle();
        }, 1200);
        const powerupInterval = setInterval(() => {
            if (this.isActive && this.vehicle) this.createPowerup();
        }, 2500);
        this.intervals = [obstacleInterval, powerupInterval];
    }
    
    // Khởi động game
    start() {
        this.initScene();
        this.createVehicle();
        this.startGameLoop();
        this.startIntervals();
        this.isActive = true;
        if (window.startGameTracking) window.startGameTracking();
        this.updateUI();
    }
    
    // Dừng game
    stop() {
        this.isActive = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.intervals.forEach(i => clearInterval(i));
        if (window.stopGameTracking) window.stopGameTracking();
    }
}
