const rateLimit = require('express-rate-limit');

// Rate limiting for different endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: { error: 'Too many login attempts, try again later' }
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Too many requests' }
});

module.exports = {
    authLimiter,
    apiLimiter
};
