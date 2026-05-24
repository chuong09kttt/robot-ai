// ========== WEBSOCKET SERVICE (PRO AI + IOT UPGRADE) ==========
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

// ===================== STATE =====================
const gamePlayers = new Map();
const conversationHistory = new Map();
const processingQueue = new Map();
const wsClients = new Map();

// ===================== INTERNAL KNOWLEDGE =====================
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

// ===================== LANGUAGE =====================
function detectLanguageUnified(text) {
    if (!text) return 'vi';
    const viChars = /[àáảãạăâêôơưđ]/i;
    if (viChars.test(text)) return 'vi';

    const enWords = /\b(what|where|when|why|how|hello|hi|thanks|please|time|date|today|now|help)\b/ix;
    if (enWords.test(text)) return 'en';

    return 'vi';
}

// ===================== RAG CHECK =====================
function shouldUseRAG(query) {
    const lower = query.toLowerCase();

    return INTERNAL_KEYWORDS.some(k => lower.includes(k)) ||
        lower.includes('tài liệu') ||
        lower.includes('theo file') ||
        lower.includes('theo văn bản');
}

// ===================== RAG SEARCH =====================
async function searchKnowledgeBase(query, lang) {
    try {
        const results = ragService.search(query);

        if (results?.length > 0) {
            const context = results.slice(0, 2).map(r => r.content).join('\n---\n').slice(0, 1500);

            return {
                found: true,
                context,
                sources: results.map(r => r.source)
            };
        }

        return { found: false };
    } catch (err) {
        return { found: false };
    }
}

// ===================== AI BRAIN (NEW CORE) =====================
async function aiBrain(userText, lang) {
    const prompt = `
You are CHIRI AI - a smart assistant with 3 abilities:

1. CHAT MODE (normal conversation)
2. ENGLISH TEACHER MODE (correct grammar, explain)
3. IOT CONTROL MODE (generate ESP32 commands)

RULES:
- If user asks to control device → return JSON command
- If user chat → normal response
- If English wrong → correct it
- ALWAYS RETURN JSON ONLY

FORMAT:
{
  "mode": "chat | english | iot",
  "message": "",
  "commands": [
    {
      "device": "fan_1",
      "action": "on/off/set",
      "value": 0
    }
  ]
}

USER: ${userText}
`;

    const res = await openaiService.chat(prompt, [], 'brain');

    try {
        return JSON.parse(res);
    } catch (e) {
        return {
            mode: "chat",
            message: res,
            commands: []
        };
    }
}

// ===================== GENERAL CHAT =====================
async function handleGeneralQuestion(userText, sessionId, lang) {
    if (!conversationHistory.has(sessionId)) {
        conversationHistory.set(sessionId, []);
    }

    const history = conversationHistory.get(sessionId);
    history.push({ role: 'user', content: userText });

    const reply = await openaiService.chat(userText, history.slice(-6), sessionId, lang);

    history.push({ role: 'assistant', content: reply });

    if (history.length > 20) {
        conversationHistory.set(sessionId, history.slice(-20));
    }

    return reply;
}

// ===================== MAIN PROCESS =====================
async function processUserMessage(userText, driveMode, sessionId, ws) {

    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }

    const queue = processingQueue.get(sessionId);

    return queue.then(async () => {

        try {
            const lang = detectLanguageUnified(userText);
            const lower = userText.toLowerCase();

            // ================= SYSTEM COMMANDS =================
            if (lower.includes('bật dịch')) {
                return "🌐 Translation ON";
            }

            if (lower.includes('tắt dịch')) {
                return "🌐 Translation OFF";
            }

            // ================= DRIVE MODE =================
            if (driveMode === true) {
                const cmd = parseDriveCommand(userText);

                if (cmd) {
                    sendToESP32(cmd, 0);
                    return DRIVE_REPLIES[cmd];
                }

                return lang === 'en'
                    ? 'Use: FORWARD / BACK / LEFT / RIGHT / STOP'
                    : 'Dùng: TIẾN / LÙI / TRÁI / PHẢI / DỪNG';
            }

            // ================= COUNTDOWN =================
            const countdown = parseCountdownCommand(userText);

            if (countdown.isCountdown && ws) {
                ws.send(JSON.stringify({
                    type: 'countdown',
                    seconds: countdown.seconds
                }));

                return lang === 'en'
                    ? `Countdown ${countdown.seconds}s started`
                    : `Đếm ngược ${countdown.seconds}s`;
            }

            // ================= TIME =================
            if (lower.includes('mấy giờ') || lower.includes('time')) {
                return getCurrentTime(lang);
            }

            // ================= DATE =================
            if (lower.includes('hôm nay') || lower.includes('date')) {
                return getCurrentDate(lang);
            }

            // ================= RAG =================
            if (shouldUseRAG(userText)) {

                const rag = await searchKnowledgeBase(userText, lang);

                if (rag.found) {
                    const prompt = `
Based on context:
${rag.context}

Question: ${userText}
Answer:
`;

                    const answer = await openaiService.chat(prompt, [], sessionId);

                    return answer;
                }
            }

            // ================= AI BRAIN (NEW PRO FEATURE) =================
            const ai = await aiBrain(userText, lang);

            // ===== CHAT MODE =====
            if (ai.mode === 'chat' || ai.mode === 'english') {
                return ai.message;
            }

            // ===== IOT MODE (AUTO CONTROL) =====
            if (ai.mode === 'iot' && ai.commands?.length) {

                for (const cmd of ai.commands) {
                    sendToESP32(cmd.device, cmd);
                }

                return `🤖 Executed ${ai.commands.length} device commands`;
            }

            // fallback
            return await handleGeneralQuestion(userText, sessionId, lang);

        } catch (err) {
            console.error(err);

            return '❌ AI error, please try again';
        }

    }).finally(() => {
        processingQueue.set(sessionId, Promise.resolve());
    });
}

// ===================== WEBSOCKET SERVER =====================
function setupWebSocket(server) {

    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {

        const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);

        wsClients.set(clientId, ws);

        ws.on('message', async (message) => {

            try {
                const data = JSON.parse(message);

                // ================= CHAT =================
                if (data.type === 'voice' || data.type === 'chat') {

                    const reply = await processUserMessage(
                        data.text,
                        data.driveMode === true,
                        clientId,
                        ws
                    );

                    ws.send(JSON.stringify({
                        type: 'ai',
                        text: reply
                    }));
                }

                // ================= DRIVE =================
                if (data.type === 'drive_command') {
                    sendToESP32(data.command, data.duration || 0);

                    ws.send(JSON.stringify({
                        type: 'drive_response',
                        command: data.command
                    }));
                }

                // ================= TRANSLATE =================
                if (data.type === 'translate') {
                    const translated = await translationService.translateText(
                        data.text,
                        data.source,
                        data.target
                    );

                    ws.send(JSON.stringify({
                        type: 'translation',
                        translated
                    }));
                }

                // ================= GAME =================
                if (data.type === 'game_move') {

                    gamePlayers.set(clientId, {
                        x: data.x,
                        z: data.z,
                        rotation: data.rotation,
                        lastUpdate: Date.now()
                    });

                    const players = {};

                    for (const [id, p] of gamePlayers) {
                        if (Date.now() - p.lastUpdate < 5000) {
                            players[id] = p;
                        }
                    }

                    wss.clients.forEach(c => {
                        if (c.readyState === WebSocket.OPEN) {
                            c.send(JSON.stringify({
                                type: 'game_players',
                                players
                            }));
                        }
                    });
                }

            } catch (err) {
                console.error('WS error:', err);
            }
        });

        ws.on('close', () => {
            wsClients.delete(clientId);
            gamePlayers.delete(clientId);
        });

        ws.send(JSON.stringify({
            type: 'system',
            message: 'CHIRI AI PRO CONNECTED',
            clientId
        }));
    });

    return wss;
}

// ===================== EXPORT =====================
module.exports = {
    setupWebSocket,
    processUserMessage,
    wsClients,
    gamePlayers
};
