import subprocess
import os
import cv2
from app.models.detector import detector
from app.utils.image_utils import draw_boxes

def process_video(input_path: str, output_path: str):
    """Processes video frame-by-frame, returns stats dict:
    { frame_count, max_concurrent_detections, total_detection_events }
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError("Cannot open video file")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    raw_path = output_path.replace(".mp4", "_raw.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(raw_path, fourcc, fps, (width, height))

    frame_count = 0
    max_concurrent = 0
    total_events = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        detections = detector.detect(frame)
        frame = draw_boxes(frame, detections)
        out.write(frame)

        frame_count += 1
        total_events += len(detections)
        max_concurrent = max(max_concurrent, len(detections))

    cap.release()
    out.release()

    _transcode_to_h264(raw_path, output_path)

    return {
        "frame_count": frame_count,
        "max_concurrent_detections": max_concurrent,
        "total_detection_events": total_events,
    }


def _transcode_to_h264(raw_path: str, output_path: str):
    """Re-encode to H.264 + yuv420p MP4 for browser playback."""
    cmd = [
        "ffmpeg", "-y",
        "-i", raw_path,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        output_path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    finally:
        if os.path.exists(raw_path):
            os.unlink(raw_path)