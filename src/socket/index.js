// ========== WEBSOCKET HANDLERS ==========
const WebSocket = require('ws');
const openaiService = require('../services/openai');
const translationService = require('../services/translation');
const { sendToESP32, esp32Clients } = require('../routes/drive');
const { detectLanguage, parseDriveCommand, parseCountdownCommand, getCurrentTime, getCurrentDate } = require('../utils/helpers');
const { FALLBACK_KNOWLEDGE, DRIVE_REPLIES } = require('../utils/constants');
const ragService = require('../services/rag');

// Game players
const gamePlayers = new Map();

// Process user message
async function processUserMessage(userText, driveMode, sessionId, ws) {
    try {
        console.log(`🔍 Process: "${userText}" | driveMode: ${driveMode}`);
        const lang = detectLanguage(userText);
        const lower = userText.toLowerCase();
        
        // Translation commands
        if (lower.includes('bật phiên dịch')) {
            return "🌐 Đã bật chế độ phiên dịch real-time!";
        }
        if (lower.includes('tắt phiên dịch')) {
            return "🌐 Đã tắt chế độ phiên dịch real-time.";
        }
        
        // Drive mode
        if (driveMode === true) {
            const command = parseDriveCommand(userText);
            if (command) {
                sendToESP32(command, 0);
                return DRIVE_REPLIES[command];
            }
            return '🚫 Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, hoặc DỪNG';
        }
        
        // Countdown
        const countdown = parseCountdownCommand(userText);
        if (countdown.isCountdown) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'countdown', seconds: countdown.seconds }));
            }
            return `⏰ Đếm ngược ${countdown.seconds} giây!`;
        }
        
        // Time and date
        if (lower.includes('mấy giờ')) return getCurrentTime(lang);
        if (lower.includes('hôm nay')) return getCurrentDate(lang);
        
        // Fallback knowledge
        if (lower.includes('vinfast')) return FALLBACK_KNOWLEDGE.vinfast;
        if (lower.includes('son la')) return FALLBACK_KNOWLEDGE['son la'];
        if (lower.includes('sáp nhập')) return FALLBACK_KNOWLEDGE['sap nhap tinh'];
        
        // RAG search
        const searchResults = ragService.search(userText);
        let context = '';
        if (searchResults.length > 0) {
            context = searchResults.map(r => r.content.slice(0, 300)).join('\n');
        }
        
        // ChatGPT
        const reply = await openaiService.chat(userText, [], sessionId, lang);
        return reply;
        
    } catch (error) {
        console.error('Process error:', error);
        return 'Xin lỗi, Chiri gặp chút vấn đề. Vui lòng thử lại! 😊';
    }
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
        }
        
        // Ping interval
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
                    sendToESP32(data.command, data.duration);
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
        });
    });
    
    return wss;
}

module.exports = { setupWebSocket };
