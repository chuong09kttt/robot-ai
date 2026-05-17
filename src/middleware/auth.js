// ========== AUTHENTICATION MIDDLEWARE ==========
const session = require('express-session');
const config = require('../config');

// Session configuration
const sessionMiddleware = session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: config.SESSION_MAX_AGE
    }
});

// Check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized - Please login first' });
    }
}

// Check if user is authenticated (for API)
function requireApiAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// Get current user
function getCurrentUser(req) {
    return req.session ? req.session.user : null;
}

module.exports = {
    sessionMiddleware,
    requireAuth,
    requireApiAuth,
    getCurrentUser
};
