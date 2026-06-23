import os

MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "yolov8n.pt"))
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model weights not found at {MODEL_PATH}")
CONFIDENCE_THRESHOLD = 0.5
# CAR_CLASS_ID = 2  # COCO class for 'car'
DETECT_CLASS_IDS = None  # None = detect all 80 COCO classes