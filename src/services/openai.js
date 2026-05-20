// ========== OPENAI SERVICE ==========
const OpenAI = require('openai');
const config = require('../config');
const {
    getCachedResponse,
    setCachedResponse
} = require('../utils/cache');

const {
    getSimpleReply
} = require('../utils/helpers');

let openai = null;

if (config.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY
    });
    console.log('✅ OpenAI initialized');
} else {
    console.log('⚠️ OpenAI missing API key');
}

// ========== PHÁT HIỆN NGÔN NGỮ (CHUẨN) ==========
function detectLanguage(text) {
    if (!text) return 'vi';
    
    // Kiểm tra dấu tiếng Việt
    const vietnameseChars = /[àáảãạâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i;
    if (vietnameseChars.test(text)) return 'vi';
    
    // Kiểm tra tiếng Anh
    if (/[a-zA-Z]/.test(text) && text.length > 2) return 'en';
    
    return 'vi';
}

// ========== SYSTEM PROMPT CHUYÊN NGHIỆP (KHÓA NGÔN NGỮ) ==========
function getSystemPrompt(detectedLang) {
    const basePrompt = `
You are CHIRI AI, a professional bilingual robot assistant (like PIKA / restaurant robot).

CRITICAL RULES:
1. **LANGUAGE RULE (MOST IMPORTANT)**:
   - If user speaks Vietnamese → respond ONLY in Vietnamese
   - If user speaks English → respond ONLY in English
   - NEVER mix languages in your response
   - NEVER translate the user's language to another language

2. **RESPONSE STYLE**:
   - Keep answers short, natural, and friendly
   - Be helpful like a commercial robot (PIKA style)
   - Use emojis occasionally to be friendly
   - If you don't know the answer, say so politely

3. **CONTEXT RULE**:
   - Remember previous messages in the conversation
   - Answer the CURRENT question based on context
   - Don't repeat answers unnecessarily

4. **TOPIC RULE**:
   - Answer directly without changing subject
   - If user asks about time/date → answer only that

Current time: ${new Date().toLocaleString(detectedLang === 'vi' ? 'vi-VN' : 'en-US')}
`;
    
    return basePrompt;
}

// Lưu trữ lịch sử hội thoại theo userId
const conversationHistory = new Map();

// ========== CHAT CHÍNH (CẢI TIẾN) ==========
async function chat(message, history = [], userId = 'default', lang = null) {
    // Phát hiện ngôn ngữ từ message
    const detectedLang = lang || detectLanguage(message);
    console.log(`📝 [${userId}] Detected: ${detectedLang.toUpperCase()} | Message: ${message.slice(0, 50)}`);
    
    // Lấy hoặc tạo lịch sử riêng cho user
    if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
    }
    const userHistory = conversationHistory.get(userId);
    
    // Thêm message user vào lịch sử
    userHistory.push({ role: 'user', content: message });
    
    // Giới hạn lịch sử (tối đa 10 cặp tin nhắn)
    const shortHistory = userHistory.slice(-20);
    
    // Build messages với system prompt phù hợp ngôn ngữ
    const messages = [
        {
            role: 'system',
            content: getSystemPrompt(detectedLang)
        },
        ...shortHistory,
        {
            role: 'user',
            content: message
        }
    ];
    
    // Cache key
    const cacheKey = `${detectedLang}_${message.slice(0, 100)}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
        console.log('📦 Using cached response');
        return cached;
    }
    
    // Fallback nếu không có OpenAI
    if (!openai) {
        return getSimpleReply(message, detectedLang);
    }
    
    try {
        console.log('📤 Sending to OpenAI:', { message: message.slice(0, 50), historyCount: shortHistory.length, lang: detectedLang });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 300,
            temperature: 0.5  // Cân bằng giữa sáng tạo và chính xác
        });
        
        let reply = completion.choices?.[0]?.message?.content?.trim();
        
        if (!reply) {
            reply = getSimpleReply(message, detectedLang);
        }
        
        // Lưu reply vào lịch sử
        userHistory.push({ role: 'assistant', content: reply });
        
        // Giới hạn lịch sử (tối đa 30 tin nhắn)
        if (userHistory.length > 30) {
            conversationHistory.set(userId, userHistory.slice(-30));
        }
        
        // Lưu cache
        setCachedResponse(cacheKey, reply);
        
        console.log(`📥 Response (${detectedLang}): ${reply.slice(0, 100)}`);
        return reply;
        
    } catch (error) {
        console.error('❌ OpenAI error:', error.message);
        return getSimpleReply(message, detectedLang);
    }
}

// Xóa lịch sử của user
function clearHistory(userId) {
    conversationHistory.delete(userId);
}

// Lấy lịch sử của user
function getHistory(userId) {
    return conversationHistory.get(userId) || [];
}

module.exports = {
    chat,
    clearHistory,
    getHistory,
    detectLanguage
};
