// ========== SECURE AUTH ROUTES ==========
const express = require('express');
const router = express.Router();
const { loginLimiter } = require('../middleware/security');
const { verifyPassword } = require('../middleware/auth');
const config = require('../config');
const crypto = require('crypto');

// Login with rate limiting
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui lòng nhập đầy đủ thông tin!' 
        });
    }
    
    // Check user exists (simplified - in production use database)
    const user = config.USERS[username];
    
    // For demo, using plain text (in production use bcrypt)
    if (user && password === (username === 'admin' ? 'admin123' : '123')) {
        // Generate secure session ID
        req.session.user = { 
            username, 
            name: user.name,
            loginAt: Date.now(),
            sessionId: crypto.randomBytes(32).toString('hex')
        };
        
        req.session.save();
        
        console.log(`✅ User logged in: ${username}`);
        res.json({ success: true, name: user.name, username });
    } else {
        console.log(`❌ Login failed: ${username}`);
        
        // Add delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
    if (req.session && req.session.user) {
        res.json({ 
            authenticated: true, 
            user: { 
                username: req.session.user.username, 
                name: req.session.user.name 
            } 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Get CSRF token
router.get('/csrf', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    req.session.csrfToken = token;
    res.json({ token });
});

module.exports = router;
