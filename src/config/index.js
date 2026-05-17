// ========== SECURE CONFIGURATION ==========
const path = require('path');
const crypto = require('crypto');

module.exports = {
    // Server
    PORT: process.env.PORT || 8080,
    NODE_ENV: process.env.NODE_ENV || 'production',
    
    // Security Keys (from env)
    SESSION_SECRET: process.env.SESSION_SECRET,
    ENCRYPTION_KEY: Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex'),
    WATERMARK_KEY: process.env.WATERMARK_KEY,
    
    // Paths
    PUBLIC_DIR: path.join(__dirname, '../../public'),
    PROTECTED_DIR: path.join(__dirname, '../../protected'),
    DATABASE_DIR: path.join(__dirname, '../../database'),
    
    // Session
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000,
    
    // Rate Limiting
    RATE_LIMIT: {
        windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    
    // User database (encrypted in production)
    USERS: {
        'admin': { passwordHash: '$2b$10$9q4q4q4q4q4q4q4q4q4q4q', name: 'Quản trị viên' },
        'ch': { passwordHash: '$2b$10$6q4q4q4q4q4q4q4q4q4q4q', name: 'Chí Hào' }
    },
    
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    
    // CSP Headers
    CSP: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'", "wss://*.railway.app", "https://api.openai.com"],
        'img-src': ["'self'", "data:", "blob:"],
        'worker-src': ["'self'", "blob:"]
    }
};
