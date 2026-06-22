function Corner({ position }) {
  const base = "absolute w-6 h-6 border-phosphor";
  const styles = {
    "top-left": "top-0 left-0 border-t-2 border-l-2 rounded-tl-sm",
    "top-right": "top-0 right-0 border-t-2 border-r-2 rounded-tr-sm",
    "bottom-left": "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-sm",
    "bottom-right": "bottom-0 right-0 border-b-2 border-r-2 rounded-br-sm",
  };
  return (
    <div
      className={`${base} ${styles[position]}`}
      style={{ borderColor: "var(--color-phosphor)" }}
    />
  );
}

/**
 * Wraps viewport content (empty state, image, video, webcam feed) in a
 * camera-viewfinder frame: corner brackets, optional scan sweep, and
 * top/bottom telemetry labels.
 */
export default function ViewfinderFrame({
  children,
  label = "FEED_01",
  statusText = "STANDBY",
  statusActive = false,
  showSweep = false,
  className = "",
}) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-sm border border-line bg-panel noise-vignette ${className}`}
    >
      <div className="scanline-overlay pointer-events-none absolute inset-0 z-20" />

      {showSweep && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/3 animate-sweep"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(57,255,106,0.06), transparent)",
          }}
        />
      )}

      <div className="relative z-0 flex h-full w-full items-center justify-center">
        {children}
      </div>

      <Corner position="top-left" />
      <Corner position="top-right" />
      <Corner position="bottom-left" />
      <Corner position="bottom-right" />

      <div className="absolute left-3 top-2 z-30 flex items-center gap-2 text-[11px] tracking-widest text-muted">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            statusActive ? "animate-blink-slow" : ""
          }`}
          style={{
            background: statusActive ? "var(--color-phosphor)" : "var(--color-muted-dim)",
          }}
        />
        <span>{label}</span>
      </div>

      <div className="absolute right-3 top-2 z-30 text-[11px] tracking-widest text-muted">
        {statusText}
      </div>
    </div>
  );
}