const express = require('express');
const router = express.Router();
const robotService = require('../services/robotService');
const { rateLimit } = require('express-rate-limit');

// Rate limit riêng cho điều khiển robot
const robotLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30 // 30 commands per minute
});

// Điều khiển robot
router.post('/control', robotLimiter, (req, res) => {
    const { command, speed } = req.body;
    
    const validCommands = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP'];
    if (!validCommands.includes(command)) {
        return res.status(400).json({ error: 'Invalid command' });
    }
    
    try {
        const result = robotService.sendCommand(command, speed);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lấy dữ liệu cảm biến
router.get('/sensors', async (req, res) => {
    try {
        const sensors = await robotService.getSensorData();
        res.json(sensors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kiểm tra kết nối
router.get('/status', (req, res) => {
    res.json({ 
        connected: robotService.isConnected,
        timestamp: new Date()
    });
});

module.exports = router;
