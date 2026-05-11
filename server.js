const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Phục vụ file tĩnh
app.use(express.static(path.join(__dirname, '/')));

// Cấu hình Serial cho ESP32 (SỬA CỔNG COM ĐÚNG CỦA BẠN)
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';  // Windows: COM3, Linux: /dev/ttyUSB0
const BAUD_RATE = 115200;

let serialPort = null;
let isSerialConnected = false;

// Kết nối ESP32
try {
    serialPort = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    serialPort.on('open', () => {
        console.log(`✅ Đã kết nối ESP32 tại ${SERIAL_PORT}`);
        isSerialConnected = true;
    });
    
    parser.on('data', (data) => {
        console.log(`📡 ESP32 gửi lên: ${data}`);
        // Gửi lại cho WebSocket clients nếu cần
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'esp32', data: data }));
            }
        });
    });
    
    serialPort.on('error', (err) => {
        console.error('❌ Lỗi Serial:', err.message);
        isSerialConnected = false;
    });
} catch(err) {
    console.error('❌ Không thể mở cổng Serial:', err.message);
    console.log(`💡 Hãy cắm ESP32 và sửa cổng SERIAL_PORT trong .env hoặc server.js`);
}

// Gửi lệnh tới ESP32
function sendToESP32(command) {
    if (!serialPort || !isSerialConnected) {
        console.log('⚠️ Chưa kết nối ESP32, lệnh không được gửi');
        return false;
    }
    
    try {
        serialPort.write(command + '\r\n');
        console.log(`📤 Gửi lệnh: ${command}`);
        return true;
    } catch(err) {
        console.error('❌ Lỗi gửi lệnh:', err);
        return false;
    }
}

// WebSocket xử lý
wss.on('connection', (ws) => {
    console.log('🔌 Client đã kết nối WebSocket');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Nhận:', data);
            
            if (data.type === 'voice') {
                // Nhận giọng nói từ client
                const userText = data.text;
                console.log(`🎤 Giọng nói: ${userText}`);
                
                // Xử lý lệnh điều khiển xe
                let command = '';
                let reply = '';
                
                const lowerText = userText.toLowerCase();
                
                // === LỆNH ĐIỀU KHIỂN XE ROBOT ===
                if (lowerText.includes('tiến') || lowerText.includes('đi thẳng') || lowerText.includes('forward')) {
                    command = 'FORWARD';
                    reply = 'Xe đang tiến về phía trước!';
                }
                else if (lowerText.includes('lùi') || lowerText.includes('back') || lowerText.includes('đi lùi')) {
                    command = 'BACKWARD';
                    reply = 'Xe đang lùi lại!';
                }
                else if (lowerText.includes('trái') || lowerText.includes('left') || lowerText.includes('quẹo trái')) {
                    command = 'LEFT';
                    reply = 'Xe đang rẽ trái!';
                }
                else if (lowerText.includes('phải') || lowerText.includes('right') || lowerText.includes('quẹo phải')) {
                    command = 'RIGHT';
                    reply = 'Xe đang rẽ phải!';
                }
                else if (lowerText.includes('dừng') || lowerText.includes('stop') || lowerText.includes('dừng lại')) {
                    command = 'STOP';
                    reply = 'Xe đã dừng lại!';
                }
                else if (lowerText.includes('nhanh') || lowerText.includes('speed up') || lowerText.includes('tăng tốc')) {
                    command = 'SPEED_UP';
                    reply = 'Đang tăng tốc!';
                }
                else if (lowerText.includes('chậm') || lowerText.includes('slow down') || lowerText.includes('giảm tốc')) {
                    command = 'SLOW_DOWN';
                    reply = 'Đang giảm tốc!';
                }
                else {
                    // Xử lý chat bình thường
                    reply = await generateAIResponse(userText);
                }
                
                // Gửi lệnh tới ESP32 nếu có
                if (command) {
                    sendToESP32(command);
                }
                
                // Phản hồi lại client
                ws.send(JSON.stringify({ 
                    type: 'ai', 
                    text: reply,
                    command: command 
                }));
            }
            else if (data.type === 'command') {
                // Lệnh trực tiếp từ UI
                sendToESP32(data.command);
            }
        } catch(e) {
            console.error('Lỗi xử lý message:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 Client ngắt kết nối');
    });
});

// Hàm tạo phản hồi AI đơn giản (có thể thay bằng API Gemini/GPT)
function generateAIResponse(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('xin chào') || lower.includes('hello')) {
        return 'Xin chào! Tôi sẵn sàng điều khiển xe robot cho bạn. Hãy ra lệnh như "tiến", "lùi", "trái", "phải" nhé!';
    } else if (lower.includes('cảm ơn')) {
        return 'Không có gì! Rất vui được giúp bạn điều khiển xe!';
    } else if (lower.includes('tên')) {
        return 'Tôi là Pika AI - trợ lý điều khiển xe robot thông minh!';
    } else {
        return `Bạn vừa nói: "${text}". Hãy thử ra lệnh: tiến, lùi, trái, phải, dừng nhé!`;
    }
}

// Khởi động server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}`);
});
