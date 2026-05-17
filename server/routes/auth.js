const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// User database (in production, use real database)
const USERS = {
    'admin': { passwordHash: '$2b$10$9q4q4q4q4q4q4q4q4q4q4q', name: 'Administrator' },
    'ch': { passwordHash: '$2b$10$6q4q4q4q4q4q4q4q4q4q4q', name: 'Chí Hào' }
};

// Hash for password 'admin123' and '123'
// In production, generate properly:
// bcrypt.hashSync('admin123', 10)

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing credentials' });
    }
    
    // Check against stored users
    if (username === 'admin' && password === 'admin123') {
        req.session.user = { username: 'admin', name: 'Administrator' };
        return res.json({ success: true, name: 'Administrator' });
    }
    
    if (username === 'ch' && password === '123') {
        req.session.user = { username: 'ch', name: 'Chí Hào' };
        return res.json({ success: true, name: 'Chí Hào' });
    }
    
    res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
