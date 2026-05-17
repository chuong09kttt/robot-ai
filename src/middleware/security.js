// ========== ADVANCED SECURITY MIDDLEWARE ==========
const helmet = require('helmet');
const crypto = require('crypto');
const config = require('../config');

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
            // Session hijacking detected
            req.session.destroy();
            return res.status(401).json({ error: 'Session hijacking detected' });
        }
    }
    next();
}

// Rate limiting by IP
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT.windowMs,
    max: config.RATE_LIMIT.max,
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

// Helmet security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: config.CSP
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
});

// Anti-tampering middleware
function antiTampering(req, res, next) {
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-originating-ip', 'x-remote-ip'];
    for (const header of suspiciousHeaders) {
        if (req.headers[header]) {
            console.warn(`Suspicious header detected: ${header}`);
            return res.status(400).json({ error: 'Bad request' });
        }
    }
    next();
}

module.exports = {
    sessionFingerprint,
    apiLimiter,
    loginLimiter,
    securityHeaders,
    antiTampering,
    generateFingerprint
};
