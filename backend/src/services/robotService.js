const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class RobotService {
    constructor() {
        this.port = null;
        this.parser = null;
        this.isConnected = false;
        this.sensorData = null;
        this.initSerial();
    }
    
    initSerial() {
        try {
            this.port = new SerialPort({
                path: process.env.ESP32_PORT || '/dev/ttyUSB0',
                baudRate: 115200
            });
            
            this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            this.parser.on('data', (data) => {
                try {
                    this.sensorData = JSON.parse(data);
                    console.log('📊 Sensor data:', this.sensorData);
                } catch (e) {
                    console.log('Raw data:', data);
                }
            });
            
            this.isConnected = true;
            console.log('✅ ESP32 connected');
        } catch (error) {
            console.error('❌ ESP32 connection failed:', error);
            this.isConnected = false;
        }
    }
    
    sendCommand(command, speed = 150) {
        if (!this.isConnected) {
            throw new Error('Robot not connected');
        }
        
        const msg = JSON.stringify({ cmd: command, speed });
        this.port.write(msg + '\n');
        
        // Log command for audit
        this.logCommand(command, speed);
        
        return { success: true, command, speed };
    }
    
    async getSensorData() {
        return this.sensorData || { distance: 0, battery: 0, temperature: 0 };
    }
    
    logCommand(command, speed) {
        // Ghi log vào database hoặc file (không lộ ra ngoài)
        console.log(`[AUDIT] Command: ${command}, Speed: ${speed}, Time: ${new Date()}`);
    }
    
    disconnect() {
        if (this.port) {
            this.port.close();
            this.isConnected = false;
        }
    }
}

module.exports = new RobotService();
