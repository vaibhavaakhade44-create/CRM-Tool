import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { Camera, X, RefreshCw, ZoomIn } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode" }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCam, setActiveCam] = useState<string | undefined>(undefined);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  const stopScan = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const startScan = useCallback(async (deviceId?: string) => {
    stopScan();
    if (!videoRef.current) return;
    try {
      setError(null);
      const reader = new BrowserMultiFormatReader();

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      setCameras(devices);

      const rearCam = devices.find(d => /back|rear|environment/i.test(d.label));
      const selectedId = deviceId ?? rearCam?.deviceId ?? devices[0]?.deviceId;
      setActiveCam(selectedId);

      controlsRef.current = await reader.decodeFromVideoDevice(selectedId, videoRef.current, (result, err) => {
        if (result) {
          const code = result.getText();
          setLastCode(code);
          setScanning(false);
          setTimeout(() => onScan(code), 300);
        } else if (err && !(err instanceof NotFoundException)) {
          console.debug("Scan error:", err.message);
        }
      });
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access and try again.");
      } else if (e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError(e.message ?? "Failed to start camera.");
      }
    }
  }, [onScan, stopScan]);

  useEffect(() => {
    startScan();
    return () => { stopScan(); };
  }, [startScan, stopScan]);

  function switchCamera(deviceId: string) {
    setScanning(true);
    setLastCode(null);
    startScan(deviceId);
  }

  function rescan() {
    setScanning(true);
    setLastCode(null);
    startScan(activeCam);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 480, overflow: "hidden", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" style={{ color: "#6366f1" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video */}
        <div style={{ position: "relative", background: "#000", aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            autoPlay
            muted
            playsInline
          />
          {scanning && !error && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ width: 200, height: 100, border: "2px solid #6366f1", borderRadius: 8, boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }}>
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, #6366f1, transparent)",
                  animation: "scanLine 1.5s ease-in-out infinite",
                  top: "50%",
                }} />
              </div>
            </div>
          )}
          {lastCode && (
            <div style={{ position: "absolute", inset: 0, background: "#10b98133", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#10b981", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                ✓ {lastCode}
              </div>
            </div>
          )}
          {error && (
            <div style={{ position: "absolute", inset: 0, background: "#00000099", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <ZoomIn className="w-8 h-8 mb-3" style={{ color: "#ef4444" }} />
              <p className="text-sm text-center" style={{ color: "#fca5a5" }}>{error}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <select value={activeCam} onChange={e => switchCamera(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}>
                {cameras.map(c => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            )}
            <button onClick={rescan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <RefreshCw className="w-3 h-3" /> Rescan
            </button>
            <button onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444433", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: "var(--text-ghost)" }}>
            Point camera at any 1D or 2D barcode / QR code
          </p>
        </div>
      </div>
      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
