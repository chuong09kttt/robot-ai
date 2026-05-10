import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

dotenv.config();

const app = express();
app.use(express.static("public"));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google TTS (tùy chọn, nâng cao)
let ttsClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  ttsClient = new TextToSpeechClient();
}

let esp32 = null;
let lastCmd = "";

function safeJSON(str) {
  try { return JSON.parse(str); }
  catch { return null; }
}

// Endpoint TTS
app.post('/tts', async (req, res) => {
  if (!ttsClient) {
    return res.status(400).json({ error: 'TTS not configured' });
  }
  
  const { text, lang } = req.body;
  const request = {
    input: { text },
    voice: { 
      languageCode: lang === 'en' ? 'en-US' : 'vi-VN',
      name: lang === 'en' ? 'en-US-Neural2-F' : 'vi-VN-Neural2-A',
      ssmlGender: 'FEMALE'
    },
    audioConfig: { audioEncoding: 'MP3' },
  };
  
  const [response] = await ttsClient.synthesizeSpeech(request);
  res.set('Content-Type', 'audio/mp3');
  res.send(response.audioContent);
});

wss.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    const data = safeJSON(msg.toString());
    if (!data) return;

    if (data.type === "esp32") {
      esp32 = ws;
      ws.on("close", () => {
        if (esp32 === ws) esp32 = null;
      });
      console.log("ESP32 connected");
      return;
    }

    if (data.type === "user") {
      const ai = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Bạn là Chiri - trợ lý AI thông minh, vui tính, thân thiện như robot Pika.

Luôn trả JSON:
{"speech":"...","cmd":"..."}

Luật:
- Nói chuyện tự nhiên, biểu cảm
- Phát hiện ngôn ngữ: nếu câu hỏi tiếng Anh thì trả lời tiếng Anh, tiếng Việt thì trả lời tiếng Việt
- cmd: forward, backward, left, right, stop, none (chỉ dùng khi nói về điều khiển robot)
            `
          },
          { role: "user", content: data.text }
        ]
      });

      const reply = ai.choices[0].message.content;
      const obj = safeJSON(reply);

      ws.send(JSON.stringify({
        type: "ai",
        text: obj?.speech || reply
      }));

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
  console.log("Server running");
});
