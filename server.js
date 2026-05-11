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
        console.log('⚠️ Chưa có OPENAI_API_KEY, chatbot sẽ dùng chế độ offline');
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
            console.log(`📤 GỬI LỆNH đến ESP32 ${id}: ${command}`);
            sent = true;
        }
    }
    if (!sent) {
        console.log('⚠️ Không có ESP32 nào đang kết nối');
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

// ========== FALLBACK THÔNG MINH (xử lý ĐÚNG câu hỏi) ==========
function getSmartFallbackReply(userMessage) {
    const lower = userMessage.toLowerCase();
    
    // ========== CÂU HỎI VỀ MẶT TRĂNG ==========
    if (lower.includes('mặt trăng') || lower.includes('mặt trăng')) {
        // Nhiệt độ mặt trăng
        if (lower.includes('nhiệt độ') || lower.includes('bao nhiêu độ') || lower.includes('nóng') || lower.includes('lạnh')) {
            return '🌙 Nhiệt độ trên Mặt Trăng rất khắc nghiệt! Ban ngày (khoảng 14 ngày Trái Đất) nhiệt độ lên tới 127°C, còn ban đêm (cũng 14 ngày) nhiệt độ giảm xuống -173°C. Chênh lệch lên đến 300°C bạn ạ! 🥶🔥';
        }
        // Khoảng cách mặt trăng
        if (lower.includes('xa') || lower.includes('khoảng cách') || lower.includes('bao xa')) {
            return '🌙 Khoảng cách từ Trái Đất đến Mặt Trăng trung bình là 384.400 km. Ánh sáng từ Mặt Trăng mất khoảng 1,28 giây để đến được mắt chúng ta! 🚀';
        }
        // Mặt trăng nặng bao nhiêu
        if (lower.includes('nặng') || lower.includes('khối lượng')) {
            return '🌙 Khối lượng của Mặt Trăng là 7.35 × 10^22 kg, bằng khoảng 1/81 khối lượng Trái Đất bạn nhé!';
        }
        // Mặt trăng được tạo thành từ gì
        if (lower.includes('tạo thành') || lower.includes('cấu tạo') || lower.includes('chất')) {
            return '🌙 Mặt Trăng được cấu tạo chủ yếu từ đá bazan, đá anorthosite và bụi mặt trăng (regolith). Bề mặt có nhiều hố va chạm do thiên thạch tạo nên.';
        }
        // Giới thiệu chung về mặt trăng
        return '🌙 Mặt Trăng là vệ tinh tự nhiên duy nhất của Trái Đất. Nó có đường kính khoảng 3.474 km (bằng 1/4 Trái Đất). Bạn muốn hỏi gì về Mặt Trăng? Nhiệt độ, khoảng cách, hay cấu tạo của nó? 🚀';
    }
    
    // ========== CÂU HỎI VỀ MẶT TRỜI ==========
    if (lower.includes('mặt trời') || lower.includes('sun')) {
        if (lower.includes('nhiệt độ') || lower.includes('bao nhiêu độ') || lower.includes('nóng')) {
            return '☀️ Nhiệt độ bề mặt Mặt Trời khoảng 5.500°C, còn lõi Mặt Trời lên tới 15 triệu độ C đấy bạn ạ! Rất nóng phải không nào? 🔥';
        }
        if (lower.includes('lớn') || lower.includes('đường kính') || lower.includes('kích thước')) {
            return '☀️ Mặt Trời có đường kính khoảng 1.39 triệu km, gấp 109 lần Trái Đất và có thể chứa được 1.3 triệu Trái Đất bên trong!';
        }
        if (lower.includes('tuổi')) {
            return '☀️ Mặt Trời khoảng 4.6 tỷ năm tuổi và được dự đoán sẽ còn hoạt động thêm khoảng 5 tỷ năm nữa!';
        }
        return '☀️ Mặt Trời là ngôi sao ở trung tâm Hệ Mặt Trời, cung cấp ánh sáng và năng lượng cho sự sống trên Trái Đất. Bạn muốn hỏi gì về Mặt Trời?';
    }
    
    // ========== CÂU HỎI VỀ TRÁI ĐẤT ==========
    if (lower.includes('trái đất') || lower.includes('earth')) {
        if (lower.includes('nặng') || lower.includes('khối lượng')) {
            return '🌍 Trái Đất có khối lượng khoảng 5,97 × 10^24 kg, tương đương gần 6 triệu tỉ tỉ kilogam đó bạn!';
        }
        if (lower.includes('tuổi')) {
            return '🌍 Trái Đất khoảng 4.54 tỷ năm tuổi, được hình thành cùng với Mặt Trời và các hành tinh khác!';
        }
        if (lower.includes('đường kính')) {
            return '🌍 Đường kính Trái Đất khoảng 12.742 km, chu vi khoảng 40.075 km ở xích đạo. Đi bộ vòng quanh Trái Đất sẽ mất khoảng 8.333 giờ liên tục đó!';
        }
        if (lower.includes('nước') || lower.includes('biển')) {
            return '💧 Khoảng 71% bề mặt Trái Đất được bao phủ bởi nước, nhưng chỉ có 2.5% là nước ngọt bạn nhé!';
        }
        return '🌍 Trái Đất là hành tinh thứ ba từ Mặt Trời, là nơi duy nhất có sự sống trong Hệ Mặt Trời. Bạn muốn hỏi gì về Trái Đất?';
    }
    
    // ========== CÂU HỎI VỀ NHIỆT ĐỘ NÓI CHUNG ==========
    if (lower.includes('nhiệt độ') && (lower.includes('bao nhiêu') || lower.includes('bao độ'))) {
        // Phát hiện vật thể được hỏi
        if (lower.includes('sao hỏa') || lower.includes('mars')) {
            return '🔴 Nhiệt độ trên Sao Hỏa trung bình khoảng -63°C, có thể xuống tới -140°C vào mùa đông ở hai cực!';
        }
        if (lower.includes('sao kim') || lower.includes('venus')) {
            return '🟡 Sao Kim có nhiệt độ bề mặt lên tới 470°C, nóng hơn cả Sao Thủy dù ở xa Mặt Trời hơn! Nguyên nhân do hiệu ứng nhà kính cực mạnh.';
        }
        if (lower.includes('sao thủy') || lower.includes('mercury')) {
            return '🪐 Sao Thủy ban ngày lên tới 430°C, nhưng ban đêm xuống -180°C do không có khí quyển giữ nhiệt!';
        }
        if (lower.includes('sao mộc') || lower.includes('jupiter')) {
            return '🪐 Sao Mộc có nhiệt độ đỉnh mây khoảng -145°C, nhưng bên trong lõi có thể lên tới 24.000°C!';
        }
    }
    
    // ========== CÂU HỎI VỀ HÀNH TINH ==========
    if (lower.includes('hành tinh') || lower.includes('sao')) {
        if (lower.includes('lớn nhất')) {
            return '🪐 Hành tinh lớn nhất trong Hệ Mặt Trời là Sao Mộc (Jupiter), đường kính gấp 11 lần Trái Đất!';
        }
        if (lower.includes('nhỏ nhất')) {
            return '🪐 Hành tinh nhỏ nhất trong Hệ Mặt Trời là Sao Thủy (Mercury), chỉ lớn hơn Mặt Trăng một chút!';
        }
        if (lower.includes('bao nhiêu hành tinh')) {
            return '🪐 Hệ Mặt Trời có 8 hành tinh: Thủy, Kim, Trái Đất, Hỏa, Mộc, Thổ, Thiên, Hải. Bạn muốn biết về hành tinh nào?';
        }
    }
    
    // ========== CÂU HỎI VỀ KHOA HỌC TỔNG QUÁT ==========
    if (lower.includes('tốc độ ánh sáng') || lower.includes('ánh sáng nhanh')) {
        return '⚡ Tốc độ ánh sáng trong chân không là 299.792.458 mét trên giây (khoảng 300.000 km/s). Đi một vòng quanh Trái Đất chỉ mất 0.13 giây!';
    }
    
    if (lower.includes('tốc độ âm thanh') || lower.includes('âm thanh nhanh')) {
        return '🔊 Tốc độ âm thanh trong không khí ở nhiệt độ 20°C là khoảng 343 mét trên giây (1.234 km/h). Nhanh hơn máy bay thương mại một chút!';
    }
    
    if (lower.includes('ngân hà') || lower.includes('milky way')) {
        return '🌌 Ngân Hà của chúng ta có khoảng 100-400 tỷ ngôi sao và đường kính khoảng 100.000 năm ánh sáng. Mỗi chấm sáng trên bầu trời đêm đều nằm trong Ngân Hà! ✨';
    }
    
    // ========== CHÀO HỎI, GIỚI THIỆU ==========
    if (lower.includes('xin chào') || lower.includes('hello') || lower.includes('chào chiri') || lower.includes('hi chiri')) {
        return 'Xin chào bạn yêu quý! Mình là Chiri, trợ lý AI thông minh. Mình có thể trả lời các câu hỏi về khoa học, thiên văn, hoặc bật chế độ điều khiển xe bằng giọng nói. Bạn cần mình giúp gì ạ? 💕';
    }
    
    if (lower.includes('tên') || lower.includes('là ai') || lower.includes('bạn là')) {
        return 'Mình là CHIRI - trợ lý AI thông minh, bạn đồng hành đáng yêu của bạn đây! Rất vui được gặp bạn! 🐹';
    }
    
    if (lower.includes('cảm ơn')) {
        return 'Không có gì đâu ạ! Rất vui khi được giúp bạn. Có gì cần hỏi thêm không ạ? 💖';
    }
    
    if (lower.includes('khỏe') || lower.includes('ổn không') || lower.includes('thế nào')) {
        return 'Mình vẫn khỏe và hoạt động tốt, cảm ơn bạn! Bạn thì sao ạ? 😊';
    }
    
    if (lower.includes('làm được gì') || lower.includes('có thể làm')) {
        return 'Mình có thể:\n📚 Trả lời câu hỏi về khoa học, thiên văn, địa lý\n🚗 Điều khiển xe bằng giọng nói (bật chế độ xe)\n💬 Trò chuyện thông minh như AI\n🌡️ Cho biết nhiệt độ, kích thước các hành tinh\nBạn muốn thử gì nào? 🚀';
    }
    
    if (lower.includes('tạm biệt') || lower.includes('bye')) {
        return 'Tạm biệt bạn nhé! Hẹn gặp lại. Hãy gọi "Xin chào" khi cần mình nhé! 👋';
    }
    
    // ========== TRẢ LỜI THÔNG MINH MẶC ĐỊNH (KHÔNG CÒN CÂU CHUNG CHUNG) ==========
    // Thử phát hiện xem có phải câu hỏi về con số/định lượng không
    if (lower.match(/bao nhiêu|bao độ|khoảng bao|số lượng|khối lượng|kích thước|đường kính|tuổi|nặng|dài|rộng|cao/)) {
        return `📊 Mình nhận thấy bạn đang hỏi về thông tin số liệu. Bạn có thể nói rõ hơn "nhiệt độ [vật thể]" hoặc "khối lượng [vật thể]" để mình trả lời chính xác nhé! Ví dụ: "nhiệt độ sao Hỏa", "khối lượng Mặt Trăng" 🎯`;
    }
    
    // Trả lời mặc định - vẫn thông minh
    return `🤔 Mình nghe câu hỏi "${userMessage}" nhưng chưa rõ chủ đề lắm. Bạn có thể hỏi mình về:\n• Nhiệt độ Mặt Trăng, Mặt Trời, các hành tinh\n• Khối lượng, kích thước Trái Đất\n• Khoảng cách, tốc độ ánh sáng\n• Hoặc bật chế độ xe để điều khiển xe bằng giọng nói nhé! 🚀`;
}

// ========== CHATGPT THÔNG MINH ==========
async function getSmartReply(userMessage) {
    // Nếu có OpenAI, gọi API để trả lời thông minh
    if (openai && process.env.OPENAI_API_KEY) {
        try {
            console.log(`🤖 Gọi ChatGPT: "${userMessage.substring(0, 50)}..."`);
            
            conversationHistory.push({ role: 'user', content: userMessage });
            if (conversationHistory.length > 20) {
                conversationHistory = conversationHistory.slice(-20);
            }
            
            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Bạn là CHIRI, robot trợ lý AI thông minh. QUAN TRỌNG: Trả lời TRỰC TIẾP và ĐÚNG TRỌNG TÂM câu hỏi. Không nói "Mình nghe bạn nói...". Khi được hỏi "nhiệt độ mặt trăng bao nhiêu", hãy trả lời chính xác nhiệt độ Mặt Trăng (127°C ban ngày, -173°C ban đêm). Luôn xưng là "mình" hoặc "Chiri".' },
                    ...conversationHistory
                ],
                max_tokens: 250,
                temperature: 0.5,
                timeout: 15000,
            });
            
            const reply = completion.choices[0].message.content;
            console.log(`💬 ChatGPT trả lời: "${reply.substring(0, 50)}..."`);
            
            conversationHistory.push({ role: 'assistant', content: reply });
            return reply;
            
        } catch (error) {
            console.error('❌ Lỗi ChatGPT:', error.message);
            return getSmartFallbackReply(userMessage);
        }
    }
    
    // Không có OpenAI API key, dùng fallback thông minh
    return getSmartFallbackReply(userMessage);
}

// ========== XỬ LÝ LỆNH ĐIỀU KHIỂN XE ==========
function getDriveCommandReply(command) {
    const commandReplies = {
        'FORWARD': '🚗 Xe đang tiến về phía trước!',
        'BACKWARD': '🚗 Xe đang lùi lại!',
        'LEFT': '🚗 Xe đang rẽ trái!',
        'RIGHT': '🚗 Xe đang rẽ phải!',
        'STOP': '🚗 Xe đã dừng lại!',
        'SPEED_UP': '🚗 Đang tăng tốc độ!',
        'SLOW_DOWN': '🚗 Đang giảm tốc độ!'
    };
    return commandReplies[command] || '🚗 Đã nhận lệnh điều khiển xe!';
}

// ========== XỬ LÝ CHAT THEO CHẾ ĐỘ ==========
async function processUserMessage(userText, driveMode) {
    console.log(`🔍 Xử lý: "${userText}" | driveMode = ${driveMode}`);
    
    // Nếu đang ở chế độ điều khiển xe
    if (driveMode === true) {
        const isCommand = isControlCommand(userText);
        if (isCommand) {
            const command = getESP32Command(userText);
            if (command) {
                sendToESP32(command);
                return getDriveCommandReply(command);
            }
        }
        return `🚫 Chiri đang ở chế độ điều khiển xe. Vui lòng nói: tiến, lùi, trái, phải, dừng. Hoặc nhấn nút "TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE" để trò chuyện nhé!`;
    }
    
    // Chế độ trò chuyện bình thường - trả lời ĐÚNG câu hỏi
    return await getSmartReply(userText);
}

// ========== TTS ==========
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('Missing text');
    
    if (!openai || !process.env.OPENAI_API_KEY) {
        return res.status(503).send('TTS not available');
    }
    
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
    } catch (error) {
        console.error('TTS error:', error.message);
        res.status(500).send('TTS error');
    }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        esp32Clients: esp32Clients.size,
        uptime: process.uptime()
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
                console.log(`🎤 WEB: "${userText}" | driveMode=${driveMode}`);
                
                const reply = await processUserMessage(userText, driveMode);
                console.log(`💬 Trả lời: "${reply.substring(0, 80)}"`);
                
                ws.send(JSON.stringify({ type: 'ai', text: reply }));
            }
            
            if (data.type === 'esp32_status') {
                console.log(`📡 ESP32: ${data.status}`);
            }
        } catch(e) {
            console.error('Lỗi:', e.message);
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 Client ${clientId} ngắt`);
        clearInterval(pingInterval);
        if (esp32Clients.has(clientId)) esp32Clients.delete(clientId);
    });
    
    ws.on('error', (err) => {
        console.error(`❌ Lỗi ${clientId}:`, err.message);
    });
});

// ========== KHỞI ĐỘNG SERVER ==========
const PORT = process.env.PORT || 8080;

process.on('SIGTERM', () => {
    console.log('📡 Đang đóng...');
    server.close(() => process.exit(0));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CHIRI AI chạy tại cổng ${PORT}`);
    console.log(`🤖 Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    console.log(`✅ Health check: /health\n`);
});
