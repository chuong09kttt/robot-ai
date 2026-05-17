// ========== TRANSLATION SERVICE ==========
const axios = require('axios');

// Translate text using MyMemory API
async function translateText(text, source, target) {
    if (!text || source === target) return text;
    
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await axios.get(url, { timeout: 8000 });
        
        if (response.data?.responseData?.translatedText) {
            let translated = response.data.responseData.translatedText;
            translated = translated.replace(/^\[ERROR\]\s*/, '').replace(/<[^>]*>/g, '');
            if (translated && !translated.includes('MYMEMORY WARNING')) {
                return translated;
            }
        }
        return text;
        
    } catch (error) {
        console.error('Translation error:', error.message);
        return text;
    }
}

// Batch translate
async function batchTranslate(texts, source, target) {
    const results = [];
    for (const text of texts) {
        const translated = await translateText(text, source, target);
        results.push(translated);
    }
    return results;
}

module.exports = {
    translateText,
    batchTranslate
};
