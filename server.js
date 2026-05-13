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

// ========== ENHANCED KNOWLEDGE BASE ==========
const knowledgeBase = {
    'sao kim': {
        mass: '4.867 × 10^24 kg (0.815 khối lượng Trái Đất)',
        diameter: '12,104 km',
        temperature: '462°C',
        distance: '108.2 triệu km từ Mặt Trời',
        description: 'Sao Kim là hành tinh thứ hai từ Mặt Trời.'
    },
    'sao hỏa': {
        mass: '6.39 × 10^23 kg (0.107 khối lượng Trái Đất)',
        diameter: '6,779 km',
        temperature: '-60°C',
        distanceFromEarth: 'Khoảng cách từ Trái Đất đến Sao Hỏa thay đổi từ 54.6 triệu km đến 401 triệu km, trung bình khoảng 225 triệu km',
        description: 'Sao Hỏa là hành tinh thứ tư từ Mặt Trời, được mệnh danh là "Hành tinh Đỏ".'
    },
    'hai bà trưng': {
        year: '40-43 sau Công nguyên',
        description: 'Khởi nghĩa Hai Bà Trưng do Trưng Trắc và Trưng Nhị lãnh đạo, diễn ra vào năm 40-43 sau Công nguyên.'
    },
    'võ nguyên giáp': {
        birthday: '25 tháng 8 năm 1911',
        death: '4 tháng 10 năm 2013',
        description: 'Đại tướng Võ Nguyên Giáp (1911-2013) là Tổng Tư lệnh Quân đội Nhân dân Việt Nam.'
    },
    'tuổi thọ': {
        vietnam: '73-75 tuổi',
        japan: '84-87 tuổi',
        world: '73-85 tuổi'
    },
    'hồ chí minh': {
        birth: '1890',
        death: '1969',
        role: 'Lãnh tụ vĩ đại của dân tộc Việt Nam'
    }
};

function searchKnowledge(query) {
    const lower = query.toLowerCase();
    
    if (lower.includes('khoảng cách') && (lower.includes('sao hỏa') || lower.includes('sao hoà') || lower.includes('mars'))) {
        return `📏 Khoảng cách từ Trái Đất đến Sao Hỏa: ${knowledgeBase['sao hỏa'].distanceFromEarth}`;
    }
    
    if (lower.includes('sao hỏa') || lower.includes('sao hoà') || lower.includes('mars')) {
        const m = knowledgeBase['sao hỏa'];
        return `🔴 Sao Hỏa (Mars):\n• Khối lượng: ${m.mass}\n• Đường kính: ${m.diameter}\n• Nhiệt độ: ${m.temperature}\n• ${m.distanceFromEarth}\n${m.description}`;
    }
    
    if (lower.includes('sao kim') || lower.includes('venus')) {
        const v = knowledgeBase['sao kim'];
        return `🌟 Sao Kim (Venus):\n• Khối lượng: ${v.mass}\n• Đường kính: ${v.diameter}\n• Nhiệt độ: ${v.temperature}\n• Khoảng cách: ${v.distance}\n${v.description}`;
    }
    
    if (lower.includes('hai bà trưng')) {
        return `📜 Khởi nghĩa Hai Bà Trưng xảy ra vào năm ${knowledgeBase['hai bà trưng'].year}. ${knowledgeBase['hai bà trưng'].description}`;
    }
    
    if (lower.includes('võ nguyên giáp') || lower.includes('võ nguyễn giáp')) {
        const v = knowledgeBase['võ nguyên giáp'];
        return `🎖️ Đại tướng Võ Nguyên Giáp sinh ngày ${v.birthday}, mất ngày ${v.death}. ${v.description}`;
    }
    
    if (lower.includes('tuổi thọ')) {
        const t = knowledgeBase['tuổi thọ'];
        return `📊 Tuổi thọ trung bình: Thế giới ${t.world}, Việt Nam ${t.vietnam}, Nhật Bản ${t.japan}.`;
    }
    
    if (lower.includes('hồ chí minh') || lower.includes('bác hồ')) {
        const h = knowledgeBase['hồ chí minh'];
        return `🇻🇳 Chủ tịch Hồ Chí Minh (${h.birth}-${h.death}) là ${h.role}.`;
    }
    
    return null;
}

// ========== REAL-TIME FUNCTIONS ==========
function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    let period = '';
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    
    if (hours < 12) period = 'sáng';
    else if (hours < 18) period = 'chiều';
    else period = 'tối';
    
    return `Bây giờ là ${hour12} giờ ${minutes} phút ${seconds} giây ${period}. (${hours}:${minutes.toString().padStart(2, '0')})`;
}

function getCurrentDate() {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const weekday = weekdays[now.getDay()];
    
    return `Hôm nay là ${weekday}, ngày ${day} tháng ${month} năm ${year}.`;
}

// ========== CHATGPT ==========
async function callChatGPT(userMessage, history = []) {
    // Check knowledge base first
    const kbAnswer = searchKnowledge(userMessage);
    if (kbAnswer) return kbAnswer;
    
    // Check real-time questions
    const lower = userMessage.toLowerCase();
    if (lower.includes('mấy giờ') || lower.includes('hiện tại') || (lower.includes('giờ') && lower.includes('bao nhiêu'))) {
        return getCurrentTime();
    }
    
    if (lower.includes('hôm nay') || lower.includes('ngày bao nhiêu') || lower.includes('ngày mấy')) {
        return getCurrentDate();
    }
    
    if (!openai) {
        return `🤔 Mình chưa có thông tin về "${userMessage.slice(0, 50)}". Bạn có thể hỏi mình về:\n• Sao Kim, Sao Hỏa, Trái Đất\n• Khoảng cách các hành tinh\n• Tuổi thọ con người\n• Lịch sử Việt Nam`;
    }
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `Bạn là Chiri - trợ lý AI thông minh, thân thiện.
                    QUAN TRỌNG: 
                    - Trả lời ĐÚNG trọng tâm câu hỏi
                    - Nếu hỏi khoảng cách, trả lời khoảng cách
                    - Nếu hỏi thời gian, trả lời thời gian thực
                    - Trả lời NGẮN GỌN (2-3 câu)
                    - Bằng TIẾNG VIỆT`
                },
                ...history.slice(-8),
                { role: 'user', content: userMessage }
            ],
            max_tokens: 300,
            temperature: 0.7,
        });
        
        return completion.choices[0].message.content;
        
    } catch (error) {
        console.error('ChatGPT error:', error.message);
        const kbAnswer = searchKnowledge(userMessage);
        if (kbAnswer) return kbAnswer;
        return `🔧 Chiri đang gặp vấn đề. Vui lòng thử lại sau!`;
    }
}

// ========== HIGH QUALITY TTS ==========
async function generateHighQualityTTS(text, lang = 'vi') {
    try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
        
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

function detectLanguage(text) {
    const vietnameseChars = /[àáảãạăâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i;
    if (vietnameseChars.test(text)) return 'vi';
    return 'en';
}

app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('Missing text');
    
    const lang = detectLanguage(text);
    
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

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        chatGPT: !!openai
    });
});

// ========== WEBSOCKET HANDLER ==========
const processingQueue = new Map();
let conversationHistory = {};

// Drive command mapping - CHỈ NHẬN 1 LỆNH DUY NHẤT
function getDriveCommand(text) {
    const lower = text.toLowerCase().trim();
    
    // Remove noise words
    const cleanText = lower.replace(/đang|ơi|ạ|mình|hãy|làm ơn/g, '');
    
    // Check each command
    if (cleanText.includes('tiến') || cleanText === 'đi' || cleanText.includes('forward')) {
        return 'FORWARD';
    }
    if (cleanText.includes('lùi') || cleanText.includes('back')) {
        return 'BACKWARD';
    }
    if (cleanText.includes('trái') || cleanText.includes('left')) {
        return 'LEFT';
    }
    if (cleanText.includes('phải') || cleanText.includes('right')) {
        return 'RIGHT';
    }
    if (cleanText.includes('dừng') || cleanText.includes('stop')) {
        return 'STOP';
    }
    return null;
}

async function processUserMessage(userText, driveMode, sessionId, ws) {
    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }
    
    const queue = processingQueue.get(sessionId);
    return await queue.then(async () => {
        try {
            console.log(`📝 [${sessionId}] Process: "${userText}" | driveMode: ${driveMode}`);
            
            // DRIVE MODE - Only process drive commands
            if (driveMode === true) {
                const command = getDriveCommand(userText);
                
                if (command) {
                    const replies = {
                        'FORWARD': '🚗 Xe tiến lên!',
                        'BACKWARD': '🚗 Xe lùi lại!',
                        'LEFT': '🚗 Xe rẽ trái!',
                        'RIGHT': '🚗 Xe rẽ phải!',
                        'STOP': '🛑 Xe dừng lại!'
                    };
                    return replies[command];
                } else {
                    return '🚫 Chế độ điều khiển xe. Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, hoặc DỪNG.';
                }
            }
            
            // COUNTDOWN COMMAND
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
                            message: `⏰ Đã bắt đầu đếm ngược ${seconds} giây!`
                        }));
                    }
                    return `⏰ Đã bắt đầu đếm ngược ${seconds} giây!`;
                }
            }
            
            // Check knowledge base first
            const kbAnswer = searchKnowledge(userText);
            if (kbAnswer) return kbAnswer;
            
            // Real-time questions
            const lower = userText.toLowerCase();
            if (lower.includes('mấy giờ') || lower.includes('giờ') && lower.includes('bao nhiêu')) {
                return getCurrentTime();
            }
            if (lower.includes('hôm nay') || lower.includes('ngày bao nhiêu')) {
                return getCurrentDate();
            }
            
            // ChatGPT mode
            if (!conversationHistory[sessionId]) {
                conversationHistory[sessionId] = [];
            }
            
            conversationHistory[sessionId].push({ role: 'user', content: userText });
            const reply = await callChatGPT(userText, conversationHistory[sessionId]);
            conversationHistory[sessionId].push({ role: 'assistant', content: reply });
            
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
        } catch(e) {
            console.error('WebSocket error:', e.message);
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

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║     🚀 CHIRI AI v5.0 - FULLY FIXED                   ║
╠═══════════════════════════════════════════════════════╣
║  📍 Port: ${PORT}                                           
║  🤖 ChatGPT: ${openai ? 'READY ✅' : 'FALLBACK ⚠️'}
║  🔊 TTS: READY ✅                                     
║  🚗 Drive Control: FIXED ✅ (Single command)         
║  ⏰ Countdown: READY ✅                              
║  📅 Real-time: READY ✅                              
║  💤 Auto-sleep: 60s ✅                               
╚═══════════════════════════════════════════════════════╝
    `);
});
