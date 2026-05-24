// ========== WEBSOCKET SERVICE (PRO AI + IOT UPGRADE) ==========
const WebSocket = require('ws');
const openaiService = require('./openai');
const translationService = require('./translation');
const ragService = require('./rag');
const { sendToESP32, esp32Clients } = require('../routes/drive');
const { evaluateSensors } = require('../ai/agent');
const { getVisionData } = require('./services/visionClient');
const { evaluate } = require('./ai/autonomous');



const { Perception } = require('../../vision/perception');
const { SLAMBridge } = require('../../localization/slam_bridge');
const { NavClient } = require('../../navigation/nav_client');
const { CognitiveBrain } = require('../../cognition/cognitive_brain');

const perception = new Perception();
const slam = new SLAMBridge();
const nav = new NavClient();
const brain = new CognitiveBrain();





const { EnvironmentDetector } = require('../../context/environment_detector');
const { AdaptiveBehavior } = require('../../behavior/adaptive_behavior');

const envDetector = new EnvironmentDetector();
const adaptive = new AdaptiveBehavior();




const { RealTimeVision } = require('../../vision/realtime_detector');
const { HazardEngine } = require('../../safety/hazard_engine');
const { SemanticWorldModel } = require('../../world_model/semantic_model');
const { ContinualMemory } = require('../../memory/continual_memory');
const { CognitiveAgent } = require('../../agent/cognitive_agent');

const hrAI = require('../ai/hr_llm_layer');
const funAI = require('../ai/entertainment_layer');

const AutonomousLoop = require('../enterprise/autonomous_loop');
const company = require('../enterprise/company_simulator');

const hrSystem = require('../ai/hr_orchestrator');




const loop = new AutonomousLoop(wss);
loop.start();

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


const visionAI = new RealTimeVision();
const safetyAI = new HazardEngine();
const worldAI = new SemanticWorldModel();
const memoryAI = new ContinualMemory();
const agentAI = new CognitiveAgent();


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



function detectMode(text) {

    const t = text.toLowerCase();

    if (t.includes("tuyển dụng") || t.includes("phỏng vấn"))
        return "hr";

    if (t.includes("tử vi") || t.includes("xem bói") || t.includes("nhân tướng"))
        return "fun";

    return "general";
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




                 // 1. camera frame
                if (data.type === "camera_frame") {
            
                    const vision = perception.analyze(data.frame);
                    const pose = slam.get_pose();
            
                    ws.send(JSON.stringify({
                        type: "environment",
                        vision,
                        pose
                    }));
                }
            
                // 2. chat / voice
                if (data.type === "chat" || data.type === "voice") {
            
                    const vision = perception.analyze(null);
                    const pose = slam.get_pose();
            
                    const decision = brain.decide(
                        data.text,
                        vision,
                        pose
                    );
            
                    if (decision.action === "go_to") {
                        nav.go_to(decision.target);
                    }
            
                    if (decision.action === "follow_user") {
                        nav.go_to("user_tracking_mode");
                    }
            
                    ws.send(JSON.stringify({
                        type: "ai_response",
                        text: `OK, executing: ${decision.action}`,
                        decision
                    }));
            
            
                    
                if (data.type === "add_employee") {
                    company.addEmployee(data.employee);
                }
                
                if (data.type === "add_project") {
                    company.addProject(data.project);
                }

                // ================= CHAT =================
                if (data.type === "telemetry") {
                    evaluateSensors(
                        data.payload,
                        sendToESP32,
                        (msg) => ws.send(JSON.stringify(msg))
                    );
                }
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

//////AUTONOMOUS HR DECISION API
                if (data.type === "hr_autonomous_evaluation") {
                
                    const result = await hrSystem.evaluateCandidate(data.candidate);
                
                    ws.send(JSON.stringify({
                        type: "hr_autonomous_result",
                        data: result
                    }));
                }

                

/////////////////////////////////////////////////CAMERA + VISION FLOW
                if (data.type === "camera_frame") {
                
                    const vision = visionAI.analyze(data.frame);
                
                    const hazard = safetyAI.evaluate(vision);
                
                    const world = worldAI.classify_environment(vision, "");
                
                    memoryAI.learn({
                        type: "vision_update",
                        data: vision
                    });
                
                    ws.send(JSON.stringify({
                        type: "world_state",
                        vision,
                        hazard,
                        world
                    }));
                }

                if (data.type === "chat" || data.type === "voice") {

                    const vision = perception?.analyze?.(null) || {};
                
                    // 1. detect environment
                    const context = envDetector.classify(
                        data.text,
                        vision
                    );
                
                    // 2. get behavior mode
                    const mode = adaptive.get_mode(context.environment);
                
                    // 3. AI prompt dynamic
                    const prompt = `
                You are a robot assistant.
                
                Current environment: ${context.environment}
                Confidence: ${context.confidence}
                
                Behavior mode: ${mode.behavior}
                Tone: ${mode.tone}
                
                User: ${data.text}
                
                Respond appropriately for this environment.
                `;
                
                    const reply = await openaiService.chat(prompt);
                
                    ws.send(JSON.stringify({
                        type: "adaptive_ai",
                        environment: context,
                        mode,
                        reply
                    }));
                }

                
                if (data.type === "chat" || data.type === "voice") {
                
                    const vision = visionAI.analyze(null);
                    const hazard = safetyAI.evaluate(vision);
                    const world = worldAI.classify_environment(vision, data.text);
                
                    const decision = agentAI.decide(
                        vision,
                        world,
                        hazard,
                        data.text
                    );
                
                    memoryAI.learn({
                        type: decision.mode,
                        text: data.text
                    });
                
                    let response = "";
                
                    if (decision.mode === "emergency") {
                        response = "⚠️ Danger detected! Alerting safety system.";
                    }
                
                    if (decision.mode === "safety_inspector") {
                        response = "Monitoring factory safety conditions.";
                    }
                
                    if (decision.mode === "manager_assistant") {
                        response = "I will help organize your tasks.";
                    }
                
                    if (decision.mode === "service_robot") {
                        response = "I will guide you.";
                    }
                
                    ws.send(JSON.stringify({
                        type: "cognitive_ai",
                        decision,
                        response
                    }));
                }
                
                if (data.type === "hr_interview_questions") {
                
                    const result = await hrAI.generateInterviewQuestions(
                        data.role,
                        data.level
                    );
                
                    ws.send(JSON.stringify({
                        type: "hr_questions",
                        data: result
                    }));
                }
                
                
                
                if (data.type === "hr_evaluate_candidate") {
                
                    const result = await hrAI.evaluateCandidate(
                        data.candidate,
                        data.answers
                    );
                
                    ws.send(JSON.stringify({
                        type: "hr_evaluation",
                        data: result
                    }));
                }
                
                if (data.type === "project_progress") {
                
                    const result = await hrAI.trackProjectProgress(
                        data.project
                    );
                
                    ws.send(JSON.stringify({
                        type: "project_analysis",
                        data: result
                    }));
                }
                
                
                if (data.type === "hr_hiring_decision") {
                
                    const result = await hrAI.hiringDecision(
                        data.team,
                        data.candidates
                    );
                
                    ws.send(JSON.stringify({
                        type: "hiring_decision",
                        data: result
                    }));
                }
                
                
                if (data.type === "fortune_telling") {
                
                    const result = await funAI.fortuneTelling(data.text);
                
                    ws.send(JSON.stringify({
                        type: "fortune",
                        data: result
                    }));
                }
                
                if (data.type === "face_reading") {
                
                    const result = await funAI.faceReadingDescription(data.face);
                
                    ws.send(JSON.stringify({
                        type: "face_reading_result",
                        data: result
                    }));
                }
                
                if (data.type === "numerology") {
                
                    const result = await funAI.numerology(
                        data.name,
                        data.birthdate
                    );
                
                    ws.send(JSON.stringify({
                        type: "numerology_result",
                        data: result
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

setInterval(() => {
    const vision = getVisionData();

    evaluate(
        vision,
        sendToESP32,
        (msg) => broadcast(msg)
    );

}, 500);



////////////////////////////////////////////////////////////////

// ===================== EXPORT =====================
module.exports = {
    setupWebSocket,
    processUserMessage,
    wsClients,
    gamePlayers
};
