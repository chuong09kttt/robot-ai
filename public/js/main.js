// ========== MAIN ENTRY POINT ==========
import { startTracking, stopTracking, trackingData } from './core/tracking.js';
import { BoatGame } from './games/BoatGame.js';
import { PlaneGame } from './games/PlaneGame.js';

let currentGame = null;

// Khởi tạo game thuyền
window.initBoatMode = function() {
    console.log('🚤 Initializing Boat Mode...');
    if (currentGame) currentGame.stop();
    currentGame = new BoatGame('gameCanvas');
    currentGame.start();
};

// Khởi tạo game máy bay
window.initPlaneMode = function() {
    console.log('✈️ Initializing Plane Mode...');
    if (currentGame) currentGame.stop();
    currentGame = new PlaneGame('gameCanvas');
    currentGame.start();
};

// Dừng game
window.stopGame = function() {
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
    if (window.stopGameTracking) window.stopGameTracking();
};

// Start game với mode
window.startGameWithMode = function(mode) {
    const gameTypeScreen = document.getElementById('gameTypeScreen');
    const gamePanel = document.getElementById('gamePanel');
    if (gameTypeScreen) gameTypeScreen.style.display = 'none';
    if (gamePanel) gamePanel.style.display = 'block';
    
    if (mode === 'boat') {
        window.initBoatMode();
    } else if (mode === 'plane') {
        window.initPlaneMode();
    }
};

// Tracking functions
window.startGameTracking = startTracking;
window.stopGameTracking = stopTracking;

console.log('✅ Game modules loaded and ready');
console.log('✅ window.initBoatMode:', typeof window.initBoatMode);
console.log('✅ window.initPlaneMode:', typeof window.initPlaneMode);
