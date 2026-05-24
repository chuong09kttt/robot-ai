const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

function encryptFile(filePath) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const input = fs.readFileSync(filePath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    
    const outputPath = filePath + '.enc';
    fs.writeFileSync(outputPath, encrypted);
    fs.unlinkSync(filePath); // Xóa file gốc
    
    console.log(`✅ Encrypted: ${filePath}`);
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.js') && !file.includes('encrypt')) {
            encryptFile(fullPath);
        }
    }
}

// Mã hóa toàn bộ backend
walkDir('./backend/src');

// Lưu key để giải mã khi chạy
fs.writeFileSync('./backend/key.bin', key);
fs.writeFileSync('./backend/iv.bin', iv);

console.log('🔒 Backend encrypted successfully!');
console.log('⚠️ Keep key.bin and iv.bin SAFE!');
