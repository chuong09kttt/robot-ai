const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// In-memory face database (encrypted in production)
let faceDatabase = new Map();

// Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.post('/register', requireAuth, (req, res) => {
    const { name, descriptors } = req.body;
    const username = req.session.user.username;
    
    if (!name || !descriptors || descriptors.length === 0) {
        return res.status(400).json({ error: 'Invalid face data' });
    }
    
    const key = `${username}_${name}`;
    // Encrypt descriptor before storing
    const encrypted = crypto.createHash('sha256').update(JSON.stringify(descriptors)).digest('hex');
    
    if (!faceDatabase.has(username)) {
        faceDatabase.set(username, []);
    }
    faceDatabase.get(username).push({ name, hash: encrypted });
    
    res.json({ success: true, message: `Face registered for ${name}` });
});

router.post('/recognize', requireAuth, (req, res) => {
    const { descriptor } = req.body;
    const username = req.session.user.username;
    
    const userFaces = faceDatabase.get(username) || [];
    
    // Simple matching (in production, use proper face matching)
    const descriptorHash = crypto.createHash('sha256').update(JSON.stringify(descriptor)).digest('hex');
    
    const match = userFaces.find(f => f.hash === descriptorHash);
    
    if (match) {
        res.json({ success: true, name: match.name });
    } else {
        res.json({ success: false, name: null });
    }
});

router.get('/list', requireAuth, (req, res) => {
    const username = req.session.user.username;
    const userFaces = faceDatabase.get(username) || [];
    res.json({ faces: userFaces.map(f => f.name) });
});

module.exports = router;
