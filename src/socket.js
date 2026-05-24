const { aiBrain } = require('./services/ai');
const { sendToDevice } = require('./iot'); // nếu có

async function handleMessage(ws, msg) {

    const result = await aiBrain(msg);

    // ===== CHAT =====
    if (result.mode === 'chat' || result.mode === 'english') {
        ws.send(JSON.stringify({
            type: 'chat',
            message: result.message
        }));
    }

    // ===== IOT CONTROL =====
    if (result.mode === 'iot' || result.commands?.length) {

        result.commands.forEach(cmd => {
            sendToDevice(cmd.device, cmd);
        });

        ws.send(JSON.stringify({
            type: 'iot_executed',
            commands: result.commands
        }));
    }
}

module.exports = { handleMessage };
