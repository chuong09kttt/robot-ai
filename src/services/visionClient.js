const WebSocket = require('ws');

let visionData = {};

function connectVisionServer() {
    const ws = new WebSocket("ws://localhost:8001/ws/vision");

    ws.on('message', (msg) => {
        visionData = JSON.parse(msg);
    });

    ws.on('open', () => {
        console.log("📷 Vision connected");
    });

    ws.on('close', () => {
        console.log("❌ Vision disconnected");
    });
}

function getVisionData() {
    return visionData;
}

module.exports = {
    connectVisionServer,
    getVisionData
};
