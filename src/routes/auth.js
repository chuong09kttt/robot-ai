// ========== AUTH ROUTES ==========
const express = require('express');
const router = express.Router();
const config = require('../config');
const { loginLimiter } = require('../middleware/rateLimit');

// Login
router.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui lòng nhập đầy đủ thông tin!' 
        });
    }
    
    const user = config.USERS[username];
    if (user && user.password === password) {
        req.session.user = { username, name: user.name };
        req.session.save();
        console.log(`✅ User logged in: ${username}`);
        res.json({ success: true, name: user.name, username });
    } else {
        console.log(`❌ Login failed: ${username}`);
        res.status(401).json({ 
            success: false, 
            message: 'Sai tên đăng nhập hoặc mật khẩu!' 
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check session
router.get('/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Get current user
router.get('/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;
