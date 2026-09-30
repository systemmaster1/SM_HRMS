"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export default function SystemAdminVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Sending verification code…");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const r = await fetch("/api/system-admin/2fa/send-code", { method: "POST" });
    const j = await r.json();
    setMessage(j.message || j.error || "");
    setBusy(false);
  }
  useEffect(() => { void send(); }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/system-admin/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const j = await r.json();
    if (r.ok) {
      router.replace("/system-admin");
      router.refresh();
      return;
    }
    setMessage(j.error || "Verification failed.");
    setBusy(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <ShieldCheck className="h-10 w-10 text-emerald-300" />
        <h1 className="mt-4 text-2xl font-bold">System Admin Verification</h1>
        <p className="mt-2 text-sm text-slate-300">Enter the 6-digit code sent to your registered System Admin email.</p>
        <form onSubmit={verify} className="mt-6 space-y-4">
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-center text-2xl tracking-[.35em]"
            placeholder="000000" />
          <button disabled={busy || code.length !== 6}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
            Verify & Continue
          </button>
        </form>
        <button disabled={busy} onClick={send} className="mt-4 w-full text-sm text-slate-300 underline">Resend code</button>
        <p className="mt-5 text-xs text-slate-400">{message}</p>
      </div>
    </main>
  );
}
