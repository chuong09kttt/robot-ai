// ========== CHIRI AI - SECURE ENTRY POINT ==========
// No need dotenv - Railway injects env vars directly to process.env
// require('dotenv').config(); // REMOVED for Railway compatibility

const { startServer } = require('./src/app');

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Start server with proper logging
console.log('🚀 CHIRI AI - Starting server...');
console.log(`📦 Node version: ${process.version}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 PORT: ${process.env.PORT || '3000 (default)'}`);

startServer()
    .then(() => {
        console.log('✅ CHIRI AI server started successfully!');
    })
    .catch(err => {
        console.error('❌ Failed to start server:', err);
        console.error('📚 Error details:', err.stack);
        process.exit(1);
    });
