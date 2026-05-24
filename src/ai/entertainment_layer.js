// ========== ENTERTAINMENT AI LAYER ==========
const openaiService = require('../services/openai');

class EntertainmentLayer {

    async fortuneTelling(input) {

        const prompt = `
You are an entertainment astrology assistant.

IMPORTANT RULES:
- This is ONLY for fun
- Do NOT claim real prediction accuracy
- Always mention "for entertainment only"

User input:
${input}

Provide:
- personality interpretation
- fun prediction
- positive advice
`;

        return await openaiService.chat(prompt);
    }

    async faceReadingDescription(faceData) {

        const prompt = `
You are a fun entertainment face reading AI.

IMPORTANT:
- This is NOT real science
- Only for entertainment

Face data:
${JSON.stringify(faceData)}

Give:
- personality guess (fun only)
- character traits (non-scientific)
- positive motivational comment
`;

        return await openaiService.chat(prompt);
    }

    async numerology(name, birthdate) {

        const prompt = `
You are a numerology entertainment system.

IMPORTANT:
- This is for fun only

Name: ${name}
Birthdate: ${birthdate}

Return:
- life path number (fun calculation)
- personality interpretation
- motivational message
`;

        return await openaiService.chat(prompt);
    }
}

module.exports = new EntertainmentLayer();
