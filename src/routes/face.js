// ========== FACE RECOGNITION ROUTES ==========
const express = require('express');
const router = express.Router();
const faceEngine = require('../services/faceEngine');
const { requireAuth } = require('../middleware/auth');

// Helper: Gửi thông báo giọng nói qua WebSocket
function sendVoiceAlert(wsClients, text, lang = 'vi') {
    if (!wsClients) return;
    
    const message = JSON.stringify({
        type: 'voice_alert',
        text: text,
        lang: lang
    });
    
    for (const [id, client] of wsClients) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    }
}

// Helper: Kiểm tra mũ và kính từ landmarks
function checkHatAndGlasses(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return { hasHat: false, hasGlasses: false, confidence: 0 };
    }
    
    // Lấy các điểm mốc quan trọng trên khuôn mặt
    // MediaPipe có 468 điểm landmarks, chỉ số tham khảo:
    const leftEye = landmarks[33];      // Mắt trái
    const rightEye = landmarks[263];    // Mắt phải
    const forehead = landmarks[10];     // Điểm giữa trán
    const noseTip = landmarks[4];       // Đầu mũi
    const topHead = landmarks[152];     // Đỉnh đầu
    
    let hasHat = false;
    let hasGlasses = false;
    let confidence = 0;
    
    // 1. KIỂM TRA MŨ
    // Nếu khoảng cách từ trán đến đỉnh đầu quá nhỏ => có mũ che
    if (forehead && topHead) {
        const foreheadToTop = Math.abs(forehead.y - topHead.y);
        const faceHeight = Math.abs(topHead.y - noseTip.y);
        
        // Nếu forehead_to_top < 20% face_height => có mũ che
        if (foreheadToTop / faceHeight < 0.2) {
            hasHat = true;
            confidence += 0.4;
        }
    }
    
    // Kiểm tra thêm: nếu điểm trán thấp hơn mắt => có mũ
    if (forehead && leftEye) {
        if (forehead.y > leftEye.y - 0.05) {
            hasHat = true;
            confidence += 0.3;
        }
    }
    
    // 2. KIỂM TRA KÍNH
    // Kiểm tra khoảng cách giữa 2 mắt và điểm mũi
    if (leftEye && rightEye && noseTip) {
        const eyeDistance = Math.abs(leftEye.x - rightEye.x);
        const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
        const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
        
        // Nếu mắt cách xa mũi bất thường => có thể do kính
        if (noseToLeftEye > eyeDistance * 0.4 || noseToRightEye > eyeDistance * 0.4) {
            hasGlasses = true;
            confidence += 0.5;
        }
    }
    
    // Kiểm tra thêm: nếu có điểm landmarks đặc trưng của gọng kính
    const hasGlassFrames = landmarks.some(landmark => {
        return (landmark.x < 0.2 && landmark.y > 0.3 && landmark.y < 0.7) ||
               (landmark.x > 0.8 && landmark.y > 0.3 && landmark.y < 0.7);
    });
    
    if (hasGlassFrames) {
        hasGlasses = true;
        confidence += 0.3;
    }
    
    return { hasHat, hasGlasses, confidence: Math.min(confidence, 1) };
}

// Register face - CÓ KIỂM TRA MŨ VÀ KÍNH
router.post('/register', requireAuth, async (req, res) => {
    const { name, descriptor, landmarks } = req.body;
    const username = req.session.user.username;
    
    if (!name || !descriptor) {
        return res.status(400).json({ error: 'Missing face data' });
    }
    
    // Lấy WebSocket clients từ app (cần được truyền vào)
    const wsClients = req.app.get('wsClients');
    
    // KIỂM TRA MŨ VÀ KÍNH
    if (landmarks && landmarks.length > 0) {
        const { hasHat, hasGlasses, confidence } = checkHatAndGlasses(landmarks);
        
        console.log(`🔍 Face analysis: hat=${hasHat}, glasses=${hasGlasses}, confidence=${confidence}`);
        
        // Nếu chưa đội mũ HOẶC chưa đeo kính
        if (!hasHat || !hasGlasses) {
            let alertMessage = '';
            
            if (!hasHat && !hasGlasses) {
                alertMessage = 'Bạn chưa đội mũ và chưa đeo kính. Vui lòng đội mũ bảo hiểm và đeo kính trước khi đăng ký!';
            } else if (!hasHat) {
                alertMessage = 'Bạn chưa đội mũ bảo hiểm. Vui lòng đội mũ trước khi đăng ký!';
            } else if (!hasGlasses) {
                alertMessage = 'Bạn chưa đeo kính. Vui lòng đeo kính trước khi đăng ký!';
            }
            
            // Gửi thông báo giọng nói qua WebSocket
            if (wsClients) {
                sendVoiceAlert(wsClients, alertMessage, 'vi');
            }
            
            return res.status(400).json({
                success: false,
                error: 'hat_glasses_required',
                message: alertMessage,
                hasHat,
                hasGlasses,
                confidence
            });
        }
        
        // Đã đủ điều kiện (có mũ VÀ có kính)
        console.log(`✅ User ${username} passed hat & glasses check`);
    } else {
        // Không có landmarks -> không thể kiểm tra
        console.warn('⚠️ No landmarks provided, skipping hat/glasses check');
    }
    
    // Tiến hành đăng ký khuôn mặt
    const result = faceEngine.registerFace(username, name, descriptor);
    
    // Gửi thông báo thành công
    if (result.success && wsClients) {
        sendVoiceAlert(wsClients, `Đăng ký khuôn mặt cho ${name} thành công!`, 'vi');
    }
    
    res.json(result);
});

// Recognize face
router.post('/recognize', requireAuth, (req, res) => {
    const { descriptor } = req.body;
    const username = req.session.user.username;
    
    if (!descriptor) {
        return res.status(400).json({ error: 'Missing face descriptor' });
    }
    
    const result = faceEngine.recognizeFace(username, descriptor);
    res.json(result);
});

// Get list of registered faces
router.get('/list', requireAuth, (req, res) => {
    const username = req.session.user.username;
    const faces = faceEngine.getRegisteredFaces(username);
    res.json({ faces });
});

// Delete a face
router.delete('/:name', requireAuth, (req, res) => {
    const { name } = req.params;
    const username = req.session.user.username;
    const result = faceEngine.deleteFace(username, name);
    res.json(result);
});

// Delete all faces
router.delete('/all', requireAuth, (req, res) => {
    const username = req.session.user.username;
    const result = faceEngine.clearAllFaces(username);
    res.json(result);
});

// Analyze face (glasses, hat, expression) - NÂNG CẤP
router.post('/analyze', requireAuth, (req, res) => {
    const { landmarks } = req.body;
    
    if (!landmarks || landmarks.length === 0) {
        return res.status(400).json({ error: 'No face landmarks' });
    }
    
    const analysis = checkHatAndGlasses(landmarks);
    
    // Thêm phân tích biểu cảm cơ bản nếu có thể
    let expression = 'neutral';
    if (landmarks.length > 0) {
        const mouth = landmarks[78];  // Điểm miệng
        const leftLip = landmarks[61];
        const rightLip = landmarks[291];
        
        if (mouth && leftLip && rightLip) {
            const mouthWidth = Math.abs(rightLip.x - leftLip.x);
            if (mouthWidth > 0.15) expression = 'happy';
            else if (mouthWidth < 0.05) expression = 'serious';
        }
    }
    
    res.json({
        ...analysis,
        expression,
        hasValidEquipment: analysis.hasHat && analysis.hasGlasses
    });
});

// Get database stats
router.get('/stats', requireAuth, (req, res) => {
    const db = faceEngine.readFaceDatabase();
    const username = req.session.user.username;
    const userFaces = db[username] || [];
    
    res.json({
        totalUsers: Object.keys(db).length,
        userFacesCount: userFaces.length,
        userFaces: userFaces.map(f => ({ name: f.name, registeredAt: f.registeredAt }))
    });
});

// ========== THÊM MỚI: Endpoint cho frontend gọi /api/face-database ==========
// Endpoint này trả về danh sách khuôn mặt đã đăng ký của user hiện tại
router.get('/database', requireAuth, (req, res) => {
    const username = req.session.user.username;
    const db = faceEngine.readFaceDatabase();
    const userFaces = db[username] || [];
    
    res.json({
        success: true,
        faces: userFaces.map(f => ({ 
            name: f.name, 
            registeredAt: f.registeredAt,
            hasDescriptor: !!f.descriptor
        })),
        total: userFaces.length
    });
});

module.exports = router;
