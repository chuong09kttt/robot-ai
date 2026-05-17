// ========== MAIN ENTRY POINT ==========
import { startTracking, stopTracking, trackingData } from './core/tracking.js';
import { BoatGame } from './games/BoatGame.js';
import { PlaneGame } from './games/PlaneGame.js';

let currentGame = null;

window.startGameTracking = startTracking;
window.stopGameTracking = stopTracking;

// Khởi tạo game theo mode
window.startGameWithMode = function(mode) {
    document.getElementById('gameTypeScreen').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    
    if (currentGame) currentGame.stop();
    
    if (mode === 'boat') {
        currentGame = new BoatGame('gameCanvas');
    } else if (mode === 'plane') {
        currentGame = new PlaneGame('gameCanvas');
    }
    
    if (currentGame) {
        currentGame.start();
    }
};

window.stopGame = function() {
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
    if (window.stopGameTracking) window.stopGameTracking();
};

// Xuất cho các module khác
window.BoatGame = BoatGame;
window.PlaneGame = PlaneGame;
