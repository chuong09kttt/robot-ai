let autonomous = false;

function enable() {
    autonomous = true;
}

function disable() {
    autonomous = false;
}

function evaluate(vision, sendToESP32, broadcast) {

    if (!autonomous) return;

    if (!vision.person) {
        sendToESP32("robot", { action: "standby" });

        broadcast({
            type: "ai_alert",
            message: "No person detected"
        });
    }

    if (vision.helmet === false) {
        broadcast({
            type: "ai_alert",
            message: "⚠️ Helmet missing detected!"
        });
    }
}

module.exports = { enable, disable, evaluate };
