const config = require('./src/config');
const ENV = require('./src/config/env');
const { startServer } = require('./src/app');

// ========== SAFETY ==========
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

// ========== LOG START ==========
console.log('=================================');
console.log('🚀 CHIRI AI STARTING...');
console.log('🌍 ENV:', ENV.name);
console.log('⚙️ PORT:', config.port);
console.log('🔑 OPENAI:', config.openaiKey ? 'OK' : 'MISSING');
console.log('=================================');

// ========== HEALTH CHECK ==========
setInterval(() => {
    console.log(`💓 HEALTH OK - ${new Date().toISOString()}`);
}, 60000);

// ========== START ==========
startServer(config.port)
    .then(() => {
        console.log('✅ SERVER RUNNING');
    })
    .catch((err) => {
        console.error('❌ START FAILED:', err);
        process.exit(1);
    });
