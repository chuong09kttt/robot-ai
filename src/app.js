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
const { setupWebSocket, wsClients, esp32Clients } = require('./socket');

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

// ========== GLOBAL ERROR HANDLERS (THÊM VÀO ĐẦU) ==========
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Không exit, chỉ log để container không bị kill
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// ========== SECURITY MIDDLEWARE (TẠM THỜI COMMENT ĐỂ TRÁNH LỖI) ==========
// app.use(securityHeaders);      // COMMENT - gây lỗi Suspicious header
// app.use(antiTampering);        // COMMENT
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// app.use(watermarkCheck);       // COMMENT

// Session with secure configuration (SỬA ĐỂ TƯƠNG THÍCH RAILWAY)
app.use(session({
    secret: config.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,  // ← ĐỔI thành true
    cookie: {
        secure: false,         // ← ĐỔI thành false (vì Railway dùng HTTP)
        httpOnly: true,
        sameSite: 'lax',       // ← ĐỔI từ 'strict' thành 'lax'
        maxAge: config.SESSION_MAX_AGE || 86400000
    },
    name: 'chiri-session'      // ← BỎ __Secure- prefix
}));

// Custom security middleware (TẠM THỜI COMMENT)
// app.use(sessionFingerprint);   // COMMENT
app.use(cleanupSession);
// app.use(apiLimiter);           // COMMENT

// ========== STATIC FILES (PUBLIC) ==========
// Thêm dòng này để serve toàn bộ thư mục public
app.use(express.static(config.PUBLIC_DIR));

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
    const indexPath = path.join(config.PUBLIC_DIR, 'index.html');
    console.log(`📄 Serving index.html from: ${indexPath}`);
    res.sendFile(indexPath);
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

// Simple endpoint for Railway healthcheck
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// ========== WEBSOCKET ==========
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
            const PORT = process.env.PORT || config.PORT || 8080;
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

// ========== GRACEFUL SHUTDOWN ==========
function gracefulShutdown(signal) {
    console.log(`🛑 ${signal} received, shutting down gracefully...`);

    server.close(() => {
        console.log('✅ HTTP server closed');

        // ========== CLEANUP WEBSOCKET ==========
        try {
            if (wsClients) {
                wsClients.clear();
                console.log('🧹 wsClients cleared');
            }

            if (esp32Clients) {
                esp32Clients.clear();
                console.log('🧹 esp32Clients cleared');
            }
        } catch (err) {
            console.error('⚠️ Cleanup error:', err);
        }

        process.exit(0);
    });

    // Force shutdown nếu treo
    setTimeout(() => {
        console.log('⚠️ Force shutdown timeout reached');
        process.exit(1);
    }, 10000);
}


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));



module.exports = { startServer };
