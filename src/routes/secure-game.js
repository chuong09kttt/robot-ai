// ========== SECURE GAME ROUTES ==========
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Secure game endpoint
router.get('/status', requireAuth, (req, res) => {
    res.json({ 
        success: true, 
        message: 'Secure game mode is ready',
        user: req.session.user.username
    });
});

module.exports = router;
