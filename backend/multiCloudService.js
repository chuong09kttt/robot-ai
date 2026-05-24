const railwayAdapter = require('../adapters/railwayAdapter');
const oracleAdapter = require('../adapters/oracleAdapter');
const ngrokAdapter = require('../adapters/ngrokAdapter');

class MultiCloudService {
    constructor() {
        this.primaryCloud = process.env.PRIMARY_CLOUD || 'railway';
        this.backupCloud = process.env.BACKUP_CLOUD || 'oracle';
        this.availableClouds = new Map();
        this.currentCloud = this.primaryCloud;
        
        // Khởi tạo tất cả adapters
        this.adapters = {
            railway: railwayAdapter,
            oracle: oracleAdapter,
            ngrok: ngrokAdapter
        };
    }
    
    async init() {
        // Kiểm tra cloud nào đang hoạt động
        for (const [name, adapter] of Object.entries(this.adapters)) {
            try {
                const status = await this.checkCloudHealth(name);
                this.availableClouds.set(name, status);
                console.log(`✅ ${name} cloud: ${status ? 'available' : 'unavailable'}`);
            } catch (error) {
                this.availableClouds.set(name, false);
                console.error(`❌ ${name} cloud failed:`, error.message);
            }
        }
        
        // Chọn cloud tốt nhất
        this.selectBestCloud();
        
        // Health check mỗi 30 giây
        setInterval(() => this.healthCheck(), 30000);
    }
    
    async checkCloudHealth(cloudName) {
        const adapter = this.adapters[cloudName];
        
        switch(cloudName) {
            case 'railway':
                // Kiểm tra WebSocket server
                return adapter.wss ? adapter.wss.clients.size >= 0 : false;
                
            case 'oracle':
                // Kiểm tra Object Storage
                const test = await adapter.uploadVideo(Buffer.from('test'), Date.now());
                return !!test.url;
                
            case 'ngrok':
                // Kiểm tra tunnel
                const metrics = await adapter.getMetrics();
                return metrics.connected;
                
            default:
                return false;
        }
    }
    
    selectBestCloud() {
        // Ưu tiên: railway > ngrok > oracle
        if (this.availableClouds.get('railway')) {
            this.currentCloud = 'railway';
        } else if (this.availableClouds.get('ngrok')) {
            this.currentCloud = 'ngrok';
        } else if (this.availableClouds.get('oracle')) {
            this.currentCloud = 'oracle';
        } else {
            console.error('⚠️ No cloud available!');
            this.currentCloud = null;
        }
        
        console.log(`🌩️ Selected cloud: ${this.currentCloud}`);
        return this.currentCloud;
    }
    
    async healthCheck() {
        for (const [name, available] of this.availableClouds) {
            const currentStatus = await this.checkCloudHealth(name);
            if (currentStatus !== available) {
                this.availableClouds.set(name, currentStatus);
                console.log(`🔄 ${name} cloud status changed: ${currentStatus}`);
                
                // Nếu primary cloud down, switch to backup
                if (name === this.primaryCloud && !currentStatus) {
                    console.log(`⚠️ Primary cloud down! Switching to backup...`);
                    this.selectBestCloud();
                    await this.notifyCloudSwitch();
                }
            }
        }
    }
    
    async notifyCloudSwitch() {
        // Gửi notification đến robot
        const message = JSON.stringify({
            type: 'cloud_switch',
            new_cloud: this.currentCloud,
            timestamp: Date.now()
        });
        
        if (global.esp32Port) {
            global.esp32Port.write(message + '\n');
        }
        
        // Log lên database
        console.log(`🔄 Switched to ${this.currentCloud} cloud`);
    }
    
    async getMetrics() {
        const metrics = {};
        for (const [name, adapter] of Object.entries(this.adapters)) {
            try {
                metrics[name] = await adapter.getMetrics();
                metrics[name].available = this.availableClouds.get(name);
            } catch (error) {
                metrics[name] = { error: error.message, available: false };
            }
        }
        
        metrics.current = this.currentCloud;
        metrics.timestamp = new Date();
        
        return metrics;
    }
    
    getAdapter() {
        return this.adapters[this.currentCloud];
    }
}

module.exports = new MultiCloudService();
