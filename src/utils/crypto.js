// ========== CRYPTO UTILITIES ==========
const crypto = require('crypto');
const config = require('../config');

const algorithm = 'aes-256-gcm';

// Encrypt data
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, config.ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

// Decrypt data
function decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
        algorithm, 
        config.ENCRYPTION_KEY, 
        Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

// Hash data with salt
function hashData(data, salt = null) {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, useSalt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: useSalt };
}

// Verify hash
function verifyHash(data, hash, salt) {
    const { hash: newHash } = hashData(data, salt);
    return newHash === hash;
}

// Generate random token
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    hashData,
    verifyHash,
    generateToken
};
