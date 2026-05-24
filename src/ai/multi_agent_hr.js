const openaiService = require('../services/openai');

// ================= HR AGENT =================
class HRAgent {
    async analyze(candidate) {
        return openaiService.chat(`
You are HR recruiter.

Analyze candidate:
${JSON.stringify(candidate)}

Return JSON:
{
  "skill_score": 0-100,
  "experience_fit": 0-100,
  "summary": ""
}
`);
    }
}

// ================= MANAGER AGENT =================
class ManagerAgent {
    async evaluate(candidate) {
        return openaiService.chat(`
You are a project manager.

Evaluate team fit and workload capacity.

Candidate:
${JSON.stringify(candidate)}

Return JSON:
{
  "team_fit": 0-100,
  "leadership_potential": 0-100,
  "risk": "low|medium|high"
}
`);
    }
}

// ================= RISK AGENT =================
class RiskAgent {
    async assess(candidate) {
        return openaiService.chat(`
You are a risk analyst.

Check:
- inconsistency
- overclaiming
- instability

Candidate:
${JSON.stringify(candidate)}

Return JSON:
{
  "risk_score": 0-100,
  "flags": []
}
`);
    }
}

// ================= PSYCHOLOGY AGENT =================
class PsychologyAgent {
    async analyze(candidate) {
        return openaiService.chat(`
You are a behavioral psychologist AI.

Analyze personality traits.

Candidate:
${JSON.stringify(candidate)}

Return JSON:
{
  "personality_fit": 0-100,
  "stress_tolerance": 0-100
}
`);
    }
}

// ================= FINAL DECISION BOARD =================
class DecisionBoard {

    async decide(hr, manager, risk, psych) {

        const prompt = `
You are final hiring decision AI.

Inputs:

HR:
${hr}

Manager:
${manager}

Risk:
${risk}

Psychology:
${psych}

Return ONLY JSON:
{
  "decision": "hire|reject|review",
  "confidence": 0-100,
  "reason": ""
}
`;

        return openaiService.chat(prompt);
    }
}

module.exports = {
    HRAgent,
    ManagerAgent,
    RiskAgent,
    PsychologyAgent,
    DecisionBoard
};
