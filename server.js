const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const NodeCache = require('node-cache');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '/')));
app.use(express.json({ limit: '50mb' }));

// Cache
const responseCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// ========== OPENAI SETUP ==========
let openai = null;
try {
    const OpenAI = require('openai');
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI ChatGPT ready');
    } else {
        console.log('⚠️ No OPENAI_API_KEY, using fallback mode');
    }
} catch (e) {
    console.log('⚠️ OpenAI module not available');
}

// ========== KNOWLEDGE BASE ==========
const knowledgeBase = {
    'sao kim': {
        mass: '4.867 × 10^24 kg (0.815 khối lượng Trái Đất)',
        diameter: '12,104 km',
        temperature: '462°C',
        distance: '108.2 triệu km từ Mặt Trời',
        description: 'Sao Kim là hành tinh thứ hai từ Mặt Trời, có kích thước và cấu tạo tương tự Trái Đất.'
    },
    'sao hỏa': {
        mass: '6.39 × 10^23 kg (0.107 khối lượng Trái Đất)',
        diameter: '6,779 km',
        temperature: '-60°C',
        description: 'Sao Hỏa là hành tinh thứ tư từ Mặt Trời, được mệnh danh là "Hành tinh Đỏ".'
    },
    'trái đất': {
        mass: '5.97 × 10^24 kg',
        diameter: '12,742 km',
        description: 'Trái Đất là hành tinh thứ ba từ Mặt Trời, là nơi duy nhất có sự sống.'
    },
    'tuổi thọ': {
        vietnam: '73-75 tuổi',
        japan: '84-87 tuổi',
        world: '73-85 tuổi',
        description: 'Tuổi thọ trung bình của con người phụ thuộc vào nhiều yếu tố như dinh dưỡng, môi trường sống, y tế.'
    },
    'hồ chí minh': {
        birth: '1890',
        death: '1969',
        fullname: 'Nguyễn Sinh Cung - Nguyễn Tất Thành - Nguyễn Ái Quốc - Hồ Chí Minh',
        role: 'Lãnh tụ vĩ đại của dân tộc Việt Nam, người sáng lập Đảng Cộng sản Việt Nam',
        achievements: 'Lãnh đạo Cách mạng Tháng Tám thành công, đọc Tuyên ngôn Độc lập khai sinh nước Việt Nam Dân chủ Cộng hòa'
    },
    'ai': {
        description: 'Trí tuệ nhân tạo (AI) là lĩnh vực khoa học máy tính tạo ra máy móc thông minh có thể học hỏi và giải quyết vấn đề.'
    },
    'robot': {
        description: 'Robot là máy móc có thể lập trình để thực hiện các nhiệm vụ tự động, thường được điều khiển bằng máy tính.'
    }
};

function searchKnowledge(query) {
    const lower = query.toLowerCase();
    
    // Check for specific planets
    if (lower.includes('sao kim') || lower.includes('venus')) {
        const v = knowledgeBase['sao kim'];
        return `🌟 Sao Kim (Venus):\n• Khối lượng: ${v.mass}\n• Đường kính: ${v.diameter}\n• Nhiệt độ: ${v.temperature}\n• Khoảng cách: ${v.distance}\n${v.description}`;
    }
    
    if (lower.includes('sao hỏa') || lower.includes('mars')) {
        const m = knowledgeBase['sao hỏa'];
        return `🔴 Sao Hỏa (Mars):\n• Khối lượng: ${m.mass}\n• Đường kính: ${m.diameter}\n• Nhiệt độ: ${m.temperature}\n${m.description}`;
    }
    
    if (lower.includes('trái đất') || lower.includes('earth')) {
        const e = knowledgeBase['trái đất'];
        return `🌍 Trái Đất (Earth):\n• Khối lượng: ${e.mass}\n• Đường kính: ${e.diameter}\n${e.description}`;
    }
    
    if (lower.includes('tuổi thọ')) {
        const t = knowledgeBase['tuổi thọ'];
        return `📊 Thông tin về tuổi thọ:\n• Thế giới: ${t.world}\n• Việt Nam: ${t.vietnam}\n• Nhật Bản: ${t.japan}\n${t.description}`;
    }
    
    if (lower.includes('hồ chí minh') || lower.includes('bác hồ') || lower.includes('chủ tịch hồ')) {
        const h = knowledgeBase['hồ chí minh'];
        return `🇻🇳 Chủ tịch Hồ Chí Minh (${h.birth}-${h.death}):\n• Tên khai sinh: ${h.fullname}\n• Vai trò: ${h.role}\n• Thành tựu: ${h.achievements}`;
    }
    
    if (lower.includes('ai là') || (lower.includes('trí tuệ') && lower.includes('tạo'))) {
        return `🤖 Trí tuệ nhân tạo (AI): ${knowledgeBase['ai'].description}`;
    }
    
    if (lower.includes('robot')) {
        return `🤖 Robot: ${knowledgeBase['robot'].description}`;
    }
    
    return null;
}

// ========== CHATGPT WITH BETTER PROMPT ==========
async function callChatGPT(userMessage, history = []) {
    const cacheKey = userMessage.slice(0, 200);
    const cached = responseCache.get(cacheKey);
    if (cached) return cached;
    
    // Check knowledge base first
    const kbAnswer = searchKnowledge(userMessage);
    if (kbAnswer) return kbAnswer;
    
    if (!openai) {
        return `🤔 Mình chưa có thông tin về "${userMessage.slice(0, 50)}". Bạn có thể hỏi mình về:\n• Sao Kim, Sao Hỏa, Trái Đất\n• Tuổi thọ con người\n• Chủ tịch Hồ Chí Minh\n• AI và Robot`;
    }
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `Bạn là Chiri - trợ lý AI thông minh, thân thiện, dễ thương.
                    QUAN TRỌNG: 
                    - Trả lời MỌI câu hỏi chính xác dựa trên kiến thức của bạn
                    - Nếu được hỏi về khoa học, vũ trụ, toán học, lịch sử - hãy trả lời chính xác
                    - Trả lời NGẮN GỌN (2-4 câu)
                    - Bằng TIẾNG VIỆT
                    - Dùng icon cảm xúc phù hợp (🌟, 🚀, 😊, 💡)
                    - Nếu không biết, hãy nói "Mình chưa rõ, bạn thử hỏi điều khác nhé!"`
                },
                ...history.slice(-8),
                { role: 'user', content: userMessage }
            ],
            max_tokens: 300,
            temperature: 0.7,
        });
        
        const reply = completion.choices[0].message.content;
        responseCache.set(cacheKey, reply);
        return reply;
        
    } catch (error) {
        console.error('ChatGPT error:', error.message);
        const kbAnswer = searchKnowledge(userMessage);
        if (kbAnswer) return kbAnswer;
        return `🔧 Chiri đang gặp vấn đề kỹ thuật. Vui lòng thử lại sau!`;
    }
}

// ========== HIGH QUALITY TTS ==========
async function generateHighQualityTTS(text, lang = 'vi') {
    try {
        // Use Google Text-to-Speech (high quality, free)
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        
        const response = await axios({
            method: 'get',
            url: ttsUrl,
            responseType: 'stream',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        return response.data;
        
    } catch (error) {
        console.error('TTS error:', error.message);
        return null;
    }
}

// Detect language from text
function detectLanguage(text) {
    const vietnameseChars = /[àáảãạăâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i;
    const englishChars = /[a-zA-Z]/;
    
    if (vietnameseChars.test(text)) return 'vi';
    if (englishChars.test(text)) return 'en';
    return 'vi';
}

// TTS endpoint
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('Missing text');
    
    const lang = detectLanguage(text);
    console.log(`🔊 TTS: "${text.slice(0, 50)}..." (${lang})`);
    
    try {
        const audioStream = await generateHighQualityTTS(text, lang);
        if (audioStream) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            audioStream.pipe(res);
        } else {
            res.status(404).send('TTS unavailable');
        }
    } catch (error) {
        console.error('TTS endpoint error:', error);
        res.status(500).send('TTS error');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        chatGPT: !!openai,
        knowledgeBase: Object.keys(knowledgeBase).length
    });
});

// ========== WEBSOCKET HANDLER ==========
const processingQueue = new Map();
let conversationHistory = {};

async function processUserMessage(userText, driveMode, sessionId, ws) {
    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }
    
    const queue = processingQueue.get(sessionId);
    return await queue.then(async () => {
        try {
            console.log(`📝 [${sessionId}] Process: "${userText.slice(0, 50)}" | driveMode: ${driveMode}`);
            
            // Drive mode control
            if (driveMode === true) {
                const controlCommands = {
                    'tiến': '🚗 Xe đang tiến về phía trước!',
                    'lùi': '🚗 Xe đang lùi lại!',
                    'trái': '🚗 Xe đang rẽ trái!',
                    'phải': '🚗 Xe đang rẽ phải!',
                    'dừng': '🛑 Xe đã dừng lại!',
                    'forward': '🚗 Moving forward!',
                    'back': '🚗 Moving backward!',
                    'left': '🚗 Turning left!',
                    'right': '🚗 Turning right!',
                    'stop': '🛑 Stopped!'
                };
                
                for (const [cmd, reply] of Object.entries(controlCommands)) {
                    if (userText.toLowerCase().includes(cmd)) {
                        return reply;
                    }
                }
                return '🚫 Đang ở chế độ điều khiển xe. Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, hoặc DỪNG.';
            }
            
            // Countdown command
            const countdownMatch = userText.match(/(?:đếm ngược|countdown|hẹn giờ)\s*(\d+)\s*(giây|phút|s|m)/i);
            if (countdownMatch) {
                let seconds = parseInt(countdownMatch[1]);
                if (countdownMatch[2] === 'phút' || countdownMatch[2] === 'm') {
                    seconds *= 60;
                }
                if (seconds > 0 && seconds <= 3600) {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'countdown', 
                            seconds: seconds,
                            message: `⏰ Bắt đầu đếm ngược ${seconds} giây!`
                        }));
                    }
                    return `⏰ Đã bắt đầu đếm ngược ${seconds} giây!`;
                }
            }
            
            // Normal chat mode
            if (!conversationHistory[sessionId]) {
                conversationHistory[sessionId] = [];
            }
            
            conversationHistory[sessionId].push({ role: 'user', content: userText });
            const reply = await callChatGPT(userText, conversationHistory[sessionId]);
            conversationHistory[sessionId].push({ role: 'assistant', content: reply });
            
            // Limit history to prevent memory issues
            if (conversationHistory[sessionId].length > 20) {
                conversationHistory[sessionId] = conversationHistory[sessionId].slice(-20);
            }
            
            return reply;
            
        } catch (error) {
            console.error('Process error:', error);
            return 'Xin lỗi, Chiri gặp chút vấn đề. Vui lòng thử lại! 😊';
        }
    }).finally(() => {
        processingQueue.set(sessionId, Promise.resolve());
    });
}

wss.on('connection', (ws) => {
    const sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    console.log(`🔌 Client connected: ${sessionId}`);
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'voice') {
                const reply = await processUserMessage(data.text, data.driveMode, sessionId, ws);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ai', text: reply }));
                }
            }
            
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
            }
        } catch(e) {
            console.error('WebSocket error:', e.message);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Xử lý thất bại' }));
            }
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${sessionId}`);
        setTimeout(() => {
            delete conversationHistory[sessionId];
            processingQueue.delete(sessionId);
        }, 300000);
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║     🚀 CHIRI AI v5.0 - FULL FEATURE READY            ║
╠═══════════════════════════════════════════════════════╣
║  📍 Port: ${PORT}                                           
║  🤖 ChatGPT: ${openai ? 'READY ✅' : 'FALLBACK MODE ⚠️'}
║  🔊 High Quality TTS: READY ✅                        
║  🌍 Multi-language: VIETNAMESE & ENGLISH ✅          
║  📚 Knowledge Base: ${Object.keys(knowledgeBase).length} topics ✅
║  🚗 Drive Control: READY ✅                          
║  ⏰ Countdown Timer: READY ✅                        
║  🎤 Voice Recognition: READY ✅                      
╚═══════════════════════════════════════════════════════╝
    `);
});
