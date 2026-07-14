"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, CameraOff, Loader2 } from "lucide-react";

/**
 * Opens the device camera, shows a live preview, and captures a still frame.
 *
 * The parent's callbacks are held in refs so that a parent re-render never
 * restarts the camera — restarting used to wipe the captured photo, which is
 * why submissions arrived without an image.
 */
export default function CameraCapture({
  onCapture,
  onError,
}: {
  onCapture: (blob: Blob | null, dataUrl: string | null) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep the latest callbacks without making them effect dependencies.
  const onCaptureRef = useRef(onCapture);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setDenied(false);
    setReady(false);
    setShot(null);
    onCaptureRef.current(null, null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      // Wait until the browser knows the real frame size, otherwise the
      // canvas would draw a 0x0 image and produce an empty file.
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
        video.onloadedmetadata = () => resolve();
      });

      await video.play();
      setReady(true);
    } catch {
      setDenied(true);
      setReady(false);
      onErrorRef.current?.(
        "Camera access was blocked. Allow camera permission in your browser and try again."
      );
    }
  }, [stop]);

  // Start once on mount; never restart on parent re-renders.
  useEffect(() => {
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const take = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;

    if (!w || !h) {
      onErrorRef.current?.("The camera is not ready yet. Please wait a moment and try again.");
      return;
    }

    setBusy(true);

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return; }

    // Mirror so the selfie looks natural
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
    });

    if (!blob || blob.size < 1000) {
      setBusy(false);
      onErrorRef.current?.("The photo did not capture correctly. Please try again.");
      return;
    }

    setShot(dataUrl);
    onCaptureRef.current(blob, dataUrl);
    stop();
    setBusy(false);
  };

  if (denied) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
        <CameraOff className="mx-auto h-7 w-7 text-rose-500" />
        <p className="mt-2 text-sm font-medium text-rose-800">Camera blocked</p>
        <p className="mt-1 text-xs text-rose-600">
          Allow camera access in your browser settings, then retry.
        </p>
        <button type="button" onClick={start}
          className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-rose-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        {/* The video stays mounted so the stream never has to restart. */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`aspect-[4/3] w-full -scale-x-100 object-cover ${shot ? "hidden" : ""}`}
        />

        {shot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Captured" className="aspect-[4/3] w-full object-cover" />
        )}

        {!ready && !shot && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/80">
            <p className="flex items-center gap-2 text-xs text-white/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting camera…
            </p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-3 flex justify-center">
        {shot ? (
          <button type="button" onClick={start}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Retake photo
          </button>
        ) : (
          <button type="button" onClick={take} disabled={!ready || busy}
            className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-50">
            <Camera className="h-4 w-4" />
            {busy ? "Capturing…" : "Take picture"}
          </button>
        )}
      </div>

      {shot && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Photo captured
        </p>
      )}
    </div>
  );
}
