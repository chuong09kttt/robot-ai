const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '/')));

// ========== KHỞI TẠO OPENAI ==========
let openai = null;
try {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    if (process.env.OPENAI_API_KEY) {
        console.log('✅ OpenAI API Key đã được cấu hình');
    } else {
        console.log('⚠️ Chưa có OPENAI_API_KEY');
    }
} catch (err) {
    console.error('❌ Lỗi khởi tạo OpenAI:', err.message);
}

// ========== LƯU ESP32 CLIENTS ==========
const esp32Clients = new Map();
let conversationHistory = [];

// ========== HÀM GỬI LỆNH ESP32 ==========
function sendToESP32(command) {
    let sent = false;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'command', command: command }));
            console.log(`📤 GỬI LỆNH đến ESP32: ${command}`);
            sent = true;
        }
    }
    if (!sent) {
        console.log('⚠️ Không có ESP32 nào kết nối');
    }
    return sent;
}

// ========== NHẬN DIỆN LỆNH ==========
function isControlCommand(text) {
    const lowerText = text.toLowerCase();
    const controlWords = [
        'tiến', 'đi thẳng', 'forward', 'tiến lên', 'tiến tới',
        'lùi', 'đi lùi', 'back', 'backward', 'lùi lại',
        'trái', 'quẹo trái', 'rẽ trái', 'left',
        'phải', 'quẹo phải', 'rẽ phải', 'right',
        'dừng', 'dừng lại', 'stop', 'dừng xe',
        'nhanh', 'tăng tốc', 'speed up',
        'chậm', 'giảm tốc', 'slow down'
    ];
    return controlWords.some(word => lowerText.includes(word));
}

function getESP32Command(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('tiến') || lowerText.includes('đi thẳng') || lowerText.includes('forward')) return 'FORWARD';
    if (lowerText.includes('lùi') || lowerText.includes('back')) return 'BACKWARD';
    if (lowerText.includes('trái') || lowerText.includes('left')) return 'LEFT';
    if (lowerText.includes('phải') || lowerText.includes('right')) return 'RIGHT';
    if (lowerText.includes('dừng') || lowerText.includes('stop')) return 'STOP';
    if (lowerText.includes('nhanh') || lowerText.includes('speed up')) return 'SPEED_UP';
    if (lowerText.includes('chậm') || lowerText.includes('slow down')) return 'SLOW_DOWN';
    return null;
}

// ========== HÀM TRẢ LỜI THÔNG MINH ==========
function getSmartReply(userMessage) {
    const lower = userMessage.toLowerCase().trim();
    
    // Loại bỏ các câu nhận diện sai (quá ngắn hoặc vô nghĩa)
    if (lower.length < 3) {
        return "Mình chưa nghe rõ bạn nói gì. Bạn có thể nói to và rõ hơn được không ạ? 🎤";
    }
    
    // Từ khóa vô nghĩa thường gặp do nhận diện sai
    const invalidPhrases = ['đại chi', 'chi đi đây', 'ạ chi', 'đi đây ạ', 'ấy ạ', 'e ơi'];
    for (const phrase of invalidPhrases) {
        if (lower.includes(phrase)) {
            return "Mình xin lỗi, mình chưa nghe rõ câu hỏi của bạn. Bạn có thể nói chậm và rõ hơn được không ạ? Ví dụ: 'nhiệt độ mặt trăng bao nhiêu' hoặc 'tiến' để điều khiển xe nhé! 🎯";
        }
    }
    
    // ====== CÂU HỎI VỀ MẶT TRĂNG ======
    if (lower.includes('mặt trăng') || lower.includes('mặt trăng')) {
        if (lower.includes('nhiệt độ') || lower.includes('bao nhiêu độ') || lower.includes('nóng') || lower.includes('lạnh')) {
            return '🌙 Nhiệt độ trên Mặt Trăng rất khắc nghiệt! Ban ngày (kéo dài 14 ngày Trái Đất) nhiệt độ lên tới 127°C, còn ban đêm (14 ngày) nhiệt độ giảm xuống -173°C. Chênh lệch lên đến 300°C bạn ạ!';
        }
        if (lower.includes('xa') || lower.includes('khoảng cách')) {
            return '🌙 Khoảng cách từ Trái Đất đến Mặt Trăng trung bình là 384.400 km. Ánh sáng từ Mặt Trăng mất khoảng 1,28 giây để đến được mắt chúng ta!';
        }
        if (lower.includes('nặng') || lower.includes('khối lượng')) {
            return '🌙 Khối lượng của Mặt Trăng là 7.35 × 10^22 kg, bằng khoảng 1/81 khối lượng Trái Đất!';
        }
        return '🌙 Mặt Trăng là vệ tinh tự nhiên duy nhất của Trái Đất. Bạn muốn hỏi về nhiệt độ, khoảng cách hay khối lượng của Mặt Trăng ạ?';
    }
    
    // ====== CÂU HỎI VỀ MẶT TRỜI ======
    if (lower.includes('mặt trời') || lower.includes('mặt trời')) {
        if (lower.includes('nhiệt độ') || lower.includes('bao nhiêu độ')) {
            return '☀️ Nhiệt độ bề mặt Mặt Trời khoảng 5.500°C, còn lõi Mặt Trời lên tới 15 triệu độ C! Nóng đến mức có thể làm tan chảy mọi thứ bạn ạ!';
        }
        if (lower.includes('lớn') || lower.includes('đường kính')) {
            return '☀️ Mặt Trời có đường kính khoảng 1.39 triệu km, gấp 109 lần Trái Đất và có thể chứa được 1.3 triệu Trái Đất bên trong!';
        }
        return '☀️ Mặt Trời là ngôi sao ở trung tâm Hệ Mặt Trời. Bạn muốn hỏi về nhiệt độ hay kích thước của Mặt Trời ạ?';
    }
    
    // ====== CÂU HỎI VỀ TRÁI ĐẤT ======
    if (lower.includes('trái đất') || lower.includes('trái đất')) {
        if (lower.includes('nặng') || lower.includes('khối lượng')) {
            return '🌍 Trái Đất có khối lượng khoảng 5,97 × 10^24 kg, tương đương gần 6 triệu tỉ tỉ kilogam đó bạn!';
        }
        if (lower.includes('tuổi')) {
            return '🌍 Trái Đất khoảng 4.54 tỷ năm tuổi, được hình thành cùng với Hệ Mặt Trời!';
        }
        if (lower.includes('nước')) {
            return '💧 Khoảng 71% bề mặt Trái Đất được bao phủ bởi nước, nhưng chỉ có 2.5% là nước ngọt bạn nhé!';
        }
        return '🌍 Trái Đất là hành tinh thứ ba từ Mặt Trời, là nơi duy nhất có sự sống. Bạn muốn hỏi gì về Trái Đất?';
    }
    
    // ====== CÁC HÀNH TINH KHÁC ======
    if (lower.includes('sao hỏa') || lower.includes('sao hoả')) {
        return '🔴 Sao Hỏa còn gọi là "Hành tinh Đỏ". Nhiệt độ trung bình khoảng -63°C, có thể xuống tới -140°C vào mùa đông ở hai cực!';
    }
    if (lower.includes('sao kim')) {
        return '🟡 Sao Kim có nhiệt độ bề mặt lên tới 470°C, nóng hơn cả Sao Thủy dù ở xa Mặt Trời hơn! Do hiệu ứng nhà kính cực mạnh.';
    }
    if (lower.includes('sao mộc')) {
        return '🪐 Sao Mộc là hành tinh lớn nhất Hệ Mặt Trời. Nhiệt độ đỉnh mây khoảng -145°C, nhưng lõi có thể lên tới 24.000°C!';
    }
    
    // ====== CHÀO HỎI ======
    if (lower.includes('xin chào') || lower.includes('hello') || lower.includes('chào chiri')) {
        return 'Xin chào bạn! Mình là Chiri, rất vui được trò chuyện với bạn. Bạn có thể hỏi mình về nhiệt độ Mặt Trăng, Mặt Trời, hoặc bật chế độ xe để điều khiển xe bằng giọng nói nhé! 💕';
    }
    
    if (lower.includes('cảm ơn')) {
        return 'Không có gì đâu ạ! Rất vui khi được giúp bạn. Có gì cần hỏi thêm không ạ? 💖';
    }
    
    if (lower.includes('tạm biệt') || lower.includes('bye')) {
        return 'Tạm biệt bạn nhé! Hẹn gặp lại. Hãy gọi "Xin chào" khi cần mình nhé! 👋';
    }
    
    // ====== HỎI VỀ KHẢ NĂNG ======
    if (lower.includes('làm được gì') || lower.includes('có thể làm')) {
        return 'Mình có thể:\n📚 Trả lời câu hỏi về Mặt Trăng, Mặt Trời, Trái Đất\n🚗 Điều khiển xe (tiến, lùi, trái, phải, dừng)\n💬 Trò chuyện thông minh\n🌡️ Cho biết nhiệt độ, kích thước các hành tinh\nBạn muốn thử gì nào?';
    }
    
    // ====== MẶC ĐỊNH - GỢI Ý ======
    return `🤔 Mình chưa rõ câu hỏi "${userMessage}" lắm. Bạn có thể hỏi mình về:\n\n• Nhiệt độ Mặt Trăng bao nhiêu?\n• Mặt Trời nóng bao nhiêu độ?\n• Trái Đất nặng bao nhiêu?\n• Khối lượng Mặt Trăng?\n\nHoặc bật chế độ xe để ra lệnh: tiến, lùi, trái, phải, dừng nhé! 🚀`;
}

// ========== XỬ LÝ CHAT ==========
async function processUserMessage(userText, driveMode) {
    console.log(`🔍 Xử lý: "${userText}" | driveMode = ${driveMode}`);
    
    if (driveMode === true) {
        const isCommand = isControlCommand(userText);
        if (isCommand) {
            const command = getESP32Command(userText);
            if (command) {
                sendToESP32(command);
                const replies = {
                    'FORWARD': '🚗 Xe đang tiến về phía trước!',
                    'BACKWARD': '🚗 Xe đang lùi lại!',
                    'LEFT': '🚗 Xe đang rẽ trái!',
                    'RIGHT': '🚗 Xe đang rẽ phải!',
                    'STOP': '🚗 Xe đã dừng lại!',
                    'SPEED_UP': '🚗 Đang tăng tốc độ!',
                    'SLOW_DOWN': '🚗 Đang giảm tốc độ!'
                };
                return replies[command] || '🚗 Đã nhận lệnh điều khiển xe!';
            }
        }
        return `🚫 Chiri đang ở chế độ điều khiển xe. Vui lòng nói: tiến, lùi, trái, phải, dừng. Hoặc nhấn nút "TẮT CHẾ ĐỘ XE" để trò chuyện nhé!`;
    }
    
    return getSmartReply(userText);
}

// ========== TTS - QUAN TRỌNG: PHẢI CÓ API NÀY ==========
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) {
        return res.status(400).send('Missing text');
    }
    
    // Nếu có OpenAI và API key, dùng TTS chất lượng cao
    if (openai && process.env.OPENAI_API_KEY) {
        try {
            const mp3 = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: text,
                speed: 1.0,
            });
            
            const buffer = Buffer.from(await mp3.arrayBuffer());
            res.setHeader('Content-Type', 'audio/mpeg');
            res.send(buffer);
            return;
        } catch (error) {
            console.error('OpenAI TTS error:', error.message);
        }
    }
    
    // Fallback: Tạo file âm thanh giả lập bằng Web Speech (client sẽ xử lý)
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(503).send('TTS not available, using browser speech');
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        esp32Clients: esp32Clients.size
    });
});

// ========== WEBSOCKET ==========
wss.on('connection', (ws, req) => {
    const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    
    console.log(`🔌 ${isESP32 ? 'ESP32' : 'WEB'} client ${clientId} kết nối`);
    
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    
    if (isESP32) {
        esp32Clients.set(clientId, ws);
        ws.send(JSON.stringify({ type: 'system', message: 'Connected to CHIRI server' }));
    }
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'voice') {
                const userText = data.text;
                const driveMode = data.driveMode === true;
                console.log(`🎤 Nhận: "${userText}" | driveMode=${driveMode}`);
                
                const reply = await processUserMessage(userText, driveMode);
                console.log(`💬 Trả lời: "${reply.substring(0, 80)}"`);
                
                ws.send(JSON.stringify({ type: 'ai', text: reply }));
            }
            
            if (data.type === 'esp32_status') {
                console.log(`📡 ESP32: ${data.status}`);
            }
        } catch(e) {
            console.error('Lỗi xử lý:', e.message);
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 Client ${clientId} ngắt`);
        clearInterval(pingInterval);
        if (esp32Clients.has(clientId)) esp32Clients.delete(clientId);
    });
});

// ========== KHỞI ĐỘNG ==========
const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CHIRI AI chạy tại http://localhost:${PORT}`);
    console.log(`✅ WebSocket: ws://localhost:${PORT}`);
    console.log(`🎤 Voice control sẵn sàng!\n`);
});
