const { processUserMessage } = require('../services/websocket');

async function handleVoice(ws, text, clientId) {

    const response = await processUserMessage(
        text,
        false,
        clientId,
        ws
    );

    ws.send(JSON.stringify({
        type: "voice_response",
        text: response
    }));
}

module.exports = { handleVoice };
