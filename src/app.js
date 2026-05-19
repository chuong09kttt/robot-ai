// ========== SECURE APP CONFIGURATION ==========
const express = require('express');
const http = require('http');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const { 
    securityHeaders, 
    sessionFingerprint, 
    apiLimiter,
    antiTampering, 
    watermarkCheck
} = require('./middleware/security');
const { cleanupSession } = require('./middleware/auth');
const { setupWebSocket } = require('./socket');

// Routes
const authRoutes = require('./routes/auth');
const faceRoutes = require('./routes/face');
const translateRoutes = require('./routes/translate');
const chatRoutes = require('./routes/chat');
const driveRoutes = require('./routes/drive');
const gameRoutes = require('./routes/game');
const protectedRoutes = require('./routes/protected');
const secureGameRoutes = require('./routes/secure-game');

const app = express();
const server = http.createServer(app);



// Sau khi setupWebSocket(server)
const { esp32Clients, wsClients } = require('./socket'); // export thêm wsClients

// Gán vào app để các route có thể dùng
app.set('wsClients', wsClients);


// ========== SECURITY MIDDLEWARE ==========
app.use(securityHeaders);
app.use(antiTampering);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(watermarkCheck);

// Session with secure configuration
app.use(session({
    secret: config.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: config.SESSION_MAX_AGE || 86400000
    },
    name: '__Secure-chiri-session'
}));

// Custom security middleware
app.use(sessionFingerprint);
app.use(cleanupSession);
app.use(apiLimiter);

// ========== STATIC FILES (PUBLIC) ==========
app.use('/css', express.static(path.join(config.PUBLIC_DIR, 'css'), { maxAge: '7d' }));
app.use('/images', express.static(path.join(config.PUBLIC_DIR, 'images'), { maxAge: '30d' }));

// ========== API ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/secure-game', secureGameRoutes);
app.use('/protected', protectedRoutes);

// ========== PUBLIC ROUTES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});

// Healthcheck endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: Date.now(), 
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Simple root endpoint for Railway healthcheck
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// ========== WEBSOCKET ==========
const { setupWebSocket, wsClients } = require('./socket');
setupWebSocket(server);
// Gán wsClients vào app để các route có thể dùng
app.set('wsClients', wsClients);
// ========== ERROR HANDLING ==========
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
async function startServer() {
    return new Promise((resolve, reject) => {
        try {
            const PORT = process.env.PORT || config.PORT || 3000;
            const HOST = '0.0.0.0';
            
            server.listen(PORT, HOST, () => {
                console.log(`\n╔════════════════════════════════════════════════════════════╗`);
                console.log(`║         🔒 CHIRI AI - SECURE EDITION v13.0                  ║`);
                console.log(`╠════════════════════════════════════════════════════════════╣`);
                console.log(`║  📍 URL: http://localhost:${PORT}                           ║`);
                console.log(`║  🌐 Public URL: ${process.env.PUBLIC_URL || 'http://localhost:' + PORT}`);
                console.log(`║  🔐 Login: admin / admin123 | ch / 123                     ║`);
                console.log(`║  🛡️ Security: Session + Fingerprint + CSP                  ║`);
                console.log(`║  🔒 Protected files: Require authentication               ║`);
                console.log(`║  ✅ Server started successfully!                           ║`);
                console.log(`║  🩺 Healthcheck: /health or /ping                         ║`);
                console.log(`╚════════════════════════════════════════════════════════════╝`);
                resolve();
            });
            
            server.on('error', (err) => {
                console.error('❌ Server error:', err);
                reject(err);
            });
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            reject(error);
        }
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, closing server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = { startServer };
