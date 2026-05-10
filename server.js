import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.static("public"));

// Thêm CORS để tránh lỗi
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let esp32 = null;
let lastCmd = "";

function safeJSON(str) {
  try { return JSON.parse(str); }
  catch { return null; }
}

// API endpoint for TTS (Text-to-Speech)
app.get('/tts', async (req, res) => {
  const text = req.query.text;
  
  console.log(`[TTS Request] Text: "${text}"`);
  
  if (!text) {
    console.log('[TTS Error] Missing text');
    return res.status(400).json({ error: 'Missing text parameter' });
  }
  
  try {
    // Detect language
    const hasVietnamese = /[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳýỷỹỵ]/i.test(text);
    const voice = hasVietnamese ? "alloy" : "nova";
    
    console.log(`[TTS] Language: ${hasVietnamese ? 'Vietnamese' : 'English'}, Voice: ${voice}`);
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
      speed: 0.95
    });
    
    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    console.log(`[TTS Success] Generated ${buffer.length} bytes`);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });
    res.send(buffer);
    
  } catch (error) {
    console.error('[TTS Error]', error);
    res.status(500).json({ error: 'TTS failed', details: error.message });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ status: 'Server is running', time: new Date().toISOString() });
});

wss.on("connection", (ws) => {
  console.log("[WebSocket] Client connected");
  
  ws.on("message", async (msg) => {
    const data = safeJSON(msg.toString());
    if (!data) return;

    // ESP32 CONNECT
    if (data.type === "esp32") {
      esp32 = ws;
      ws.on("close", () => {
        if (esp32 === ws) esp32 = null;
      });
      console.log("[ESP32] Connected");
      return;
    }

    // USER MESSAGE
    if (data.type === "user") {
      console.log(`[User] ${data.text}`);
      
      // Detect language
      const hasVietnamese = /[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳýỷỹỵ]/i.test(data.text);
      const responseLang = hasVietnamese ? "Vietnamese" : "English";
      
      const ai = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Bạn là Chiri - trợ lý AI thông minh, vui tính, thân thiện, giọng nói dễ thương như con gái.

QUAN TRỌNG:
- PHẢI trả lời bằng CHÍNH XÁC ngôn ngữ mà người dùng hỏi
- Nếu người dùng hỏi tiếng Việt → TRẢ LỜI TIẾNG VIỆT
- Nếu người dùng hỏi tiếng Anh → TRẢ LỜI TIẾNG ANH
- Câu trả lời ngắn gọn, tự nhiên, thân thiện (tối đa 2 câu)
- Luôn trả về JSON: {"speech":"nội dung trả lời","cmd":"none"}
            `
          },
          { role: "user", content: data.text }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const reply = ai.choices[0].message.content;
      const obj = safeJSON(reply);
      const speechText = obj?.speech || reply;
      
      console.log(`[AI Response] ${speechText}`);
      
      // Send text response to web
      ws.send(JSON.stringify({
        type: "ai",
        text: speechText
      }));

      // Send to ESP32 if needed
      if (obj?.cmd && obj.cmd !== "none") {
        if (obj.cmd !== lastCmd && esp32?.readyState === 1) {
          esp32.send(JSON.stringify({ cmd: obj.cmd }));
          lastCmd = obj.cmd;
        }
      }
    }
  });
  
  ws.on("close", () => {
    console.log("[WebSocket] Client disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 Web UI: http://localhost:${PORT}`);
  console.log(`🎤 TTS endpoint: http://localhost:${PORT}/tts?text=hello`);
  console.log(`✅ Ready!\n`);
});
