// ========== CHAT ROUTES ==========
const express = require('express');
const router = express.Router();
const openaiService = require('../services/openai');
const { requireApiAuth } = require('../middleware/auth');
const { detectLanguage } = require('../utils/helpers');

// Send message
router.post('/message', requireApiAuth, async (req, res) => {
    const { message, history } = req.body;
    const username = req.session.user.username;
    
    if (!message) {
        return res.status(400).json({ error: 'Missing message' });
    }
    
    const lang = detectLanguage(message);
    const reply = await openaiService.chat(message, history || [], username, lang);
    
    res.json({ reply, lang });
});

// Clear conversation history
router.post('/clear', requireApiAuth, (req, res) => {
    const username = req.session.user.username;
    openaiService.clearHistory(username);
    res.json({ success: true });
});

// Get conversation history
router.get('/history', requireApiAuth, (req, res) => {
    const username = req.session.user.username;
    const history = openaiService.getHistory(username);
    res.json({ history });
});

module.exports = router;
