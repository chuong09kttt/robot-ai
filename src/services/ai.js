const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function aiBrain(message) {
    const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `
You are an AI Robot with 3 abilities:

1. CHAT MODE (normal conversation)
2. ENGLISH TEACHER MODE
3. IOT CONTROL MODE (ESP32 control)

RULES:
- If user asks about devices (fan, light, motor) → return iot_command JSON
- If user chats normally → chat mode
- If user writes English wrong → correct it

OUTPUT MUST BE JSON:

{
  "mode": "chat | english | iot",
  "message": "",
  "commands": [
    {
      "device": "",
      "action": "",
      "value": ""
    }
  ]
}
`
            },
            { role: "user", content: message }
        ]
    });

    return JSON.parse(res.choices[0].message.content);
}

module.exports = { aiBrain };
