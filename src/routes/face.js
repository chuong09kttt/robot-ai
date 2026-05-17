// ========== FACE RECOGNITION ROUTES ==========
const express = require('express');
const fs = require('fs');
const router = express.Router();
const config = require('../config');
const { requireApiAuth } = require('../middleware/auth');

// Read face database
function readFaceDB() {
    try {
        if (fs.existsSync(config.FACE_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(config.FACE_DATA_FILE, 'utf8'));
        }
    } catch(e) {}
    return {};
}

// Write face database
function writeFaceDB(data) {
    fs.writeFileSync(config.FACE_DATA_FILE, JSON.stringify(data, null, 2));
}

// Register face
router.post('/register', requireApiAuth, (req, res) => {
    const { name, descriptor } = req.body;
    const username = req.session.user.username;
    
    if (!name || !descriptor) {
        return res.status(400).json({ error: 'Missing face data' });
    }
    
    const db = readFaceDB();
    if (!db[username]) db[username] = [];
    db[username].push({ name, descriptor, registeredAt: Date.now() });
    writeFaceDB(db);
    
    res.json({ success: true, message: `Đã lưu khuôn mặt cho ${name}` });
});

// Recognize face
router.post('/recognize', requireApiAuth, (req, res) => {
    const { descriptor } = req.body;
    const username = req.session.user.username;
    const db = readFaceDB();
    const userFaces = db[username] || [];
    
    // Simple matching - in production use proper face matching
    const match = userFaces.find(f => 
        JSON.stringify(f.descriptor) === JSON.stringify(descriptor)
    );
    
    if (match) {
        res.json({ success: true, name: match.name });
    } else {
        res.json({ success: false, name: null });
    }
});

// List registered faces
router.get('/list', requireApiAuth, (req, res) => {
    const username = req.session.user.username;
    const db = readFaceDB();
    const userFaces = db[username] || [];
    
    res.json({ faces: userFaces.map(f => ({ name: f.name, registeredAt: f.registeredAt })) });
});

// Delete face
router.delete('/:name', requireApiAuth, (req, res) => {
    const { name } = req.params;
    const username = req.session.user.username;
    
    const db = readFaceDB();
    if (db[username]) {
        db[username] = db[username].filter(f => f.name !== name);
        writeFaceDB(db);
    }
    
    res.json({ success: true });
});

// Get face database info
router.get('/database', (req, res) => {
    const db = readFaceDB();
    res.json({ users: Object.keys(db) });
});

module.exports = router;
