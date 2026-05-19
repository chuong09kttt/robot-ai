// ========== SERVER CONFIGURATION ==========
const path = require('path');

module.exports = {
    // Server
    PORT: process.env.PORT || 8880,
    NODE_ENV: process.env.NODE_ENV || 'production',

    // Security Keys (from env)
    SESSION_SECRET: process.env.SESSION_SECRET || 'default-secret-key-change-me',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
    WATERMARK_KEY: process.env.WATERMARK_KEY || 'default-watermark-key',

    // Paths
    PUBLIC_DIR: path.join(__dirname, '../../public'),
    PROTECTED_DIR: path.join(__dirname, '../protected'),
    DATABASE_DIR: path.join(__dirname, '../database'),

    // Session
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours

    // Rate Limiting
    RATE_LIMIT: {
        windowMs: (process.env.RATE_LIMIT_WINDOW_MS || 15) * 60 * 1000, // 15 minutes
        max: process.env.RATE_LIMIT_MAX || 100
    },

    // Users (tạm thời, nên chuyển sang database)
    USERS: {
        admin: { name: 'Administrator', password: 'admin123' },
        ch: { name: 'ch', password: '123' }
    }
};
