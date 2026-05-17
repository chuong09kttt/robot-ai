const express = require('express');
const router = express.Router();

const USERS = {
    'admin': { password: 'admin123', name: 'Quản trị viên' },
    'ch': { password: '123', name: 'Chí Hào' }
};

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = USERS[username];
    
    if (user && user.password === password) {
        req.session.user = { username, name: user.name };
        res.json({ success: true, name: user.name });
    } else {
        res.json({ success: false, message: 'Sai tài khoản hoặc mật khẩu!' });
    }
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
