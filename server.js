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

// ========== CHATGPT FALLBACK ==========
function getFallbackReply(userMessage) {
    const lower = userMessage.toLowerCase();
    if (lower.includes('xin chào') || lower.includes('hello')) {
        return 'Xin chào bạn! Mình là CHIRI, rất vui được gặp bạn!';
    }
    if (lower.includes('tên')) {
        return 'Mình là CHIRI - trợ lý AI thông minh!';
    }
    if (lower.includes('cảm ơn')) {
        return 'Không có gì đâu ạ!';
    }
    if (lower.includes('khỏe')) {
        return 'Mình vẫn khỏe, cảm ơn bạn!';
    }
    return `Mình nghe bạn nói: "${userMessage}". Bạn có thể ra lệnh: tiến, lùi, trái, phải, dừng để điều khiển xe nhé!`;
}

// ========== GỌI CHATGPT ==========
async function callChatGPT(userMessage) {
    if (!openai || !process.env.OPENAI_API_KEY) {
        console.log('💬 Dùng fallback reply');
        return getFallbackReply(userMessage);
    }
    
    try {
        console.log(`🤖 Gọi ChatGPT: "${userMessage.substring(0, 50)}..."`);
        
        conversationHistory.push({ role: 'user', content: userMessage });
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }
        
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Bạn là CHIRI, robot trợ lý AI thân thiện. Trả lời ngắn gọn, dễ thương, tiếng Việt.' },
                ...conversationHistory
            ],
            max_tokens: 200,
            temperature: 0.8,
            timeout: 10000,
        });
        
        const reply = completion.choices[0].message.content;
        console.log(`💬 ChatGPT: "${reply.substring(0, 50)}..."`);
        
        conversationHistory.push({ role: 'assistant', content: reply });
        return reply;
        
    } catch (error) {
        console.error('❌ Lỗi ChatGPT:', error.message);
        return getFallbackReply(userMessage);
    }
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
                console.log(`🎤 Nhận từ WEB: "${userText}"`);
                
                const isCommand = isControlCommand(userText);
                let reply = '';
                let sentCommand = null;
                
                if (isCommand) {
                    sentCommand = getESP32Command(userText);
                    if (sentCommand) sendToESP32(sentCommand);
                    
                    const commandReplies = {
                        'FORWARD': '🚗 Xe đang tiến về phía trước!',
                        'BACKWARD': '🚗 Xe đang lùi lại!',
                        'LEFT': '🚗 Xe đang rẽ trái!',
                        'RIGHT': '🚗 Xe đang rẽ phải!',
                        'STOP': '🚗 Xe đã dừng lại!',
                        'SPEED_UP': '🚗 Đang tăng tốc độ!',
                        'SLOW_DOWN': '🚗 Đang giảm tốc độ!'
                    };
                    reply = commandReplies[sentCommand] || '🚗 Đã nhận lệnh điều khiển xe!';
                } else {
                    reply = await callChatGPT(userText);
                }
                
                ws.send(JSON.stringify({ type: 'ai', text: reply, isCommand: isCommand, command: sentCommand }));
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
