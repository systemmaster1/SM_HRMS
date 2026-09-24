"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";

/**
 * App-styled replacements for window.alert / confirm / prompt, plus toasts.
 *
 *   if (await confirmDialog({ title: "Delete field?", danger: true })) …
 *   const reason = await promptDialog({ title: "Reason", required: true });
 *   toast("Saved");                 toast(error.message, "error");
 *
 * They work from any client code. If the host is not mounted (public pages),
 * they fall back to the browser's own dialogs.
 */

type Tone = "success" | "error" | "info";

type Request =
  | { kind: "alert"; title: string; message?: string; tone?: Tone; resolve: () => void }
  | { kind: "confirm"; title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: "prompt"; title: string; message?: string; placeholder?: string; confirmText?: string; required?: boolean; multiline?: boolean; defaultValue?: string; resolve: (v: string | null) => void };

type ToastItem = { id: number; message: string; tone: Tone };

let enqueue: ((r: Request) => void) | null = null;
let pushToast: ((t: ToastItem) => void) | null = null;
let toastSeq = 0;

export function alertDialog(opts: string | { title: string; message?: string; tone?: Tone }): Promise<void> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  if (!enqueue) { window.alert([o.title, o.message].filter(Boolean).join("\n\n")); return Promise.resolve(); }
  return new Promise((resolve) => enqueue!({ kind: "alert", ...o, resolve }));
}

export function confirmDialog(o: { title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean }): Promise<boolean> {
  if (!enqueue) return Promise.resolve(window.confirm([o.title, o.message].filter(Boolean).join("\n\n")));
  return new Promise((resolve) => enqueue!({ kind: "confirm", ...o, resolve }));
}

export function promptDialog(o: { title: string; message?: string; placeholder?: string; confirmText?: string; required?: boolean; multiline?: boolean; defaultValue?: string }): Promise<string | null> {
  if (!enqueue) return Promise.resolve(window.prompt([o.title, o.message].filter(Boolean).join("\n\n"), o.defaultValue || ""));
  return new Promise((resolve) => enqueue!({ kind: "prompt", ...o, resolve }));
}

export function toast(message: string, tone: Tone = "success") {
  if (!pushToast) { if (tone === "error") window.alert(message); return; }
  pushToast({ id: ++toastSeq, message, tone });
}

const TONE_ICON = {
  success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 shrink-0 text-rose-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-brand-600" />,
};

export default function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    pushToast = (t) => {
      setToasts((list) => [...list.slice(-2), t]);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), t.tone === "error" ? 6000 : 3500);
    };
    return () => { enqueue = null; pushToast = null; };
  }, []);

  useEffect(() => {
    if (current?.kind === "prompt") {
      setValue(current.defaultValue || "");
      setTouched(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [current]);

  const close = (result?: any) => {
    if (!current) return;
    if (current.kind === "alert") current.resolve();
    else if (current.kind === "confirm") current.resolve(!!result);
    else current.resolve(result ?? null);
    setQueue((q) => q.slice(1));
  };

  const submitPrompt = () => {
    if (current?.kind !== "prompt") return;
    if (current.required && !value.trim()) { setTouched(true); return; }
    close(value.trim());
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(current.kind === "confirm" ? false : null);
      if (e.key === "Enter" && current.kind !== "prompt") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const danger = current?.kind === "confirm" && current.danger;
  const icon = current?.kind === "alert"
    ? TONE_ICON[current.tone || "info"]
    : danger ? <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" /> : null;

  return (
    <>
      {current && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => close(current.kind === "confirm" ? false : null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
            <div className="flex items-start gap-3">
              {icon}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{current.title}</h2>
                {current.message && (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{current.message}</p>
                )}
              </div>
            </div>

            {current.kind === "prompt" && (
              <div className="mt-4">
                {current.multiline ? (
                  <textarea ref={inputRef} rows={3} value={value} placeholder={current.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                ) : (
                  <input ref={inputRef} value={value} placeholder={current.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitPrompt(); }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                )}
                {touched && current.required && !value.trim() && (
                  <p className="mt-1.5 text-xs text-rose-600">This is required.</p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {current.kind !== "alert" && (
                <button onClick={() => close(current.kind === "confirm" ? false : null)}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                  {(current.kind === "confirm" && current.cancelText) || "Cancel"}
                </button>
              )}
              <button
                onClick={() => (current.kind === "prompt" ? submitPrompt() : close(true))}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${
                  danger ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-700 hover:bg-brand-800"}`}>
                {current.kind === "alert" ? "OK" : current.confirmText || (danger ? "Delete" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts: above the mobile bottom bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[95] flex flex-col items-center gap-2 px-3 lg:bottom-6 lg:items-end lg:px-6">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {TONE_ICON[t.tone]}
            <p className="flex-1 text-slate-800 dark:text-slate-100">{t.message}</p>
            <button aria-label="Dismiss" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
