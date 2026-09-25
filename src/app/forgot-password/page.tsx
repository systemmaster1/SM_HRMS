"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/Logo";
import {
  Mail,
  ShieldCheck,
  ArrowLeft,
  Users,
  CheckCircle2,
} from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

type Mode = "choose" | "admin" | "verify" | "employee" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!normalizedEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/forgot-password/send-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "We couldn't send the verification code. Please try again."
        );
        return;
      }

      setMessage(
        data?.message ||
          "If an account exists for this email, a verification code has been sent."
      );

      setMode("verify");
    } catch {
      setError(
        "We couldn't connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/forgot-password/verify-reset",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            code: code.trim(),
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "We couldn't reset your password. Please try again."
        );
        return;
      }

      setMode("success");
    } catch {
      setError(
        "We couldn't connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/forgot-password/send-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "We couldn't resend the verification code."
        );
        return;
      }

      setMessage(
        "A new verification code has been sent to your email."
      );

      setCode("");
    } catch {
      setError(
        "We couldn't connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
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
                  type="button"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("admin");
                  }}
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
                      Verify with a secure code sent to your registered email.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("employee");
                  }}
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
                      Contact your admin or reporting manager for a password reset.
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
                For security, team member passwords are reset by your
                organization.
              </p>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Contact your{" "}
                <strong className="font-medium">
                  reporting manager
                </strong>{" "}
                or{" "}
                <strong className="font-medium">
                  HR admin
                </strong>{" "}
                and ask them to reset your account password.
              </p>

              <button
                type="button"
                onClick={() => setMode("choose")}
                className="mt-6 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Go back
              </button>
            </>
          )}

          {mode === "admin" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Verify your email
              </h1>

              <p className="mt-1.5 text-sm text-slate-500">
                We'll send a 6-digit verification code from SM HRMS
                to your registered email address.
              </p>

              <form onSubmit={sendOtp} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Email address
                  </label>

                  <input
                    type="email"
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" />

                  {loading
                    ? "Sending code..."
                    : "Send verification code"}
                </button>
              </form>
            </>
          )}

          {mode === "verify" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Check your email
              </h1>

              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Enter the 6-digit verification code sent to{" "}
                <strong className="font-medium text-slate-700">
                  {normalizedEmail}
                </strong>
                .
              </p>

              {message && (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {message}
                </p>
              )}

              <form
                onSubmit={verifyAndReset}
                className="mt-6 space-y-4"
              >
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Verification code
                  </label>

                  <input
                    className={`mt-1.5 ${inputCls} text-center text-lg tracking-[0.35em]`}
                    placeholder="000000"
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value.replace(/\D/g, "").slice(0, 6)
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    New password
                  </label>

                  <input
                    type="password"
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) =>
                      setNewPassword(e.target.value)
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Confirm new password
                  </label>

                  <input
                    type="password"
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="Enter the password again"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    autoComplete="new-password"
                    minLength={8}
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
                  className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Resetting password..."
                    : "Verify & reset password"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={resendCode}
                  className="w-full py-1 text-sm font-medium text-brand-700 transition hover:text-brand-800 disabled:opacity-50"
                >
                  Resend verification code
                </button>
              </form>
            </>
          )}

          {mode === "success" && (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </span>

              <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
                Password reset successful
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Your password has been changed successfully. You can
                now sign in to SM HRMS using your new password.
              </p>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="mt-6 w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800"
              >
                Continue to sign in
              </button>
            </div>
          )}

          {mode !== "success" && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Secure authentication by SM HRMS · SystemMaster Automations
        </p>
      </div>
    </main>
  );
}
