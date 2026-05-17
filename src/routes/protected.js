// ========== PROTECTED FILES ROUTE ==========
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const config = require('../config');

// Serve protected JS files (only after authentication)
router.get('/js/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(config.PROTECTED_DIR, 'js', filename);
    
    // Security: only allow .js files
    if (!filename.endsWith('.js')) {
        return res.status(403).send('Forbidden');
    }
    
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Serve protected module files
router.get('/js/modules/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(config.PROTECTED_DIR, 'js', 'modules', filename);
    
    if (!filename.endsWith('.js')) {
        return res.status(403).send('Forbidden');
    }
    
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Serve WebAssembly files
router.get('/wasm/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(config.PROTECTED_DIR, 'wasm', filename);
    
    if (filename.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
        res.sendFile(filePath);
    } else {
        res.status(403).send('Forbidden');
    }
});

module.exports = router;
