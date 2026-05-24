let autonomousMode = false;

const rules = [
    {
        condition: "temperature > 60",
        action: "turn_on_fan"
    },
    {
        condition: "no_person_detected",
        action: "standby"
    },
    {
        condition: "helmet_missing",
        action: "send_alert"
    }
];

function enableAutonomous() {
    autonomousMode = true;
}

function disableAutonomous() {
    autonomousMode = false;
}

function evaluateSensors(data, sendToESP32, broadcast) {

    if (!autonomousMode) return;

    // AI DECISION ENGINE (rule + AI hybrid)

    if (data.temperature > 60) {
        sendToESP32("fan", { action: "on" });

        broadcast({
            type: "ai_action",
            message: "🔥 Overheat detected → Fan ON"
        });
    }

    if (!data.personDetected) {
        sendToESP32("robot", { action: "standby" });
    }

    if (data.helmet === false) {
        broadcast({
            type: "alert",
            message: "⚠️ Person without helmet detected!"
        });
    }
}

module.exports = {
    enableAutonomous,
    disableAutonomous,
    evaluateSensors
};
