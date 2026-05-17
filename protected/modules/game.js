// ========== GAME MODULE ==========
// This file will be obfuscated + uses WASM

(function() {
    let gameActive = false;
    let gameMode = null;
    let gameModule = null;
    
    window.initGameUI = function() {
        console.log('🎮 Game mode initialized');
    };
    
    window.startGameWithMode = async function(mode) {
        gameMode = mode;
        document.getElementById('gameTypeScreen').style.display = 'none';
        document.getElementById('gamePanel').style.display = 'block';
        
        // Load WASM module if not loaded
        if (!gameModule) {
            await loadWasm();
        }
        
        // Initialize game based on mode
        if (mode === 'boat') {
            initBoatMode();
        } else if (mode === 'plane') {
            initPlaneMode();
        }
    };
    
    async function loadWasm() {
        try {
            const response = await fetch('/protected/wasm/game.wasm');
            const bytes = await response.arrayBuffer();
            const wasmModule = await WebAssembly.instantiate(bytes, {
                env: {
                    emscripten_get_now: () => Date.now(),
                    emscripten_log: (ptr) => console.log('WASM:', ptr)
                }
            });
            gameModule = wasmModule.instance.exports;
            console.log('✅ WASM module loaded');
        } catch(e) {
            console.error('WASM load failed:', e);
        }
    }
    
    function initBoatMode() {
        console.log('🚤 Boat mode starting');
        if (gameModule) {
            gameModule.game_init();
        }
        // Boat game logic here
        showGameScreen('boat');
    }
    
    function initPlaneMode() {
        console.log('✈️ Plane mode starting');
        if (gameModule) {
            gameModule.game_init();
        }
        showGameScreen('plane');
    }
    
    function showGameScreen(mode) {
        const instruction = document.querySelector('.game-instruction');
        if (instruction) {
            instruction.innerHTML = `🎮 <span>ĐIỀU KHIỂN:</span> ${mode === 'boat' ? 'Giơ 2 tay như vô lăng → xoay để lái' : 'Dang 2 tay sang 2 bên → nghiêng để lượn'} | Đầu cao → tăng tốc | Nắm tay → bắn`;
        }
        
        // Start tracking
        if (window.startGameTracking) {
            window.startGameTracking();
        }
        
        gameActive = true;
    }
    
    window.stopGame = function() {
        gameActive = false;
        if (window.stopGameTracking) {
            window.stopGameTracking();
        }
        document.getElementById('gamePanel').style.display = 'none';
        document.getElementById('modeScreen').style.display = 'block';
    };
    
    // WASM game functions
    window.gameUpdate = function(steering, speed, shooting) {
        if (gameModule && gameActive) {
            gameModule.game_update(steering, speed, shooting ? 1 : 0);
            return {
                x: gameModule.game_get_x(),
                z: gameModule.game_get_z(),
                rotation: gameModule.game_get_rotation(),
                score: gameModule.game_get_score(),
                lives: gameModule.game_get_lives()
            };
        }
        return null;
    };
    
    window.gameAddScore = function(points) {
        if (gameModule) return gameModule.game_add_score(points);
        return 0;
    };
    
    window.gameHit = function() {
        if (gameModule) return gameModule.game_hit();
        return 0;
    };
})();

// Export for navigation
window.showGameTypeScreen = function() {
    document.getElementById('modeScreen').style.display = 'none';
    document.getElementById('gameTypeScreen').style.display = 'block';
};

window.startGameWithMode = window.startGameWithMode;
window.stopGame = window.stopGame;
