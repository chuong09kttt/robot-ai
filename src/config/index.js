// ========== CONFIGURATION ==========
const path = require('path');

module.exports = {
    // Server
    PORT: process.env.PORT || 8080,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Session
    SESSION_SECRET: process.env.SESSION_SECRET || 'chiri-super-secret-key-2024',
    
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    
    // Google Drive
    GOOGLE_DRIVE_FILE_ID: process.env.GOOGLE_DRIVE_FILE_ID || '1RXqoUIQgb_UgvbjM8h3412OZdsxPAZPP',
    
    // Paths
    PUBLIC_DIR: path.join(__dirname, '../../public'),
    FACE_DATA_FILE: path.join(__dirname, '../../face-data.json'),
    
    // Rate limits
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100,
    
    // Session
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    
    // Users
    USERS: {
        'admin': { password: 'admin123', name: 'Quản trị viên' },
        'ch': { password: '123', name: 'Chí Hào' }
    }
};
