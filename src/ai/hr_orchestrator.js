const {
    HRAgent,
    ManagerAgent,
    RiskAgent,
    PsychologyAgent,
    DecisionBoard
} = require('./multi_agent_hr');

class HROrchestrator {

    constructor() {
        this.hr = new HRAgent();
        this.manager = new ManagerAgent();
        this.risk = new RiskAgent();
        this.psych = new PsychologyAgent();
        this.board = new DecisionBoard();
    }

    async evaluateCandidate(candidate) {

        // chạy song song agents
        const [hr, manager, risk, psych] = await Promise.all([
            this.hr.analyze(candidate),
            this.manager.evaluate(candidate),
            this.risk.assess(candidate),
            this.psych.analyze(candidate)
        ]);

        // tổng hợp quyết định
        const decision = await this.board.decide(
            hr, manager, risk, psych
        );

        return {
            hr,
            manager,
            risk,
            psych,
            decision
        };
    }
}

module.exports = new HROrchestrator();
