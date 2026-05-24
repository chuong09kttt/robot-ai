// ========== CHIRI AI - SECURE ENTRY POINT ==========

// Load environment ONLY for Local / VPS (PM2, Ubuntu, Oracle)
const ENV = require('./src/config/env');

if (ENV.isLocal || ENV.isVPS) {
    require('dotenv').config();
}

// Core app
const { startServer } = require('./src/app');

// ========== ERROR HANDLING ==========
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// ========== STARTUP LOGS ==========
console.log('🚀 CHIRI AI - Starting server...');
console.log(`🌍 Environment: ${ENV.name}`);
console.log(`📦 Node version: ${process.version}`);
console.log(`🏠 Platform: ${process.platform}`);
console.log(`🔑 OpenAI Key: ${process.env.OPENAI_API_KEY ? 'OK' : 'MISSING'}`);

// ========== START SERVER ==========
startServer()
    .then(() => {
        console.log('✅ Server started successfully');
    })
    .catch((err) => {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    });
