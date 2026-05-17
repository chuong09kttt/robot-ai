const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { text, source, target } = req.body;
    
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data?.responseData?.translatedText) {
            let translated = response.data.responseData.translatedText;
            translated = translated.replace(/^\[ERROR\]\s*/, '');
            res.json({ translated });
        } else {
            res.json({ translated: text });
        }
    } catch (error) {
        res.json({ translated: text });
    }
});

module.exports = router;
