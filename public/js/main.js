// ========== MAIN ENTRY POINT ==========
import { startTracking, stopTracking } from './core/tracking.js';
import { BoatGame } from './games/BoatGame.js';
import { PlaneGame } from './games/PlaneGame.js';

let currentGame = null;

window.initBoatMode = function() {
    console.log('🚤 Boat mode starting...');
    if (currentGame) currentGame.stop();
    currentGame = new BoatGame('gameCanvas');
    currentGame.start();
};

window.initPlaneMode = function() {
    console.log('✈️ Plane mode starting...');
    if (currentGame) currentGame.stop();
    currentGame = new PlaneGame('gameCanvas');
    currentGame.start();
};

window.stopGame = function() {
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
};

window.startGameWithMode = function(mode) {
    const gameTypeScreen = document.getElementById('gameTypeScreen');
    const gamePanel = document.getElementById('gamePanel');
    if (gameTypeScreen) gameTypeScreen.style.display = 'none';
    if (gamePanel) gamePanel.style.display = 'block';
    
    if (mode === 'boat') window.initBoatMode();
    else if (mode === 'plane') window.initPlaneMode();
};

window.startGameTracking = startTracking;
window.stopGameTracking = stopTracking;

console.log('✅ Game modules ready');
