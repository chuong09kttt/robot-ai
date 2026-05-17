// ========== ADVANCED AUTH MIDDLEWARE ==========
const bcrypt = require('bcrypt');
const config = require('../config');

// Hash password (for creating users)
async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

// Verify password
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Check if user is authenticated (API)
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        // Check session age
        const sessionAge = Date.now() - (req.session.cookie._expires || Date.now());
        if (sessionAge > config.SESSION_MAX_AGE) {
            req.session.destroy();
            return res.status(401).json({ error: 'Session expired' });
        }
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized - Please login first' });
    }
}

// Check if user is authenticated (WebSocket)
function wsRequireAuth(ws, req, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        ws.close(1008, 'Unauthorized');
    }
}

// Get current user
function getCurrentUser(req) {
    return req.session ? req.session.user : null;
}

// Session cleanup
function cleanupSession(req, res, next) {
    if (req.session && req.session.user) {
        const now = Date.now();
        const lastActivity = req.session.lastActivity || now;
        
        if (now - lastActivity > config.SESSION_MAX_AGE) {
            req.session.destroy();
            return res.status(401).json({ error: 'Session expired' });
        }
        
        req.session.lastActivity = now;
    }
    next();
}

module.exports = {
    hashPassword,
    verifyPassword,
    requireAuth,
    wsRequireAuth,
    getCurrentUser,
    cleanupSession
};
