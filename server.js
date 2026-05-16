const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');

// ========== AUTHENTICATION ==========
const USERS = {
    'admin': { password: 'admin123', name: 'Quản trị viên' },
    'user1': { password: '123456', name: 'Nguyễn Văn A' },
    'user2': { password: '123456', name: 'Trần Thị B' }
};

// ========== CACHE ==========
const responseCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
const ttsCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

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
app.use(express.urlencoded({ extended: true }));

// ========== KHỞI TẠO OPENAI ==========
let openai = null;
if (OpenAI && process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI API Key configured - ChatGPT mode ready');
    } catch (err) {
        console.error('❌ OpenAI init error:', err.message);
    }
} else {
    console.log('⚠️ No OPENAI_API_KEY, using simple reply mode');
}

// ========== REAL-TIME FUNCTIONS ==========
function getCurrentTime(lang = 'vi') {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    if (lang === 'en') {
        const period = hours < 12 ? 'AM' : 'PM';
        const hour12 = hours % 12 || 12;
        return `It's ${hour12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${period}.`;
    } else {
        let period = '';
        let hour12 = hours % 12;
        if (hour12 === 0) hour12 = 12;
        if (hours < 12) period = 'sáng';
        else if (hours < 18) period = 'chiều';
        else period = 'tối';
        return `Bây giờ là ${hour12} giờ ${minutes} phút ${seconds} giây ${period}.`;
    }
}

function getCurrentDate(lang = 'vi') {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    if (lang === 'en') {
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `Today is ${weekdays[now.getDay()]}, ${months[month - 1]} ${day}, ${year}.`;
    } else {
        const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        const weekday = weekdays[now.getDay()];
        return `Hôm nay là ${weekday}, ngày ${day} tháng ${month} năm ${year}.`;
    }
}

// ========== LANGUAGE DETECTION ==========
function detectLanguage(text) {
    if (!text || text.length === 0) return 'vi';
    
    const vietnameseChars = /[àáảãạăâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i;
    
    if (vietnameseChars.test(text)) {
        return 'vi';
    }
    
    const englishKeywords = /\b(what|where|when|why|how|who|which|is|are|am|was|were|do|does|did|have|has|had|can|could|will|would|should|may|might|please|thank|hello|hi|hey|good|bad|nice|love|like|help|support|sorry|yes|no|ok|okay|thanks|welcome|how are you|i am|you are)\b/i;
    
    if (englishKeywords.test(text)) {
        return 'en';
    }
    
    const latinOnly = /^[a-zA-Z0-9\s\.\,\?\!]+$/.test(text);
    if (latinOnly && text.length > 2) {
        return 'en';
    }
    
    return 'vi';
}

function getSystemPrompt(lang, customContext = '') {
    if (lang === 'en') {
        let prompt = `You are Chiri - a smart, friendly, cute AI assistant.
IMPORTANT:
- Answer ALL user questions accurately and helpfully
- If asked about distance, answer with distance
- If asked about time, answer with real-time
- Tone: friendly, enthusiastic, use emojis (❤️, 😊, 🚀)
- Answer in ENGLISH only
- Answer SHORT (2-3 sentences)
- If you don't know, honestly say "I'm not sure about that"`;
        
        if (customContext) {
            prompt += `\n\n**REFERENCE INFORMATION (prioritize using):**\n${customContext.slice(0, 400)}\n\nUse the above information to answer if appropriate.`;
        }
        return prompt;
    } else {
        let prompt = `Bạn là Chiri - một trợ lý AI thông minh, thân thiện, dễ thương.
QUAN TRỌNG:
- Trả lời MỌI câu hỏi của người dùng một cách chính xác, hữu ích
- Nếu hỏi về khoảng cách, trả lời khoảng cách
- Nếu hỏi về thời gian, trả lời thời gian thực
- Nếu hỏi về VinFast, hãy dùng thông tin từ bài báo Dân trí ngày 13/5/2026
- Giọng điệu: thân thiện, nhiệt tình, dùng icon cảm xúc (❤️, 😊, 🚀)
- Trả lời bằng TIẾNG VIỆT
- Trả lời NGẮN GỌN (2-3 câu)
- Nếu không biết, hãy thành thật nói "Mình chưa rõ lắm"`;

        if (customContext) {
            prompt += `\n\n**THÔNG TIN THAM KHẢO (ưu tiên sử dụng):**\n${customContext.slice(0, 400)}\n\nHãy dùng thông tin trên để trả lời nếu phù hợp.`;
        }
        return prompt;
    }
}

// ========== FALLBACK KNOWLEDGE ==========
const fallbackKnowledge = {
    'vinfast': `Theo bài báo Dân trí ngày 13/5/2026, VinFast đang tái cấu trúc:
- Công ty Tương Lai (của ông Phạm Nhật Vượng) mua lại 2 nhà máy tại Hải Phòng và Hà Tĩnh với giá 13.309,6 tỷ đồng
- Đồng thời nhận lại khoảng 182.000 tỷ đồng nợ của VinFast
- Sau tái cấu trúc, VinFast sẽ không còn mảng sản xuất tại Việt Nam, thay vào đó thuê Công ty Tương Lai sản xuất
- VinFast vẫn giữ các mảng R&D, thiết kế, kinh doanh, bảo hành, hậu mãi
- VinFast dự kiến có lãi từ năm 2027
- Khách hàng không bị ảnh hưởng về chất lượng sản phẩm và chế độ bảo hành`,
    
    'vinfast tu bo o to': `VinFast không từ bỏ ngành ô tô. Họ đang tái cấu trúc để tối ưu chi phí và giảm nợ. VinFast vẫn giữ thương hiệu, vẫn bán xe, vẫn bảo hành bình thường. Mục tiêu là có lãi từ năm 2027.`,
    
    'son la': 'Tỉnh Sơn La không nằm trong phương án sáp nhập theo tài liệu dự kiến. Sơn La giữ nguyên hiện trạng.',
    
    'sap nhap tinh': 'Theo tài liệu dự kiến, có 23 tỉnh thành mới được sáp nhập từ 63 tỉnh thành hiện tại. Các tỉnh như Hà Nội, Huế, Sơn La, Lai Châu, Điện Biên, Lạng Sơn, Quảng Ninh, Thanh Hoá, Nghệ An, Hà Tĩnh, Cao Bằng không sáp nhập.',
    
    'vard vung tau': 'VARD Vũng Tàu là công ty đóng tàu chuyên dụng, thành lập năm 2006, có 1100 nhân viên đến từ 63 tỉnh thành. Địa chỉ: Đường số 6, KCN Đông Xuyên, Phường Rạch Dừa, TP. Vũng Tàu. Công ty có kế hoạch tuyển thêm lên 2000 người, đơn hàng đến 2026.'
};

function searchFallbackKnowledge(query, lang = 'vi') {
    const lower = query.toLowerCase();
    
    if (lang === 'en') {
        if (lower.includes('vinfast') && (lower.includes('quit') || lower.includes('abandon') || lower.includes('leave'))) {
            return 'VinFast is not quitting the automotive industry. They are restructuring to optimize costs and reduce debt. VinFast still keeps the brand, still sells cars, still provides warranty. Target is to be profitable from 2027.';
        }
        if (lower.includes('vinfast')) {
            return `According to Dan Tri newspaper on May 13, 2026, VinFast is restructuring:
- Future Company (of Mr. Pham Nhat Vuong) will buy 2 factories in Hai Phong and Ha Tinh for 13,309.6 billion VND
- Also takes over about 182,000 billion VND of VinFast's debt
- After restructuring, VinFast will no longer have manufacturing in Vietnam, instead hire Future Company to produce
- VinFast still keeps R&D, design, sales, warranty, after-sales
- VinFast expects to be profitable from 2027
- Customers are not affected in product quality and warranty`;
        }
        if (lower.includes('son la') || (lower.includes('son') && lower.includes('la'))) {
            return 'Son La province is not included in the proposed merger plan according to the document. Son La remains unchanged.';
        }
        if (lower.includes('province') && lower.includes('merge')) {
            return 'According to the proposed document, 23 new provinces/cities will be merged from the current 63 provinces/cities. Provinces like Hanoi, Hue, Son La, Lai Chau, Dien Bien, Lang Son, Quang Ninh, Thanh Hoa, Nghe An, Ha Tinh, Cao Bang will not merge.';
        }
        if (lower.includes('vard') || (lower.includes('vung') && lower.includes('tau'))) {
            return 'VARD Vung Tau is a specialized shipbuilding company, established in 2006, with 1,100 employees from 63 provinces. Address: Street 6, Dong Xuyen Industrial Park, Rach Dua Ward, Vung Tau City. The company plans to recruit up to 2,000 people, with orders until 2026.';
        }
        return null;
    }
    
    if (lower.includes('vinfast') && (lower.includes('từ bỏ') || lower.includes('bỏ ngành') || lower.includes('rút lui'))) {
        return fallbackKnowledge['vinfast tu bo o to'];
    }
    if (lower.includes('vinfast')) {
        return fallbackKnowledge['vinfast'];
    }
    if (lower.includes('son la') || (lower.includes('sơn') && lower.includes('la'))) {
        return fallbackKnowledge['son la'];
    }
    if (lower.includes('sap nhap') || lower.includes('sáp nhập') || (lower.includes('nhập') && lower.includes('tỉnh'))) {
        return fallbackKnowledge['sap nhap tinh'];
    }
    if (lower.includes('vard') || (lower.includes('vung') && lower.includes('tau'))) {
        return fallbackKnowledge['vard vung tau'];
    }
    return null;
}

// ========== RAG KNOWLEDGE BASE ==========
let customKnowledge = [];
let knowledgeSource = '';

// ========== GOOGLE DRIVE CONFIG ==========
const GOOGLE_DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || '1RXqoUIQgb_UgvbjM8h3412OZdsxPAZPP';

async function downloadFromGoogleDrive(fileId) {
    if (!axios) return null;
    
    try {
        console.log(`📥 Downloading from Google Drive ID: ${fileId}`);
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const buffer = Buffer.from(response.data);
        
        if (pdfParse) {
            try {
                const pdfData = await pdfParse(buffer);
                console.log(`✅ PDF loaded: ${pdfData.numpages} pages, ${pdfData.text.length} chars`);
                return pdfData.text;
            } catch (e) {
                return buffer.toString('utf-8');
            }
        }
        return buffer.toString('utf-8');
    } catch (error) {
        console.error('❌ Google Drive download error:', error.message);
        return null;
    }
}

async function crawlWebsite(url) {
    if (!axios || !cheerio) return null;
    
    try {
        console.log(`🕷️ Crawling: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, .sidebar, .navigation, iframe, .advertisement, .cookie-banner').remove();
        
        let content = '';
        const selectors = ['main', 'article', '.content', '.main-content', '#content', '.post-content', '.entry-content', 'body'];
        
        for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                content = elements.text().trim();
                if (content.length > 500) break;
            }
        }
        
        content = content.replace(/\s+/g, ' ').trim();
        console.log(`✅ Crawled: ${content.length} chars from ${url}`);
        
        return { url, title: $('title').text() || url, content };
    } catch (error) {
        console.error(`❌ Crawl error ${url}:`, error.message);
        return null;
    }
}

function splitTextIntoChunks(text, maxChunkSize = 1000) {
    if (!text) return [];
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
        if (paragraph.trim().length === 0) continue;
        if (paragraph.length <= maxChunkSize) {
            chunks.push(paragraph.trim());
        } else {
            const sentences = paragraph.split(/[.!?]+/);
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
        }
    }
    return chunks;
}

function extractKeywords(text) {
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = cleanText.split(/\s+/);
    const stopwords = new Set(['và', 'của', 'có', 'là', 'một', 'với', 'cho', 'khi', 'đã', 'sẽ', 'được', 'không', 'các', 'những']);
    const keywords = [];
    for (const word of words) {
        if (word.length > 2 && !stopwords.has(word)) {
            keywords.push(word);
        }
    }
    return [...new Set(keywords.slice(0, 20))];
}

async function loadCustomKnowledge() {
    console.log('\n📚 LOADING CUSTOM KNOWLEDGE...\n');
    const allContent = [];
    
    const defaultWebsites = process.env.DEFAULT_WEBSITES 
        ? process.env.DEFAULT_WEBSITES.split(',')
        : [
            'https://vi.wikipedia.org/wiki/Tuổi_thọ',
            'https://vi.wikipedia.org/wiki/Sức_khỏe',
            'https://www.vard.com/vungtau',
            'https://dantri.com.vn/o-to-xe-may/lanh-dao-vinfast-noi-gi-ve-nghi-van-tu-bo-nganh-o-to-20260513203658767.htm'
          ];
    
    if (axios && cheerio) {
        console.log('🌐 Crawling websites...');
        for (const url of defaultWebsites) {
            const data = await crawlWebsite(url);
            if (data) {
                allContent.push({ source: url, type: 'website', title: data.title, content: data.content });
            }
            await delay(1000);
        }
    }
    
    if (GOOGLE_DRIVE_FILE_ID && axios) {
        console.log(`📁 Downloading from Google Drive ID: ${GOOGLE_DRIVE_FILE_ID}...`);
        const pdfContent = await downloadFromGoogleDrive(GOOGLE_DRIVE_FILE_ID);
        if (pdfContent) {
            allContent.push({
                source: `Google Drive (PDF sáp nhập tỉnh)`,
                type: 'pdf',
                title: 'Phương án sáp nhập tỉnh thành Việt Nam',
                content: pdfContent
            });
        }
    }
    
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
    
    knowledgeSource = `📚 Loaded ${customKnowledge.length} knowledge chunks from ${allContent.length} sources`;
    console.log(`\n✅ ${knowledgeSource}\n`);
}

function searchInKnowledge(query) {
    if (customKnowledge.length === 0) return [];
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const results = [];
    
    for (const chunk of customKnowledge) {
        let score = 0;
        const chunkLower = chunk.content.toLowerCase();
        
        if (chunkLower.includes(queryLower)) score += 30;
        for (const word of queryWords) {
            if (chunkLower.includes(word)) score += 2;
            if (chunk.keywords && chunk.keywords.includes(word)) score += 5;
        }
        score += Math.min(10, chunk.content.length / 200);
        if (chunk.source && chunk.source.includes('dantri')) score += 15;
        
        if (score > 5) {
            results.push({ score, content: chunk.content, source: chunk.source, title: chunk.title });
        }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 3);
}

function generateAnswerFromKnowledge(query, results) {
    if (results.length === 0) return null;
    const bestMatch = results[0];
    
    if (bestMatch.score >= 15) {
        return {
            answer: `📖 **Theo ${bestMatch.source}:**\n\n${bestMatch.content.substring(0, 600)}${bestMatch.content.length > 600 ? '...' : ''}`,
            source: bestMatch.source,
            confidence: 'high'
        };
    }
    
    if (results.length >= 2 && results[0].score >= 10) {
        let combined = `📚 **Tổng hợp từ các nguồn:**\n\n`;
        for (let i = 0; i < Math.min(2, results.length); i++) {
            combined += `📌 **${results[i].source}:**\n${results[i].content.substring(0, 300)}...\n\n`;
        }
        return { answer: combined, source: 'multiple sources', confidence: 'medium' };
    }
    return null;
}

async function callChatGPT(userMessage, history = [], customContext = '', lang = 'vi') {
    const cacheKey = userMessage.slice(0, 200) + lang;
    const cached = responseCache.get(cacheKey);
    if (cached) return cached;
    
    if (!openai || !process.env.OPENAI_API_KEY) {
        return getSimpleReply(userMessage, lang);
    }
    
    try {
        const systemPrompt = getSystemPrompt(lang, customContext);
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                ...history.slice(-10),
                { role: 'user', content: userMessage.slice(0, 500) }
            ],
            max_tokens: 350,
            temperature: 0.7,
        });
        const reply = completion.choices[0].message.content;
        responseCache.set(cacheKey, reply);
        return reply;
    } catch (error) {
        console.error('❌ ChatGPT error:', error.message);
        return getSimpleReply(userMessage, lang);
    }
}

function getSimpleReply(userMessage, lang = 'vi') {
    const lower = userMessage.toLowerCase();
    
    if (lang === 'en') {
        if (lower.includes('hello') || lower.includes('hi')) {
            return 'Hello! I am Chiri AI, nice to meet you! 💕';
        }
        if (lower.includes('how are you')) {
            return 'I am doing great! Thank you for asking. How can I help you today? 😊';
        }
        if (lower.includes('thank')) {
            return 'You\'re welcome! Happy to help you! 💖';
        }
        return `🤔 I heard you say: "${userMessage.slice(0, 50)}". I am still learning to answer better.`;
    } else {
        if (lower.includes('xin chào') || lower.includes('hello')) {
            return 'Xin chào bạn! Mình là Chiri AI, rất vui được gặp bạn! 💕';
        }
        if (lower.includes('khỏe') || lower.includes('khoẻ')) {
            return 'Mình rất tốt, cảm ơn bạn đã hỏi! Bạn có thể giúp gì cho mình hôm nay không? 😊';
        }
        if (lower.includes('cảm ơn')) {
            return 'Không có gì đâu ạ! Rất vui khi được giúp bạn! 💖';
        }
        return `🤔 Mình nghe bạn nói: "${userMessage.slice(0, 50)}". Mình đang học hỏi thêm để trả lời tốt hơn.`;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getDriveCommand(text) {
    const lower = text.toLowerCase().trim();
    const cleanText = lower.replace(/đang|ơi|ạ|mình|hãy|làm ơn|cho|tôi/g, '');
    
    if (cleanText.includes('tiến') || cleanText === 'đi' || cleanText.includes('forward')) return 'FORWARD';
    if (cleanText.includes('lùi') || cleanText.includes('back')) return 'BACKWARD';
    if (cleanText.includes('trái') || cleanText.includes('left')) return 'LEFT';
    if (cleanText.includes('phải') || cleanText.includes('right')) return 'RIGHT';
    if (cleanText.includes('dừng') || cleanText.includes('stop')) return 'STOP';
    return null;
}

function sendToESP32(command, duration = 0) {
    let sent = false;
    for (const [id, client] of esp32Clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'command', command: command, duration: duration }));
            console.log(`📤 Send to ESP32: ${command} (duration: ${duration}ms)`);
            sent = true;
        }
    }
    return sent;
}

function handleCountdownCommand(text) {
    const lower = text.toLowerCase();
    const secondMatch = lower.match(/(?:đếm ngược|countdown|hẹn giờ)\s*(\d+)\s*(giây|s)/i);
    const minuteMatch = lower.match(/(?:đếm ngược|countdown|hẹn giờ)\s*(\d+)\s*(phút|m)/i);
    
    if (secondMatch) {
        let seconds = parseInt(secondMatch[1]);
        if (seconds > 0 && seconds <= 3600) return { isCountdown: true, seconds };
    }
    if (minuteMatch) {
        let seconds = parseInt(minuteMatch[1]) * 60;
        if (seconds > 0 && seconds <= 3600) return { isCountdown: true, seconds };
    }
    return { isCountdown: false };
}

// ========== TRANSLATION API ==========
async function translateText(text, source, target) {
    if (!text || text.trim() === '') return '';
    
    try {
        // Sử dụng API dịch MyMemory (miễn phí)
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            let translated = response.data.responseData.translatedText;
            translated = translated.replace(/^\[ERROR\]\s*/, '');
            return translated;
        }
        return text;
    } catch (error) {
        console.error('Translation error:', error.message);
        return text;
    }
}

// ========== PROCESS USER MESSAGE ==========
async function processUserMessage(userText, driveMode, sessionId, ws) {
    if (!processingQueue.has(sessionId)) {
        processingQueue.set(sessionId, Promise.resolve());
    }
    
    const queue = processingQueue.get(sessionId);
    return await queue.then(async () => {
        try {
            console.log(`🔍 [${sessionId}] Process: "${userText}" | driveMode: ${driveMode}`);
            
            const lang = detectLanguage(userText);
            console.log(`🌐 Detected language: ${lang === 'en' ? 'ENGLISH' : 'VIETNAMESE'}`);
            
            // Check for translation commands
            const lower = userText.toLowerCase();
            if (lower.includes('bật phiên dịch') || lower.includes('bật dịch realtime')) {
                return "🌐 Đã bật chế độ phiên dịch real-time! Vui lòng chọn ngôn ngữ trên màn hình và bắt đầu nói.";
            }
            if (lower.includes('tắt phiên dịch') || lower.includes('tắt dịch')) {
                return "🌐 Đã tắt chế độ phiên dịch real-time.";
            }
            
            // DRIVE MODE
            if (driveMode === true) {
                const command = getDriveCommand(userText);
                if (command) {
                    sendToESP32(command, 0);
                    const replies = {
                        'FORWARD': lang === 'en' ? '🚗 Moving forward!' : '🚗 Xe tiến lên!',
                        'BACKWARD': lang === 'en' ? '🚗 Moving backward!' : '🚗 Xe lùi lại!',
                        'LEFT': lang === 'en' ? '🚗 Turning left!' : '🚗 Xe rẽ trái!',
                        'RIGHT': lang === 'en' ? '🚗 Turning right!' : '🚗 Xe rẽ phải!',
                        'STOP': lang === 'en' ? '🛑 Stopped!' : '🛑 Xe dừng lại!'
                    };
                    return replies[command];
                }
                return lang === 'en' 
                    ? '🚫 Car control mode. Please say: FORWARD, BACK, LEFT, RIGHT, or STOP.'
                    : '🚫 Chế độ điều khiển xe. Vui lòng nói: TIẾN, LÙI, TRÁI, PHẢI, hoặc DỪNG.';
            }
            
            // COUNTDOWN
            const countdown = handleCountdownCommand(userText);
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
            
            // REAL-TIME
            if (lower.includes('what time') || lower.includes('current time') || lower.includes('time now') ||
                lower.includes('mấy giờ') || (lower.includes('giờ') && lower.includes('bao nhiêu'))) {
                return getCurrentTime(lang);
            }
            if (lower.includes('what date') || lower.includes('today') || lower.includes('what day') ||
                lower.includes('hôm nay') || lower.includes('ngày bao nhiêu') || lower.includes('ngày mấy')) {
                return getCurrentDate(lang);
            }
            
            // FALLBACK KNOWLEDGE
            const fallbackAnswer = searchFallbackKnowledge(userText, lang);
            if (fallbackAnswer) return fallbackAnswer;
            
            // RAG
            console.log('🔍 Searching in custom knowledge...');
            const searchResults = searchInKnowledge(userText);
            
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
            
            // CHAT MODE
            if (!conversationHistory[sessionId]) {
                conversationHistory[sessionId] = [];
            }
            
            conversationHistory[sessionId].push({ role: 'user', content: userText });
            
            let reply;
            if (customContext) {
                reply = await callChatGPT(userText, conversationHistory[sessionId], customContext, lang);
            } else {
                reply = await callChatGPT(userText, conversationHistory[sessionId], '', lang);
            }
            
            conversationHistory[sessionId].push({ role: 'assistant', content: reply });
            
            if (conversationHistory[sessionId].length > 20) {
                conversationHistory[sessionId] = conversationHistory[sessionId].slice(-20);
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

async function generateHighQualityTTS(text, lang = 'vi') {
    const cacheKey = text.slice(0, 200) + lang;
    const cached = ttsCache.get(cacheKey);
    if (cached) return cached;
    
    try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
        const response = await axios({
            method: 'get',
            url: ttsUrl,
            responseType: 'stream',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        ttsCache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        return null;
    }
}

// ========== API ENDPOINTS ==========

// LOGIN endpoint
app.post('/api/login', (req, res) => {
    console.log('📝 Login request:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin!' });
    }
    
    const user = USERS[username];
    if (user && user.password === password) {
        console.log(`✅ User logged in: ${username}`);
        res.json({ success: true, name: user.name, username: username });
    } else {
        console.log(`❌ Login failed: ${username}`);
        res.json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
    }
});

// Face registration
app.post('/api/register-face', (req, res) => {
    const { username, faceDescriptor } = req.body;
    // Lưu face descriptor vào file (có thể mở rộng)
    const faceFile = 'face-data.json';
    let faceData = {};
    try {
        if (fs.existsSync(faceFile)) {
            faceData = JSON.parse(fs.readFileSync(faceFile, 'utf8'));
        }
    } catch(e) {}
    
    if (!faceData[username]) faceData[username] = [];
    faceData[username].push(faceDescriptor);
    fs.writeFileSync(faceFile, JSON.stringify(faceData, null, 2));
    
    res.json({ success: true, message: `Đã lưu khuôn mặt cho ${username}` });
});

app.get('/api/face-database', (req, res) => {
    const faceFile = 'face-data.json';
    let users = [];
    try {
        if (fs.existsSync(faceFile)) {
            const faceData = JSON.parse(fs.readFileSync(faceFile, 'utf8'));
            users = Object.keys(faceData);
        }
    } catch(e) {}
    res.json({ users: users.length ? users : ['admin', 'user1', 'user2'] });
});

// TTS endpoint
app.get('/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('Missing text');
    const lang = detectLanguage(text);
    const ttsLang = lang === 'en' ? 'en' : 'vi';
    const audioStream = await generateHighQualityTTS(text, ttsLang);
    if (audioStream) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        audioStream.pipe(res);
    } else {
        res.status(404).send('TTS unavailable');
    }
});

// Translation endpoint
app.post('/api/translate', async (req, res) => {
    const { text, source, target } = req.body;
    if (!text) return res.json({ success: false, translated: '' });
    
    const translated = await translateText(text, source, target);
    res.json({ success: true, original: text, translated: translated });
});

// Upload PDF
app.post('/api/upload-pdf', async (req, res) => {
    try {
        const { fileContent, fileName } = req.body;
        if (!fileContent) return res.json({ success: false, message: 'No file content' });
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
        res.json({ success: true, message: `Đã thêm ${chunks.length} đoạn kiến thức từ PDF!` });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Add website
app.post('/api/add-website', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.json({ success: false, message: 'No URL provided' });
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
            res.json({ success: true, message: `Đã crawl và thêm ${chunks.length} đoạn từ website!` });
        } else {
            res.json({ success: false, message: 'Không thể crawl website' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Add Google Drive
app.post('/api/add-drive', async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) return res.json({ success: false, message: 'No file ID provided' });
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
            res.json({ success: true, message: `Đã thêm ${chunks.length} đoạn từ Google Drive!` });
        } else {
            res.json({ success: false, message: 'Không thể tải file từ Google Drive' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Knowledge stats
app.get('/api/knowledge-stats', (req, res) => {
    const sources = {};
    for (const item of customKnowledge) {
        sources[item.source] = (sources[item.source] || 0) + 1;
    }
    res.json({
        totalChunks: customKnowledge.length,
        sources: sources,
        knowledgeSource: knowledgeSource,
        modulesAvailable: { openai: !!openai, pdfParse: !!pdfParse, axios: !!axios, cheerio: !!cheerio }
    });
});

// Clear knowledge
app.post('/api/clear-knowledge', (req, res) => {
    customKnowledge = [];
    res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu đã học!' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', time: new Date().toISOString() });
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
        ttsCacheSize: ttsCache.keys().length
    });
});

// ========== WEBSOCKET ==========
wss.on('connection', (ws, req) => {
    const isESP32 = req.headers['user-agent']?.includes('ESP32') || false;
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    let sessionId = clientId;
    
    console.log(`🔌 ${isESP32 ? 'ESP32' : 'WEB'} connected: ${clientId}`);
    
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    
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
            
            if (data.type === 'drive_command') {
                console.log(`🚗 Drive command: ${data.command} (duration: ${data.duration}ms)`);
                sendToESP32(data.command, data.duration);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'drive_response', command: data.command, status: 'executed' }));
                }
            }
            
            if (data.type === 'translate') {
                const translated = await translateText(data.text, data.source, data.target);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'translation', original: data.text, translated: translated }));
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


// ========== GAME MULTIPLAYER ==========
let gamePlayers = {};

// Thêm vào phần WebSocket handling
wss.on('connection', (ws, req) => {
    // ... existing code ...
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            // ... existing code ...
            
            // GAME: Xử lý di chuyển người chơi
            if (data.type === 'game_move') {
                gamePlayers[clientId] = {
                    x: data.x,
                    z: data.z,
                    rotation: data.rotation,
                    lastUpdate: Date.now()
                };
                
                // Gửi danh sách người chơi đến tất cả
                const playersList = {};
                for (const [id, player] of Object.entries(gamePlayers)) {
                    if (Date.now() - player.lastUpdate < 5000) {
                        playersList[id] = { x: player.x, z: player.z, rotation: player.rotation };
                    }
                }
                
                // Broadcast to all game clients
                for (const [id, client] of wss.clients) {
                    if (client.readyState === WebSocket.OPEN && gamePlayers[id]) {
                        client.send(JSON.stringify({ type: 'game_players', players: playersList }));
                    }
                }
            }
            
        } catch(e) {
            console.error('WebSocket error:', e.message);
        }
    });
    
    ws.on('close', () => {
        delete gamePlayers[clientId];
        // ... existing code ...
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 8080;

async function startServer() {
    await loadCustomKnowledge();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n╔══════════════════════════════════════════════════════════════════════════════╗`);
        console.log(`║                         🚀 CHIRI AI - FULL FEATURE MODE v12.0                ║`);
        console.log(`╠══════════════════════════════════════════════════════════════════════════════╣`);
        console.log(`║  📍 Server URL: http://localhost:${PORT}                                                    ║`);
        console.log(`║  🔐 Login: admin / admin123                                                      ║`);
        console.log(`║  📚 Knowledge chunks: ${customKnowledge.length.toString().padEnd(46)}║`);
        console.log(`║  🤖 ChatGPT: ${(openai && process.env.OPENAI_API_KEY ? 'READY ✅' : 'NOT AVAILABLE ⚠️').padEnd(46)}║`);
        console.log(`║  📄 PDF Reader: ${(pdfParse ? 'READY ✅' : 'NOT AVAILABLE ⚠️').padEnd(46)}║`);
        console.log(`║  🕷️ Web Crawler: ${(axios && cheerio ? 'READY ✅' : 'NOT AVAILABLE ⚠️').padEnd(46)}║`);
        console.log(`║  🌐 Language: Auto-detect (VI/EN) ✅                                               ║`);
        console.log(`║  🌐 Real-time Translation: READY ✅ (8 languages)                                  ║`);
        console.log(`║  🎤 Voice Control: READY ✅                                                        ║`);
        console.log(`║  ⏰ Countdown Timer: READY ✅                                                      ║`);
        console.log(`║  📅 Real-time Clock: READY ✅                                                     ║`);
        console.log(`║  🚗 Drive Control: READY ✅ (Button + Voice)                                       ║`);
        console.log(`║  📷 Face Detection: READY ✅ (Face Mesh)                                           ║`);
        console.log(`║  👤 Face Recognition: READY ✅ (Register + Recognize)                              ║`);
        console.log(`║  🚗 ESP32 Clients: ${esp32Clients.size.toString().padEnd(46)}║`);
        console.log(`║  💤 Auto-sleep: 60 seconds inactivity                                            ║`);
        console.log(`║  📄 PDF Source: Google Drive (sáp nhập tỉnh)                                      ║`);
        console.log(`║  🌐 Website Sources: vard.com/vungtau, dantri.com.vn (VinFast)                   ║`);
        console.log(`╠══════════════════════════════════════════════════════════════════════════════╣`);
        console.log(`║  💡 RULE: Vietnamese question → Vietnamese answer | English → English         ║`);
        console.log(`║  🌐 TRANSLATION: Hỗ trợ VI, EN, ZH, JA, KO, FR, DE, ES                         ║`);
        console.log(`║  📷 FACE ID: Đăng ký 3 ảnh → Nhập tên → Lưu → Nhận diện                        ║`);
        console.log(`╚══════════════════════════════════════════════════════════════════════════════╝`);
        console.log(``);
    });
}

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

startServer();
