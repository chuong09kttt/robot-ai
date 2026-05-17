const express = require('express');
const router = express.Router();

// Game state manager (server-side)
class GameManager {
    constructor() {
        this.sessions = new Map();
    }
    
    initSession(sessionId) {
        this.sessions.set(sessionId, {
            score: 0,
            lives: 5,
            position: { x: 0, z: 0 },
            mode: 'boat'
        });
        return this.sessions.get(sessionId);
    }
    
    updateGame(sessionId, steering, speed, shooting) {
        const game = this.sessions.get(sessionId);
        if (!game) return null;
        
        // Core game logic (server-side, cannot be stolen)
        const targetX = steering * 8.5;
        game.position.x += (targetX - game.position.x) * 0.12;
        game.position.z -= speed * 0.48;
        game.position.x = Math.min(8.5, Math.max(-8.5, game.position.x));
        
        if (shooting && game.shootCooldown <= 0) {
            game.shootCooldown = 10;
            game.lastShot = Date.now();
        }
        
        if (game.shootCooldown > 0) game.shootCooldown--;
        
        return {
            position: game.position,
            score: game.score,
            lives: game.lives,
            canShoot: game.shootCooldown <= 0
        };
    }
    
    addScore(sessionId, points) {
        const game = this.sessions.get(sessionId);
        if (game) {
            game.score += points;
            return game.score;
        }
        return 0;
    }
    
    reduceLife(sessionId) {
        const game = this.sessions.get(sessionId);
        if (game) {
            game.lives--;
            return game.lives;
        }
        return 0;
    }
}

const gameManager = new GameManager();

// Middleware to check session
const requireGameSession = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.post('/init', requireGameSession, (req, res) => {
    const { mode } = req.body;
    const sessionId = req.session.user.username + '_game';
    const game = gameManager.initSession(sessionId);
    game.mode = mode;
    res.json({ success: true, game: { lives: game.lives, score: game.score } });
});

router.post('/update', requireGameSession, (req, res) => {
    const { steering, speed, shooting } = req.body;
    const sessionId = req.session.user.username + '_game';
    const result = gameManager.updateGame(sessionId, steering, speed, shooting);
    if (result) {
        res.json({ success: true, ...result });
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

router.post('/score', requireGameSession, (req, res) => {
    const { points } = req.body;
    const sessionId = req.session.user.username + '_game';
    const newScore = gameManager.addScore(sessionId, points);
    res.json({ success: true, score: newScore });
});

router.post('/hit', requireGameSession, (req, res) => {
    const sessionId = req.session.user.username + '_game';
    const lives = gameManager.reduceLife(sessionId);
    res.json({ success: true, lives });
});

module.exports = router;
