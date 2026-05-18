// ========== DRIVE CONTROL ROUTES ==========
const express = require('express');
const router = express.Router();
const { DRIVE_REPLIES } = require('../utils/constants');

// Global map for ESP32 clients (shared)
const esp32Clients = new Map();

// Send command to ESP32
function sendToESP32(command, duration = 0) {
    let sent = false;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === 1) {
            client.send(JSON.stringify({ type: 'command', command, duration }));
            sent = true;
        }
    }
    return sent;
}

// Command endpoint - TEMPORARILY REMOVED AUTH FOR DEPLOYMENT
router.post('/command', (req, res) => {
    const { command, duration } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Missing command' });
    }
    
    const sent = sendToESP32(command, duration || 0);
    const reply = DRIVE_REPLIES[command] || `🚗 Command: ${command}`;
    
    res.json({ success: sent, reply, command });
});

// Get ESP32 clients count
router.get('/clients', (req, res) => {
    let count = 0;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === 1) count++;
    }
    res.json({ count });
});

module.exports = router;
module.exports.esp32Clients = esp32Clients;
module.exports.sendToESP32 = sendToESP32;
