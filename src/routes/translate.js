// ========== TRANSLATION ROUTES ==========
const express = require('express');
const router = express.Router();
const translationService = require('../services/translation');
const { requireAuth } = require('../middleware/auth');  // ← SỬA TÊN

// Translate text
router.post('/', requireAuth, async (req, res) => {    // ← SỬA TÊN
    const { text, source, target } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Missing text' });
    }
    
    if (source === target) {
        return res.json({ translated: text });
    }
    
    const translated = await translationService.translateText(text, source, target);
    res.json({ translated });
});

// Get supported languages
router.get('/languages', (req, res) => {
    res.json({
        languages: [
            { code: 'vi', name: 'Tiếng Việt' },
            { code: 'en', name: 'English' },
            { code: 'zh', name: '中文' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' },
            { code: 'fr', name: 'Français' },
            { code: 'de', name: 'Deutsch' },
            { code: 'es', name: 'Español' }
        ]
    });
});

module.exports = router;
