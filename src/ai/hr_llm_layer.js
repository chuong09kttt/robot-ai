// ========== HR + MANAGEMENT LLM LAYER ==========
const openaiService = require('../services/openai');

class HRLLMLayer {

    // 1. TẠO CÂU HỎI PHỎNG VẤN
    async generateInterviewQuestions(jobRole, level = "junior") {

        const prompt = `
You are a professional HR recruiter.

Create 5 interview questions for:
- Role: ${jobRole}
- Level: ${level}

Include:
- technical questions
- behavioral questions
- problem solving questions

Return in Vietnamese.
`;

        return await openaiService.chat(prompt, [], "hr_questions");
    }

    // 2. ĐÁNH GIÁ ỨNG VIÊN
    async evaluateCandidate(candidateInfo, answers) {

        const prompt = `
You are a senior HR evaluator.

Evaluate this candidate:

Profile:
${JSON.stringify(candidateInfo)}

Interview Answers:
${JSON.stringify(answers)}

Return JSON:
{
  "score": 0-100,
  "strengths": [],
  "weaknesses": [],
  "recommendation": "hire | reject | review",
  "reason": ""
}
`;

        const result = await openaiService.chat(prompt, [], "hr_evaluation");

        try {
            return JSON.parse(result);
        } catch (e) {
            return {
                score: 50,
                recommendation: "review",
                reason: "Parse error fallback"
            };
        }
    }

    // 3. GỢI Ý TUYỂN DỤNG
    async hiringDecision(teamContext, candidatePool) {

        const prompt = `
You are a hiring manager AI.

Team context:
${JSON.stringify(teamContext)}

Candidates:
${JSON.stringify(candidatePool)}

Suggest:
- best candidate
- reasoning
- risk factors
`;

        return await openaiService.chat(prompt);
    }

    // 4. THEO DÕI TIẾN ĐỘ DỰ ÁN
    async trackProjectProgress(projectData) {

        const prompt = `
You are a project manager AI.

Analyze project progress:

${JSON.stringify(projectData)}

Return:
- progress %
- risks
- delays
- suggestions
`;

        return await openaiService.chat(prompt);
    }
}

module.exports = new HRLLMLayer();
