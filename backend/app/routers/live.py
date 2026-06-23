from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
import cv2
import numpy as np
import base64
from app.models.detector import detector
from app.utils.image_utils import draw_boxes, image_to_base64

router = APIRouter()

@router.websocket("/live")
async def live_detection(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            if websocket.client_state != WebSocketState.CONNECTED:
                break
            data = await websocket.receive_text()
            if ',' in data:
                data = data.split(',')[1]
            img_bytes = base64.b64decode(data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            try:
                detections = detector.detect(frame)
                annotated = draw_boxes(frame, detections)
                b64 = image_to_base64(annotated)
                await websocket.send_text(f"data:image/jpeg;base64,{b64}")
            except Exception as e:
                print(f"Frame processing error: {e}")
                continue

    except (WebSocketDisconnect, RuntimeError):
        print("Live client disconnected")