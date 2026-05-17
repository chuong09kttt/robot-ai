// ========== CHIRI AI SECURE SERVER ==========
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

// Initialize app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "wss://*.railway.app", "https://api.openai.com", "https://api.mymemory.translated.net"],
            imgSrc: ["'self'", "data:", "blob:"],
            workerSrc: ["'self'", "blob:"],
            mediaSrc: ["'self'", "blob:"]
        }
    }
}));

app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [
            'https://robot-ai-production-9a07.up.railway.app',
            'http://localhost:8080',
            'https://*.railway.app'
        ];
        if (!origin || allowedOrigins.some(o => o === origin || (o.includes('*') && origin.includes('railway')))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Secure session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
    name: '__Secure-chiri',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Request fingerprint middleware
app.use((req, res, next) => {
    if (req.session && req.session.user) {
        const fingerprint = crypto.createHash('sha256')
            .update((req.headers['user-agent'] || '') + (req.ip || ''))
            .digest('hex');
        
        if (req.session.fingerprint && req.session.fingerprint !== fingerprint) {
            req.session.destroy();
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.session.fingerprint = fingerprint;
    }
    next();
});

// ========== STATIC FILES ==========
app.use('/css', express.static(path.join(__dirname, '../public/css'), { maxAge: '1d' }));
app.use('/js', express.static(path.join(__dirname, '../public/js'), { maxAge: '1d' }));

// ========== ROUTES ==========
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const faceRoutes = require('./routes/face');
const translateRoutes = require('./routes/translate');

app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/translate', translateRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ========== WEBSOCKET ==========
const clients = new Map();

wss.on('connection', (ws, req) => {
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    clients.set(clientId, ws);
    console.log(`🔌 Client connected: ${clientId}`);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            // Handle game messages
            if (data.type === 'game_update') {
                // Broadcast to other clients
                clients.forEach((client, id) => {
                    if (id !== clientId && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'player_update', id: clientId, data: data.data }));
                    }
                });
            }
        } catch(e) {}
    });

    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`🔌 Client disconnected: ${clientId}`);
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║         🚀 CHIRI AI SECURE SERVER v13.0                 ║`);
    console.log(`╠══════════════════════════════════════════════════════════╣`);
    console.log(`║  📍 URL: https://robot-ai-production-9a07.up.railway.app ║`);
    console.log(`║  🔐 Security: Session + Fingerprint + Helmet             ║`);
    console.log(`║  🎮 Game Engine: Server-side logic                       ║`);
    console.log(`║  👤 Face ID: Encrypted storage                           ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝`);
});
