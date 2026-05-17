// ========== CHAT MODULE ==========
// This file will be obfuscated

(function() {
    // Chat specific logic
    const chatState = {
        isAwake: false,
        messages: []
    };
    
    // Export functions
    window.initChatUI = function() {
        console.log('💬 Chat mode initialized');
        window.CHIRI.isAwake = false;
        window.updateWakeStatus('sleeping');
    };
    
    window.sendChatMessage = function(text) {
        if (!text) return;
        window.addMessage('user', text);
        if (window.CHIRI.ws?.readyState === WebSocket.OPEN) {
            window.CHIRI.ws.send(JSON.stringify({ type: 'voice', text, driveMode: false }));
        }
    };
    
    window.clearChat = function() {
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            chatBox.innerHTML = '<div class="message ai"><div class="bubble">🐹 SYSTEM ONLINE. SAY "XIN CHÀO" TO ACTIVATE.</div></div>';
        }
    };
})();
