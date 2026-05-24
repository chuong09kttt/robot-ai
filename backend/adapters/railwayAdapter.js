const { WebSocketServer } = require('ws');
const redis = require('redis');

class RailwayAdapter {
    constructor() {
        this.wss = null;
        this.clients = new Map();
        this.redisClient = null;
        
        // Kết nối Redis (Railway cung cấp)
        if (process.env.REDIS_URL) {
            this.redisClient = redis.createClient({ url: process.env.REDIS_URL });
            this.redisClient.connect();
        }
    }
    
    setupWebSocket(server) {
        this.wss = new WebSocketServer({ 
            server, 
            path: process.env.WEBSOCKET_PATH 
        });
        
        this.wss.on('connection', (ws, req) => {
            const clientId = req.headers['x-client-id'];
            this.clients.set(clientId, ws);
            
            ws.on('message', async (data) => {
                const message = JSON.parse(data);
                
                // Broadcast to all clients
                this.broadcast(message, clientId);
                
                // Store in Redis for persistence
                if (this.redisClient) {
                    await this.redisClient.lPush('messages', JSON.stringify(message));
                }
            });
            
            ws.on('close', () => {
                this.clients.delete(clientId);
            });
        });
        
        console.log('✅ Railway WebSocket server started');
    }
    
    broadcast(message, excludeClient = null) {
        for (const [clientId, client] of this.clients) {
            if (clientId !== excludeClient && client.readyState === 1) {
                client.send(JSON.stringify(message));
            }
        }
    }
    
    async getMetrics() {
        return {
            platform: 'railway',
            connections: this.clients.size,
            redisConnected: this.redisClient?.isReady || false,
            uptime: process.uptime()
        };
    }
}

module.exports = new RailwayAdapter();
