// ========== FACE RECOGNITION ROUTES ==========
const express = require('express');
const router = express.Router();
const faceEngine = require('../services/faceEngine');
const { requireAuth } = require('../middleware/auth');

// Register face
router.post('/register', requireAuth, (req, res) => {
    const { name, descriptor } = req.body;
    const username = req.session.user.username;
    
    if (!name || !descriptor) {
        return res.status(400).json({ error: 'Missing face data' });
    }
    
    const result = faceEngine.registerFace(username, name, descriptor);
    res.json(result);
});

// Recognize face
router.post('/recognize', requireAuth, (req, res) => {
    const { descriptor } = req.body;
    const username = req.session.user.username;
    
    if (!descriptor) {
        return res.status(400).json({ error: 'Missing face descriptor' });
    }
    
    const result = faceEngine.recognizeFace(username, descriptor);
    res.json(result);
});

// Get list of registered faces
router.get('/list', requireAuth, (req, res) => {
    const username = req.session.user.username;
    const faces = faceEngine.getRegisteredFaces(username);
    res.json({ faces });
});

// Delete a face
router.delete('/:name', requireAuth, (req, res) => {
    const { name } = req.params;
    const username = req.session.user.username;
    const result = faceEngine.deleteFace(username, name);
    res.json(result);
});

// Delete all faces
router.delete('/all', requireAuth, (req, res) => {
    const username = req.session.user.username;
    const result = faceEngine.clearAllFaces(username);
    res.json(result);
});

// Analyze face (glasses, hat, expression)
router.post('/analyze', requireAuth, (req, res) => {
    const { landmarks } = req.body;
    
    if (!landmarks || landmarks.length === 0) {
        return res.status(400).json({ error: 'No face landmarks' });
    }
    
    const result = faceEngine.analyzeFace(landmarks[0]);
    res.json(result);
});

// Get database stats
router.get('/stats', requireAuth, (req, res) => {
    const db = faceEngine.readFaceDatabase();
    const username = req.session.user.username;
    const userFaces = db[username] || [];
    
    res.json({
        totalUsers: Object.keys(db).length,
        userFacesCount: userFaces.length,
        userFaces: userFaces.map(f => ({ name: f.name, registeredAt: f.registeredAt }))
    });
});

module.exports = router;
