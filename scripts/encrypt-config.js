// ========== ENCRYPT CONFIGURATION ==========
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const algorithm = 'aes-256-gcm';
const configPath = path.join(__dirname, '../src/config/secrets.json');
const outputPath = path.join(__dirname, '../src/config/secrets.enc');

// Configuration to encrypt
const config = {
    apiKeys: {
        openai: process.env.OPENAI_API_KEY || '',
        google: process.env.GOOGLE_API_KEY || '',
        microsoft: process.env.MS_API_KEY || ''
    },
    database: {
        url: process.env.DB_URL || '',
        name: 'chiri_db'
    },
    features: {
        chat: true,
        drive: true,
        translate: true,
        camera: true,
        face: true,
        game: true
    },
    rateLimits: {
        login: 5,
        api: 100,
        upload: 10
    }
};

// Generate encryption key from master key
function getEncryptionKey() {
    const masterKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    return Buffer.from(masterKey.slice(0, 32), 'hex');
}

// Encrypt configuration
function encryptConfig() {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const jsonString = JSON.stringify(config, null, 2);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const encryptedData = {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: algorithm,
        timestamp: Date.now()
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(encryptedData, null, 2));
    console.log('✅ Configuration encrypted and saved to:', outputPath);
    console.log('⚠️ Keep your ENCRYPTION_KEY safe!');
}

// Decrypt configuration (for server use)
function decryptConfig() {
    if (!fs.existsSync(outputPath)) {
        console.error('❌ Encrypted config not found!');
        return null;
    }
    
    const encryptedData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
}

// Command line arguments
if (process.argv[2] === '--decrypt') {
    const config = decryptConfig();
    console.log('Decrypted config:', config);
} else {
    encryptConfig();
}

module.exports = { encryptConfig, decryptConfig };
