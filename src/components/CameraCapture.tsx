"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, CameraOff } from "lucide-react";

/**
 * Opens the device camera, shows a live preview, and captures a still frame.
 * Calls back with a JPEG blob. No photo leaves the device until it is uploaded.
 */
export default function CameraCapture({
  onCapture,
  onError,
}: {
  onCapture: (blob: Blob, dataUrl: string) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setDenied(false);
    setShot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setDenied(true);
      setReady(false);
      onError?.("Camera access was blocked. Please allow camera permission and try again.");
    }
  }, [onError]);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const take = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror so the selfie looks natural
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setShot(dataUrl);
    stop();

    canvas.toBlob(
      (blob) => { if (blob) onCapture(blob, dataUrl); },
      "image/jpeg",
      0.82
    );
  };

  if (denied) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
        <CameraOff className="mx-auto h-7 w-7 text-rose-500" />
        <p className="mt-2 text-sm font-medium text-rose-800">Camera blocked</p>
        <p className="mt-1 text-xs text-rose-600">
          Allow camera access in your browser settings, then try again.
        </p>
        <button
          onClick={start}
          className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Captured" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full -scale-x-100 object-cover"
          />
        )}

        {!ready && !shot && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/70">
            <p className="text-xs text-white/70">Starting camera…</p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-3 flex justify-center">
        {shot ? (
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Retake photo
          </button>
        ) : (
          <button
            type="button"
            onClick={take}
            disabled={!ready}
            className="flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" /> Take picture
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
