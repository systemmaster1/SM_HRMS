"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoFull } from "@/components/Logo";
import { Mail, ShieldCheck, ArrowLeft, Users } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

type Mode = "choose" | "admin" | "sent" | "verify" | "employee";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });

    setLoading(false);
    if (error) {
      setError("We couldn't send a code to that email. Check the address and try again.");
      return;
    }
    setMode("verify");
  };

  const verifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    const supabase = createClient();

    const { error: otpErr } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });

    if (otpErr) {
      setLoading(false);
      setError("That code is not valid or has expired.");
      return;
    }

    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (pwErr) {
      setError(pwErr.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoFull width={170} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          {mode === "choose" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Forgot your password?
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Choose the option that describes you.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setMode("admin")}
                  className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-600 hover:bg-brand-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      I am an owner or admin
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Verify with a code sent to your email.
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => setMode("employee")}
                  className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-600 hover:bg-brand-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    <Users className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      I am a team member
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Your admin or reporting manager will reset it.
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}

          {mode === "employee" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Ask your admin to reset it
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                For security, team member passwords are reset by your organization.
                Contact your <strong className="font-medium">reporting manager</strong> or{" "}
                <strong className="font-medium">HR admin</strong> and ask them to set a new
                password for your account.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                They can do this from{" "}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">
                  Team → your name → Reset password
                </span>
                . You will be able to sign in immediately afterwards.
              </p>
            </>
          )}

          {mode === "admin" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Verify your email
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                We&apos;ll send a 6-digit code to your registered email address.
              </p>

              <form onSubmit={sendOtp} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email address</label>
                  <input
                    type="email"
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" />
                  {loading ? "Sending…" : "Send code"}
                </button>
              </form>
            </>
          )}

          {mode === "verify" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Enter the code
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>

              <form onSubmit={verifyAndReset} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Verification code
                  </label>
                  <input
                    className={`mt-1.5 ${inputCls} text-center text-lg tracking-[0.4em]`}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">New password</label>
                  <input
                    type="password"
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {loading ? "Verifying…" : "Reset password"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
