"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldCheck, ShieldOff } from "lucide-react";

type Status = { enabled: boolean; skipped: boolean; emailHint?: string };

export default function OrgAdmin2FASettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<"idle"|"enable"|"disable">("idle");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/security/org-admin-2fa/status", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) setStatus(j);
  }
  useEffect(() => { void load(); }, []);

  async function requestCode(kind:"enable"|"disable") {
    setBusy(true); setCode(""); setMessage("");
    const url = kind === "enable"
      ? "/api/security/org-admin-2fa/send-code"
      : "/api/security/org-admin-2fa/send-disable-code";
    const r = await fetch(url, { method:"POST" });
    const j = await r.json();
    setMessage(j.message || j.error || "");
    if (r.ok) setMode(kind);
    setBusy(false);
  }

  async function verify() {
    if (code.length !== 6 || mode === "idle") return;
    setBusy(true);
    const url = mode === "enable"
      ? "/api/security/org-admin-2fa/verify-enable"
      : "/api/security/org-admin-2fa/verify-disable";
    const r = await fetch(url, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ code }),
    });
    const j = await r.json();
    setMessage(j.message || j.error || "");
    if (r.ok) { setMode("idle"); setCode(""); await load(); }
    setBusy(false);
  }

  if (!status) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">2-Step Verification</h2>
            {status.enabled
              ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Enabled</span>
              : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Recommended</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {status.enabled
              ? "Your Organization Admin account requires an email OTP after password sign-in."
              : "Add an email OTP after password sign-in to protect organization settings and employee data."}
          </p>
          {status.emailHint && <p className="mt-2 text-xs text-slate-500">Verification email: {status.emailHint}</p>}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          {status.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600"/> : <LockKeyhole className="h-4 w-4"/>}
          {status.enabled ? "Extra sign-in protection is active" : "Extra sign-in protection is not active"}
        </div>

        {mode === "idle" ? (
          <button onClick={() => requestCode(status.enabled ? "disable" : "enable")} disabled={busy}
            className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${status.enabled ? "border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300" : "bg-emerald-700 text-white"}`}>
            {status.enabled ? "Disable with OTP" : "Enable 2-Step Verification"}
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter the 6-digit OTP sent to your registered email to {mode} 2-Step Verification.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit OTP"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-center tracking-[.25em] dark:border-slate-700"/>
              <button onClick={verify} disabled={busy || code.length !== 6}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
                Verify OTP
              </button>
              <button onClick={()=>{setMode("idle");setCode("");setMessage("");}} disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">Cancel</button>
            </div>
          </div>
        )}
        {message && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
        <ShieldOff className="mt-0.5 h-4 w-4 shrink-0"/>
        Disabling 2-Step Verification also requires a fresh OTP and revokes existing verified admin sessions.
      </div>
    </section>
  );
}
