// ========== MAIN ENTRY POINT ==========
import { startTracking, stopTracking, trackingData } from './core/tracking.js';
import { BoatGame } from './games/BoatGame.js';
import { PlaneGame } from './games/PlaneGame.js';

let currentGame = null;
let boatGameInstance = null;
let planeGameInstance = null;

// Khởi tạo game thuyền
window.initBoatMode = function() {
    console.log('🚤 Initializing Boat Mode...');
    
    // Dừng game hiện tại nếu có
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
    
    // Tạo instance mới
    boatGameInstance = new BoatGame('gameCanvas');
    currentGame = boatGameInstance;
    currentGame.start();
};

// Khởi tạo game máy bay
window.initPlaneMode = function() {
    console.log('✈️ Initializing Plane Mode...');
    
    // Dừng game hiện tại nếu có
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
    
    // Tạo instance mới
    planeGameInstance = new PlaneGame('gameCanvas');
    currentGame = planeGameInstance;
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

// Start game với mode (cho selector)
window.startGameWithMode = function(mode) {
    document.getElementById('gameTypeScreen').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    
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
