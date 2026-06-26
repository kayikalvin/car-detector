// const BASE_URL = "http://localhost:8000";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";




/**
 * Detects cars in a single image.
 * Returns { detections, count, image_base64 } as defined by /detect/image.
 */
export async function detectImage(file, signal) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/detect/image`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok) {
    const message = await safeErrorMessage(res);
    throw new Error(message);
  }

  return res.json();
}
/**
 * Sends a video for annotation. Returns { blob, stats } where stats is
 * { frameCount, maxConcurrentDetections, totalDetectionEvents }.
 */
export async function detectVideo(file, signal) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/detect/video`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok) {
    const message = await safeErrorMessage(res);
    throw new Error(message);
  }

  const stats = {
    frameCount: Number(res.headers.get("X-Frame-Count")) || 0,
    maxConcurrentDetections: Number(res.headers.get("X-Max-Concurrent-Detections")) || 0,
    totalDetectionEvents: Number(res.headers.get("X-Total-Detection-Events")) || 0,
  };

  const blob = await res.blob();
  return { blob, stats };
}

/**
 * Checks backend health. Used for the connection indicator in the status bar.
 */
export async function checkHealth(signal) {
  const res = await fetch(`${BASE_URL}/api/status`, { signal });
  if (!res.ok) throw new Error("Backend unhealthy");
  return res.json();
}

/**
 * Opens a WebSocket to the /live endpoint for streaming frame-by-frame detection.
 */
export function openLiveSocket() {
  const wsUrl = BASE_URL.replace(/^http/, "ws") + "/live";
  return new WebSocket(wsUrl);
}

async function safeErrorMessage(res) {
  try {
    const data = await res.json();
    return data.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export { BASE_URL };