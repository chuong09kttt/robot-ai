// ========== DRIVE MODULE ==========
// This file will be obfuscated

(function() {
    let currentCommand = null;
    let timeout = null;
    
    function sendCommand(cmd) {
        if (window.CHIRI.ws?.readyState === WebSocket.OPEN) {
            window.CHIRI.ws.send(JSON.stringify({ type: 'drive_command', command: cmd, duration: 0 }));
        }
    }
    
    function updateStatus(msg) {
        const statusElem = document.getElementById('driveStatusDisplay');
        if (statusElem) statusElem.innerHTML = msg;
    }
    
    window.initDriveUI = function() {
        console.log('🚗 Drive mode initialized');
        
        document.querySelectorAll('.drive-btn-gaming').forEach(btn => {
            btn.onmousedown = () => {
                const cmd = btn.getAttribute('data-cmd');
                if (cmd) {
                    currentCommand = cmd;
                    sendCommand(cmd);
                    updateStatus(`EXECUTING ${getCommandName(cmd)}...`);
                }
            };
            btn.onmouseup = () => {
                if (currentCommand) {
                    sendCommand('STOP');
                    updateStatus('STOPPED');
                    currentCommand = null;
                }
            };
        });
    };
    
    function getCommandName(cmd) {
        const names = { FORWARD: 'TIẾN', BACKWARD: 'LÙI', LEFT: 'TRÁI', RIGHT: 'PHẢI', STOP: 'DỪNG' };
        return names[cmd] || cmd;
    }
    
    // Voice commands for drive
    window.processDriveVoice = function(text) {
        const lower = text.toLowerCase();
        if (lower.includes('tiến')) sendCommand('FORWARD');
        else if (lower.includes('lùi')) sendCommand('BACKWARD');
        else if (lower.includes('trái')) sendCommand('LEFT');
        else if (lower.includes('phải')) sendCommand('RIGHT');
        else if (lower.includes('dừng')) sendCommand('STOP');
        else return false;
        return true;
    };
})();
