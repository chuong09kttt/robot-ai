// ========== ADVANCED SECURITY MIDDLEWARE ==========
const helmet = require('helmet');
const crypto = require('crypto');
const config = require('../config');
const { checkWatermark } = require('../utils/watermark');

// Generate request fingerprint
function generateFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    
    return crypto.createHash('sha256')
        .update(`${userAgent}|${acceptLanguage}|${ip}`)
        .digest('hex');
}

// Session fingerprint middleware
function sessionFingerprint(req, res, next) {
    if (req.session && req.session.user) {
        const fingerprint = generateFingerprint(req);
        
        if (!req.session.fingerprint) {
            req.session.fingerprint = fingerprint;
        } else if (req.session.fingerprint !== fingerprint) {
            req.session.destroy();
            return res.status(401).json({ error: 'Session hijacking detected' });
        }
    }
    next();
}

// Rate limiting by IP
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT?.windowMs || 15 * 60 * 1000,
    max: config.RATE_LIMIT?.max || 100,
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    },
    skipSuccessfulRequests: false
});

// Strict login limiter
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    skipSuccessfulRequests: true
});

// Helmet security headers (CÓ THỂ COMMENT ĐỂ TEST)
const securityHeaders = helmet({
    contentSecurityPolicy: false,  // TẮT CSP để cho phép F12
    hsts: false,
    frameguard: false,
    noSniff: true,
    xssFilter: true
});

// Anti-tampering middleware - TẠM THỜI TẮT HOÀN TOÀN
function antiTampering(req, res, next) {
    // TẠM THỜI TẮT KIỂM TRA NÀY
    // Chỉ log chứ không chặn
    const suspiciousHeaders = ['x-forwarded-for', 'x-originating-ip', 'x-remote-ip'];
    for (const header of suspiciousHeaders) {
        if (req.headers[header]) {
            console.log(`⚠️ Header detected (ignored): ${header}=${req.headers[header]}`);
            // KHÔNG block nữa
        }
    }
    next();  // Luôn cho phép đi tiếp
}

module.exports = {
    sessionFingerprint,
    apiLimiter,
    loginLimiter,
    securityHeaders,
    antiTampering,
    generateFingerprint,
    watermarkCheck: checkWatermark
};
