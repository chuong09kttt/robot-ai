// ========== MAIN APPLICATION (OBFUSCATED IN PRODUCTION) ==========
// This file will be obfuscated before deployment

import { initWebSocket } from './core/websocket.js';
import { initSpeechRecognition } from './core/speech.js';

// Global state
window.state = {
    currentUser: null,
    ws: null,
    isAwake: false,
    isTranslatorMode: false
};

// Initialize after login
async function initApp() {
    console.log('🔐 Initializing secure application...');
    
    // Get user info
    const res = await fetch('/api/auth/check', { credentials: 'include' });
    const data = await res.json();
    
    if (data.authenticated) {
        window.state.currentUser = data.user;
        document.getElementById('userNameDisplay').innerHTML = `👤 ${data.user.name}`;
        
        // Initialize core services
        initWebSocket();
        initSpeechRecognition();
        
        // Setup navigation
        setupNavigation();
        
        // Show mode screen
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('modeScreen').style.display = 'block';
    }
}

function setupNavigation() {
    document.querySelectorAll('.mode-card').forEach(card => {
        card.onclick = () => {
            const mode = card.getAttribute('data-mode');
            if (mode === 'chat') window.showChatMode?.();
            else if (mode === 'drive') window.showDriveMode?.();
            else if (mode === 'translate') window.showTranslateMode?.();
            else if (mode === 'camera') window.showCameraMode?.();
            else if (mode === 'game') window.showGameMode?.();
        };
    });
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.onclick = () => window.showModeScreen?.();
    });
}

// Start app
initApp();
