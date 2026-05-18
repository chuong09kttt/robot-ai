// ========== OPENAI SERVICE ==========
const OpenAI = require('openai');
const config = require('../config');
const { getCachedResponse, setCachedResponse } = require('../utils/cache');
const { getSimpleReply } = require('../utils/helpers');

let openai = null;

if (config.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY
    });

    console.log('✅ OpenAI initialized');
} else {
    console.log('⚠️ No API key');
}

function getSystemPrompt(lang='vi') {

    if(lang==='en'){

        return `
You are Chiri.

Rules:

- Answer accurately.
- Keep answers short.
- Natural human tone.
- Use ENGLISH only.
- Use context ONLY if supplied.
- Do NOT continue old topics automatically.
- If user changes subject, answer the new question directly.
`;
    }

    return `
Bạn là Chiri AI.

Quy tắc:

- Trả lời chính xác.
- Trả lời ngắn gọn tự nhiên.
- Chỉ dùng tiếng Việt.
- Chỉ dùng context nếu được cung cấp.
- KHÔNG tự tiếp tục chủ đề cũ.
- Nếu người dùng đổi chủ đề, trả lời câu hỏi mới.
`;
}

async function chat(
    message,
    history=[],
    userId='default',
    lang='vi'
){

    const cacheKey =
    `${message}_${lang}`;

    const cached =
    getCachedResponse(cacheKey);

    if(cached){
        return cached;
    }

    if(!openai){
        return getSimpleReply(message,lang);
    }

    try{

        const messages=[

            {
                role:'system',
                content:getSystemPrompt(lang)
            },

            ...history.slice(-6),

            {
                role:'user',
                content:message
            }

        ];

        console.log(
            "OPENAI SEND:",
            JSON.stringify(messages,null,2)
        );

        const completion =
        await openai.chat.completions.create({

            model:'gpt-4o-mini',

            messages,

            temperature:0.4,

            max_tokens:250

        });

        const reply =
        completion.choices[0]
        .message
        .content;

        setCachedResponse(
            cacheKey,
            reply
        );

        return reply;

    }
    catch(error){

        console.error(
            "OpenAI error:",
            error.message
        );

        return getSimpleReply(
            message,
            lang
        );
    }
}

module.exports={
    chat
};
