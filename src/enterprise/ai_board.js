const openaiService = require('../services/openai');

class AIBoard {

    async makeDecision(state) {

        const prompt = `
You are the CEO AI of a company.

Analyze company state:

Employees:
${JSON.stringify(state.employees)}

Projects:
${JSON.stringify(state.projects)}

Finance:
${JSON.stringify(state.finance)}

Return ONLY JSON:
{
  "strategy": "",
  "priority": "",
  "action_plan": []
}
`;

        return openaiService.chat(prompt);
    }

    async riskAnalysis(state) {

        const prompt = `
You are CFO + Risk Officer AI.

Detect risks in company:

${JSON.stringify(state)}

Return:
- risk level
- issues
- recommendations
`;

        return openaiService.chat(prompt);
    }
}

module.exports = new AIBoard();
