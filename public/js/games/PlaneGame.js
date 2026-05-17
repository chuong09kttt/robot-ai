import { BaseGame } from './BaseGame.js';

export class PlaneGame extends BaseGame {
    constructor(canvasId) {
        super(canvasId, { lives: 3, speedIcon: '✈️' });
    }
    
    createVehicle() {
        const plane = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
        body.rotation.z = Math.PI / 2;
        plane.add(body);
        
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), new THREE.MeshPhongMaterial({ color: 0xff4444 }));
        wing.position.set(0, 0.1, 0);
        plane.add(wing);
        
        this.vehicle = plane;
        this.scene.add(this.vehicle);
        this.scene.background = new THREE.Color(0x87CEEB);
        this.camera.position.set(0, 5, 12);
    }
    
    updateMovement(steering, speed) {
        const targetX = steering * 10;
        this.vehicle.position.x += (targetX - this.vehicle.position.x) * 0.12;
        this.vehicle.position.x = Math.min(9, Math.max(-9, this.vehicle.position.x));
        this.vehicle.rotation.z = -steering * 0.6;
        this.vehicle.position.z -= speed * 0.55;
        this.vehicle.position.y = 2 + Math.sin(Date.now() * 0.005) * 0.1;
    }
}
