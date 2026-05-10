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

      const ai = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Bạn là Chiri - trợ lý AI thông minh, vui tính, thân thiện.

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

      // SEND TO ESP32 (ANTI SPAM)
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
