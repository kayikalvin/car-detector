from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import cv2
import numpy as np
import tempfile
import os
from starlette.background import BackgroundTask
from app.models.detector import detector
from app.utils.image_utils import draw_boxes, image_to_base64
from app.utils.video_utils import process_video

router = APIRouter(prefix="/detect", tags=["detection"])

@router.post("/image")
async def detect_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    
    MAX_SIZE = 100 * 1024 * 1024  # 100MB

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(413, "File too large")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image")
    detections = detector.detect(img)
    annotated = draw_boxes(img.copy(), detections)
    img_b64 = image_to_base64(annotated)
    return JSONResponse({
        "detections": detections,
        "count": len(detections),
        "image_base64": img_b64
    })

@router.post("/video")
async def detect_video(file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(400, "File must be a video")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_in:
        tmp_in.write(await file.read())
        input_path = tmp_in.name

    output_path = input_path.replace(".mp4", "_out.mp4")
    try:
        process_video(input_path, output_path)
    except Exception as e:
        raise HTTPException(500, f"Video processing failed: {str(e)}")
    finally:
        os.unlink(input_path)

    def cleanup(path):
        if os.path.exists(path):
            os.unlink(path)

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename="annotated_video.mp4",
        background=BackgroundTask(cleanup, output_path)
    )