import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.static("public"));

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
  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' });
  }
  
  try {
    // Detect language (simple check)
    const isEnglish = /^[a-zA-Z\s\.,!?'"]+$/.test(text);
    const voice = isEnglish ? "nova" : "alloy"; // Nova for English, Alloy for Vietnamese
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
      speed: 0.95
    });
    
    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: 'TTS failed' });
  }
});

wss.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    const data = safeJSON(msg.toString());
    if (!data) return;

    // ESP32 CONNECT
    if (data.type === "esp32") {
      esp32 = ws;
      ws.on("close", () => {
        if (esp32 === ws) esp32 = null;
      });
      console.log("ESP32 connected");
      return;
    }

    // USER MESSAGE
    if (data.type === "user") {
      // Detect language from user input
      const isEnglish = /^[a-zA-Z\s\.,!?'"]+$/.test(data.text);
      const responseLang = isEnglish ? "English" : "Vietnamese";
      
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

Ví dụ người dùng hỏi "khối lượng mặt trời bao nhiêu" → Trả lời tiếng Việt
Ví dụ người dùng hỏi "what is your name" → Trả lời tiếng Anh
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
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running with OpenAI TTS");
});
