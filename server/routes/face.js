const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const faceFile = path.join(__dirname, '../../face-data.json');

// Đọc database
function readFaceDB() {
    try {
        if (fs.existsSync(faceFile)) {
            return JSON.parse(fs.readFileSync(faceFile, 'utf8'));
        }
    } catch(e) {}
    return {};
}

// Ghi database
function writeFaceDB(data) {
    fs.writeFileSync(faceFile, JSON.stringify(data, null, 2));
}

router.post('/register', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { name, descriptor } = req.body;
    const username = req.session.user.username;
    const db = readFaceDB();
    
    if (!db[username]) db[username] = [];
    db[username].push({ name, descriptor });
    writeFaceDB(db);
    
    res.json({ success: true });
});

router.post('/recognize', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { descriptor } = req.body;
    // Logic nhận diện...
    res.json({ success: true, name: null });
});

router.get('/list', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const db = readFaceDB();
    const userFaces = db[req.session.user.username] || [];
    res.json({ faces: userFaces.map(f => f.name) });
});

module.exports = router;
