// ========== CACHE MANAGER ==========
const NodeCache = require('node-cache');

// Cache instances
const responseCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
const ttsCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Get cached response
function getCachedResponse(key) {
    return responseCache.get(key);
}

// Set cached response
function setCachedResponse(key, value, ttl = 3600) {
    responseCache.set(key, value, ttl);
}

// Get cached TTS
function getCachedTTS(key) {
    return ttsCache.get(key);
}

// Set cached TTS
function setCachedTTS(key, value, ttl = 3600) {
    ttsCache.set(key, value, ttl);
}

// Clear all caches
function clearAllCaches() {
    responseCache.flushAll();
    ttsCache.flushAll();
}

module.exports = {
    responseCache,
    ttsCache,
    getCachedResponse,
    setCachedResponse,
    getCachedTTS,
    setCachedTTS,
    clearAllCaches
};
