// ========== GENERATE SECURITY KEYS ==========
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sessionSecret = crypto.randomBytes(32).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');
const watermarkKey = crypto.randomBytes(32).toString('hex');

const envContent = `# Generated Security Keys
SESSION_SECRET=${sessionSecret}
ENCRYPTION_KEY=${encryptionKey}
WATERMARK_KEY=${watermarkKey}

# Server
PORT=8080
NODE_ENV=production

# Rate Limits
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# API Keys (add your keys)
OPENAI_API_KEY=your-key-here
`;

fs.writeFileSync(path.join(__dirname, '../.env'), envContent);
console.log('✅ Security keys generated and saved to .env');
console.log('⚠️ Please add your OPENAI_API_KEY to .env');
