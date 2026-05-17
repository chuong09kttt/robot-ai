// ========== CORS MIDDLEWARE ==========
const cors = require('cors');

const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = [
            'https://robot-ai-production-9a07.up.railway.app',
            'http://localhost:8080',
            'http://localhost:3000'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
};

module.exports = {
    corsOptions,
    securityHeaders
};
