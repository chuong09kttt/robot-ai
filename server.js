const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const OpenAI = require('openai');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '/')));

// ========== KHỞI TẠO OPENAI ==========
let openai = null;
try {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI API Key đã được cấu hình');
} catch (err) {
    console.error('❌ Lỗi khởi tạo OpenAI:', err.message);
}

// ========== DỮ LIỆU RIÊNG ==========
let customKnowledge = []; // Lưu trữ nội dung đã học
let knowledgeSource = ''; // Nguồn dữ liệu

// Cấu hình nguồn dữ liệu mặc định
const DEFAULT_WEBSITES = [
    'https://www.vard.com/vungtau',
    'https://vi.wikipedia.org/wiki/L%E1%BB%87_Th%E1%BB%A7y_(ngh%E1%BB%87_s%C4%A9)',
    'https://vi.wikipedia.org/wiki/Mặt_Trời'
];

// Google Drive file ID (chia sẻ công khai)
// Ví dụ: https://drive.google.com/file/d/FILE_ID/view
const GOOGLE_DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || '1RXqoUIQgb_UgvbjM8h3412OZdsxPAZPP';
// ========== TẢI FILE TỪ GOOGLE DRIVE ==========
async function downloadFromGoogleDrive(fileId) {
    try {
        console.log(`📥 Đang tải file từ Google Drive ID: ${fileId}`);
        
        // Lấy link tải trực tiếp từ Google Drive
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        // Kiểm tra xem có phải PDF không
        const buffer = Buffer.from(response.data);
        
        // Thử parse PDF
        try {
            const pdfData = await pdfParse(buffer);
            console.log(`✅ Đã tải PDF: ${pdfData.numpages} trang, ${pdfData.text.length} ký tự`);
            return pdfData.text;
        } catch (e) {
            console.log('File không phải PDF, lưu dạng text');
            return buffer.toString('utf-8');
        }
    } catch (error) {
        console.error('❌ Lỗi tải từ Google Drive:', error.message);
        return null;
    }
}

// ========== CRAWL WEBSITE ==========
async function crawlWebsite(url) {
    try {
        console.log(`🕷️ Đang crawl: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        // Xóa các element không cần thiết
        $('script, style, nav, footer, header, .sidebar, .navigation').remove();
        
        // Lấy nội dung chính
        let content = '';
        
        // Thử lấy nội dung từ các thẻ phổ biến
        $('main, article, .content, .main-content, #content, p').each((i, el) => {
            content += $(el).text().trim() + '\n';
        });
        
        // Nếu không tìm thấy, lấy body
        if (content.length < 100) {
            content = $('body').text();
        }
        
        // Làm sạch văn bản
        content = content.replace(/\s+/g, ' ').trim();
        
        console.log(`✅ Crawl thành công: ${content.length} ký tự`);
        return {
            url: url,
            title: $('title').text() || url,
            content: content
        };
    } catch (error) {
        console.error(`❌ Lỗi crawl ${url}:`, error.message);
        return null;
    }
}

// ========== CHIA NHỎ VĂN BẢN THÀNH CÁC ĐOẠN NHỎ ==========
function splitTextIntoChunks(text, maxChunkSize = 1000) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/);
    
    let currentChunk = '';
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length < maxChunkSize) {
            currentChunk += sentence + '. ';
        } else {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = sentence + '. ';
        }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    
    return chunks;
}

// ========== LƯU TRI THỨC ==========
async function loadCustomKnowledge() {
    console.log('\n📚 ĐANG TẢI DỮ LIỆU RIÊNG...\n');
    
    let allContent = [];
    
    // 1. Crawl các website mặc định
    console.log('🌐 Crawl website mặc định...');
    for (const url of DEFAULT_WEBSITES) {
        const data = await crawlWebsite(url);
        if (data) {
            allContent.push({
                source: url,
                type: 'website',
                title: data.title,
                content: data.content
            });
        }
        await delay(1000); // Tránh crawl quá nhanh
    }
    
    // 2. Tải từ Google Drive (nếu có)
    if (GOOGLE_DRIVE_FILE_ID) {
        console.log('📁 Tải từ Google Drive...');
        const pdfContent = await downloadFromGoogleDrive(GOOGLE_DRIVE_FILE_ID);
        if (pdfContent) {
            allContent.push({
                source: `Google Drive (ID: ${GOOGLE_DRIVE_FILE_ID})`,
                type: 'pdf',
                title: 'Tài liệu từ Google Drive',
                content: pdfContent
            });
        }
    }
    
    // 3. Chia nhỏ và lưu vào knowledge base
    for (const item of allContent) {
        console.log(`📖 Xử lý: ${item.title}`);
        const chunks = splitTextIntoChunks(item.content);
        
        for (const chunk of chunks) {
            customKnowledge.push({
                source: item.source,
                type: item.type,
                title: item.title,
                content: chunk,
                keywords: extractKeywords(chunk)
            });
        }
    }
    
    knowledgeSource = `📚 Đã tải ${customKnowledge.length} đoạn kiến thức từ ${allContent.length} nguồn`;
    console.log(`\n✅ ${knowledgeSource}\n`);
}

// ========== TRÍCH XUẤT TỪ KHÓA ==========
function extractKeywords(text) {
    // Loại bỏ dấu câu và chuyển về chữ thường
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = cleanText.split(/\s+/);
    
    // Loại bỏ stopwords
    const stopwords = new Set([
        'và', 'của', 'có', 'là', 'một', 'với', 'cho', 'khi', 'đã', 'sẽ',
        'được', 'không', 'các', 'những', 'như', 'này', 'ấy', 'ở', 'tại'
    ]);
    
    const keywords = [];
    for (const word of words) {
        if (word.length > 2 && !stopwords.has(word)) {
            keywords.push(word);
        }
    }
    
    return [...new Set(keywords)];
}

// ========== TÌM KIẾM TRONG TRI THỨC RIÊNG ==========
function searchInCustomKnowledge(query) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    const results = [];
    
    for (const chunk of customKnowledge) {
        let score = 0;
        const chunkLower = chunk.content.toLowerCase();
        
        // Tìm kiếm chính xác cụm từ
        if (chunkLower.includes(queryLower)) {
            score += 10;
        }
        
        // Tìm kiếm từng từ
        for (const word of queryWords) {
            if (word.length > 2 && chunkLower.includes(word)) {
                score += 1;
            }
            if (chunk.keywords && chunk.keywords.includes(word)) {
                score += 2;
            }
        }
        
        if (score > 0) {
            results.push({
                score: score,
                content: chunk.content,
                source: chunk.source,
                title: chunk.title
            });
        }
    }
    
    // Sắp xếp theo độ liên quan
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, 3); // Lấy 3 kết quả tốt nhất
}

// ========== TẠO CÂU TRẢ LỜI TỪ DỮ LIỆU RIÊNG ==========
function generateAnswerFromKnowledge(query, searchResults) {
    if (searchResults.length === 0) return null;
    
    // Nếu có kết quả với điểm cao
    const bestMatch = searchResults[0];
    if (bestMatch.score >= 5) {
        return {
            answer: `📖 Theo ${bestMatch.source}:\n\n${bestMatch.content.substring(0, 800)}...`,
            source: bestMatch.source,
            confidence: 'high'
        };
    }
    
    // Nếu có nhiều kết quả liên quan
    if (searchResults.length >= 2) {
        let combinedAnswer = `📚 Tổng hợp từ các nguồn:\n\n`;
        for (let i = 0; i < Math.min(2, searchResults.length); i++) {
            combinedAnswer += `📌 ${searchResults[i].source}:\n${searchResults[i].content.substring(0, 300)}...\n\n`;
        }
        return {
            answer: combinedAnswer,
            source: 'nhiều nguồn',
            confidence: 'medium'
        };
    }
    
    return null;
}

// ========== HÀM GỌI CHATGPT (DÙNG KHI KHÔNG CÓ DỮ LIỆU RIÊNG) ==========
async function callChatGPT(userMessage, history = [], customContext = '') {
    if (!openai || !process.env.OPENAI_API_KEY) {
        return getOfflineReply(userMessage);
    }
    
    try {
        let systemPrompt = `Bạn là Chiri - một trợ lý AI thông minh, thân thiện.
Trả lời bằng TIẾNG VIỆT, giọng điệu vui vẻ, dùng icon cảm xúc.`;

        if (customContext) {
            systemPrompt += `\n\nTHÔNG TIN THAM KHẢO (từ dữ liệu riêng):\n${customContext}\n\nHãy dùng thông tin trên nếu phù hợp để trả lời.`;
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                ...history.slice(-10),
                { role: 'user', content: userMessage }
            ],
            max_tokens: 500,
            temperature: 0.7,
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('❌ Lỗi gọi ChatGPT:', error.message);
        return getOfflineReply(userMessage);
    }
}

function getOfflineReply(userMessage) {
    const lower = userMessage.toLowerCase();
    
    if (lower.includes('tuổi thọ')) {
        return '👨‍👩‍👧‍👦 Tuổi thọ trung bình của con người khoảng 73-85 tuổi. Ở Việt Nam là 73-75 tuổi.';
    }
    
    return `🤔 Mình chưa có thông tin về "${userMessage}". Bạn có thể cập nhật dữ liệu bằng PDF hoặc website cho mình học nhé!`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== ESP32 FUNCTIONS ==========
const esp32Clients = new Map();
let conversationHistory = {};

function sendToESP32(command) {
    let sent = false;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'command', command: command }));
            console.log(`📤 GỬI LỆNH đến ESP32: ${command}`);
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

// ========== XỬ LÝ CHAT CHÍNH (ƯU TIÊN DỮ LIỆU RIÊNG) ==========
async function processUserMessage(userText, driveMode, sessionId) {
    console.log(`🔍 [${sessionId}] Xử lý: "${userText}" | driveMode = ${driveMode}`);
    
    // Chế độ điều khiển xe
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
                return replies[command] || '🚗 Đã nhận lệnh!';
            }
        }
        return `🚫 Đang ở chế độ xe. Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, DỪNG.`;
    }
    
    // ====== CHẾ ĐỘ TRÒ CHUYỆN - ƯU TIÊN DỮ LIỆU RIÊNG ======
    
    // 1. Tìm kiếm trong dữ liệu riêng
    console.log('🔍 Tìm kiếm trong dữ liệu riêng...');
    const searchResults = searchInCustomKnowledge(userText);
    
    let customAnswer = null;
    let customContext = '';
    
    if (searchResults.length > 0) {
        customAnswer = generateAnswerFromKnowledge(userText, searchResults);
        if (customAnswer && customAnswer.confidence === 'high') {
            console.log('✅ TÌM THẤY trong dữ liệu riêng (độ tin cậy cao)');
            return customAnswer.answer;
        }
        if (customAnswer) {
            customContext = searchResults.map(r => r.content).join('\n\n');
            console.log(`📖 Tìm thấy ${searchResults.length} kết quả liên quan, sẽ dùng làm context cho ChatGPT`);
        }
    }
    
    // 2. Nếu không có hoặc độ tin cậy thấp, gọi ChatGPT kèm context
    console.log('🤖 Gọi ChatGPT với context từ dữ liệu riêng...');
    
    if (!conversationHistory[sessionId]) {
        conversationHistory[sessionId] = [];
    }
    
    conversationHistory[sessionId].push({ role: 'user', content: userText });
    
    let aiReply = await callChatGPT(userText, conversationHistory[sessionId], customContext);
    
    conversationHistory[sessionId].push({ role: 'assistant', content: aiReply });
    
    if (conversationHistory[sessionId].length > 20) {
        conversationHistory[sessionId] = conversationHistory[sessionId].slice(-20);
    }
    
    // Thêm ghi chú nếu có dùng dữ liệu riêng
    if (customContext) {
        aiReply += `\n\n📌 *Thông tin trên có tham khảo từ dữ liệu của tôi.*`;
    }
    
    return aiReply;
}

// ========== API: CẬP NHẬT DỮ LIỆU MỚI ==========
app.post('/update-knowledge', express.json(), async (req, res) => {
    const { pdfUrl, websiteUrl } = req.body;
    
    try {
        if (pdfUrl) {
            // Parse Google Drive URL để lấy ID
            let fileId = pdfUrl;
            const match = pdfUrl.match(/\/d\/(.+?)\//);
            if (match) fileId = match[1];
            
            const content = await downloadFromGoogleDrive(fileId);
            if (content) {
                const chunks = splitTextIntoChunks(content);
                for (const chunk of chunks) {
                    customKnowledge.push({
                        source: `PDF: ${pdfUrl}`,
                        type: 'pdf',
                        title: 'Tài liệu mới',
                        content: chunk,
                        keywords: extractKeywords(chunk)
                    });
                }
                res.json({ success: true, message: `Đã thêm ${chunks.length} đoạn kiến thức mới!` });
            } else {
                res.json({ success: false, message: 'Không thể tải PDF' });
            }
        } else if (websiteUrl) {
            const data = await crawlWebsite(websiteUrl);
            if (data) {
                const chunks = splitTextIntoChunks(data.content);
                for (const chunk of chunks) {
                    customKnowledge.push({
                        source: websiteUrl,
                        type: 'website',
                        title: data.title,
                        content: chunk,
                        keywords: extractKeywords(chunk)
                    });
                }
                res.json({ success: true, message: `Đã crawl và thêm ${chunks.length} đoạn từ website!` });
            } else {
                res.json({ success: false, message: 'Không thể crawl website' });
            }
        } else {
            res.json({ success: false, message: 'Vui lòng cung cấp pdfUrl hoặc websiteUrl' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ========== API: XEM DỮ LIỆU ĐÃ HỌC ==========
app.get('/knowledge-stats', (req, res) => {
    res.json({
        totalChunks: customKnowledge.length,
        sources: [...new Set(customKnowledge.map(k => k.source))],
        knowledgeSource: knowledgeSource
    });
});

// ========== TTS ENDPOINT ==========
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('Missing text');
    
    if (openai && process.env.OPENAI_API_KEY) {
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
            return;
        } catch (error) {
            console.error('TTS error:', error.message);
        }
    }
    res.status(404).send('TTS not available');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        customKnowledgeCount: customKnowledge.length,
        chatGPTReady: !!(openai && process.env.OPENAI_API_KEY)
    });
});

// ========== WEBSOCKET ==========
wss.on('connection', (ws, req) => {
    const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    let sessionId = clientId;
    
    console.log(`🔌 ${isESP32 ? 'ESP32' : 'WEB'} client kết nối`);
    
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    
    if (isESP32) {
        esp32Clients.set(clientId, ws);
        ws.send(JSON.stringify({ type: 'system', message: 'Connected to CHIRI server' }));
    }
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'voice') {
                const reply = await processUserMessage(data.text, data.driveMode === true, sessionId);
                ws.send(JSON.stringify({ type: 'ai', text: reply }));
            }
        } catch(e) {
            console.error('Lỗi xử lý:', e.message);
        }
    });
    
    ws.on('close', () => {
        clearInterval(pingInterval);
        if (esp32Clients.has(clientId)) esp32Clients.delete(clientId);
    });
});

// ========== KHỞI ĐỘNG ==========
const PORT = process.env.PORT || 8080;

// Tải dữ liệu riêng trước khi khởi động server
async function startServer() {
    await loadCustomKnowledge();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 CHIRI AI - RAG Mode`);
        console.log(`📍 http://localhost:${PORT}`);
        console.log(`📚 Dữ liệu riêng: ${customKnowledge.length} đoạn kiến thức`);
        console.log(`🤖 ChatGPT: ${openai && process.env.OPENAI_API_KEY ? 'Sẵn sàng' : 'Không có API key'}\n`);
    });
}

startServer();
