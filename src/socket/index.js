// ========== WEBSOCKET HANDLERS ==========
const WebSocket = require('ws');
const openaiService = require('../services/openai');
const translationService = require('../services/translation');
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
const ragService = require('../services/rag');

// Game players storage
const gamePlayers = new Map();
const conversationHistory = new Map();
const processingQueue = new Map();

// Process user message (có queue để tránh xung đột)
async function processUserMessage(userText, driveMode, sessionId, ws) {
    // Queue processing to avoid conflicts
    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }
    
    const queue = processingQueue.get(sessionId);
    return await queue.then(async () => {
        try {
            console.log(`🔍 Process: "${userText}" | driveMode: ${driveMode}`);
            const lang = detectLanguage(userText);
            const lower = userText.toLowerCase();
            
            // Translation commands
            if (lower.includes('bật phiên dịch') || lower.includes('bật dịch realtime')) {
                return "🌐 Đã bật chế độ phiên dịch real-time! Vui lòng chọn ngôn ngữ trên màn hình và bắt đầu nói.";
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
                    ? '🚫 Car control mode. Please say: FORWARD, BACK, LEFT, RIGHT, or STOP.'
                    : '🚫 Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, hoặc DỪNG';
            }
            
            // Countdown
            const countdown = parseCountdownCommand(userText);
            if (countdown.isCountdown) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                        type: 'countdown', 
                        seconds: countdown.seconds,
                        message: lang === 'en' 
                            ? `⏰ Countdown started for ${countdown.seconds} seconds!`
                            : `⏰ Đã bắt đầu đếm ngược ${countdown.seconds} giây!`
                    }));
                }
                return lang === 'en'
                    ? `⏰ Countdown started for ${countdown.seconds} seconds!`
                    : `⏰ Đã bắt đầu đếm ngược ${countdown.seconds} giây!`;
            }
            
            // Time and date
            if (lower.includes('what time') || lower.includes('current time') || lower.includes('time now') ||
                lower.includes('mấy giờ') || (lower.includes('giờ') && lower.includes('bao nhiêu'))) {
                return getCurrentTime(lang);
            }
            if (lower.includes('what date') || lower.includes('today') || lower.includes('what day') ||
                lower.includes('hôm nay') || lower.includes('ngày bao nhiêu') || lower.includes('ngày mấy')) {
                return getCurrentDate(lang);
            }
            
            // Fallback knowledge
            if (lower.includes('vinfast')) {
                if (lang === 'en') {
                    return 'VinFast is restructuring to optimize costs and reduce debt. They still keep the brand and warranty.';
                }
                return FALLBACK_KNOWLEDGE.vinfast;
            }
            if (lower.includes('son la') || (lower.includes('sơn') && lower.includes('la'))) {
                return lang === 'en' 
                    ? 'Son La province is not included in the proposed merger plan.'
                    : FALLBACK_KNOWLEDGE['son la'];
            }
            if (lower.includes('sap nhap') || lower.includes('sáp nhập') || (lower.includes('nhập') && lower.includes('tỉnh'))) {
                return lang === 'en'
                    ? '23 new provinces will be merged from the current 63 provinces.'
                    : FALLBACK_KNOWLEDGE['sap nhap tinh'];
            }
            
            // RAG search
            console.log('🔍 Searching in custom knowledge...');
            const searchResults = ragService.search(userText);
            
            let customContext = '';
            if (searchResults.length > 0) {
                console.log(`📖 Found ${searchResults.length} relevant results`);
                customContext = searchResults.map(r => r.content.slice(0, 300)).join('\n\n');
            }
            
            // Chat mode - LƯU HISTORY
            if (!conversationHistory.has(sessionId)) {
                conversationHistory.set(sessionId, []);
            }
            
            const history = conversationHistory.get(sessionId);
            history.push({ role: 'user', content: userText });
            
            // Gọi ChatGPT với context từ RAG
            let reply;
            if (customContext) {
                reply = await openaiService.chat(userText, history, sessionId, lang, customContext);
            } else {
                reply = await openaiService.chat(userText, history, sessionId, lang);
            }
            
            // Lưu câu trả lời vào history
            history.push({ role: 'assistant', content: reply });
            
            // Giới hạn history (chỉ giữ 20 tin nhắn gần nhất)
            if (history.length > 20) {
                conversationHistory.set(sessionId, history.slice(-20));
            }
            
            return reply;
            
        } catch (error) {
            console.error('Process error:', error);
            const lang = detectLanguage(userText);
            return lang === 'en'
                ? 'Sorry, Chiri is having a problem. Please try again! 😊'
                : 'Xin lỗi, Chiri gặp chút vấn đề. Vui lòng thử lại! 😊';
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
        
        // Check if ESP32
        const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
        if (isESP32) {
            esp32Clients.set(clientId, ws);
            console.log(`📱 ESP32 device connected: ${clientId}`);
        }
        
        // Ping interval to keep connection alive
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000);
        
        // Handle incoming messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                // Voice/Text message
                if (data.type === 'voice') {
                    const reply = await processUserMessage(data.text, data.driveMode === true, clientId, ws);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ai', text: reply }));
                    }
                }
                
                // Drive command
                if (data.type === 'drive_command') {
                    console.log(`🚗 Drive command: ${data.command}`);
                    sendToESP32(data.command, data.duration || 0);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'drive_response', 
                            command: data.command, 
                            status: 'executed' 
                        }));
                    }
                }
                
                // Translation
                if (data.type === 'translate') {
                    const translated = await translationService.translateText(data.text, data.source, data.target);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'translation', 
                            original: data.text, 
                            translated: translated 
                        }));
                    }
                }
                
                // Game multiplayer - player movement
                if (data.type === 'game_move') {
                    gamePlayers.set(clientId, {
                        x: data.x,
                        z: data.z,
                        rotation: data.rotation,
                        lastUpdate: Date.now()
                    });
                    
                    // Broadcast to all other players
                    const playersList = {};
                    for (const [id, player] of gamePlayers) {
                        if (Date.now() - player.lastUpdate < 5000) {
                            playersList[id] = { 
                                x: player.x, 
                                z: player.z, 
                                rotation: player.rotation 
                            };
                        }
                    }
                    
                    // Send to all connected clients
                    for (const [id, client] of wss.clients) {
                        if (client.readyState === WebSocket.OPEN && gamePlayers.has(id)) {
                            client.send(JSON.stringify({ 
                                type: 'game_players', 
                                players: playersList 
                            }));
                        }
                    }
                }
                
                // Game state request
                if (data.type === 'game_state') {
                    const playersList = {};
                    for (const [id, player] of gamePlayers) {
                        if (Date.now() - player.lastUpdate < 5000) {
                            playersList[id] = { 
                                x: player.x, 
                                z: player.z, 
                                rotation: player.rotation 
                            };
                        }
                    }
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'game_players', players: playersList }));
                    }
                }
                
                // Ping/Pong
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
                }
                
                // Echo (for testing)
                if (data.type === 'echo') {
                    ws.send(JSON.stringify({ type: 'echo', data: data.data }));
                }
                
            } catch(e) {
                console.error('WebSocket message error:', e.message);
                // Send error back to client
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
                }
            }
        });
        
        // Handle ping/pong
        ws.on('pong', () => {
            // Connection is alive - update heartbeat for ESP32
            if (isESP32) {
                // Heartbeat received, connection is alive
            }
        });
        
        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error.message);
        });
        
        // Handle disconnection
        ws.on('close', () => {
            console.log(`🔌 Client disconnected: ${clientId}`);
            clearInterval(pingInterval);
            
            // Remove from ESP32 clients
            if (esp32Clients.has(clientId)) {
                esp32Clients.delete(clientId);
                console.log(`📱 ESP32 device disconnected: ${clientId}`);
            }
            
            // Remove from game players
            gamePlayers.delete(clientId);
            
            // Clean up conversation history after delay (5 minutes)
            setTimeout(() => {
                conversationHistory.delete(clientId);
                processingQueue.delete(clientId);
            }, 300000);
        });
        
        // Send welcome message
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
                type: 'system', 
                message: 'Connected to CHIRI AI server',
                clientId: clientId,
                timestamp: Date.now()
            }));
        }
    });
    
    // Clean up stale game players periodically (every 5 seconds)
    setInterval(() => {
        const now = Date.now();
        for (const [id, player] of gamePlayers) {
            if (now - player.lastUpdate > 10000) { // 10 seconds timeout
                gamePlayers.delete(id);
            }
        }
    }, 5000);
    
    return wss;
}

// Get number of connected clients
function getConnectedClients() {
    let esp32Count = 0;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === WebSocket.OPEN) esp32Count++;
    }
    return { esp32: esp32Count, total: esp32Clients.size };
}

// Broadcast message to all clients
function broadcast(message, type = 'broadcast') {
    for (const [id, client] of esp32Clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, ...message }));
        }
    }
}

// Send message to specific client
function sendToClient(clientId, message) {
    const client = esp32Clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        return true;
    }
    return false;
}

module.exports = { 
    setupWebSocket,
    processUserMessage,
    clearHistory,
    getHistory,
    getConnectedClients,
    broadcast,
    sendToClient,
    gamePlayers
};
