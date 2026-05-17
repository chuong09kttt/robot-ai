// ========== DIGITAL WATERMARKING ==========
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Watermark configuration
const WATERMARK_KEY = config.WATERMARK_KEY || 'chiri-default-watermark-key';
const WATERMARK_ALGORITHM = 'aes-256-cbc';

// Tạo watermark duy nhất cho phiên bản
function generateVersionWatermark(version = '13.0.0') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const data = `CHIRI_AI_${version}_${timestamp}_${random}`;
    
    const cipher = crypto.createCipheriv(WATERMARK_ALGORITHM, 
        Buffer.from(WATERMARK_KEY.padEnd(32, '0').slice(0, 32)), 
        Buffer.alloc(16, 0));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        watermark: encrypted,
        plaintext: data,
        timestamp,
        version
    };
}

// Kiểm tra watermark hợp lệ
function verifyWatermark(watermark) {
    try {
        const decipher = crypto.createDecipheriv(WATERMARK_ALGORITHM,
            Buffer.from(WATERMARK_KEY.padEnd(32, '0').slice(0, 32)),
            Buffer.alloc(16, 0));
        
        let decrypted = decipher.update(watermark, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted.startsWith('CHIRI_AI_');
    } catch(e) {
        return false;
    }
}

// Thêm watermark vào mã nguồn JavaScript
function addWatermarkToJS(code, options = {}) {
    const watermark = generateVersionWatermark(options.version);
    const watermarkComment = `/*\n * CHIRI AI - Protected Code\n * Version: ${watermark.version}\n * Timestamp: ${watermark.timestamp}\n * Watermark: ${watermark.watermark}\n * DO NOT COPY OR DISTRIBUTE\n */\n\n`;
    
    // Thêm fingerprint vào code
    const fingerprint = `window.__CHIRI_WATERMARK__ = "${watermark.watermark}";\n`;
    
    return watermarkComment + fingerprint + code;
}

// Thêm watermark vào file HTML
function addWatermarkToHTML(code, options = {}) {
    const watermark = generateVersionWatermark(options.version);
    const watermarkComment = `<!-- 
    CHIRI AI - Protected Code
    Version: ${watermark.version}
    Timestamp: ${watermark.timestamp}
    Watermark: ${watermark.watermark}
    DO NOT COPY OR DISTRIBUTE
-->\n`;
    
    const metaTag = `<meta name="chiri-watermark" content="${watermark.watermark}">\n`;
    
    // Thêm vào đầu file
    return watermarkComment + metaTag + code;
}

// Thêm watermark vào CSS
function addWatermarkToCSS(code, options = {}) {
    const watermark = generateVersionWatermark(options.version);
    const watermarkComment = `/* 
 * CHIRI AI - Protected CSS
 * Version: ${watermark.version}
 * Timestamp: ${watermark.timestamp}
 * Watermark: ${watermark.watermark}
 * DO NOT COPY OR DISTRIBUTE
 */\n\n`;
    
    return watermarkComment + code;
}

// Kiểm tra watermark trong response
function checkWatermark(req, res, next) {
    // Thêm watermark vào response headers
    const watermark = generateVersionWatermark();
    res.setHeader('X-CHIRI-Watermark', watermark.watermark);
    res.setHeader('X-CHIRI-Version', watermark.version);
    res.setHeader('X-CHIRI-Protected', 'true');
    next();
}

// Tạo fingerprint cho người dùng
function generateUserFingerprint(userId, sessionId) {
    const data = `${userId}|${sessionId}|${Date.now()}|${crypto.randomBytes(16).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash;
}

// Kiểm tra license
function validateLicense(licenseKey) {
    // Giả lập kiểm tra license
    const expectedHash = crypto.createHash('sha256')
        .update(`${WATERMARK_KEY}_LICENSE_2024`)
        .digest('hex');
    
    return licenseKey === expectedHash;
}

// Tạo license key mới (chỉ dùng cho admin)
function generateLicenseKey() {
    return crypto.createHash('sha256')
        .update(`${WATERMARK_KEY}_LICENSE_2024_${Date.now()}`)
        .digest('hex');
}

// Thêm tracking code vào JavaScript
function addTrackingCode(code, userId) {
    const trackingCode = `
// Tracking and security
(function() {
    const userId = "${userId}";
    const sessionId = "${crypto.randomBytes(16).toString('hex')}";
    const startTime = Date.now();
    
    // Track usage
    setInterval(() => {
        const data = {
            userId: userId,
            sessionId: sessionId,
            duration: Date.now() - startTime,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        // Send tracking data (optional)
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/track', JSON.stringify(data));
        }
    }, 60000); // Every minute
})();
`;
    
    return code + trackingCode;
}

// Phát hiện devtools mở
function addDevToolsDetection(code) {
    const detectionCode = `
// DevTools detection
(function() {
    let devToolsOpen = false;
    const element = new Image();
    Object.defineProperty(element, 'id', {
        get: function() {
            devToolsOpen = true;
            return '';
        }
    });
    
    setInterval(() => {
        console.log(element);
        console.clear();
        if (devToolsOpen) {
            document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:50%">🔒 Developer tools detected. Please close to continue.</h1>';
            setTimeout(() => location.reload(), 3000);
        }
    }, 1000);
})();
`;
    
    return code + detectionCode;
}

// Tạo code đã được bảo vệ hoàn chỉnh
function protectJavaScript(code, options = {}) {
    let protectedCode = code;
    
    // Thêm watermark
    protectedCode = addWatermarkToJS(protectedCode, options);
    
    // Thêm tracking
    if (options.tracking) {
        protectedCode = addTrackingCode(protectedCode, options.userId || 'anonymous');
    }
    
    // Thêm devtools detection
    if (options.antiDebug) {
        protectedCode = addDevToolsDetection(protectedCode);
    }
    
    return protectedCode;
}

// Xuất module
module.exports = {
    generateVersionWatermark,
    verifyWatermark,
    addWatermarkToJS,
    addWatermarkToHTML,
    addWatermarkToCSS,
    checkWatermark,
    generateUserFingerprint,
    validateLicense,
    generateLicenseKey,
    addTrackingCode,
    addDevToolsDetection,
    protectJavaScript
};
