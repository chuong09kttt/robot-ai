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
    antiTampering 
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

const app = express();
const server = http.createServer(app);

// ========== SECURITY MIDDLEWARE ==========
app.use(securityHeaders);
app.use(antiTampering);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session with secure configuration
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: config.SESSION_MAX_AGE
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
app.use('/protected', protectedRoutes);

// ========== PUBLIC ROUTES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() });
});

// ========== WEBSOCKET ==========
setupWebSocket(server);

// ========== START SERVER ==========
async function startServer() {
    return new Promise((resolve) => {
        const PORT = config.PORT;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`\n╔════════════════════════════════════════════════════════════╗`);
            console.log(`║         🔒 CHIRI AI - SECURE EDITION v13.0                  ║`);
            console.log(`╠════════════════════════════════════════════════════════════╣`);
            console.log(`║  📍 URL: http://localhost:${PORT}                           ║`);
            console.log(`║  🔐 Login: admin / admin123 | ch / 123                     ║`);
            console.log(`║  🛡️ Security: Session + Fingerprint + CSP                  ║`);
            console.log(`║  🔒 Protected files: Require authentication               ║`);
            console.log(`║  ✅ Server started successfully!                           ║`);
            console.log(`╚════════════════════════════════════════════════════════════╝`);
            resolve();
        });
    });
}

module.exports = { startServer };
