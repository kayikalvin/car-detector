from ultralytics import YOLO
from app.config import MODEL_PATH, CONFIDENCE_THRESHOLD, CAR_CLASS_ID
import numpy as np

class CarDetector:
    def __init__(self):
        self.model = YOLO(MODEL_PATH)

    def detect(self, image: np.ndarray):
        """Return list of car detections with bbox and confidence."""
        results = self.model(image, verbose=False, conf=CONFIDENCE_THRESHOLD)[0]
        detections = []
        if results.boxes is not None:
            for box in results.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if cls_id == CAR_CLASS_ID:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    detections.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": round(conf, 4),
                        "class": "car"
                    })
        return detections

# Global detector (singleton) loaded once at startup
detector = CarDetector()