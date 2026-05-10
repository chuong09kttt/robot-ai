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

let esp32Client = null;

wss.on("connection", (ws) => {

  console.log("Client connected");

  ws.on("message", async (message) => {

    try {

      const data = JSON.parse(message);

      // ESP32 REGISTER
      if(data.type === "esp32") {

        esp32Client = ws;

        console.log("ESP32 connected");

        return;
      }

      // USER MESSAGE
      if(data.type === "user") {

        console.log("User:", data.text);

        const completion =
          await openai.chat.completions.create({

          model: "gpt-4.1-mini",

          messages: [
            {
              role: "system",
              content:
              `
              Bạn là AI robot.

              Nếu người dùng yêu cầu điều khiển robot,
              hãy trả JSON.

              Ví dụ:
              {"speech":"Đang tiến lên","cmd":"forward"}

              Lệnh:
              forward
              backward
              left
              right
              stop
              `
            },

            {
              role: "user",
              content: data.text
            }
          ]
        });

        const reply =
          completion.choices[0].message.content;

        console.log(reply);

        // SEND TO WEB
        ws.send(JSON.stringify({
          type:"ai",
          text:reply
        }));

        // TRY PARSE COMMAND
        try {

          const obj = JSON.parse(reply);

          if(obj.cmd && esp32Client) {

            esp32Client.send(JSON.stringify({
              cmd:obj.cmd
            }));
          }

        } catch(err) {}

      }

    } catch(err) {

      console.log(err);

    }

  });

});

server.listen(3000, () => {

  console.log("Server running");

});