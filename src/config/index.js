// ========== SERVER CONFIGURATION ==========
const path = require('path');
const crypto = require('crypto');

// Helper: hash simple password (for future DB migration)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
    // ========== SERVER ==========
    PORT: process.env.PORT || 8880,
    NODE_ENV: process.env.NODE_ENV || 'production',

    // ========== SECURITY ==========
    SESSION_SECRET: process.env.SESSION_SECRET || 'CHANGE_ME_SESSION_SECRET',

    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
        ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
        : Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),

    WATERMARK_KEY: process.env.WATERMARK_KEY || 'CHANGE_ME_WATERMARK',

    // ========== PATHS ==========
    PUBLIC_DIR: path.join(__dirname, '../../public'),
    PROTECTED_DIR: path.join(__dirname, '../protected'),
    DATABASE_DIR: path.join(__dirname, '../database'),

    // ========== SESSION ==========
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000,

    // ========== RATE LIMIT ==========
    RATE_LIMIT: {
        windowMs: (process.env.RATE_LIMIT_WINDOW_MS || 15) * 60 * 1000,
        max: process.env.RATE_LIMIT_MAX || 100
    },

    // ========== USERS (PRODUCTION SAFE) ==========
    USERS: {
        admin: {
            name: 'Administrator',
            passwordHash: process.env.ADMIN_PASSWORD_HASH || hashPassword('CHANGE_ME_ADMIN')
        },
        ch: {
            name: 'ch',
            passwordHash: process.env.CH_PASSWORD_HASH || hashPassword('CHANGE_ME_CH')
        }
    },

    // helper export
    hashPassword
};
