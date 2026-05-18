// ========== SECURE GAME LOGIC (SERVER-SIDE) ==========
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Game state storage (encrypted in production)
const gameSessions = new Map();

// Game configuration (ẩn trên server)
const GAME_CONFIG = {
    obstacleSpeed: 0.6,
    powerupValue: 10,
    baseSpeed: 0.48,
    steeringSensitivity: 8.5,
    collisionDistance: 0.9,
    obstacleInterval: 1200,
    powerupInterval: 2500,
    maxScore: 999999
};

// Tạo session game mới
router.post('/init', requireAuth, (req, res) => {
    const { mode } = req.body; // 'boat' or 'plane'
    const userId = req.session.user.username;
    const sessionId = `${userId}_${Date.now()}`;
    
    gameSessions.set(sessionId, {
        userId: userId,
        mode: mode,
        score: 0,
        lives: mode === 'plane' ? 3 : 5,
        position: { x: 0, z: 0 },
        obstacles: [],
        powerups: [],
        lastUpdate: Date.now(),
        sessionId: sessionId
    });
    
    console.log(`🎮 Game session created: ${sessionId} (${mode})`);
    
    res.json({
        success: true,
        sessionId: sessionId,
        gameState: {
            lives: gameSessions.get(sessionId).lives,
            score: 0,
            position: { x: 0, z: 0 }
        }
    });
});

// Cập nhật game state (ẩn logic)
router.post('/update', requireAuth, (req, res) => {
    const { sessionId, steering, speed, shooting, position } = req.body;
    
    const game = gameSessions.get(sessionId);
    if (!game) {
        return res.status(404).json({ error: 'Game session not found' });
    }
    
    // ========== LOGICE GAME QUAN TRỌNG (ẨN TRÊN SERVER) ==========
    
    // Cập nhật vị trí (server-side calculation)
    const targetX = steering * GAME_CONFIG.steeringSensitivity;
    game.position.x += (targetX - game.position.x) * 0.12;
    game.position.x = Math.min(8.5, Math.max(-8.5, game.position.x));
    game.position.z -= Math.max(0.1, speed * GAME_CONFIG.baseSpeed);
    
    // Xử lý bắn đạn
    let canShoot = false;
    if (shooting && game.shootCooldown <= 0) {
        game.shootCooldown = 10;
        canShoot = true;
    }
    if (game.shootCooldown > 0) game.shootCooldown--;
    
    // Xử lý va chạm với vật cản
    let collision = false;
    let hitObstacle = null;
    
    for (let i = 0; i < game.obstacles.length; i++) {
        const obs = game.obstacles[i];
        const dx = obs.x - game.position.x;
        const dz = obs.z - (game.position.z + 1.3);
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < GAME_CONFIG.collisionDistance) {
            collision = true;
            hitObstacle = obs;
            game.obstacles.splice(i, 1);
            game.lives--;
            break;
        }
    }
    
    // Xử lý nhặt vật phẩm
    let powerupCollected = false;
    let powerupValue = 0;
    
    for (let i = 0; i < game.powerups.length; i++) {
        const p = game.powerups[i];
        const dx = p.x - game.position.x;
        const dz = p.z - game.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 1.0) {
            powerupCollected = true;
            powerupValue = GAME_CONFIG.powerupValue;
            game.score += powerupValue;
            game.powerups.splice(i, 1);
            break;
        }
    }
    
    // Tạo vật cản mới (server-side)
    const newObstacles = [];
    if (Math.random() < 0.05) {
        newObstacles.push({
            x: (Math.random() - 0.5) * 14,
            z: game.position.z - 90,
            id: Date.now() + Math.random()
        });
    }
    
    // Tạo vật phẩm mới
    const newPowerups = [];
    if (Math.random() < 0.03) {
        newPowerups.push({
            x: (Math.random() - 0.5) * 14,
            z: game.position.z - 80,
            id: Date.now() + Math.random()
        });
    }
    
    game.lastUpdate = Date.now();
    
    // Kiểm tra game over
    const isGameOver = game.lives <= 0;
    
    res.json({
        success: true,
        gameState: {
            score: game.score,
            lives: game.lives,
            position: game.position,
            isGameOver: isGameOver,
            canShoot: canShoot,
            collision: collision,
            powerupCollected: powerupCollected,
            powerupValue: powerupValue
        },
        newObstacles: newObstacles,
        newPowerups: newPowerups
    });
});

// Lấy danh sách vật cản
router.get('/obstacles/:sessionId', requireAuth, (req, res) => {
    const { sessionId } = req.params;
    const game = gameSessions.get(sessionId);
    
    if (!game) {
        return res.status(404).json({ error: 'Game session not found' });
    }
    
    // Cập nhật vị trí vật cản
    for (const obs of game.obstacles) {
        obs.z += 0.6;
    }
    
    // Loại bỏ vật cản đã qua
    game.obstacles = game.obstacles.filter(obs => obs.z < 28);
    
    res.json({
        obstacles: game.obstacles,
        powerups: game.powerups
    });
});

// Kết thúc game và lưu điểm
router.post('/end', requireAuth, (req, res) => {
    const { sessionId } = req.body;
    const game = gameSessions.get(sessionId);
    
    if (!game) {
        return res.status(404).json({ error: 'Game session not found' });
    }
    
    // Lưu điểm cao nhất
    const highScore = saveHighScore(game.userId, game.score, game.mode);
    
    gameSessions.delete(sessionId);
    
    res.json({
        success: true,
        finalScore: game.score,
        highScore: highScore,
        message: `Game ended with score ${game.score}`
    });
});

// Lấy bảng xếp hạng
router.get('/leaderboard/:mode', requireAuth, (req, res) => {
    const { mode } = req.params;
    const leaderboard = getLeaderboard(mode);
    
    res.json({
        success: true,
        mode: mode,
        leaderboard: leaderboard
    });
});

// Helper functions
function saveHighScore(userId, score, mode) {
    // Lưu vào database (có thể dùng file hoặc DB)
    const highScoresFile = path.join(__dirname, '../../database/highscores.json');
    let highscores = {};
    
    try {
        if (fs.existsSync(highScoresFile)) {
            highscores = JSON.parse(fs.readFileSync(highScoresFile, 'utf8'));
        }
    } catch(e) {}
    
    if (!highscores[userId]) highscores[userId] = {};
    if (!highscores[userId][mode]) highscores[userId][mode] = 0;
    
    if (score > highscores[userId][mode]) {
        highscores[userId][mode] = score;
        fs.writeFileSync(highScoresFile, JSON.stringify(highscores, null, 2));
        return score;
    }
    
    return highscores[userId][mode];
}

function getLeaderboard(mode) {
    const highScoresFile = path.join(__dirname, '../../database/highscores.json');
    const leaderboard = [];
    
    try {
        if (fs.existsSync(highScoresFile)) {
            const highscores = JSON.parse(fs.readFileSync(highScoresFile, 'utf8'));
            
            for (const [userId, scores] of Object.entries(highscores)) {
                if (scores[mode]) {
                    leaderboard.push({
                        userId: userId,
                        score: scores[mode]
                    });
                }
            }
        }
    } catch(e) {}
    
    // Sắp xếp theo điểm giảm dần
    leaderboard.sort((a, b) => b.score - a.score);
    
    return leaderboard.slice(0, 10);
}

module.exports = router;
