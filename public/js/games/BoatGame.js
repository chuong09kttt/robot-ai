import { BaseGame } from './BaseGame.js';

export class BoatGame extends BaseGame {
    constructor(canvasId) {
        super(canvasId, { lives: 5, speedIcon: '🚤' });
    }
    
    createVehicle() {
        const boat = new THREE.Group();
        
        const hull = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12),
            new THREE.MeshPhongMaterial({ color: 0xff4444 })
        );
        hull.rotation.x = Math.PI / 2;
        hull.position.y = 0.2;
        boat.add(hull);
        
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.12, 2.2),
            new THREE.MeshPhongMaterial({ color: 0xD2B48C })
        );
        deck.position.y = 0.55;
        boat.add(deck);
        
        const bow = new THREE.Mesh(
            new THREE.ConeGeometry(0.4, 0.7, 8),
            new THREE.MeshPhongMaterial({ color: 0xff4444 })
        );
        bow.position.set(0, 0.4, 1.3);
        bow.rotation.x = 0.2;
        boat.add(bow);
        
        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 1.3, 6),
            new THREE.MeshPhongMaterial({ color: 0x8B4513 })
        );
        mast.position.set(0, 1.0, -0.2);
        boat.add(mast);
        
        const sail = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 1.0),
            new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
        );
        sail.position.set(0, 1.1, 0);
        boat.add(sail);
        
        this.vehicle = boat;
        this.scene.add(this.vehicle);
        
        // Water
        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 400, 100, 80),
            new THREE.MeshPhongMaterial({ color: 0x2a6f8f })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.3;
        this.scene.add(water);
    }
}
