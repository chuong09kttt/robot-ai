// ========== WEBSOCKET SERVICE ==========
const WebSocket = require('ws');
const openaiService = require('./openai');
const translationService = require('./translation');
const { sendToESP32, esp32Clients } = require('../routes/drive');
const { 
    detectLanguage, 
    parseDriveCommand, 
    parseCountdownCommand, 
    getCurrentTime, 
    getCurrentDate,
    getSimpleReply
} = require('../utils/helpers');
const { FALLBACK_KNOWLEDGE, DRIVE_REPLIES } = require('../utils/constants');

// Game players storage
const gamePlayers = new Map();
const conversationHistory = new Map();
const processingQueue = new Map();

// ========== LANGUAGE DETECTION CẢI TIẾN ==========
function detectLanguageImproved(text) {
    if (!text || text.length === 0) return 'vi';
    
    // Biểu thức cho tiếng Việt
    const vietnameseChars = /[àáảãạâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i;
    
    // Nếu có ký tự tiếng Việt -> tiếng Việt
    if (vietnameseChars.test(text)) {
        return 'vi';
    }
    
    // Biểu thức cho tiếng Anh
    const englishPattern = /^[a-zA-Z0-9\s\.\,\?\!\'\"\(\)\-\:\;]+$/;
    if (englishPattern.test(text) && text.length > 2) {
        return 'en';
    }
    
    return 'vi';
}

// ========== FALLBACK KNOWLEDGE MỞ RỘNG ==========
const expandedKnowledge = {
    'vi': {
        'trái đất nặng bao nhiêu': 'Khối lượng của Trái Đất là khoảng 5.97 × 10^24 kg, tức 5.97 tỷ tỷ tấn! Đó là một con số khổng lồ! 🌍',
        'khối lượng trái đất': 'Trái Đất có khối lượng khoảng 5.97 × 10^24 kg. Nặng lắm đó bạn ạ!',
        'trái đất bao nhiêu tuổi': 'Trái Đất khoảng 4.54 tỷ năm tuổi, rất già rồi đấy!',
        'mặt trăng bao xa': 'Mặt Trăng cách Trái Đất khoảng 384,400 km, tương đương 30 lần đường kính Trái Đất! 🌙',
        'mặt trời bao xa': 'Mặt Trời cách Trái Đất khoảng 149.6 triệu km!',
        'vinfast': 'VinFast đang tái cấu trúc: Công ty Tương Lai mua lại 2 nhà máy. VinFast vẫn giữ thương hiệu và bảo hành. Dự kiến có lãi từ năm 2027.',
        'xin chào': 'Xin chào bạn! Mình là Chiri AI, rất vui được gặp bạn! 💕',
        'bạn khỏe không': 'Mình rất khỏe, cảm ơn bạn đã hỏi! Bạn có khỏe không ạ? 😊',
        'cảm ơn': 'Không có gì đâu ạ! Rất vui khi được giúp bạn! 💖',
        'tạm biệt': 'Tạm biệt bạn! Hẹn gặp lại nhé! 👋'
    },
    'en': {
        'how heavy is earth': 'The Earth has a mass of approximately 5.97 × 10^24 kg! That\'s huge! 🌍',
        'earth mass': 'Earth\'s mass is about 5.97 × 10^24 kilograms.',
        'how old is earth': 'Earth is approximately 4.54 billion years old!',
        'distance to moon': 'The Moon is about 384,400 km away from Earth! 🌙',
        'distance to sun': 'The Sun is about 149.6 million km away from Earth!',
        'hello': 'Hello! I am Chiri AI, nice to meet you! 💕',
        'how are you': 'I am doing great, thank you for asking! How about you? 😊',
        'thank you': 'You are very welcome! Happy to help you! 💖',
        'goodbye': 'Goodbye! See you later! 👋'
    }
};

function searchKnowledge(query, lang = 'vi') {
    const lower = query.toLowerCase().trim();
    const knowledge = expandedKnowledge[lang];
    
    for (const [keyword, answer] of Object.entries(knowledge)) {
        if (lower.includes(keyword)) {
            return answer;
        }
    }
    return null;
}

// Process user message
async function processUserMessage(userText, driveMode, sessionId, ws) {
    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }
    
    const queue = processingQueue.get(sessionId);
    return await queue.then(async () => {
        try {
            console.log(`🔍 Process: "${userText}" | driveMode: ${driveMode}`);
            
            // Phát hiện ngôn ngữ cải tiến
            const lang = detectLanguageImproved(userText);
            console.log(`🌐 Detected language: ${lang === 'en' ? 'ENGLISH' : 'VIETNAMESE'}`);
            
            const lower = userText.toLowerCase();
            
            // Lệnh bật/tắt phiên dịch
            if (lower.includes('bật phiên dịch') || lower.includes('bật dịch')) {
                return "🌐 Đã bật chế độ phiên dịch real-time! Vui lòng chọn ngôn ngữ trên màn hình.";
            }
            if (lower.includes('tắt phiên dịch') || lower.includes('tắt dịch')) {
                return "🌐 Đã tắt chế độ phiên dịch real-time.";
            }
            
            // Drive mode
            if (driveMode === true) {
                const command = parseDriveCommand(userText);
                if (command) {
                    sendToESP32(command, 0);
                    return DRIVE_REPLIES[command];
                }
                return lang === 'en' 
                    ? '🚫 Please say: FORWARD, BACK, LEFT, RIGHT, or STOP'
                    : '🚫 Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, hoặc DỪNG';
            }
            
            // Countdown
            const countdown = parseCountdownCommand(userText);
            if (countdown.isCountdown) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'countdown', seconds: countdown.seconds }));
                }
                return lang === 'en'
                    ? `⏰ Countdown started for ${countdown.seconds} seconds!`
                    : `⏰ Đã bắt đầu đếm ngược ${countdown.seconds} giây!`;
            }
            
            // THỜI GIAN THỰC
            if (lower.includes('mấy giờ') || lower.includes('current time') || lower.includes('time now')) {
                return getCurrentTime(lang);
            }
            if (lower.includes('hôm nay') || lower.includes('today') || lower.includes('what date')) {
                return getCurrentDate(lang);
            }
            
            // KIẾN THỨC CÓ SẴN
            const knowledgeAnswer = searchKnowledge(userText, lang);
            if (knowledgeAnswer) return knowledgeAnswer;
            
            // Chat mode
            if (!conversationHistory.has(sessionId)) {
                conversationHistory.set(sessionId, []);
            }
            
            const history = conversationHistory.get(sessionId);
            history.push({ role: 'user', content: userText });
            
            let reply;
            reply = await openaiService.chat(userText, history, sessionId, lang);
            
            history.push({ role: 'assistant', content: reply });
            
            // Limit history size
            if (history.length > 20) {
                conversationHistory.set(sessionId, history.slice(-20));
            }
            
            return reply;
            
        } catch (error) {
            console.error('Process error:', error);
            const lang = detectLanguageImproved(userText);
            return lang === 'en'
                ? 'Sorry, I encountered an error. Please try again! 😊'
                : 'Xin lỗi, Chiri gặp chút vấn đề. Vui lòng thử lại nhé! 😊';
        }
    }).finally(() => {
        processingQueue.set(sessionId, Promise.resolve());
    });
}

// Clear conversation history
function clearHistory(sessionId) {
    conversationHistory.delete(sessionId);
}

// Get conversation history
function getHistory(sessionId) {
    return conversationHistory.get(sessionId) || [];
}

// Setup WebSocket server
function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws, req) => {
        const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        console.log(`🔌 Client connected: ${clientId}`);
        
        const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
        if (isESP32) {
            esp32Clients.set(clientId, ws);
            console.log(`📱 ESP32 device connected: ${clientId}`);
        }
        
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30000);
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'voice') {
                    const reply = await processUserMessage(data.text, data.driveMode === true, clientId, ws);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ai', text: reply }));
                    }
                }
                
                if (data.type === 'drive_command') {
                    sendToESP32(data.command, data.duration || 0);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'drive_response', command: data.command }));
                    }
                }
                
                if (data.type === 'translate') {
                    const translated = await translationService.translateText(data.text, data.source, data.target);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'translation', translated }));
                    }
                }
                
                if (data.type === 'game_move') {
                    gamePlayers.set(clientId, {
                        x: data.x,
                        z: data.z,
                        rotation: data.rotation,
                        lastUpdate: Date.now()
                    });
                    
                    const playersList = {};
                    for (const [id, player] of gamePlayers) {
                        if (Date.now() - player.lastUpdate < 5000) {
                            playersList[id] = { x: player.x, z: player.z, rotation: player.rotation };
                        }
                    }
                    
                    for (const [id, client] of wss.clients) {
                        if (client.readyState === WebSocket.OPEN && gamePlayers.has(id)) {
                            client.send(JSON.stringify({ type: 'game_players', players: playersList }));
                        }
                    }
                }
                
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
                }
                
            } catch(e) {
                console.error('WebSocket error:', e.message);
            }
        });
        
        ws.on('close', () => {
            console.log(`🔌 Client disconnected: ${clientId}`);
            clearInterval(pingInterval);
            esp32Clients.delete(clientId);
            gamePlayers.delete(clientId);
            setTimeout(() => {
                conversationHistory.delete(clientId);
                processingQueue.delete(clientId);
            }, 300000);
        });
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'system', message: 'Connected to CHIRI AI server', clientId }));
        }
    });
    
    // Clean up stale game players
    setInterval(() => {
        const now = Date.now();
        for (const [id, player] of gamePlayers) {
            if (now - player.lastUpdate > 10000) {
                gamePlayers.delete(id);
            }
        }
    }, 5000);
    
    return wss;
}

module.exports = { setupWebSocket, processUserMessage, clearHistory, getHistory, gamePlayers };
