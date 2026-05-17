// ========== EXPRESS APP CONFIGURATION ==========
const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const { sessionMiddleware } = require('./middleware/auth');
const { corsOptions, securityHeaders } = require('./middleware/cors');
const { apiLimiter } = require('./middleware/rateLimit');
const { setupWebSocket } = require('./services/websocket');  // Đã sửa đường dẫn

// Routes
const authRoutes = require('./routes/auth');
const faceRoutes = require('./routes/face');
const translateRoutes = require('./routes/translate');
const chatRoutes = require('./routes/chat');
const driveRoutes = require('./routes/drive');
const knowledgeRoutes = require('./routes/knowledge');
const gameRoutes = require('./routes/game');

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(securityHeaders);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(apiLimiter);

// Static files
app.use(express.static(config.PUBLIC_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/drive', driveRoutes.router);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: Date.now(), 
        uptime: process.uptime(),
        session: !!req.session.user
    });
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', time: new Date().toISOString() });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});

// Setup WebSocket
setupWebSocket(server);

// Start server
function startServer() {
    const PORT = config.PORT;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n╔════════════════════════════════════════════════════════════╗`);
        console.log(`║         🚀 CHIRI AI - PROFESSIONAL EDITION                ║`);
        console.log(`╠════════════════════════════════════════════════════════════╣`);
        console.log(`║  📍 URL: http://localhost:${PORT}                           ║`);
        console.log(`║  🔐 Login: admin / admin123 | ch / 123                     ║`);
        console.log(`║  🏗️  Architecture: Modular                                 ║`);
        console.log(`║  ✅ Server started successfully!                           ║`);
        console.log(`╚════════════════════════════════════════════════════════════╝`);
    });
}

module.exports = { startServer };
