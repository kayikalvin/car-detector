import subprocess
import cv2
from app.models.detector import detector
from app.utils.image_utils import draw_boxes

def process_video(input_path: str, output_path: str):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError("Cannot open video file")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Write frames with a codec OpenCV can reliably encode (mp4v), then
    # transcode to H.264 via ffmpeg so browsers can actually play the result.
    # Raw mp4v output is NOT playable in <video> tags in Chrome/Firefox/Safari.
    raw_path = output_path.replace(".mp4", "_raw.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(raw_path, fourcc, fps, (width, height))

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        detections = detector.detect(frame)
        frame = draw_boxes(frame, detections)
        out.write(frame)

    cap.release()
    out.release()

    _transcode_to_h264(raw_path, output_path)


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
        import os
        if os.path.exists(raw_path):
            os.unlink(raw_path)