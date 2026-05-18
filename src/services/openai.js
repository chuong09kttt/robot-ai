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

// ========== SYSTEM PROMPT ==========
function getSystemPrompt(lang = 'vi') {

    if (lang === 'en') {

        return `
You are Chiri AI.

Rules:
- Answer correctly and naturally
- Keep answers short
- Friendly tone
- English only
- DO NOT continue old topics unless user asks
- If context is provided, use it
- If no context, answer normally
`;

    }

    return `
Bạn là Chiri AI.

Quy tắc:
- Trả lời chính xác
- Ngắn gọn tự nhiên
- Thân thiện
- KHÔNG tự tiếp tục chủ đề cũ
- Chỉ dùng context nếu được cung cấp
- Không tự bịa
`;
}

// ========== CHAT ==========
async function chat(
    message,
    history = [],
    userId = 'default',
    lang = 'vi'
) {

    // cache
    const cacheKey =
        `${lang}_${message.slice(0, 100)}`;

    const cached =
        getCachedResponse(cacheKey);

    if (cached) {
        return cached;
    }

    // no api
    if (!openai) {
        return getSimpleReply(message, lang);
    }

    try {

        // LIMIT HISTORY
        const cleanHistory =
            Array.isArray(history)
                ? history.slice(-6)
                : [];

        const messages = [

            {
                role: 'system',
                content: getSystemPrompt(lang)
            },

            ...cleanHistory,

            {
                role: 'user',
                content: message
            }
        ];

        console.log('📤 Sending to OpenAI:', {
            message,
            historyCount: cleanHistory.length,
            lang
        });

        const completion =
            await openai.chat.completions.create({

                model: 'gpt-3.5-turbo',

                messages,

                max_tokens: 200,

                temperature: 0.5
            });

        const reply =
            completion
                .choices?.[0]
                ?.message
                ?.content
                ?.trim();

        if (!reply) {

            return getSimpleReply(
                message,
                lang
            );
        }

        setCachedResponse(
            cacheKey,
            reply
        );

        return reply;

    } catch (error) {

        console.error(
            '❌ OpenAI error:',
            error.message
        );

        return getSimpleReply(
            message,
            lang
        );
    }
}

module.exports = {
    chat
};
