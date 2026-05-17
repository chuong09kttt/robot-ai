// ========== CHIRI AI - SECURE ENTRY POINT ==========
require('dotenv').config();
const { startServer } = require('./src/app');

// Start server
startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
