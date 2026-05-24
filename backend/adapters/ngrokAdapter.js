const ngrok = require('ngrok');
const axios = require('axios');

class NgrokAdapter {
    constructor() {
        this.url = null;
        this.tunnels = {};
        this.isConnected = false;
    }
    
    async start() {
        try {
            // Kết nối ngrok
            this.url = await ngrok.connect({
                addr: process.env.PORT || 3000,
                authtoken: process.env.NGROK_AUTH_TOKEN,
                region: process.env.NGROK_REGION || 'ap', // Asia Pacific
                onStatusChange: (status) => {
                    console.log(`ngrok status: ${status}`);
                    this.isConnected = status === 'connected';
                }
            });
            
            // Tạo multiple tunnels
            this.tunnels.ws = await ngrok.connect({
                addr: 3001,
                proto: 'tcp',
                authtoken: process.env.NGROK_AUTH_TOKEN
            });
            
            this.tunnels.video = await ngrok.connect({
                addr: 8080,
                auth: `${process.env.NGROK_USER}:${process.env.NGROK_PASS}`,
                authtoken: process.env.NGROK_AUTH_TOKEN
            });
            
            console.log(`✅ ngrok public URL: ${this.url}`);
            console.log(`✅ WebSocket tunnel: ${this.tunnels.ws}`);
            
            // Gửi URL cho robot biết
            await this.notifyRobot();
            
            return {
                api: this.url,
                websocket: this.tunnels.ws,
                video: this.tunnels.video
            };
        } catch (error) {
            console.error('ngrok failed:', error);
            throw error;
        }
    }
    
    async notifyRobot() {
        // Gửi URL mới đến ESP32 qua Serial/Bluetooth
        const message = JSON.stringify({
            type: 'ngrok_update',
            api_url: this.url,
            ws_url: this.tunnels.ws,
            timestamp: Date.now()
        });
        
        // Gửi qua serial port
        if (global.esp32Port) {
            global.esp32Port.write(message + '\n');
        }
        
        // Lưu vào file để robot đọc
        const fs = require('fs');
        fs.writeFileSync('/tmp/ngrok_url.txt', this.url);
    }
    
    async getMetrics() {
        try {
            const response = await axios.get('http://localhost:4040/api/tunnels');
            return {
                connected: this.isConnected,
                tunnels: response.data.tunnels,
                url: this.url
            };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
    
    async stop() {
        await ngrok.kill();
        this.isConnected = false;
        console.log('ngrok stopped');
    }
}

module.exports = new NgrokAdapter();
