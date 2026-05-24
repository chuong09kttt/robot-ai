const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authenticateJWT } = require('./src/middleware/auth');
const robotRoutes = require('./src/routes/robotRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const authRoutes = require('./src/routes/authRoutes');

const app = express();

// Bảo mật headers
app.use(helmet());

// CORS chỉ cho phép frontend domain
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://your-frontend.railway.app',
    credentials: true
}));

// Giới hạn request
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Parse JSON
app.use(express.json({ limit: '10mb' }));

// Routes (cần xác thực)
app.use('/api/auth', authRoutes);
app.use('/api/robot', authenticateJWT, robotRoutes);
app.use('/api/chat', authenticateJWT, chatRoutes);

// Health check (public)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔒 Backend running on port ${PORT}`);
});
