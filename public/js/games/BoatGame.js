// ========== BOAT GAME ==========
import { BaseGame } from './BaseGame.js';

export class BoatGame extends BaseGame {
    constructor(canvasId) {
        super(canvasId, { lives: 5, speedIcon: '🚤' });
        this.gameName = 'Boat Racing';
    }
    
    createVehicle() {
        const boat = new THREE.Group();
        
        // Thân thuyền
        const hull = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12),
            new THREE.MeshPhongMaterial({ color: 0xff4444, shininess: 80 })
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
            new THREE.MeshPhongMaterial({ color: 0xff4444 })
        );
        bow.position.set(0, 0.4, 1.3);
        bow.rotation.x = 0.2;
        boat.add(bow);
        
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
        
        this.vehicle = boat;
        this.scene.add(this.vehicle);
        
        // Tạo nước
        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 400, 100, 80),
            new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 100 })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.3;
        this.scene.add(water);
    }
    
    createObstacle() {
        const obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.5, 1.0),
            new THREE.MeshPhongMaterial({ color: 0xaa3333 })
        );
        obstacle.position.set((Math.random() - 0.5) * 14, 0.3, this.vehicle.position.z - 90);
        this.scene.add(obstacle);
        this.obstacles.push(obstacle);
    }
    
    createPowerup() {
        const powerup = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 16, 16),
            new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00 })
        );
        powerup.position.set((Math.random() - 0.5) * 14, 0.3, this.vehicle.position.z - 80);
        this.scene.add(powerup);
        this.powerups.push(powerup);
    }
}
