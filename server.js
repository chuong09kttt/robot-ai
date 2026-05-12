const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');

// ========== CACHE OPTIMIZATION ==========
const ttsCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
const responseCache = new NodeCache({ stdTTL: 300, maxKeys: 200 });

// ========== KHAI BÁO BIẾN TOÀN CỤC ==========
const esp32Clients = new Map();
let conversationHistory = {};
const processingQueue = new Map();
const clientHeartbeats = new Map();

// ========== LOAD MODULES WITH FALLBACK ==========
let OpenAI;
let pdfParse;
let axios;
let cheerio;

try {
    OpenAI = require('openai');
    console.log('✅ OpenAI module loaded');
} catch (e) {
    console.log('⚠️ OpenAI module not available');
}

try {
    pdfParse = require('pdf-parse');
    console.log('✅ pdf-parse loaded');
} catch (e) {
    console.log('⚠️ pdf-parse not available, PDF features disabled');
}

try {
    axios = require('axios');
    console.log('✅ axios loaded');
} catch (e) {
    console.log('⚠️ axios not available, web crawling disabled');
}

try {
    cheerio = require('cheerio');
    console.log('✅ cheerio loaded');
} catch (e) {
    console.log('⚠️ cheerio not available, HTML parsing disabled');
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '/')));
app.use(express.json({ limit: '50mb' }));

// ========== KHỞI TẠO OPENAI ==========
let openai = null;
if (OpenAI && process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 10000,
        });
        console.log('✅ OpenAI API Key configured - ChatGPT mode ready');
    } catch (err) {
        console.error('❌ OpenAI init error:', err.message);
    }
} else {
    console.log('⚠️ No OPENAI_API_KEY, using simple reply mode');
}

// ========== RAG KNOWLEDGE BASE ==========
let customKnowledge = [];
let knowledgeSource = '';
let knowledgeIndex = new Map();

// ========== GOOGLE DRIVE CONFIG ==========
const GOOGLE_DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || '';

// ========== REBUILD KNOWLEDGE INDEX ==========
function rebuildKnowledgeIndex() {
    knowledgeIndex.clear();
    for (const chunk of customKnowledge) {
        for (const keyword of chunk.keywords || []) {
            if (!knowledgeIndex.has(keyword)) knowledgeIndex.set(keyword, []);
            knowledgeIndex.get(keyword).push(chunk);
        }
    }
    console.log(`📚 Index rebuilt: ${knowledgeIndex.size} keywords indexed`);
}

// ========== DOWNLOAD FROM GOOGLE DRIVE ==========
async function downloadFromGoogleDrive(fileId) {
    if (!axios) {
        console.log('⚠️ Axios not available, cannot download from Google Drive');
        return null;
    }
    
    try {
        console.log(`📥 Downloading from Google Drive ID: ${fileId}`);
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        const buffer = Buffer.from(response.data);
        
        if (pdfParse) {
            try {
                const pdfData = await pdfParse(buffer);
                console.log(`✅ PDF loaded: ${pdfData.numpages} pages, ${pdfData.text.length} chars`);
                return pdfData.text;
            } catch (e) {
                console.log('File is not PDF, treating as text');
                return buffer.toString('utf-8');
            }
        } else {
            return buffer.toString('utf-8');
        }
    } catch (error) {
        console.error('❌ Google Drive download error:', error.message);
        return null;
    }
}

// ========== CRAWL WEBSITE ==========
async function crawlWebsite(url) {
    if (!axios || !cheerio) {
        console.log('⚠️ Axios or cheerio not available, cannot crawl website');
        return null;
    }
    
    try {
        console.log(`🕷️ Crawling: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        // Remove unnecessary elements
        $('script, style, nav, footer, header, .sidebar, .navigation, iframe, .advertisement').remove();
        
        // Get main content
        let content = '';
        
        // Try common content selectors
        const selectors = ['main', 'article', '.content', '.main-content', '#content', '.post-content', '.entry-content'];
        
        for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                content = elements.text().trim();
                break;
            }
        }
        
        // Fallback to body
        if (content.length < 100) {
            content = $('body').text();
        }
        
        // Clean text
        content = content.replace(/\s+/g, ' ').trim();
        
        console.log(`✅ Crawled: ${content.length} chars from ${url}`);
        
        return {
            url: url,
            title: $('title').text() || url,
            content: content
        };
    } catch (error) {
        console.error(`❌ Crawl error ${url}:`, error.message);
        return null;
    }
}

// ========== SPLIT TEXT INTO CHUNKS ==========
function splitTextIntoChunks(text, maxChunkSize = 800) {
    if (!text) return [];
    
    const chunks = [];
    const sentences = text.split(/[.!?]+/);
    
    let currentChunk = '';
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length === 0) continue;
        
        if ((currentChunk + ' ' + trimmed).length < maxChunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + trimmed + '.';
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = trimmed + '.';
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    
    return chunks;
}

// ========== EXTRACT KEYWORDS ==========
function extractKeywords(text) {
    const cleanText = text.toLowerCase().replace(/[^\w\sàáảãạăâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/g, '');
    const words = cleanText.split(/\s+/);
    
    const stopwords = new Set([
        'và', 'của', 'có', 'là', 'một', 'với', 'cho', 'khi', 'đã', 'sẽ',
        'được', 'không', 'các', 'những', 'như', 'này', 'ấy', 'ở', 'tại',
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was'
    ]);
    
    const keywords = [];
    for (const word of words) {
        if (word.length > 2 && !stopwords.has(word)) {
            keywords.push(word);
        }
    }
    
    return [...new Set(keywords.slice(0, 20))];
}

// ========== LOAD CUSTOM KNOWLEDGE ==========
async function loadCustomKnowledge() {
    console.log('\n📚 LOADING CUSTOM KNOWLEDGE...\n');
    
    const allContent = [];
    
    // Default websites to crawl
    const defaultWebsites = process.env.DEFAULT_WEBSITES 
        ? process.env.DEFAULT_WEBSITES.split(',')
        : [
            'https://vi.wikipedia.org/wiki/Tuổi_thọ',
            'https://vi.wikipedia.org/wiki/Sức_khỏe'
          ];
    
    // Crawl websites
    if (axios && cheerio) {
        console.log('🌐 Crawling websites...');
        for (const url of defaultWebsites) {
            const data = await crawlWebsite(url);
            if (data) {
                allContent.push({
                    source: url,
                    type: 'website',
                    title: data.title,
                    content: data.content
                });
            }
            await delay(1000);
        }
    }
    
    // Download from Google Drive
    if (GOOGLE_DRIVE_FILE_ID && axios) {
        console.log('📁 Downloading from Google Drive...');
        const pdfContent = await downloadFromGoogleDrive(GOOGLE_DRIVE_FILE_ID);
        if (pdfContent) {
            allContent.push({
                source: `Google Drive (${GOOGLE_DRIVE_FILE_ID})`,
                type: 'pdf',
                title: 'Tài liệu từ Google Drive',
                content: pdfContent
            });
        }
    }
    
    // Process and store knowledge
    for (const item of allContent) {
        console.log(`📖 Processing: ${item.title}`);
        const chunks = splitTextIntoChunks(item.content);
        
        for (const chunk of chunks) {
            customKnowledge.push({
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                source: item.source,
                type: item.type,
                title: item.title,
                content: chunk,
                keywords: extractKeywords(chunk)
            });
        }
    }
    
    rebuildKnowledgeIndex();
    knowledgeSource = `📚 Loaded ${customKnowledge.length} knowledge chunks from ${allContent.length} sources`;
    console.log(`\n✅ ${knowledgeSource}\n`);
}

// ========== OPTIMIZED SEARCH IN KNOWLEDGE ==========
function searchInKnowledge(query, maxResults = 3) {
    if (customKnowledge.length === 0) return [];
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const scores = new Map();
    
    // Fast keyword index search
    for (const word of queryWords) {
        const chunks = knowledgeIndex.get(word) || [];
        for (const chunk of chunks) {
            const currentScore = scores.get(chunk.id) || 0;
            scores.set(chunk.id, currentScore + 2);
        }
    }
    
    // Exact phrase match (high weight)
    for (const chunk of customKnowledge) {
        if (chunk.content.toLowerCase().includes(queryLower)) {
            const currentScore = scores.get(chunk.id) || 0;
            scores.set(chunk.id, currentScore + 10);
        }
    }
    
    const results = Array.from(scores.entries())
        .map(([id, score]) => {
            const chunk = customKnowledge.find(c => c.id === id);
            return { ...chunk, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    
    return results;
}

// ========== GENERATE ANSWER FROM KNOWLEDGE ==========
function generateAnswerFromKnowledge(query, results) {
    if (results.length === 0) return null;
    
    const bestMatch = results[0];
    
    if (bestMatch.score >= 15) {
        return {
            answer: `📖 **Theo ${bestMatch.source}:**\n\n${bestMatch.content.substring(0, 600)}${bestMatch.content.length > 600 ? '...' : ''}`,
            source: bestMatch.source,
            confidence: 'high',
            hasMore: bestMatch.content.length > 600
        };
    }
    
    if (results.length >= 2 && results[0].score >= 8) {
        let combined = `📚 **Tổng hợp từ các nguồn:**\n\n`;
        for (let i = 0; i < Math.min(2, results.length); i++) {
            combined += `📌 **${results[i].source}:**\n${results[i].content.substring(0, 300)}...\n\n`;
        }
        return {
            answer: combined,
            source: 'multiple sources',
            confidence: 'medium',
            hasMore: true
        };
    }
    
    return null;
}

// ========== OPTIMIZED CALL CHATGPT ==========
async function callChatGPT(userMessage, history = [], customContext = '') {
    // Check cache
    const cacheKey = `${userMessage}|${customContext.slice(0, 100)}`;
    const cached = responseCache.get(cacheKey);
    if (cached) return cached;
    
    if (!openai || !process.env.OPENAI_API_KEY) {
        return getSimpleReply(userMessage);
    }
    
    try {
        let systemPrompt = `Bạn là Chiri - một trợ lý AI thông minh, thân thiện, dễ thương.
Nhiệm vụ của bạn:
- Trả lời MỌI câu hỏi của người dùng một cách chính xác, hữu ích
- Giọng điệu: thân thiện, nhiệt tình, dùng icon cảm xúc (❤️, 😊, 🚀)
- Trả lời NGẮN GỌN (tối đa 3-4 câu)
- Trả lời bằng TIẾNG VIỆT
- Nếu không biết, hãy thành thật nói "Mình chưa rõ lắm"`;

        if (customContext) {
            systemPrompt += `\n\n**THÔNG TIN THAM KHẢO (ưu tiên sử dụng):**\n${customContext.slice(0, 400)}\n\nHãy dùng thông tin trên để trả lời nếu phù hợp.`;
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                ...history.slice(-6),
                { role: 'user', content: userMessage.slice(0, 500) }
            ],
            max_tokens: 250,
            temperature: 0.7,
            timeout: 8000,
        });
        
        const reply = completion.choices[0].message.content;
        responseCache.set(cacheKey, reply);
        return reply;
    } catch (error) {
        console.error('❌ ChatGPT error:', error.message);
        return getSimpleReply(userMessage);
    }
}

// ========== SIMPLE REPLY FALLBACK ==========
function getSimpleReply(userMessage) {
    const lower = userMessage.toLowerCase();
    
    if (lower.includes('xin chào') || lower.includes('hello')) {
        return 'Xin chào bạn! Mình là Chiri AI, rất vui được gặp bạn! 💕';
    }
    if (lower.includes('khỏe')) {
        return 'Cảm ơn bạn! Mình là AI nên không có sức khỏe, nhưng mình luôn sẵn sàng giúp đỡ bạn! 😊';
    }
    if (lower.includes('tuổi thọ')) {
        return '👨‍👩‍👧‍👦 Tuổi thọ trung bình của con người khoảng 73-85 tuổi. Ở Việt Nam là 73-75 tuổi. Người Nhật sống thọ nhất với 84-87 tuổi!';
    }
    if (lower.includes('cảm ơn')) {
        return 'Không có gì đâu ạ! Rất vui khi được giúp bạn! 💖';
    }
    
    return `🤔 Mình nghe bạn nói: "${userMessage.slice(0, 50)}". Mình đang học hỏi thêm để trả lời tốt hơn. Bạn có thể hỏi mình về tuổi thọ con người nhé!`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== ESP32 FUNCTIONS ==========
function sendToESP32(command) {
    let sent = false;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'command', command: command }));
            console.log(`📤 Send to ESP32: ${command}`);
            sent = true;
        }
    }
    return sent;
}

function isControlCommand(text) {
    const controlWords = ['tiến', 'lùi', 'trái', 'phải', 'dừng', 'forward', 'back', 'left', 'right', 'stop'];
    return controlWords.some(word => text.toLowerCase().includes(word));
}

function getESP32Command(text) {
    const lower = text.toLowerCase();
    if (lower.includes('tiến')) return 'FORWARD';
    if (lower.includes('lùi')) return 'BACKWARD';
    if (lower.includes('trái')) return 'LEFT';
    if (lower.includes('phải')) return 'RIGHT';
    if (lower.includes('dừng')) return 'STOP';
    return null;
}

// ========== PROCESS USER MESSAGE WITH QUEUE ==========
async function processUserMessage(userText, driveMode, sessionId, ws) {
    // Queue system to prevent race conditions
    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }
    
    const queue = processingQueue.get(sessionId);
    const result = await queue.then(async () => {
        try {
            console.log(`🔍 [${sessionId}] Process: "${userText}" | driveMode: ${driveMode}`);
            
            // Drive mode
            if (driveMode === true) {
                if (isControlCommand(userText)) {
                    const command = getESP32Command(userText);
                    if (command) {
                        sendToESP32(command);
                        const replies = {
                            'FORWARD': '🚗 Xe đang tiến về phía trước!',
                            'BACKWARD': '🚗 Xe đang lùi lại!',
                            'LEFT': '🚗 Xe đang rẽ trái!',
                            'RIGHT': '🚗 Xe đang rẽ phải!',
                            'STOP': '🚗 Xe đã dừng lại!'
                        };
                        return replies[command];
                    }
                }
                return '🚫 Đang ở chế độ xe. Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, DỪNG. Hoặc tắt chế độ xe để trò chuyện!';
            }
            
            // RAG: Search in custom knowledge
            console.log('🔍 Searching in custom knowledge...');
            const searchResults = searchInKnowledge(userText, 3);
            
            let customAnswer = null;
            let customContext = '';
            
            if (searchResults.length > 0) {
                customAnswer = generateAnswerFromKnowledge(userText, searchResults);
                if (customAnswer && customAnswer.confidence === 'high') {
                    console.log('✅ Found HIGH confidence answer in knowledge base');
                    return customAnswer.answer;
                }
                if (searchResults.length > 0) {
                    customContext = searchResults.map(r => `[${r.source}]: ${r.content.slice(0, 300)}`).join('\n\n');
                    console.log(`📖 Found ${searchResults.length} relevant results, using as context`);
                }
            }
            
            // Chat mode with ChatGPT
            if (!conversationHistory[sessionId]) {
                conversationHistory[sessionId] = [];
            }
            
            conversationHistory[sessionId].push({ role: 'user', content: userText });
            
            let reply;
            if (customContext) {
                reply = await callChatGPT(userText, conversationHistory[sessionId], customContext);
                reply += `\n\n📌 *Thông tin có tham khảo từ dữ liệu của tôi.*`;
            } else {
                reply = await callChatGPT(userText, conversationHistory[sessionId]);
            }
            
            conversationHistory[sessionId].push({ role: 'assistant', content: reply });
            
            // Limit history
            if (conversationHistory[sessionId].length > 16) {
                conversationHistory[sessionId] = conversationHistory[sessionId].slice(-16);
            }
            
            return reply;
        } catch (error) {
            console.error('Process error:', error);
            return 'Chiri hơi mệt, bạn thử lại nhé! 😊';
        }
    });
    
    // Reset queue
    processingQueue.set(sessionId, Promise.resolve());
    return result;
}

// ========== TTS WITH CACHE ==========
const ttsQueue = [];
let isProcessingTTS = false;

async function generateTTS(text) {
    const cacheKey = text.slice(0, 200);
    const cached = ttsCache.get(cacheKey);
    if (cached) return cached;
    
    if (!openai || !process.env.OPENAI_API_KEY) return null;
    
    try {
        const mp3 = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'nova',
            input: text.slice(0, 500),
            speed: 1.0,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        ttsCache.set(cacheKey, buffer);
        return buffer;
    } catch (error) {
        console.error('TTS error:', error.message);
        return null;
    }
}

// ========== API ENDPOINTS ==========

// Upload PDF file
app.post('/api/upload-pdf', async (req, res) => {
    try {
        const { fileContent, fileName } = req.body;
        if (!fileContent) {
            return res.json({ success: false, message: 'No file content' });
        }
        
        const buffer = Buffer.from(fileContent, 'base64');
        
        let text = '';
        if (pdfParse) {
            const pdfData = await pdfParse(buffer);
            text = pdfData.text;
        } else {
            text = buffer.toString('utf-8');
        }
        
        const chunks = splitTextIntoChunks(text);
        for (const chunk of chunks) {
            customKnowledge.push({
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                source: `Uploaded PDF: ${fileName}`,
                type: 'pdf',
                title: fileName,
                content: chunk,
                keywords: extractKeywords(chunk)
            });
        }
        rebuildKnowledgeIndex();
        
        res.json({ success: true, message: `Đã thêm ${chunks.length} đoạn kiến thức từ PDF!` });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Add website URL
app.post('/api/add-website', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.json({ success: false, message: 'No URL provided' });
        }
        
        const data = await crawlWebsite(url);
        if (data) {
            const chunks = splitTextIntoChunks(data.content);
            for (const chunk of chunks) {
                customKnowledge.push({
                    id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                    source: url,
                    type: 'website',
                    title: data.title,
                    content: chunk,
                    keywords: extractKeywords(chunk)
                });
            }
            rebuildKnowledgeIndex();
            res.json({ success: true, message: `Đã crawl và thêm ${chunks.length} đoạn từ website!` });
        } else {
            res.json({ success: false, message: 'Không thể crawl website' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Add Google Drive file
app.post('/api/add-drive', async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) {
            return res.json({ success: false, message: 'No file ID provided' });
        }
        
        const content = await downloadFromGoogleDrive(fileId);
        if (content) {
            const chunks = splitTextIntoChunks(content);
            for (const chunk of chunks) {
                customKnowledge.push({
                    id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                    source: `Google Drive: ${fileId}`,
                    type: 'drive',
                    title: 'Tài liệu từ Google Drive',
                    content: chunk,
                    keywords: extractKeywords(chunk)
                });
            }
            rebuildKnowledgeIndex();
            res.json({ success: true, message: `Đã thêm ${chunks.length} đoạn từ Google Drive!` });
        } else {
            res.json({ success: false, message: 'Không thể tải file từ Google Drive' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Get knowledge stats
app.get('/api/knowledge-stats', (req, res) => {
    const sources = {};
    for (const item of customKnowledge) {
        if (!sources[item.source]) {
            sources[item.source] = 0;
        }
        sources[item.source]++;
    }
    
    res.json({
        totalChunks: customKnowledge.length,
        sources: sources,
        knowledgeSource: knowledgeSource,
        indexedKeywords: knowledgeIndex.size,
        modulesAvailable: {
            openai: !!openai,
            pdfParse: !!pdfParse,
            axios: !!axios,
            cheerio: !!cheerio
        }
    });
});

// Clear knowledge
app.post('/api/clear-knowledge', (req, res) => {
    customKnowledge = [];
    knowledgeIndex.clear();
    res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu đã học!' });
});

// TTS endpoint with cache
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('Missing text');
    
    const audioBuffer = await generateTTS(text);
    if (audioBuffer) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(audioBuffer);
    } else {
        res.status(404).send('TTS not available');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        knowledgeChunks: customKnowledge.length,
        esp32Count: esp32Clients.size,
        chatGPTReady: !!(openai && process.env.OPENAI_API_KEY),
        pdfReady: !!pdfParse,
        crawlerReady: !!(axios && cheerio),
        cacheSize: ttsCache.keys().length
    });
});

// ========== WEBSOCKET WITH HEARTBEAT ==========
wss.on('connection', (ws, req) => {
    const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    let sessionId = clientId;
    
    console.log(`🔌 ${isESP32 ? 'ESP32' : 'WEB'} connected: ${clientId}`);
    
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 25000);
    
    if (isESP32) {
        esp32Clients.set(clientId, ws);
        clientHeartbeats.set(clientId, Date.now());
        ws.send(JSON.stringify({ type: 'system', message: 'Connected to CHIRI server' }));
    }
    
    ws.on('pong', () => {
        if (isESP32) clientHeartbeats.set(clientId, Date.now());
    });
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'voice') {
                const reply = await processUserMessage(data.text, data.driveMode === true, sessionId, ws);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ai', text: reply }));
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
        if (esp32Clients.has(clientId)) {
            esp32Clients.delete(clientId);
            clientHeartbeats.delete(clientId);
        }
        setTimeout(() => {
            delete conversationHistory[sessionId];
            processingQueue.delete(sessionId);
        }, 300000);
    });
});

// ========== ESP32 HEARTBEAT MONITOR ==========
setInterval(() => {
    const now = Date.now();
    for (const [id, lastHeartbeat] of clientHeartbeats) {
        if (now - lastHeartbeat > 60000) {
            const client = esp32Clients.get(id);
            if (client) client.terminate();
            esp32Clients.delete(id);
            clientHeartbeats.delete(id);
            console.log(`🔌 ESP32 ${id} timed out`);
        }
    }
}, 30000);

// ========== START SERVER ==========
const PORT = process.env.PORT || 8080;

async function startServer() {
    await loadCustomKnowledge();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 CHIRI AI - FULL FEATURE MODE v4.0`);
        console.log(`📍 http://localhost:${PORT}`);
        console.log(`📚 Knowledge chunks: ${customKnowledge.length}`);
        console.log(`🔍 Indexed keywords: ${knowledgeIndex.size}`);
        console.log(`🤖 ChatGPT: ${openai && process.env.OPENAI_API_KEY ? 'READY ✅' : 'NOT AVAILABLE ⚠️'}`);
        console.log(`📄 PDF Reader: ${pdfParse ? 'READY ✅' : 'NOT AVAILABLE ⚠️'}`);
        console.log(`🕷️ Web Crawler: ${axios && cheerio ? 'READY ✅' : 'NOT AVAILABLE ⚠️'}`);
        console.log(`🎤 Voice Control: READY ✅`);
        console.log(`🚗 ESP32 Clients: ${esp32Clients.size}`);
        console.log(`💾 Cache: TTS + Response caching ENABLED ✅`);
        console.log(`\n📡 WebSocket: ws://localhost:${PORT}`);
        console.log(`\n💡 API Endpoints:`);
        console.log(`   POST /api/upload-pdf - Upload PDF file`);
        console.log(`   POST /api/add-website - Add website URL`);
        console.log(`   POST /api/add-drive - Add Google Drive file ID`);
        console.log(`   GET  /api/knowledge-stats - View knowledge stats`);
        console.log(`   POST /api/clear-knowledge - Clear all knowledge\n`);
    });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

startServer();
