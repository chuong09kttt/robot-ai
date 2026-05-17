const express = require('express');
const axios = require('axios');
const router = express.Router();

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.post('/', requireAuth, async (req, res) => {
    const { text, source, target } = req.body;
    
    if (!text || !source || !target) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    if (source === target) {
        return res.json({ translated: text });
    }
    
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data?.responseData?.translatedText) {
            let translated = response.data.responseData.translatedText;
            translated = translated.replace(/^\[ERROR\]\s*/, '').replace(/<[^>]*>/g, '');
            res.json({ translated: translated || text });
        } else {
            res.json({ translated: text });
        }
    } catch (error) {
        res.json({ translated: text });
    }
});

module.exports = router;
