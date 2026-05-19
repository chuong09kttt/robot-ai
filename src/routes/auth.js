


// ========== SECURE AUTH ROUTES ==========
const express = require('express');
const router = express.Router();
const { loginLimiter } = require('../middleware/security');
const config = require('../config');
const crypto = require('crypto');

// Login with rate limiting
router.post('/login', loginLimiter, async (req, res) => {

    console.log('📥 Received login request');
    console.log('Body:', req.body);
    console.log('Headers:', req.headers);
    
    const { username, password } = req.body;
    
    console.log(`🔐 Login attempt: ${username}`);
    
    // Input validation
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui lòng nhập đầy đủ thông tin!' 
        });
    }
    
    // Check user exists in config
    const user = config.USERS?.[username];
    
    // Log để debug
    console.log(`User found: ${!!user}`);
    console.log(`Password match: ${user && user.password === password}`);
    
    // Xác thực mật khẩu từ config
    if (user && user.password === password) {
        // Generate secure session ID
        req.session.user = { 
            username, 
            name: user.name,
            loginAt: Date.now(),
            sessionId: crypto.randomBytes(32).toString('hex')
        };
        
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Lỗi server, vui lòng thử lại!' 
                });
            }
            
            console.log(`✅ User logged in: ${username}`);
            res.json({ success: true, name: user.name, username });
        });
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
