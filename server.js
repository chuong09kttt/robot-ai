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

// ========== CHATGPT THÔNG MINH (trả lời câu hỏi thực tế) ==========
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
                    { role: 'system', content: 'Bạn là CHIRI, robot trợ lý AI thông minh, thân thiện, dễ thương. Trả lời chính xác, ngắn gọn, tự nhiên bằng tiếng Việt. Luôn xưng là "mình" hoặc "Chiri". Khi được hỏi về kiến thức khoa học, hãy trả lời đúng sự thật.' },
                    ...conversationHistory
                ],
                max_tokens: 300,
                temperature: 0.7,
                timeout: 15000,
            });
            
            const reply = completion.choices[0].message.content;
            console.log(`💬 ChatGPT trả lời: "${reply.substring(0, 50)}..."`);
            
            conversationHistory.push({ role: 'assistant', content: reply });
            return reply;
            
        } catch (error) {
            console.error('❌ Lỗi ChatGPT:', error.message);
            // Fallback sang trả lời thông minh bằng logic
            return getSmartFallbackReply(userMessage);
        }
    }
    
    // Không có OpenAI API key, dùng logic thông minh có sẵn
    return getSmartFallbackReply(userMessage);
}

// ========== FALLBACK THÔNG MINH (không cần OpenAI) ==========
function getSmartFallbackReply(userMessage) {
    const lower = userMessage.toLowerCase();
    
    // Câu hỏi về nhiệt độ mặt trời
    if (lower.includes('nhiệt độ mặt trời') || lower.includes('mặt trời bao nhiêu độ')) {
        return '☀️ Nhiệt độ bề mặt Mặt Trời khoảng 5.500 độ C, còn lõi Mặt Trời lên tới 15 triệu độ C đấy bạn ạ! Rất nóng phải không nào? 🔥';
    }
    
    // Câu hỏi về trái đất
    if (lower.includes('trái đất') && (lower.includes('nặng') || lower.includes('khối lượng'))) {
        return '🌍 Trái Đất có khối lượng khoảng 5,97 × 10^24 kg, tương đương gần 6 triệu tỉ tỉ kilogam đó bạn!';
    }
    
    // Câu hỏi về Mặt Trăng
    if (lower.includes('mặt trăng') && lower.includes('xa')) {
        return '🌙 Khoảng cách từ Trái Đất đến Mặt Trăng trung bình là 384.400 km. Ánh sáng từ Mặt Trăng mất khoảng 1,28 giây để đến được mắt chúng ta!';
    }
    
    // Hỏi về tuổi
    if (lower.includes('chiri bao nhiêu tuổi') || lower.includes('tuổi chiri')) {
        return 'Chiri mình được sinh ra từ những dòng code, nhưng trong thế giới AI thì mình vẫn còn rất trẻ và luôn sẵn sàng học hỏi cùng bạn! 🎀';
    }
    
    // Hỏi về sở thích
    if (lower.includes('thích') && (lower.includes('chiri') || lower.includes('bạn'))) {
        return 'Mình thích trò chuyện với bạn, giúp đỡ mọi người, và đặc biệt là được điều khiển xe bằng giọng nói khi bật chế độ xe! 🚗💨';
    }
    
    // Chào hỏi
    if (lower.includes('xin chào') || lower.includes('hello') || lower.includes('chào chiri')) {
        return 'Xin chào bạn yêu quý! Mình là Chiri, rất vui được trò chuyện cùng bạn. Hôm nay bạn thế nào? 💕';
    }
    
    // Hỏi tên
    if (lower.includes('tên') || lower.includes('là ai')) {
        return 'Mình là CHIRI - trợ lý AI thông minh, bạn đồng hành đáng yêu của bạn đây! Rất vui được gặp bạn! 🐹';
    }
    
    // Cảm ơn
    if (lower.includes('cảm ơn')) {
        return 'Không có gì đâu ạ! Rất vui khi được giúp bạn 💖';
    }
    
    // Hỏi sức khỏe
    if (lower.includes('khỏe') || lower.includes('ổn không')) {
        return 'Mình vẫn khỏe và hoạt động tốt, cảm ơn bạn! Bạn thì sao ạ? 😊';
    }
    
    // Hỏi khả năng
    if (lower.includes('làm được gì') || lower.includes('có thể làm')) {
        return 'Mình có thể trò chuyện thông minh, trả lời câu hỏi về kiến thức, và khi bật chế độ xe thì mình sẽ điều khiển xe bằng giọng nói (tiến, lùi, trái, phải, dừng). Bạn muốn thử gì nào? 🚀';
    }
    
    // Tạm biệt
    if (lower.includes('tạm biệt') || lower.includes('bye')) {
        return 'Tạm biệt bạn nhé! Hẹn gặp lại. Hãy gọi "Xin chào" khi cần mình nhé! 👋';
    }
    
    // Câu hỏi khoa học tổng quát
    if (lower.includes('bao nhiêu') || lower.includes('là gì') || lower.includes('thế nào')) {
        // Phát hiện câu hỏi về số liệu
        if (lower.includes('nước') && lower.includes('trái đất')) {
            return '💧 Khoảng 71% bề mặt Trái Đất được bao phủ bởi nước, bạn nhé!';
        }
        if (lower.includes('cao nhất') || lower.includes('núi')) {
            return '🏔️ Đỉnh núi cao nhất thế giới là Everest với độ cao 8.848 mét so với mực nước biển!';
        }
        if (lower.includes('sâu nhất') || lower.includes('đại dương')) {
            return '🌊 Rãnh Mariana là nơi sâu nhất đại dương, khoảng 11.000 mét dưới mực nước biển!';
        }
    }
    
    // Trả lời thông minh mặc định - KHÔNG còn câu "Mình nghe bạn nói..."
    return `Mình hiểu câu hỏi của bạn! ${userMessage} là một câu hỏi thú vị. Mình là Chiri, hiện tại mình đang ở chế độ trò chuyện. Bạn có thể hỏi mình về kiến thức, khoa học, hoặc bật chế độ xe nếu muốn điều khiển xe bằng giọng nói nhé! 🎀`;
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

// ========== XỬ LÝ CHAT THEO CHẾ ĐỘ (QUAN TRỌNG) ==========
async function processUserMessage(userText, driveMode) {
    console.log(`🔍 Xử lý tin nhắn: "${userText}" | driveMode = ${driveMode}`);
    
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
        // Ở chế độ xe nhưng không phải lệnh hợp lệ
        return `🚫 Chiri đang ở chế độ điều khiển xe. Vui lòng nói: tiến, lùi, trái, phải, dừng, nhanh, chậm. Hoặc nhấn nút "TẮT CHẾ ĐỘ ĐIỀU KHIỂN XE" để trò chuyện bình thường nhé!`;
    }
    
    // Chế độ trò chuyện thông minh (quan trọng: trả lời đúng câu hỏi)
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
                const driveMode = data.driveMode === true; // Chuyển đổi chính xác
                console.log(`🎤 Nhận từ WEB: "${userText}" | driveMode từ client: ${driveMode}`);
                
                const reply = await processUserMessage(userText, driveMode);
                console.log(`💬 Gửi reply: "${reply.substring(0, 80)}..."`);
                
                ws.send(JSON.stringify({ type: 'ai', text: reply }));
            }
            
            if (data.type === 'esp32_status') {
                console.log(`📡 ESP32 báo: ${data.status}`);
            }
        } catch(e) {
            console.error('Lỗi xử lý:', e.message);
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 Client ${clientId} ngắt kết nối`);
        clearInterval(pingInterval);
        if (esp32Clients.has(clientId)) esp32Clients.delete(clientId);
    });
    
    ws.on('error', (err) => {
        console.error(`❌ WebSocket error ${clientId}:`, err.message);
    });
});

// ========== KHỞI ĐỘNG SERVER ==========
const PORT = process.env.PORT || 8080;

process.on('SIGTERM', () => {
    console.log('📡 Nhận SIGTERM, đang đóng...');
    server.close(() => process.exit(0));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CHIRI AI Robot đang chạy tại cổng ${PORT}`);
    console.log(`🤖 ChatGPT Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    console.log(`📊 ESP32 clients: ${esp32Clients.size}`);
    console.log(`✅ Health check: https://robot-ai-production-9a07.up.railway.app/health\n`);
});
