// ========== FACE RECOGNITION ENGINE ==========
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { encrypt, decrypt, hashData } = require('../utils/crypto');

// Face database path
const FACE_DB_PATH = path.join(config.DATABASE_DIR, 'faces.enc');

// Face descriptor extractor - lấy các điểm đặc trưng trên khuôn mặt
function extractFaceDescriptor(landmarks) {
    // Các điểm quan trọng trên khuôn mặt (MediaPipe Face Mesh indices)
    const keyIndices = [
        10,  // Trán trên
        33,  // Mắt trái ngoài
        61,  // Mắt trái trong
        133, // Mắt trái dưới
        152, // Cằm
        168, // Sống mũi
        199, // Má phải
        263, // Mắt phải trong
        291, // Mắt phải ngoài
        362, // Mắt phải dưới
        454, // Má trái
        468  // Đỉnh mũi
    ];
    
    const descriptor = [];
    for (const idx of keyIndices) {
        if (landmarks[idx]) {
            descriptor.push(landmarks[idx].x, landmarks[idx].y, landmarks[idx].z || 0);
        } else {
            descriptor.push(0, 0, 0);
        }
    }
    return descriptor;
}

// So sánh 2 face descriptors
function compareFaces(desc1, desc2, threshold = 0.12) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return false;
    
    let sumSquaredDiff = 0;
    let validCount = 0;
    
    for (let i = 0; i < desc1.length; i++) {
        if (desc1[i] !== 0 || desc2[i] !== 0) {
            sumSquaredDiff += Math.pow(desc1[i] - desc2[i], 2);
            validCount++;
        }
    }
    
    if (validCount === 0) return false;
    const distance = Math.sqrt(sumSquaredDiff / validCount);
    return distance < threshold;
}

// Tính khoảng cách giữa 2 faces (càng nhỏ càng giống)
function calculateFaceDistance(desc1, desc2) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return 1;
    
    let sumSquaredDiff = 0;
    let validCount = 0;
    
    for (let i = 0; i < desc1.length; i++) {
        if (desc1[i] !== 0 || desc2[i] !== 0) {
            sumSquaredDiff += Math.pow(desc1[i] - desc2[i], 2);
            validCount++;
        }
    }
    
    if (validCount === 0) return 1;
    return Math.sqrt(sumSquaredDiff / validCount);
}

// Đọc database khuôn mặt (đã mã hóa)
function readFaceDatabase() {
    try {
        if (fs.existsSync(FACE_DB_PATH)) {
            const encryptedData = fs.readFileSync(FACE_DB_PATH, 'utf8');
            const data = JSON.parse(encryptedData);
            // Giải mã nội dung
            if (data.encrypted) {
                const decrypted = decrypt({
                    encrypted: data.encrypted,
                    iv: data.iv,
                    authTag: data.authTag
                });
                return JSON.parse(decrypted);
            }
            return data;
        }
    } catch(e) {
        console.error('Error reading face database:', e.message);
    }
    return {};
}

// Ghi database khuôn mặt (mã hóa)
function writeFaceDatabase(data) {
    try {
        // Mã hóa dữ liệu trước khi lưu
        const jsonString = JSON.stringify(data);
        const encrypted = encrypt(jsonString);
        
        const encryptedData = {
            encrypted: encrypted.encrypted,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            version: '1.0',
            timestamp: Date.now()
        };
        
        fs.writeFileSync(FACE_DB_PATH, JSON.stringify(encryptedData, null, 2));
        return true;
    } catch(e) {
        console.error('Error writing face database:', e.message);
        return false;
    }
}

// Đăng ký khuôn mặt mới
function registerFace(username, name, descriptor) {
    const db = readFaceDatabase();
    
    if (!db[username]) {
        db[username] = [];
    }
    
    // Kiểm tra xem tên đã tồn tại chưa
    const existingIndex = db[username].findIndex(f => f.name === name);
    if (existingIndex !== -1) {
        // Cập nhật descriptor mới
        db[username][existingIndex] = {
            name,
            descriptor,
            registeredAt: Date.now(),
            hash: hashData(JSON.stringify(descriptor)).hash
        };
    } else {
        // Thêm mới
        db[username].push({
            name,
            descriptor,
            registeredAt: Date.now(),
            hash: hashData(JSON.stringify(descriptor)).hash
        });
    }
    
    writeFaceDatabase(db);
    return { success: true, message: `Đã đăng ký khuôn mặt cho ${name}` };
}

// Nhận diện khuôn mặt
function recognizeFace(username, descriptor, threshold = 0.15) {
    const db = readFaceDatabase();
    
    if (!db[username] || db[username].length === 0) {
        return { success: false, name: null, confidence: 0 };
    }
    
    let bestMatch = null;
    let bestDistance = 1;
    let bestDescriptor = null;
    
    for (const face of db[username]) {
        const distance = calculateFaceDistance(descriptor, face.descriptor);
        if (distance < bestDistance && distance < threshold) {
            bestDistance = distance;
            bestMatch = face.name;
            bestDescriptor = face.descriptor;
        }
    }
    
    if (bestMatch) {
        // Tính confidence (1 - distance)
        const confidence = Math.max(0, Math.min(1, 1 - bestDistance));
        return { 
            success: true, 
            name: bestMatch, 
            confidence: confidence.toFixed(2),
            distance: bestDistance.toFixed(4)
        };
    }
    
    return { success: false, name: null, confidence: 0 };
}

// Lấy danh sách khuôn mặt đã đăng ký
function getRegisteredFaces(username) {
    const db = readFaceDatabase();
    
    if (!db[username]) {
        return [];
    }
    
    return db[username].map(face => ({
        name: face.name,
        registeredAt: face.registeredAt
    }));
}

// Xóa khuôn mặt
function deleteFace(username, name) {
    const db = readFaceDatabase();
    
    if (!db[username]) {
        return { success: false, message: 'No faces found' };
    }
    
    const index = db[username].findIndex(f => f.name === name);
    if (index === -1) {
        return { success: false, message: 'Face not found' };
    }
    
    db[username].splice(index, 1);
    writeFaceDatabase(db);
    
    return { success: true, message: `Đã xóa khuôn mặt ${name}` };
}

// Xóa tất cả khuôn mặt của user
function clearAllFaces(username) {
    const db = readFaceDatabase();
    
    if (db[username]) {
        delete db[username];
        writeFaceDatabase(db);
        return { success: true, message: 'Đã xóa tất cả khuôn mặt' };
    }
    
    return { success: false, message: 'No faces found' };
}

// Phát hiện kính mắt từ landmarks
function detectGlasses(landmarks) {
    const leftEyeInner = landmarks[133];
    const leftEyeOuter = landmarks[33];
    const rightEyeInner = landmarks[362];
    const rightEyeOuter = landmarks[263];
    
    if (!leftEyeInner || !leftEyeOuter || !rightEyeInner || !rightEyeOuter) return false;
    
    const leftWidth = Math.hypot(leftEyeInner.x - leftEyeOuter.x, leftEyeInner.y - leftEyeOuter.y);
    const rightWidth = Math.hypot(rightEyeInner.x - rightEyeOuter.x, rightEyeInner.y - rightEyeOuter.y);
    const avgWidth = (leftWidth + rightWidth) / 2;
    
    const noseBridge = landmarks[168];
    const noseTip = landmarks[1];
    if (!noseBridge || !noseTip) return false;
    
    const noseHeight = Math.hypot(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);
    return avgWidth / noseHeight > 1.3;
}

// Phát hiện mũ từ landmarks
function detectHat(landmarks) {
    const foreheadTop = landmarks[10];
    const leftCheek = landmarks[234];
    const chin = landmarks[152];
    
    if (!foreheadTop || !leftCheek || !chin) return false;
    
    const foreheadY = foreheadTop.y;
    const chinY = chin.y;
    const cheekY = leftCheek.y;
    const foreheadRatio = (cheekY - foreheadY) / (chinY - foreheadY);
    return foreheadRatio < 0.25;
}

// Phát hiện biểu cảm khuôn mặt (cười, buồn, ngạc nhiên)
function detectExpression(landmarks) {
    // Lấy các điểm miệng
    const mouthLeft = landmarks[61];
    const mouthRight = landmarks[291];
    const mouthTop = landmarks[13];
    const mouthBottom = landmarks[14];
    
    if (!mouthLeft || !mouthRight || !mouthTop || !mouthBottom) {
        return { expression: 'neutral', confidence: 0 };
    }
    
    const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
    const mouthHeight = Math.abs(mouthBottom.y - mouthTop.y);
    const mouthRatio = mouthHeight / mouthWidth;
    
    if (mouthRatio > 0.5) {
        return { expression: 'surprised', confidence: mouthRatio };
    } else if (mouthRatio > 0.3) {
        // Cần thêm điều kiện để phân biệt cười và buồn
        const leftMouthCorner = landmarks[61];
        const rightMouthCorner = landmarks[291];
        if (leftMouthCorner && rightMouthCorner) {
            const cornerY = (leftMouthCorner.y + rightMouthCorner.y) / 2;
            if (cornerY < mouthTop.y) {
                return { expression: 'happy', confidence: mouthRatio };
            } else {
                return { expression: 'sad', confidence: mouthRatio };
            }
        }
        return { expression: 'happy', confidence: mouthRatio };
    }
    
    return { expression: 'neutral', confidence: 0.8 };
}

// Phát hiện tuổi (ước lượng từ tỷ lệ khuôn mặt)
function estimateAge(landmarks) {
    // Đây là ước lượng đơn giản, trong thực tế cần model riêng
    const forehead = landmarks[10];
    const chin = landmarks[152];
    
    if (!forehead || !chin) return null;
    
    const faceLength = Math.abs(chin.y - forehead.y);
    // Heuristic: tỷ lệ mặt dài thường liên quan đến tuổi
    if (faceLength > 0.4) return { age: 'adult', range: '25-40' };
    if (faceLength > 0.35) return { age: 'young', range: '18-25' };
    return { age: 'child', range: '0-18' };
}

// Phát hiện giới tính (ước lượng từ tỷ lệ khuôn mặt)
function estimateGender(landmarks) {
    // Đơn giản hóa: dựa vào tỷ lệ chiều rộng mặt / chiều dài mặt
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    
    if (!leftCheek || !rightCheek || !forehead || !chin) return null;
    
    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    const faceHeight = Math.abs(chin.y - forehead.y);
    const ratio = faceWidth / faceHeight;
    
    // Heuristic: nam thường có mặt dài hơn (ratio nhỏ), nữ có mặt tròn hơn (ratio lớn)
    if (ratio > 0.85) return { gender: 'female', confidence: 0.6 };
    return { gender: 'male', confidence: 0.6 };
}

// Phân tích đầy đủ các đặc điểm khuôn mặt
function analyzeFace(landmarks) {
    return {
        hasGlasses: detectGlasses(landmarks),
        hasHat: detectHat(landmarks),
        expression: detectExpression(landmarks),
        age: estimateAge(landmarks),
        gender: estimateGender(landmarks),
        confidence: 0.7
    };
}

// Tạo face descriptor từ frame (gọi từ client)
function processFaceFrame(imageData, landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return { success: false, error: 'No face detected' };
    }
    
    const descriptor = extractFaceDescriptor(landmarks[0]);
    const analysis = analyzeFace(landmarks[0]);
    
    return {
        success: true,
        descriptor,
        analysis,
        faceCount: landmarks.length
    };
}

// Xuất module
module.exports = {
    extractFaceDescriptor,
    compareFaces,
    calculateFaceDistance,
    readFaceDatabase,
    writeFaceDatabase,
    registerFace,
    recognizeFace,
    getRegisteredFaces,
    deleteFace,
    clearAllFaces,
    detectGlasses,
    detectHat,
    detectExpression,
    estimateAge,
    estimateGender,
    analyzeFace,
    processFaceFrame
};
