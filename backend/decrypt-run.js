const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const algorithm = 'aes-256-cbc';
const key = fs.readFileSync('./key.bin');
const iv = fs.readFileSync('./iv.bin');

function decryptFile(encryptedPath, outputPath) {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const encrypted = fs.readFileSync(encryptedPath);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    fs.writeFileSync(outputPath, decrypted);
}

// Decrypt tất cả file .enc
function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.enc')) {
            const outputPath = fullPath.replace('.enc', '');
            decryptFile(fullPath, outputPath);
            console.log(`🔓 Decrypted: ${outputPath}`);
        }
    }
}

walkDir('./src');

// Chạy server
require('./src/app.js');
