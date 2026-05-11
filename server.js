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
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
    console.error('❌ LỖI: OPENAI_API_KEY chưa được set trong Railway Environment!');
} else {
    console.log('✅ OpenAI API Key đã được cấu hình');
}

// ========== LƯU ESP32 CLIENTS ==========
const esp32Clients = new Map();

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

// ========== NHẬN DIỆN LỆNH ĐIỀU KHIỂN ==========
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

// ========== GỌI CHATGPT ==========
let conversationHistory = [];

async function callChatGPT(userMessage) {
    if (!process.env.OPENAI_API_KEY) {
        return 'Xin lỗi, API key chưa được cấu hình. Vui lòng liên hệ quản trị viên.';
    }
    
    try {
        console.log(`🤖 Gọi ChatGPT: "${userMessage.substring(0, 50)}..."`);
        
        conversationHistory.push({ role: 'user', content: userMessage });
        
        if (conversationHistory.length > 30) {
            conversationHistory = conversationHistory.slice(-30);
        }
        
        const systemPrompt = `Bạn là CHIRI, một robot trợ lý AI thông minh, thân thiện, vui tính và dễ thương.
Bạn có thể trò chuyện về mọi chủ đề, trả lời câu hỏi, kể chuyện, giúp đỡ người dùng.
Bạn cũng có thể điều khiển một chiếc xe robot khi người dùng ra lệnh như "tiến", "lùi", "trái", "phải", "dừng".
Hãy trả lời ngắn gọn, tự nhiên, dễ thương, dùng tiếng Việt, xưng hô "mình - bạn".`;
        
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];
        
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        
        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            max_tokens: 300,
            temperature: 0.8,
        });
        
        const reply = completion.choices[0].message.content;
        console.log(`💬 ChatGPT: "${reply.substring(0, 50)}..."`);
        
        conversationHistory.push({ role: 'assistant', content: reply });
        
        return reply;
        
    } catch (error) {
        console.error('❌ Lỗi ChatGPT:', error);
        return 'Xin lỗi, CHIRI đang gặp chút vấn đề. Bạn vui lòng thử lại sau nhé!';
    }
}

// ========== TEXT TO SPEECH ==========
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) {
        return res.status(400).send('Missing text');
    }
    
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).send('API Key not configured');
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
        console.error('TTS error:', error);
        res.status(500).send('TTS error');
    }
});

// ========== WEBSOCKET ==========
wss.on('connection', (ws, req) => {
    const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    
    console.log(`🔌 ${isESP32 ? 'ESP32' : 'WEB'} client ${clientId} kết nối`);
    
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
                    if (sentCommand) {
                        sendToESP32(sentCommand);
                    }
                    
                    switch(sentCommand) {
                        case 'FORWARD': reply = '🚗 Xe đang tiến về phía trước!'; break;
                        case 'BACKWARD': reply = '🚗 Xe đang lùi lại!'; break;
                        case 'LEFT': reply = '🚗 Xe đang rẽ trái!'; break;
                        case 'RIGHT': reply = '🚗 Xe đang rẽ phải!'; break;
                        case 'STOP': reply = '🚗 Xe đã dừng lại!'; break;
                        case 'SPEED_UP': reply = '🚗 Đang tăng tốc độ!'; break;
                        case 'SLOW_DOWN': reply = '🚗 Đang giảm tốc độ!'; break;
                        default: reply = '🚗 Đã nhận lệnh điều khiển xe!';
                    }
                } else {
                    reply = await callChatGPT(userText);
                }
                
                ws.send(JSON.stringify({
                    type: 'ai',
                    text: reply,
                    isCommand: isCommand,
                    command: sentCommand
                }));
            }
            
            if (data.type === 'esp32_status') {
                console.log(`📡 ESP32 báo: ${data.status}`);
            }
            
        } catch(e) {
            console.error('Lỗi:', e);
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 Client ${clientId} ngắt kết nối`);
        if (esp32Clients.has(clientId)) {
            esp32Clients.delete(clientId);
        }
    });
});

// ========== KHỞI ĐỘNG ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 CHIRI AI Robot đang chạy tại cổng ${PORT}`);
    console.log(`🤖 ChatGPT Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    console.log(`📊 ESP32 clients: ${esp32Clients.size}`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.log('\n⚠️ CẢNH BÁO: OPENAI_API_KEY chưa được cấu hình!');
        console.log('💡 Vào Railway Dashboard → Variables → Thêm OPENAI_API_KEY\n');
    }
});
