// ========== GENERATE SECURITY KEYS ==========
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Generate random key
function generateKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Generate password hash (bcrypt compatible)
function generatePasswordHash(password) {
    const salt = crypto.randomBytes(16).toString('base64');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

// Create .env file
function createEnvFile(keys) {
    const envPath = path.join(__dirname, '../.env');
    const envContent = `# ========== CHIRI AI SECURITY KEYS ==========
# Generated: ${new Date().toISOString()}
# DO NOT COMMIT THIS FILE TO GIT!

# Server Configuration
PORT=8080
NODE_ENV=production

# Security Keys
SESSION_SECRET=${keys.sessionSecret}
ENCRYPTION_KEY=${keys.encryptionKey}
WATERMARK_KEY=${keys.watermarkKey}
CSRF_SECRET=${keys.csrfSecret}

# Rate Limits
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# API Keys (Add your own keys below)
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_API_KEY=your-google-api-key-here
MS_API_KEY=your-microsoft-api-key-here

# Database (Optional)
DB_URL=mongodb://localhost:27017/chiri
DB_USER=
DB_PASS=

# Email (Optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Monitoring
SENTRY_DSN=
LOG_LEVEL=info
`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created!');
}

// Create .gitignore entries for sensitive files
function updateGitignore() {
    const gitignorePath = path.join(__dirname, '../.gitignore');
    const entries = [
        '.env',
        'database/*.enc',
        'protected/js/**/*.js',
        'protected/wasm/*.wasm',
        'public/css/style.min.css',
        '*.log',
        'node_modules/',
        '.DS_Store'
    ];
    
    let content = '';
    if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    for (const entry of entries) {
        if (!content.includes(entry)) {
            content += `\n${entry}`;
        }
    }
    
    fs.writeFileSync(gitignorePath, content);
    console.log('✅ .gitignore updated!');
}

// Create secure backup of keys
function createBackup(keys) {
    const backupDir = path.join(__dirname, '../.secrets');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `keys-${Date.now()}.enc`);
    const backupContent = JSON.stringify(keys, null, 2);
    
    // Simple encryption for backup (can be enhanced)
    const cipher = crypto.createCipher('aes-256-cbc', keys.sessionSecret);
    let encrypted = cipher.update(backupContent, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    fs.writeFileSync(backupPath, encrypted);
    console.log(`✅ Backup saved to: ${backupPath}`);
    console.log('⚠️ Keep this backup in a safe place!');
}

// Main function
async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         🔐 CHIRI AI - SECURITY KEY GENERATOR              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Generate keys
    const keys = {
        sessionSecret: generateKey(32),
        encryptionKey: generateKey(32),
        watermarkKey: generateKey(32),
        csrfSecret: generateKey(32),
        generatedAt: new Date().toISOString(),
        version: '13.0.0'
    };
    
    console.log('📋 Generated keys:');
    console.log(`   Session Secret: ${keys.sessionSecret.slice(0, 16)}...`);
    console.log(`   Encryption Key: ${keys.encryptionKey.slice(0, 16)}...`);
    console.log(`   Watermark Key: ${keys.watermarkKey.slice(0, 16)}...`);
    console.log(`   CSRF Secret: ${keys.csrfSecret.slice(0, 16)}...`);
    
    // Create files
    createEnvFile(keys);
    updateGitignore();
    createBackup(keys);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         ✅ KEYS GENERATED SUCCESSFULLY!                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  ⚠️ IMPORTANT:                                            ║');
    console.log('║  - Never commit .env file to git!                         ║');
    console.log('║  - Store backup keys in a secure location                 ║');
    console.log('║  - Add your API keys to .env file                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    rl.close();
}

// Ask for confirmation before overwriting
if (fs.existsSync(path.join(__dirname, '../.env'))) {
    rl.question('⚠️ .env file already exists. Overwrite? (y/N): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
            main();
        } else {
            console.log('❌ Cancelled.');
            rl.close();
        }
    });
} else {
    main();
}
