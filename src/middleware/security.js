// ========== SECURITY MIDDLEWARE - DISABLED FOR DEBUG ==========
const crypto = require('crypto');

// Generate request fingerprint
function generateFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    
    return crypto.createHash('sha256')
        .update(`${userAgent}|${acceptLanguage}|${ip}`)
        .digest('hex');
}

// DISABLED - không làm gì
function sessionFingerprint(req, res, next) {
    next();
}

// DISABLED - không làm gì
const apiLimiter = (req, res, next) => {
    next();
};

// DISABLED - không làm gì
const loginLimiter = (req, res, next) => {
    next();
};

// DISABLED - không làm gì
const securityHeaders = (req, res, next) => {
    next();
};

// DISABLED - không làm gì
function antiTampering(req, res, next) {
    next();
}

// DISABLED - không làm gì
const watermarkCheck = (req, res, next) => {
    next();
};

module.exports = {
    sessionFingerprint,
    apiLimiter,
    loginLimiter,
    securityHeaders,
    antiTampering,
    generateFingerprint,
    watermarkCheck
};
