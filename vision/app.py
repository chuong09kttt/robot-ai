from fastapi import FastAPI, WebSocket
import cv2
import base64
import numpy as np
from ultralytics import YOLO

app = FastAPI()

model = YOLO("helmet_model.pt")

@app.websocket("/ws/vision")
async def vision_socket(ws: WebSocket):
    await ws.accept()

    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        results = model(frame)

        helmet = False
        person = False

        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                label = model.names[cls]

                if label == "helmet":
                    helmet = True
                if label == "person":
                    person = True

        _, buffer = cv2.imencode('.jpg', frame)
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')

        await ws.send_json({
            "type": "vision",
            "helmet": helmet,
            "person": person,
            "frame": jpg_as_text
        })
