// ========== KNOWLEDGE BASE ROUTES ==========
const express = require('express');
const router = express.Router();
const ragService = require('../services/rag');
const { requireApiAuth } = require('../middleware/auth');

// Get knowledge stats
router.get('/stats', (req, res) => {
    const stats = ragService.getStats();
    res.json(stats);
});

// Upload PDF
router.post('/upload-pdf', requireApiAuth, async (req, res) => {
    const { fileContent, fileName } = req.body;
    
    if (!fileContent) {
        return res.status(400).json({ error: 'No file content' });
    }
    
    const result = await ragService.addPDF(fileContent, fileName);
    res.json(result);
});

// Add website
router.post('/add-website', requireApiAuth, async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }
    
    const result = await ragService.addWebsite(url);
    res.json(result);
});

// Add Google Drive file
router.post('/add-drive', requireApiAuth, async (req, res) => {
    const { fileId } = req.body;
    
    if (!fileId) {
        return res.status(400).json({ error: 'No file ID provided' });
    }
    
    const result = await ragService.addGoogleDrive(fileId);
    res.json(result);
});

// Clear knowledge base
router.post('/clear', requireApiAuth, (req, res) => {
    ragService.clearKnowledge();
    res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu đã học!' });
});

// Search knowledge
router.post('/search', requireApiAuth, async (req, res) => {
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Missing query' });
    }
    
    const results = await ragService.search(query);
    res.json({ results });
});

module.exports = router;
