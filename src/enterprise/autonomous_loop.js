const company = require('./company_simulator');
const board = require('./ai_board');

class AutonomousLoop {

    constructor(wsServer) {
        this.wsServer = wsServer;
    }

    start() {

        setInterval(async () => {

            // 1. simulate world
            company.tick();

            const state = company.getState();

            // 2. AI decision
            const decision = await board.makeDecision(state);
            const risk = await board.riskAnalysis(state);

            // 3. broadcast to dashboard
            const payload = {
                type: "enterprise_update",
                state,
                decision,
                risk
            };

            if (this.wsServer) {
                this.wsServer.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify(payload));
                    }
                });
            }

        }, 3000); // mỗi 3 giây
    }
}

module.exports = AutonomousLoop;
