import { BaseGame } from './BaseGame.js';

export class PlaneGame extends BaseGame {
    constructor(canvasId) {
        super(canvasId, { lives: 3, speedIcon: '✈️' });
    }
    
    createVehicle() {
        const plane = new THREE.Group();
        
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8),
            new THREE.MeshPhongMaterial({ color: 0xff4444 })
        );
        body.rotation.z = Math.PI / 2;
        plane.add(body);
        
        const wing = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.08, 0.5),
            new THREE.MeshPhongMaterial({ color: 0xff4444 })
        );
        wing.position.set(0, 0.1, 0);
        plane.add(wing);
        
        const cockpit = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0x88ccff })
        );
        cockpit.position.set(0, 0.2, 0.5);
        plane.add(cockpit);
        
        this.vehicle = plane;
        this.scene.add(this.vehicle);
        
        // Sky background
        this.scene.background = new THREE.Color(0x87CEEB);
        this.camera.position.set(0, 5, 12);
        
        // Clouds
        for (let i = 0; i < 20; i++) {
            const cloudGroup = new THREE.Group();
            const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
            [0.7, 0.5, 0.6, 0.4, 0.5].forEach((size, idx) => {
                const part = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 7), cloudMat);
                part.position.set((idx - 2) * 0.5, 0, (idx % 2) * 0.3);
                cloudGroup.add(part);
            });
            cloudGroup.position.set((Math.random() - 0.5) * 40, 3 + Math.random() * 5, (Math.random() - 0.5) * 100 - 50);
            this.scene.add(cloudGroup);
        }
    }
    
    updateMovement(steering, speed) {
        if (!this.vehicle) return;
        const targetX = steering * 10;
        this.vehicle.position.x += (targetX - this.vehicle.position.x) * 0.12;
        this.vehicle.position.x = Math.min(9, Math.max(-9, this.vehicle.position.x));
        this.vehicle.rotation.z = -steering * 0.6;
        this.vehicle.position.z -= speed * 0.55;
        this.vehicle.position.y = 2 + Math.sin(Date.now() * 0.005) * 0.1;
    }
}
