// ========== GAME MULTIPLAYER ROUTES ==========
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');  // ← SỬA

// Game sessions
const gameSessions = new Map();

// Initialize game session
router.post('/init', requireAuth, (req, res) => {  // ← SỬA
    const { mode } = req.body;
    const username = req.session.user.username;
    const sessionId = `${username}_game`;
    
    gameSessions.set(sessionId, {
        score: 0,
        lives: mode === 'plane' ? 3 : 5,
        position: { x: 0, z: 0 },
        mode: mode || 'boat',
        lastUpdate: Date.now()
    });
    
    const game = gameSessions.get(sessionId);
    res.json({ success: true, game: { lives: game.lives, score: game.score } });
});

// Update game state
router.post('/update', requireAuth, (req, res) => {  // ← SỬA
    const { steering, speed, shooting } = req.body;
    const username = req.session.user.username;
    const sessionId = `${username}_game`;
    
    const game = gameSessions.get(sessionId);
    if (!game) {
        return res.status(404).json({ error: 'Game session not found' });
    }
    
    // Update position
    const targetX = steering * 8.5;
    game.position.x += (targetX - game.position.x) * 0.12;
    game.position.z -= speed * 0.48;
    game.position.x = Math.min(8.5, Math.max(-8.5, game.position.x));
    game.lastUpdate = Date.now();
    
    res.json({
        success: true,
        position: game.position,
        score: game.score,
        lives: game.lives
    });
});

// Add score
router.post('/score', requireAuth, (req, res) => {  // ← SỬA
    const { points } = req.body;
    const username = req.session.user.username;
    const sessionId = `${username}_game`;
    
    const game = gameSessions.get(sessionId);
    if (game) {
        game.score += points;
        res.json({ success: true, score: game.score });
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

// Reduce life
router.post('/hit', requireAuth, (req, res) => {  // ← SỬA
    const username = req.session.user.username;
    const sessionId = `${username}_game`;
    
    const game = gameSessions.get(sessionId);
    if (game) {
        game.lives--;
        res.json({ success: true, lives: game.lives });
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

// Get game state
router.get('/state', requireAuth, (req, res) => {  // ← SỬA
    const username = req.session.user.username;
    const sessionId = `${username}_game`;
    
    const game = gameSessions.get(sessionId);
    if (game) {
        res.json({ success: true, game });
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

module.exports = router;
