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
        console.log('✅ OpenAI API Key đã được cấu hình - ChatGPT mode sẵn sàng');
    } else {
        console.log('⚠️ CHƯA CÓ OPENAI_API_KEY! Chat sẽ hoạt động giới hạn');
    }
} catch (err) {
    console.error('❌ Lỗi khởi tạo OpenAI:', err.message);
}

// ========== LƯU ESP32 CLIENTS ==========
const esp32Clients = new Map();
let conversationHistory = {};

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

// ========== NHẬN DIỆN LỆNH ĐIỀU KHIỂN XE ==========
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

// ========== HÀM GỌI CHATGPT API ==========
async function callChatGPT(userMessage, history = []) {
    if (!openai || !process.env.OPENAI_API_KEY) {
        console.log('⚠️ Không có ChatGPT API, dùng chế độ offline');
        return getOfflineReply(userMessage);
    }
    
    try {
        console.log(`🤖 Gọi ChatGPT cho câu hỏi: "${userMessage.substring(0, 50)}..."`);
        
        const systemPrompt = `Bạn là Chiri - một trợ lý AI thông minh, thân thiện, dễ thương. 
Nhiệm vụ của bạn:
- Trả lời MỌI câu hỏi của người dùng một cách chính xác, hữu ích và vui vẻ
- Giọng điệu: thân thiện, nhiệt tình, dùng cả icon cảm xúc (❤️, 😊, 🚀, v.v.)
- Nếu không biết câu trả lời, hãy thành thật nói "Mình chưa rõ lắm" và hướng dẫn người dùng tìm kiếm
- Trả lời bằng TIẾNG VIỆT
- Luôn giữ thái độ tích cực, sẵn sàng giúp đỡ`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                ...history.slice(-10),
                { role: 'user', content: userMessage }
            ],
            max_tokens: 500,
            temperature: 0.7,
        });
        
        const reply = completion.choices[0].message.content;
        console.log(`💬 ChatGPT trả lời: "${reply.substring(0, 80)}..."`);
        return reply;
        
    } catch (error) {
        console.error('❌ Lỗi gọi ChatGPT:', error.message);
        return `😅 Mình xin lỗi, hiện tại mình đang gặp chút vấn đề kết nối. ${getOfflineReply(userMessage)}`;
    }
}

function getOfflineReply(userMessage) {
    const lower = userMessage.toLowerCase();
    
    if (lower.includes('tuổi thọ') || lower.includes('sống bao lâu')) {
        return '👨‍👩‍👧‍👦 Tuổi thọ trung bình của con người hiện nay khoảng 73-85 tuổi. Ở Việt Nam là khoảng 73-75 tuổi. Người Nhật sống thọ nhất thế giới với 84-87 tuổi. Yếu tố ảnh hưởng: chế độ ăn, tập thể dục, gen di truyền và môi trường sống bạn nhé! 💚';
    }
    
    if (lower.includes('khỏe') || lower.includes('khoẻ')) {
        return 'Cảm ơn bạn đã quan tâm! Mình là trợ lý AI nên không có sức khỏe để lo, nhưng mình luôn sẵn sàng giúp đỡ bạn. Bạn có khỏe không? 😊';
    }
    
    if (lower.includes('xin chào') || lower.includes('hello')) {
        return 'Xin chào bạn! Mình là Chiri, rất vui được trò chuyện với bạn. Bạn có thể hỏi mình bất cứ điều gì nhé! 💕';
    }
    
    return `🤔 Mình hiểu bạn hỏi về "${userMessage}". Bạn có thể kết nối ChatGPT API để mình trả lời thông minh hơn nhé! Hiện tại mình đang ở chế độ cơ bản.`;
}

// ========== XỬ LÝ CHAT CHÍNH ==========
async function processUserMessage(userText, driveMode, sessionId) {
    console.log(`🔍 [${sessionId}] Xử lý: "${userText}" | driveMode = ${driveMode}`);
    
    if (driveMode === true) {
        if (isControlCommand(userText)) {
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
        return `🚫 Mình đang ở chế độ điều khiển xe. Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, DỪNG. Hoặc nhấn "TẮT CHẾ ĐỘ XE" để trò chuyện tự do nhé!`;
    }
    
    if (!conversationHistory[sessionId]) {
        conversationHistory[sessionId] = [];
    }
    
    conversationHistory[sessionId].push({ role: 'user', content: userText });
    let aiReply = await callChatGPT(userText, conversationHistory[sessionId]);
    conversationHistory[sessionId].push({ role: 'assistant', content: aiReply });
    
    if (conversationHistory[sessionId].length > 20) {
        conversationHistory[sessionId] = conversationHistory[sessionId].slice(-20);
    }
    
    return aiReply;
}

// ========== TTS ENDPOINT ==========
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) {
        return res.status(400).send('Missing text');
    }
    
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
    
    res.status(404).send('TTS not available');
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        esp32Clients: esp32Clients.size,
        chatGPTReady: !!(openai && process.env.OPENAI_API_KEY)
    });
});

// ========== WEBSOCKET ==========
wss.on('connection', (ws, req) => {
    const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    let sessionId = clientId;
    
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
                console.log(`🎤 [${sessionId.substring(0,8)}] Nhận: "${userText}" | driveMode=${driveMode}`);
                
                const reply = await processUserMessage(userText, driveMode, sessionId);
                console.log(`💬 [${sessionId.substring(0,8)}] Trả lời: "${reply.substring(0, 80)}..."`);
                
                ws.send(JSON.stringify({ type: 'ai', text: reply }));
            }
            
            if (data.type === 'clear_history') {
                delete conversationHistory[sessionId];
                ws.send(JSON.stringify({ type: 'system', message: '🗑️ Đã xóa lịch sử hội thoại!' }));
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
        setTimeout(() => {
            delete conversationHistory[sessionId];
        }, 300000);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CHIRI AI 2.0 - SMART MODE`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`🎤 Chế độ trò chuyện: ${openai && process.env.OPENAI_API_KEY ? 'CHATGPT THÔNG MINH ✅' : 'OFFLINE CƠ BẢN ⚠️'}`);
    console.log(`🚗 Chế độ điều khiển xe: sẵn sàng\n`);
});
