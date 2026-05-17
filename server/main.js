const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const session = require('express-session');

// Import routes
const authRoutes = require('./routes/auth');
const faceRoutes = require('./routes/face');
const translateRoutes = require('./routes/translate');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'chiri-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (chỉ file CSS, images - KHÔNG có JS)
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/translate', translateRoutes);

// Serve HTML (chỉ HTML, JS sẽ được inject sau login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Protected JS files - chỉ gửi khi đã login
app.get('/app.js', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('// Unauthorized');
    }
    res.sendFile(path.join(__dirname, '../public/js/app.js'));
});

// WebSocket
wss.on('connection', (ws) => {
    console.log('🔌 Client connected');
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
        } catch(e) {}
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Secure server running on port ${PORT}`);
});
