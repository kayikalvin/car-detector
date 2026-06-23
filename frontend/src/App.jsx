import { useState, useEffect, useRef, useCallback } from "react";
import ViewfinderFrame from "./components/Viewfinderframe.jsx";
import { detectImage, detectVideo, checkHealth, openLiveSocket } from "./api.js";

// ─── helpers ────────────────────────────────────────────────────────────────
function useSystemClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? "var(--color-phosphor)"
      : pct >= 50
      ? "var(--color-amber)"
      : "var(--color-alert)";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 flex-1 rounded-full"
        style={{ background: "var(--color-line-bright)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function BBoxOverlay({ detections, naturalWidth, naturalHeight }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });

  useEffect(() => {
    if (!containerRef.current || !naturalWidth || !naturalHeight) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale({ x: width / naturalWidth, y: height / naturalHeight });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [naturalWidth, naturalHeight]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-10">
      {detections.map((det, i) => {
        const [x1, y1, x2, y2] = det.bbox;
        const left = x1 * scale.x;
        const top = y1 * scale.y;
        const width = (x2 - x1) * scale.x;
        const height = (y2 - y1) * scale.y;
        const pct = Math.round(det.confidence * 100);
        return (
          <div
            key={i}
            className="absolute animate-lock-on"
            style={{ left, top, width, height }}
          >
            <div
              className="absolute inset-0 border"
              style={{ borderColor: "var(--color-phosphor)" }}
            />
            <div
              className="absolute -top-5 left-0 px-1 text-[10px] tracking-widest whitespace-nowrap"
              style={{
                background: "var(--color-void)",
                color: "var(--color-phosphor)",
                lineHeight: "18px",
              }}
            >
              {det.class_name?.toUpperCase() ?? "TGT"} {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── sidebar ────────────────────────────────────────────────────────────────
function TelemetrySidebar({ detections, mode, backendOk }) {
  return (
    <aside
      className="flex flex-col gap-4 overflow-y-auto"
      style={{
        width: "220px",
        minWidth: "220px",
        borderLeft: "1px solid var(--color-line)",
        padding: "16px",
      }}
    >
      {/* system status */}
      <section>
        <p
          className="text-[10px] tracking-widest mb-2"
          style={{ color: "var(--color-muted)" }}
        >
          SYS_STATUS
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            {
              label: "BACKEND",
              ok: backendOk,
              val: backendOk ? "ONLINE" : "OFFLINE",
            },
            {
              label: "MODE",
              ok: true,
              val: mode.toUpperCase(),
            },
          ].map(({ label, ok, val }) => (
            <div key={label} className="flex justify-between text-[11px]">
              <span style={{ color: "var(--color-muted)" }}>{label}</span>
              <span
                style={{
                  color: ok ? "var(--color-phosphor)" : "var(--color-alert)",
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ borderTop: "1px solid var(--color-line)" }} />

      {/* detection count */}
      <section>
        <p
          className="text-[10px] tracking-widest mb-1"
          style={{ color: "var(--color-muted)" }}
        >
          DETECTIONS
        </p>
        <p
          className="text-4xl tabular-nums text-shadow-glow"
          style={{ color: "var(--color-phosphor)", lineHeight: 1 }}
        >
          {String(detections.length).padStart(2, "0")}
        </p>
      </section>

      {detections.length > 0 && (
        <>
          <div style={{ borderTop: "1px solid var(--color-line)" }} />
          <section className="flex flex-col gap-3">
            <p
              className="text-[10px] tracking-widest"
              style={{ color: "var(--color-muted)" }}
            >
              TARGET_LOG
            </p>
            {detections.map((det, i) => {
              const [x1, y1, x2, y2] = det.bbox ?? [0, 0, 0, 0];
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "var(--color-phosphor)" }}>
                      {String(i + 1).padStart(2, "0")} {det.class_name?.toUpperCase() ?? "VEH"}
                    </span>
                  </div>
                  <ConfidenceBar value={det.confidence} />
                  <p
                    className="text-[9px] tabular-nums"
                    style={{ color: "var(--color-muted)" }}
                  >
                    [{Math.round(x1)},{Math.round(y1)}] [{Math.round(x2)},{Math.round(y2)}]
                  </p>
                </div>
              );
            })}
          </section>
        </>
      )}

      {detections.length === 0 && (
        <p
          className="text-[10px] tracking-widest"
          style={{ color: "var(--color-muted-dim)" }}
        >
          NO TARGETS ACQUIRED
        </p>
      )}
    </aside>
  );
}

// ─── mode: image ────────────────────────────────────────────────────────────
function ImageMode({ backendOk }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setPreview(URL.createObjectURL(file));
    setState("loading");
    setResult(null);
    setError("");

    try {
      const data = await detectImage(file, abortRef.current.signal);
      setResult(data);
      setState("done");
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
      setState("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFile(file);
    },
    [handleFile]
  );

  const detections = result?.detections ?? [];

  const statusText =
    state === "loading"
      ? "SCANNING..."
      : state === "done"
      ? `${detections.length} TGT LOCKED`
      : state === "error"
      ? "SCAN_ERR"
      : "STANDBY";

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
        {/* viewport */}
        <ViewfinderFrame
          label="IMG_SCAN"
          statusText={statusText}
          statusActive={state === "loading"}
          showSweep={state === "loading"}
        >
          {preview ? (
            <div className="relative w-full h-full">
              <img
                src={
                  result?.image_base64
                    ? `data:image/jpeg;base64,${result.image_base64}`
                    : preview
                }
                alt="Detection feed"
                className="w-full h-full object-contain"
                onLoad={(e) =>
                  setImgDims({
                    w: e.target.naturalWidth,
                    h: e.target.naturalHeight,
                  })
                }
              />
              {state === "done" && !result?.image_base64 && (
                <BBoxOverlay
                  detections={detections}
                  naturalWidth={imgDims.w}
                  naturalHeight={imgDims.h}
                />
              )}
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-3 cursor-pointer select-none"
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                style={{ opacity: 0.4 }}
              >
                <rect
                  x="4"
                  y="4"
                  width="32"
                  height="32"
                  rx="2"
                  stroke="var(--color-phosphor)"
                  strokeWidth="1"
                />
                <line
                  x1="4"
                  y1="4"
                  x2="10"
                  y2="4"
                  stroke="var(--color-phosphor)"
                  strokeWidth="2"
                />
                <line
                  x1="4"
                  y1="4"
                  x2="4"
                  y2="10"
                  stroke="var(--color-phosphor)"
                  strokeWidth="2"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="6"
                  stroke="var(--color-phosphor)"
                  strokeWidth="1"
                />
                <line
                  x1="20"
                  y1="14"
                  x2="20"
                  y2="26"
                  stroke="var(--color-phosphor)"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                />
                <line
                  x1="14"
                  y1="20"
                  x2="26"
                  y2="20"
                  stroke="var(--color-phosphor)"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                />
              </svg>
              <p
                className="text-[11px] tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                DROP IMAGE / CLICK TO LOAD
              </p>
            </div>
          )}
        </ViewfinderFrame>

        {/* controls */}
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-[11px] tracking-widest border transition-colors"
            style={{
              borderColor: "var(--color-line-bright)",
              color: "var(--color-phosphor)",
              background: "transparent",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--color-panel-raised)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            LOAD_IMAGE
          </button>
          {preview && (
            <button
              onClick={() => {
                setPreview(null);
                setResult(null);
                setState("idle");
              }}
              className="px-4 py-2 text-[11px] tracking-widest border transition-colors"
              style={{
                borderColor: "var(--color-line)",
                color: "var(--color-muted)",
                background: "transparent",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-panel-raised)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              CLEAR
            </button>
          )}
        </div>

        {state === "error" && (
          <p
            className="text-[11px] tracking-widest"
            style={{ color: "var(--color-alert)" }}
          >
            ERR // {error}
          </p>
        )}
      </main>

      <TelemetrySidebar
        detections={detections}
        mode="image"
        backendOk={backendOk}
      />
    </div>
  );
}

// ─── mode: video ────────────────────────────────────────────────────────────
function VideoMode({ backendOk }) {
  const [state, setState] = useState("idle");
  const [videoUrl, setVideoUrl] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState("loading");
    setVideoUrl(null);
    setStats(null);
    setError("");
    setProgress("PROCESSING FRAMES...");

    try {
      const { blob, stats } = await detectVideo(file, abortRef.current.signal);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStats(stats);
      setState("done");
      setProgress("");
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
      setState("error");
      setProgress("");
    }
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
        <ViewfinderFrame
          label="VID_PROC"
          statusText={
            state === "loading"
              ? "PROCESSING..."
              : state === "done"
              ? "OUTPUT_READY"
              : "STANDBY"
          }
          statusActive={state === "loading"}
          showSweep={state === "loading"}
        >
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              style={{ background: "var(--color-void)" }}
            />
          ) : state === "loading" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-6 rounded-sm animate-blink-slow"
                    style={{
                      background: "var(--color-phosphor)",
                      animationDelay: `${i * 0.18}s`,
                      opacity: 0.4,
                    }}
                  />
                ))}
              </div>
              <p
                className="text-[11px] tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                {progress}
              </p>
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-3 cursor-pointer"
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                style={{ opacity: 0.4 }}
              >
                <rect
                  x="2"
                  y="8"
                  width="26"
                  height="24"
                  rx="2"
                  stroke="var(--color-phosphor)"
                  strokeWidth="1"
                />
                <polyline
                  points="28,14 38,9 38,31 28,26"
                  stroke="var(--color-phosphor)"
                  strokeWidth="1"
                />
                <line
                  x1="9"
                  y1="20"
                  x2="21"
                  y2="20"
                  stroke="var(--color-phosphor)"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                />
              </svg>
              <p
                className="text-[11px] tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                DROP VIDEO / CLICK TO LOAD
              </p>
            </div>
          )}
        </ViewfinderFrame>

        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={state === "loading"}
            className="px-4 py-2 text-[11px] tracking-widest border transition-colors disabled:opacity-40"
            style={{
              borderColor: "var(--color-line-bright)",
              color: "var(--color-phosphor)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              if (state !== "loading")
                e.currentTarget.style.background = "var(--color-panel-raised)";
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            LOAD_VIDEO
          </button>
          {videoUrl && (
            <a
              href={videoUrl}
              download="detection_output.mp4"
              className="px-4 py-2 text-[11px] tracking-widest border"
              style={{
                borderColor: "var(--color-phosphor-dim)",
                color: "var(--color-phosphor)",
                textDecoration: "none",
              }}
            >
              EXPORT_MP4
            </a>
          )}
          {state === "loading" && (
            <button
              onClick={() => {
                abortRef.current?.abort();
                setState("idle");
              }}
              className="px-4 py-2 text-[11px] tracking-widest border"
              style={{
                borderColor: "var(--color-alert)",
                color: "var(--color-alert)",
                background: "transparent",
              }}
            >
              ABORT
            </button>
          )}
        </div>

        {state === "error" && (
          <p
            className="text-[11px] tracking-widest"
            style={{ color: "var(--color-alert)" }}
          >
            ERR // {error}
          </p>
        )}
      </main>

      <TelemetrySidebar
        detections={
          stats
            ? Array.from({ length: stats.maxConcurrentDetections }, (_, i) => ({
                bbox: [0, 0, 0, 0],
                confidence: 1,
                class_name: "vehicle",
                _summaryIndex: i,
              }))
            : []
        }
        mode="video"
        backendOk={backendOk}
      />
    </div>
  );
}

// ─── mode: live ─────────────────────────────────────────────────────────────
function LiveMode({ backendOk }) {
  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(loopRef.current);
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRunning(false);
    setDetections([]);
    setFrameCount(0);
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const ws = openLiveSocket();
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          setDetections(data.detections ?? []);
          setFrameCount((c) => c + 1);
        } catch {}
      };

      ws.onerror = () => setError("WebSocket error");
      ws.onclose = () => setRunning(false);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");

      const sendFrame = () => {
        if (ws.readyState === WebSocket.OPEN && videoRef.current && canvas) {
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 480;
          ctx.drawImage(videoRef.current, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob && ws.readyState === WebSocket.OPEN) ws.send(blob);
            },
            "image/jpeg",
            0.7
          );
        }
        loopRef.current = setTimeout(sendFrame, 200);
      };

      ws.onopen = () => {
        setRunning(true);
        sendFrame();
      };
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
        <ViewfinderFrame
          label="CAM_01 // LIVE"
          statusText={
            running
              ? `FRAME ${String(frameCount).padStart(4, "0")}`
              : "FEED_OFFLINE"
          }
          statusActive={running}
          showSweep={running}
        >
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{
                display: running ? "block" : "none",
                transform: "scaleX(-1)",
              }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {running && (
              <BBoxOverlay
                detections={detections}
                naturalWidth={videoRef.current?.videoWidth || 640}
                naturalHeight={videoRef.current?.videoHeight || 480}
              />
            )}

            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border flex items-center justify-center"
                  style={{ borderColor: "var(--color-muted-dim)" }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: "var(--color-muted-dim)" }}
                  />
                </div>
                <p
                  className="text-[11px] tracking-widest"
                  style={{ color: "var(--color-muted)" }}
                >
                  CAMERA OFFLINE
                </p>
              </div>
            )}
          </div>
        </ViewfinderFrame>

        <div className="flex gap-3 items-center">
          {!running ? (
            <button
              onClick={start}
              className="px-4 py-2 text-[11px] tracking-widest border transition-colors"
              style={{
                borderColor: "var(--color-phosphor-dim)",
                color: "var(--color-phosphor)",
                background: "transparent",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-phosphor-faint)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              ▶ START_FEED
            </button>
          ) : (
            <button
              onClick={stop}
              className="px-4 py-2 text-[11px] tracking-widest border"
              style={{
                borderColor: "var(--color-alert)",
                color: "var(--color-alert)",
                background: "transparent",
              }}
            >
              ■ STOP_FEED
            </button>
          )}

          {running && (
            <span
              className="text-[11px] tracking-widest animate-blink-slow"
              style={{ color: "var(--color-phosphor)" }}
            >
              ● STREAMING
            </span>
          )}
        </div>

        {error && (
          <p
            className="text-[11px] tracking-widest"
            style={{ color: "var(--color-alert)" }}
          >
            ERR // {error}
          </p>
        )}
      </main>

      <TelemetrySidebar
        detections={detections}
        mode="live"
        backendOk={backendOk}
      />
    </div>
  );
}

// ─── root ────────────────────────────────────────────────────────────────────
const MODES = ["image", "video", "live"];

export default function App() {
  const [mode, setMode] = useState("image");
  const [backendOk, setBackendOk] = useState(null);
  const clock = useSystemClock();

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await checkHealth();
        if (!cancelled) setBackendOk(true);
      } catch {
        if (!cancelled) setBackendOk(false);
      }
    };
    ping();
    const id = setInterval(ping, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className="flex flex-col h-full animate-flicker"
      style={{ background: "var(--color-void)" }}
    >
      {/* status bar */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          borderBottom: "1px solid var(--color-line)",
          background: "var(--color-panel)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* logo mark */}
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border"
              style={{
                borderColor: "var(--color-phosphor)",
                boxShadow: "inset 0 0 4px rgba(57,255,106,0.15)",
              }}
            >
              <div
                className="w-full h-full opacity-30"
                style={{ background: "var(--color-phosphor)" }}
              />
            </div>
            <span
              className="text-[13px] tracking-widest text-shadow-glow"
              style={{ color: "var(--color-phosphor)" }}
            >
              VEHICLESCOPE
            </span>
          </div>

          <span
            className="text-[10px] tracking-widest"
            style={{ color: "var(--color-muted-dim)" }}
          >
            //
          </span>

          {/* mode tabs */}
          <nav className="flex gap-1">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1 text-[10px] tracking-widest transition-colors"
                style={{
                  color:
                    mode === m
                      ? "var(--color-void)"
                      : "var(--color-muted)",
                  background:
                    mode === m
                      ? "var(--color-phosphor)"
                      : "transparent",
                  border: `1px solid ${
                    mode === m
                      ? "var(--color-phosphor)"
                      : "var(--color-line)"
                  }`,
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>

        {/* right: connection + clock */}
        <div className="flex items-center gap-4 text-[10px] tracking-widest">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendOk === null
                  ? ""
                  : backendOk
                  ? "animate-blink-slow"
                  : ""
              }`}
              style={{
                background:
                  backendOk === null
                    ? "var(--color-muted-dim)"
                    : backendOk
                    ? "var(--color-phosphor)"
                    : "var(--color-alert)",
              }}
            />
            <span
              style={{
                color:
                  backendOk === null
                    ? "var(--color-muted-dim)"
                    : backendOk
                    ? "var(--color-phosphor)"
                    : "var(--color-alert)",
              }}
            >
              {backendOk === null
                ? "CONNECTING"
                : backendOk
                ? "BACKEND OK"
                : "BACKEND ERR"}
            </span>
          </div>

          <span style={{ color: "var(--color-muted)" }} className="tabular-nums">
            {clock}
          </span>
        </div>
      </header>

      {/* main */}
      <div className="flex flex-1 overflow-hidden">
        {mode === "image" && <ImageMode backendOk={!!backendOk} />}
        {mode === "video" && <VideoMode backendOk={!!backendOk} />}
        {mode === "live" && <LiveMode backendOk={!!backendOk} />}
      </div>

      {/* footer rail */}
      <footer
        className="flex items-center justify-between px-4 py-1.5 shrink-0 text-[9px] tracking-widest tabular-nums"
        style={{
          borderTop: "1px solid var(--color-line)",
          background: "var(--color-panel)",
          color: "var(--color-muted-dim)",
        }}
      >
        <span>MODEL // YOLOv8n</span>
        <span>BACKEND // localhost:8000</span>
        <span>v0.1.0</span>
      </footer>
    </div>
  );
}