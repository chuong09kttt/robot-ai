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

CRITICAL RULES - YOU MUST FOLLOW:
1. ONLY answer the CURRENT question. IGNORE all previous topics.
2. DO NOT continue talking about VinFast, cars, Dantri, or any unrelated topic unless the user explicitly asks.
3. If user asks about science (sun mass, moon, planets, time, date), answer ONLY that topic.
4. If user asks "what time is it" or "today's date", answer ONLY the time/date.
5. NEVER mix topics. Each question is independent.
6. Keep answers short, natural, and friendly.

EXAMPLE:
- User: "khối lượng mặt trời bao nhiêu" → You answer ONLY about sun mass.
- User: "hôm nay ngày bao nhiêu" → You answer ONLY today's date.
- User: "what time is it" → You answer ONLY current time.

DO NOT mention VinFast, Dantri, or cars unless the user explicitly asks about them.
`;

    }

    return `
Bạn là Chiri AI.

QUY TẮC CỰC KỲ QUAN TRỌNG - PHẢI LÀM THEO:
1. CHỈ trả lời câu hỏi HIỆN TẠI. BỎ QUA mọi chủ đề cũ.
2. KHÔNG tiếp tục nói về VinFast, ô tô, Dân trí, hay bất kỳ chủ đề không liên quan trừ khi người dùng hỏi trực tiếp.
3. Nếu người dùng hỏi về khoa học (khối lượng mặt trời, mặt trăng, hành tinh, giờ, ngày), CHỈ trả lời đúng chủ đề đó.
4. Nếu hỏi "mấy giờ" hoặc "hôm nay ngày bao nhiêu", CHỈ trả lời giờ/ngày.
5. TUYỆT ĐỐI KHÔNG trộn lẫn chủ đề. Mỗi câu hỏi là độc lập.
6. Trả lời ngắn gọn, tự nhiên, thân thiện.

VÍ DỤ:
- Hỏi: "khối lượng mặt trời bao nhiêu" → Chỉ trả lời về khối lượng mặt trời.
- Hỏi: "hôm nay ngày bao nhiêu" → Chỉ trả lời ngày hôm nay.
- Hỏi: "mấy giờ rồi" → Chỉ trả lời giờ hiện tại.

KHÔNG được nhắc đến VinFast, Dân trí, hay ô tô trừ khi người dùng hỏi cụ thể về chúng.
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
        console.log('📦 Using cached response for:', message.slice(0, 50));
        return cached;
    }

    // no api
    if (!openai) {
        return getSimpleReply(message, lang);
    }

    try {

        // LIMIT HISTORY - chỉ lấy 4 tin gần nhất để giảm nhiễu
        const cleanHistory =
            Array.isArray(history)
                ? history.slice(-4)
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

                max_tokens: 250,

                temperature: 0.3  // giảm nhiệt độ để trả lời chính xác hơn, ít sáng tạo sai
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
