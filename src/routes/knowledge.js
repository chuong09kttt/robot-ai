// ========== KNOWLEDGE BASE ROUTES ==========
const express = require('express');
const router = express.Router();
const ragService = require('../services/rag');
const { requireAuth } = require('../middleware/auth');  // ← SỬA

// Get knowledge stats (public, no auth needed)
router.get('/stats', (req, res) => {
    const stats = ragService.getStats();
    res.json(stats);
});

// Upload PDF
router.post('/upload-pdf', requireAuth, async (req, res) => {  // ← SỬA
    const { fileContent, fileName } = req.body;
    
    if (!fileContent) {
        return res.status(400).json({ error: 'No file content' });
    }
    
    const result = await ragService.addPDF(fileContent, fileName);
    res.json(result);
});

// Add website
router.post('/add-website', requireAuth, async (req, res) => {  // ← SỬA
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }
    
    const result = await ragService.addWebsite(url);
    res.json(result);
});

// Add Google Drive file
router.post('/add-drive', requireAuth, async (req, res) => {  // ← SỬA
    const { fileId } = req.body;
    
    if (!fileId) {
        return res.status(400).json({ error: 'No file ID provided' });
    }
    
    const result = await ragService.addGoogleDrive(fileId);
    res.json(result);
});

// Clear knowledge base
router.post('/clear', requireAuth, (req, res) => {  // ← SỬA
    ragService.clearKnowledge();
    res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu đã học!' });
});

// Search knowledge
router.post('/search', requireAuth, async (req, res) => {  // ← SỬA
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Missing query' });
    }
    
    const results = await ragService.search(query);
    res.json({ results });
});

module.exports = router;
