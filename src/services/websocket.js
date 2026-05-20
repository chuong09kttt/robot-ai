// ========== WEBSOCKET SERVICE ==========
const WebSocket = require('ws');
const openaiService = require('./openai');
const translationService = require('./translation');
const ragService = require('./rag');
const { sendToESP32, esp32Clients } = require('../routes/drive');
const { 
    detectLanguage, 
    parseDriveCommand, 
    parseCountdownCommand, 
    getCurrentTime, 
    getCurrentDate,
    getSimpleReply
} = require('../utils/helpers');
const { DRIVE_REPLIES } = require('../utils/constants');

// Game players storage
const gamePlayers = new Map();
const conversationHistory = new Map();
const processingQueue = new Map();

// Tạo Map để lưu tất cả WebSocket clients (bao gồm cả browser và ESP32)
const wsClients = new Map();
// KHÔNG khai báo esp32Clients ở đây vì đã import từ drive.js

// ========== TỪ KHÓA NỘI BỘ (cần tra RAG) ==========
const INTERNAL_KEYWORDS = [
    'vinfast',
    'vard',
    'sáp nhập tỉnh',
    'nội bộ',
    'quy trình',
    'tài liệu công ty',
    'quy định công ty',
    'vũng tàu'
];

// ========== LANGUAGE DETECTION ==========
function detectLanguageImproved(text) {
    if (!text) return 'vi';
    const viChars = /[àáảãạăâêôơưđ]/i;
    if (viChars.test(text)) return 'vi';
    const englishWords = /\b(what|where|when|why|how|hello|hi|thanks|please|current|date|time)\b/ix;
    if (englishWords.test(text)) return 'en';
    return 'vi';
}

// ========== KIỂM TRA CÓ CẦN TRA RAG KHÔNG ==========
function shouldUseRAG(query) {
    const lower = query.toLowerCase();
    for (const keyword of INTERNAL_KEYWORDS) {
        if (lower.includes(keyword)) return true;
    }
    if (lower.includes('theo tài liệu') || lower.includes('trong file') || 
        lower.includes('tài liệu nói') || lower.includes('theo văn bản')) return true;
    return false;
}

// ========== TÌM KIẾM TRONG KNOWLEDGE BASE ==========
async function searchKnowledgeBase(query, lang) {
    try {
        console.log('🔍 Searching in knowledge base...');
        const searchResults = ragService.search(query);
        if (searchResults && searchResults.length > 0) {
            console.log(`📖 Found ${searchResults.length} relevant results`);
            const contexts = searchResults.map(r => r.content).slice(0, 2);
            let context = contexts.join('\n\n---\n\n');
            context = context.slice(0, 1500);
            return { found: true, context, sources: searchResults.map(r => r.source) };
        }
        return { found: false, context: null, sources: [] };
    } catch (error) {
        console.error('RAG search error:', error);
        return { found: false, context: null, sources: [] };
    }
}

// ========== TẠO CÂU TRẢ LỜI TỪ RAG + CHATGPT ==========
async function generateAnswerWithRAG(userText, context, sources, lang) {
    const contextPrompt = lang === 'en' 
        ? `Based on the following reference information, please answer the user's question accurately and concisely.\n\nReference information:\n${context}\n\nUser question: ${userText}\n\nAnswer:`
        : `Dựa trên thông tin tham khảo sau đây, hãy trả lời câu hỏi của người dùng một cách chính xác và ngắn gọn.\n\nThông tin tham khảo:\n${context}\n\nCâu hỏi: ${userText}\n\nTrả lời:`;
    try {
        const reply = await openaiService.chat(contextPrompt, [], `rag_${Date.now()}`, lang);
        const sourceText = sources.length > 0 ? `\n\n📌 *Nguồn: ${sources.slice(0, 2).join(', ')}*` : '';
        return reply + sourceText;
    } catch (error) {
        return `📖 **Thông tin tham khảo:**\n\n${context.slice(0, 800)}${context.length > 800 ? '...' : ''}\n\n📌 *Nguồn: ${sources.join(', ')}*`;
    }
}

// ========== XỬ LÝ CÂU HỎI THƯỜNG (CHATGPT) ==========
async function handleGeneralQuestion(userText, sessionId, lang) {
    if (!conversationHistory.has(sessionId)) conversationHistory.set(sessionId, []);
    const history = conversationHistory.get(sessionId);
    history.push({ role: 'user', content: userText });
    const shortHistory = history.slice(-6);
    console.log('🧠 History:', shortHistory);
    // Gọi chat với language detection tự động
    let reply = await openaiService.chat(userText, shortHistory, sessionId, lang);
    // Thêm log để debug
    console.log(`🤖 AI Response (${lang}): ${reply?.slice(0, 100)}`);
    
    if (!reply || reply.includes('having a problem') || reply.includes('gặp vấn đề')) {
        reply = getSimpleReply(userText, lang);
    }
    history.push({ role: 'assistant', content: reply });
    if (history.length > 20) conversationHistory.set(sessionId, history.slice(-20));
    return reply;
}


// ========== PHÁT HIỆN NGÔN NGỮ THỐNG NHẤT ==========
function detectLanguageUnified(text) {
    if (!text) return 'vi';
    const viChars = /[àáảãạăâêôơưđ]/i;
    if (viChars.test(text)) return 'vi';
    const englishWords = /\b(what|where|when|why|how|hello|hi|thanks|please|current|date|time|yes|no|ok|good|bad|love|hate|like|dislike|help|support)\b/ix;
    if (englishWords.test(text)) return 'en';
    return 'vi';
}



// ========== GỬI THÔNG BÁO GIỌNG NÓI ==========
function sendVoiceAlertToAll(text, lang = 'vi') {
    const message = JSON.stringify({ type: 'voice_alert', text, lang });
    for (const [id, client] of wsClients) {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    }
    console.log(`🔊 Voice alert to all: "${text}"`);
}

function sendVoiceAlertToClient(clientId, text, lang = 'vi') {
    const client = wsClients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'voice_alert', text, lang }));
        console.log(`🔊 Voice alert to ${clientId}: "${text}"`);
    }
}

// ========== PROCESS USER MESSAGE (CHÍNH) ==========
async function processUserMessage(userText, driveMode, sessionId, ws) {
    if (!processingQueue.has(sessionId)) processingQueue.set(sessionId, Promise.resolve());
    const queue = processingQueue.get(sessionId);
    return await queue.then(async () => {
        try {
            console.log(`🔍 Process: "${userText}" | driveMode: ${driveMode}`);
            const lang = detectLanguageImproved(userText);
            console.log(`🌐 Detected language: ${lang === 'en' ? 'ENGLISH' : 'VIETNAMESE'}`);
            const lower = userText.toLowerCase();
            
            console.log({ question: userText, lang, driveMode, useRAG: shouldUseRAG(userText) });
            
            if (lower.includes('bật phiên dịch') || lower.includes('bật dịch')) {
                return "🌐 Đã bật chế độ phiên dịch real-time! Vui lòng chọn ngôn ngữ trên màn hình.";
            }
            if (lower.includes('tắt phiên dịch') || lower.includes('tắt dịch')) {
                return "🌐 Đã tắt chế độ phiên dịch real-time.";
            }
            
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
            
            const countdown = parseCountdownCommand(userText);
            if (countdown.isCountdown) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'countdown', seconds: countdown.seconds }));
                }
                return lang === 'en'
                    ? `⏰ Countdown started for ${countdown.seconds} seconds!`
                    : `⏰ Đã bắt đầu đếm ngược ${countdown.seconds} giây!`;
            }
            
            if (lower.includes('mấy giờ') || lower.includes('current time') || lower.includes('time now')) {
                return getCurrentTime(lang);
            }
            if (lower.includes('hôm nay') || lower.includes('today') || lower.includes('what date')) {
                return getCurrentDate(lang);
            }
            
            if (shouldUseRAG(userText)) {
                console.log('📚 This question may need internal knowledge, searching RAG...');
                const ragResult = await searchKnowledgeBase(userText, lang);
                if (ragResult.found) {
                    console.log('✅ Found relevant information in knowledge base');
                    const answer = await generateAnswerWithRAG(userText, ragResult.context, ragResult.sources, lang);
                    return answer;
                } else {
                    console.log('⚠️ No relevant information found in knowledge base, using ChatGPT');
                }
            }
            
            return await handleGeneralQuestion(userText, sessionId, lang);
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

function clearHistory(sessionId) { conversationHistory.delete(sessionId); }
function getHistory(sessionId) { return conversationHistory.get(sessionId) || []; }

// Setup WebSocket server
function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws, req) => {
        const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        console.log(`🔌 Client connected: ${clientId}`);
        wsClients.set(clientId, ws);
        
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
                    gamePlayers.set(clientId, { x: data.x, z: data.z, rotation: data.rotation, lastUpdate: Date.now() });
                    const playersList = {};
                    for (const [id, player] of gamePlayers) {
                        if (Date.now() - player.lastUpdate < 5000) {
                            playersList[id] = { x: player.x, z: player.z, rotation: player.rotation };
                        }
                    }
                    for (const client of wss.clients) {
                        if (client.readyState === WebSocket.OPEN) {
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
            wsClients.delete(clientId);
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
    
    setInterval(() => {
        const now = Date.now();
        for (const [id, player] of gamePlayers) {
            if (now - player.lastUpdate > 10000) gamePlayers.delete(id);
        }
    }, 5000);
    
    return wss;
}

module.exports = { 
    setupWebSocket, 
    processUserMessage, 
    clearHistory, 
    getHistory, 
    gamePlayers,
    wsClients,
    esp32Clients,
    sendVoiceAlertToAll,
    sendVoiceAlertToClient
};
