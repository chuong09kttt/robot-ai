const devices = new Map();

function registerDevice(id, ws) {
    devices.set(id, ws);

    ws.on('close', () => {
        devices.delete(id);
    });
}

function sendToDevice(id, command) {
    const ws = devices.get(id);

    if (!ws) {
        console.log("Device offline:", id);
        return;
    }

    ws.send(JSON.stringify({
        type: "command",
        data: command
    }));
}

module.exports = {
    registerDevice,
    sendToDevice
};
