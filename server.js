import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.static("public"));

// CORS middleware
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

// TTS Endpoint
app.get('/tts', async (req, res) => {
  const text = req.query.text;
  
  console.log(`[TTS] Request: "${text}"`);
  
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }
  
  try {
    const hasVietnamese = /[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳýỷỹỵ]/i.test(text);
    const voice = hasVietnamese ? "alloy" : "nova";
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
      speed: 0.95
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);
    
  } catch (error) {
    console.error('[TTS Error]', error);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// WebSocket
wss.on("connection", (ws) => {
  console.log("[WS] Client connected");
  
  ws.on("message", async (msg) => {
    const data = safeJSON(msg.toString());
    if (!data) return;

    if (data.type === "esp32") {
      esp32 = ws;
      ws.on("close", () => {
        if (esp32 === ws) esp32 = null;
      });
      console.log("[ESP32] Connected");
      return;
    }

    if (data.type === "user") {
      console.log(`[User] ${data.text}`);
      
      const hasVietnamese = /[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳýỷỹỵ]/i.test(data.text);
      
      const ai = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Bạn là Chiri - trợ lý AI thông minh, vui tính, thân thiện.

QUAN TRỌNG:
- Trả lời bằng CHÍNH XÁC ngôn ngữ người dùng hỏi
- Câu trả lời ngắn gọn, tự nhiên (tối đa 2 câu)
- Luôn trả về JSON: {"speech":"nội dung","cmd":"none"}
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
      
      ws.send(JSON.stringify({ type: "ai", text: speechText }));

      if (obj?.cmd && obj.cmd !== "none") {
        if (obj.cmd !== lastCmd && esp32?.readyState === 1) {
          esp32.send(JSON.stringify({ cmd: obj.cmd }));
          lastCmd = obj.cmd;
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 http://localhost:${PORT}\n`);
});
