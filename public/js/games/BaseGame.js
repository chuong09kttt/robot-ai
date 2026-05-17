// ========== BASE GAME CLASS ==========
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
    
    initScene() {
        if (!this.canvas) {
            console.error('Canvas not found');
            return false;
        }
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x0a1030);
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a1030);
        
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 7, 14);
        
        const ambient = new THREE.AmbientLight(0x404060, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
        sun.position.set(5, 15, 5);
        this.scene.add(sun);
        
        return true;
    }
    
    createVehicle() {
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
        hull.rotation.x = Math.PI / 2;
        hull.position.y = 0.2;
        boat.add(hull);
        this.vehicle = boat;
        this.scene.add(this.vehicle);
        
        const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 400, 100, 80), new THREE.MeshPhongMaterial({ color: 0x2a6f8f }));
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.3;
        this.scene.add(water);
    }
    
    createObstacle() {
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.0), new THREE.MeshPhongMaterial({ color: 0xaa3333 }));
        obstacle.position.set((Math.random() - 0.5) * 14, 0.3, this.vehicle.position.z - 90);
        this.scene.add(obstacle);
        this.obstacles.push(obstacle);
    }
    
    createPowerup() {
        const powerup = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00 }));
        powerup.position.set((Math.random() - 0.5) * 14, 0.3, this.vehicle.position.z - 80);
        this.scene.add(powerup);
        this.powerups.push(powerup);
    }
    
    fireBullet() {
        if (!this.vehicle) return;
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
        bullet.position.copy(this.vehicle.position);
        bullet.position.z += 1.6;
        bullet.position.y = 0.6;
        bullet.userData = { velocityZ: -5 };
        this.scene.add(bullet);
        this.bullets.push(bullet);
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
    
    gameOver() {
        this.isActive = false;
        this.intervals.forEach(i => clearInterval(i));
        if (this.animationId) cancelAnimationFrame(this.animationId);
        alert(`💀 GAME OVER! Score: ${this.score}`);
        document.getElementById('gamePanel').style.display = 'none';
        document.getElementById('modeScreen').style.display = 'block';
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
            
            const targetX = steering * 8.5;
            this.vehicle.position.x += (targetX - this.vehicle.position.x) * 0.1;
            this.vehicle.position.x = Math.min(8.5, Math.max(-8.5, this.vehicle.position.x));
            this.vehicle.rotation.z = -steering * 0.5;
            this.vehicle.position.z -= speed * 0.48;
            
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
            
            // Update obstacles
            for (let i = this.obstacles.length-1; i>=0; i--) {
                const o = this.obstacles[i];
                o.position.z += speed * 0.45 + 0.6;
                if (o.position.z > 28) {
                    this.scene.remove(o);
                    this.obstacles.splice(i,1);
                    continue;
                }
                if (Math.abs(o.position.x - this.vehicle.position.x) < 0.9 && 
                    Math.abs(o.position.z - this.vehicle.position.z) < 1.3) {
                    this.lives--;
                    this.scene.remove(o);
                    this.obstacles.splice(i,1);
                    this.updateUI();
                    if (this.lives <= 0) this.gameOver();
                }
            }
            
            // Update powerups
            for (let i = this.powerups.length-1; i>=0; i--) {
                const p = this.powerups[i];
                p.position.z += speed * 0.45 + 0.5;
                p.rotation.y += 0.05;
                if (Math.abs(p.position.x - this.vehicle.position.x) < 1.0 && 
                    Math.abs(p.position.z - this.vehicle.position.z) < 1.3) {
                    this.score += 10;
                    this.scene.remove(p);
                    this.powerups.splice(i,1);
                    this.updateUI();
                } else if (p.position.z > 28) {
                    this.scene.remove(p);
                    this.powerups.splice(i,1);
                }
            }
            
            this.camera.position.x += (this.vehicle.position.x - this.camera.position.x) * 0.06;
            this.camera.position.z = this.vehicle.position.z + 12;
            this.camera.lookAt(this.vehicle.position);
            
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
    
    start() {
        if (!this.initScene()) return;
        this.createVehicle();
        this.startGameLoop();
        this.startIntervals();
        this.isActive = true;
        if (window.startGameTracking) window.startGameTracking();
        this.updateUI();
    }
    
    stop() {
        this.isActive = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.intervals.forEach(i => clearInterval(i));
        if (window.stopGameTracking) window.stopGameTracking();
    }
}
