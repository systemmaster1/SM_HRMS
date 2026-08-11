"use client";

import { useState } from "react";
import { CheckCircle2, Download, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";

export default function AndroidDownloadCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const startDownload = async () => {
    setState("downloading");
    setProgress(0);
    setError("");

    try {
      const response = await fetch("/downloads/SM-HRMS.apk", {
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 404
            ? "Android build is not published yet. Run the GitHub Android APK workflow once."
            : `Download failed (${response.status}).`
        );
      }

      const total = Number(response.headers.get("content-length") || 0);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) setProgress(Math.min(99, Math.round((received / total) * 100)));
        }
      }

      const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SM-HRMS.apk";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setProgress(100);
      setState("done");
    } catch (e: any) {
      setState("error");
      setProgress(null);
      setError(e?.message || "Unable to download the Android app.");
    }
  };

  if (compact) {
    return (
      <div className="w-full max-w-md">
        <button
          onClick={startDownload}
          disabled={state === "downloading"}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-6 py-4 text-sm font-extrabold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-wait"
        >
          {state === "downloading" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : state === "done" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Download className="h-5 w-5 transition group-hover:translate-y-0.5" />
          )}
          {state === "downloading"
            ? `Downloading SM HRMS${progress !== null ? ` · ${progress}%` : "…"}`
            : state === "done"
            ? "Downloaded · Open APK to Install"
            : "Download Android App"}
        </button>

        {state === "downloading" && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-blue-300 transition-all duration-300"
              style={{ width: `${Math.max(4, progress || 4)}%` }}
            />
          </div>
        )}

        {state === "error" && <p className="mt-3 text-xs leading-5 text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Smartphone className="h-7 w-7 text-blue-200" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Native Android App</span>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Install SM HRMS</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Built for attendance, field visits and duty-time location tracking. Use the same SM HRMS account you already use on web.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Duty IN → OUT privacy boundary</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Native foreground location service</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Same HRMS login & data</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Server-recorded tracking events</div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <button
          onClick={startDownload}
          disabled={state === "downloading"}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-90"
        >
          {state === "downloading" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : state === "done" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          {state === "downloading"
            ? `Downloading… ${progress ?? 0}%`
            : state === "done"
            ? "Download complete · Open SM-HRMS.apk"
            : "Download SM HRMS for Android"}
        </button>

        {state === "downloading" && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Downloading securely</span>
              <span>{progress ?? 0}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-700 transition-all duration-300"
                style={{ width: `${Math.max(3, progress || 3)}%` }}
              />
            </div>
          </div>
        )}

        {state === "done" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            APK downloaded. Open <b>SM-HRMS.apk</b> from Downloads and tap <b>Install</b>.
          </div>
        )}

        {state === "error" && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Download", "Tap the button above"],
            ["2", "Allow install", "Android may ask to allow this browser/source"],
            ["3", "Install", "Open APK and confirm Install"],
          ].map(([n, title, desc]) => (
            <div key={n} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">{n}</div>
              <div className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
