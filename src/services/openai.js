// ========== OPENAI SERVICE ==========
const OpenAI = require('openai');
const config = require('../config');
const { getCachedResponse, setCachedResponse } = require('../utils/cache');
const { getSimpleReply, detectLanguage } = require('../utils/helpers');

let openai = null;
if (config.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    console.log('✅ OpenAI service initialized');
} else {
    console.log('⚠️ OpenAI not configured, using smart reply mode');
}

// Conversation histories
const conversationHistory = new Map();

// System prompts
function getSystemPrompt(lang) {
    if (lang === 'en') {
        return `You are Chiri - a smart, friendly, cute AI assistant.
- Answer ALL user questions accurately and helpfully
- Tone: friendly, enthusiastic, use emojis (❤️, 😊, 🚀)
- Answer in ENGLISH only, SHORT (2-3 sentences)
- If you don't know, say "I'm not sure about that"`;
    } else {
        return `Bạn là Chiri - một trợ lý AI thông minh, thân thiện, dễ thương.
- Trả lời MỌI câu hỏi của người dùng một cách chính xác, hữu ích
- Giọng điệu: thân thiện, nhiệt tình, dùng icon cảm xúc (❤️, 😊, 🚀)
- Trả lời bằng TIẾNG VIỆT, NGẮN GỌN (2-3 câu)
- Nếu không biết, nói "Mình chưa rõ lắm"`;
    }
}

// Chat with AI
async function chat(message, history = [], userId = 'default', lang = 'vi') {
    const cacheKey = `${userId}_${message.slice(0, 200)}_${lang}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;
    
    if (!openai) {
        return getSimpleReply(message, lang);
    }
    
    try {
        // Get or create conversation history
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }
        
        const userHistory = conversationHistory.get(userId);
        const messages = [
            { role: 'system', content: getSystemPrompt(lang) },
            ...userHistory.slice(-10),
            { role: 'user', content: message.slice(0, 500) }
        ];
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 350,
            temperature: 0.7
        });
        
        const reply = completion.choices[0].message.content;
        
        // Update history
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

// Clear conversation history
function clearHistory(userId) {
    conversationHistory.delete(userId);
}

// Get conversation history
function getHistory(userId) {
    return conversationHistory.get(userId) || [];
}

module.exports = {
    chat,
    clearHistory,
    getHistory
};
