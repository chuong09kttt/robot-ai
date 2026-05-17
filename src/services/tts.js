// ========== TEXT-TO-SPEECH SERVICE ==========
const axios = require('axios');
const { getCachedTTS, setCachedTTS } = require('../utils/cache');

// Generate TTS audio
async function generateTTS(text, lang = 'vi') {
    const cacheKey = `${lang}_${text.slice(0, 200)}`;
    const cached = getCachedTTS(cacheKey);
    if (cached) return cached;
    
    try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
        const response = await axios({
            method: 'get',
            url: ttsUrl,
            responseType: 'stream',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        setCachedTTS(cacheKey, response.data);
        return response.data;
        
    } catch (error) {
        console.error('TTS error:', error.message);
        return null;
    }
}

module.exports = { generateTTS };
