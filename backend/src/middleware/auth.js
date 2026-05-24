const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

const generateToken = (userId) => {
    return jwt.sign(
        { userId, exp: Math.floor(Date.now() / 1000) + 24 * 3600 }, // 24 hours
        process.env.JWT_SECRET
    );
};

module.exports = { authenticateJWT, generateToken };
