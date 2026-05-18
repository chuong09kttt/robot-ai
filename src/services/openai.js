// ========== OPENAI SERVICE ==========
const OpenAI = require('openai');
const config = require('../config');
const { getCachedResponse, setCachedResponse } = require('../utils/cache');
const { getSimpleReply } = require('../utils/helpers');

let openai = null;
if (config.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    console.log('✅ OpenAI service initialized');
} else {
    console.log('⚠️ OpenAI not configured, using smart reply mode');
}

const conversationHistory = new Map();

function getSystemPrompt(lang, customContext = '') {
    if (lang === 'en') {
        return `You are Chiri - a smart, friendly, cute AI assistant.
- Answer ALL user questions accurately and helpfully
- Tone: friendly, enthusiastic, use emojis (❤️, 😊, 🚀)
- Answer in ENGLISH only
- Answer SHORT and NATURAL (2-3 sentences max)
- Use conversational language, like a real person talking
- If you don't know, say "I'm not sure about that, but I can help you search!"`;
    } else {
        return `Bạn là Chiri - một trợ lý AI thông minh, thân thiện, dễ thương.
- Trả lời MỌI câu hỏi của người dùng một cách chính xác, hữu ích
- Giọng điệu: thân thiện, tự nhiên, dùng icon cảm xúc (❤️, 😊, 🚀)
- Trả lời bằng TIẾNG VIỆT, TỰ NHIÊN NHƯ NGƯỜI THẬT
- Trả lời NGẮN GỌN (2-3 câu), không lan man
- Sử dụng ngôn ngữ đời thường, gần gũi
- Nếu không biết, nói "Mình chưa rõ lắm, nhưng mình có thể giúp bạn tra cứu thêm nhé!"`;
    }
}

async function chat(message, history = [], userId = 'default', lang = 'vi', customContext = '') {
    const cacheKey = `${userId}_${message.slice(0, 200)}_${lang}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;
    
    if (!openai) {
        return getSimpleReply(message, lang);
    }
    
    try {
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }
        
        const userHistory = conversationHistory.get(userId);
        const messages = [
            { role: 'system', content: getSystemPrompt(lang, customContext) },
            ...userHistory.slice(-10),
            { role: 'user', content: message }
        ];
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 200,
            temperature: 0.8,
        });
        
        const reply = completion.choices[0].message.content;
        
        userHistory.push({ role: 'user', content: message });
        userHistory.push({ role: 'assistant', content: reply });
        if (userHistory.length > 20) {
            userHistory.splice(0, userHistory.length - 20);
        }
        
        setCachedResponse(cacheKey, reply);
        return reply;
        
    } catch (error) {
        console.error('OpenAI error:', error.message);
        return getSimpleReply(message, lang);
    }
}

function clearHistory(userId) {
    conversationHistory.delete(userId);
}

function getHistory(userId) {
    return conversationHistory.get(userId) || [];
}

module.exports = { chat, clearHistory, getHistory };
