"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark, LogoFull } from "@/components/Logo";
import {
  UserPlus,
  Check,
  MailCheck,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

type Step = "form" | "verify";

export default function SignUpPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!normalizedEmail) {
      setError("Please enter your work email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/signup/send-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
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
          "A 6-digit verification code has been sent to your email."
      );

      setStep("verify");
    } catch {
      setError(
        "We couldn't connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/signup/verify-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: normalizedEmail,
            password,
            code: code.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "We couldn't verify your email. Please try again."
        );
        return;
      }

      /*
       * Account is now created and email-confirmed.
       * Sign in immediately so onboarding has an authenticated session.
       */
      const supabase = createClient();

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (signInError) {
        setError(
          "Your account was created successfully, but automatic sign-in failed. Please sign in manually."
        );

        setTimeout(() => {
          router.push("/login");
        }, 2500);

        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError(
        "We couldn't complete your registration. Please try again."
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
        "/api/auth/signup/send-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
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

      setCode("");

      setMessage(
        "A new 6-digit verification code has been sent to your email."
      );
    } catch {
      setError(
        "We couldn't connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- OTP verification ---------------- */

  if (step === "verify") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <LogoFull width={170} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50">
              <MailCheck className="h-6 w-6 text-brand-700" />
            </div>

            <div className="mt-5 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Verify your email
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                We sent a 6-digit verification code to
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {normalizedEmail}
              </p>
            </div>

            {message && (
              <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
            )}

            <form onSubmit={verify} className="mt-6 space-y-4">
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
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />

                {loading
                  ? "Verifying..."
                  : "Verify & create account"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={resendCode}
                className="w-full py-1 text-sm font-medium text-brand-700 transition hover:text-brand-800 disabled:opacity-50"
              >
                Resend verification code
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError("");
                  setMessage("");
                }}
                className="w-full py-1 text-sm text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
              >
                Change email or registration details
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                After verification
              </p>

              <ol className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>1. Your SM HRMS account will be activated.</li>
                <li>2. You'll continue to organization setup.</li>
                <li>3. Add your team and start your 7-day trial.</li>
              </ol>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Secure email verification by SM HRMS · SystemMaster Automations
          </p>
        </div>
      </main>
    );
  }

  /* ---------------- Registration form ---------------- */

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-hero-gradient p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 animate-pulse rounded-full bg-accent-400/20 blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/95 shadow-sm">
              <LogoMark size={36} />
            </div>

            <span className="text-lg font-semibold tracking-tight">
              SM HRMS
            </span>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Start managing
            <br />
            your team today.
          </h1>

          <ul className="mt-8 space-y-3">
            {[
              "7-day free trial, no card required",
              "Attendance and GPS field visits",
              "Leave approvals and task management",
              "₹29 per active user per month — launch offer",
            ].map((f) => (
              <li
                key={f}
                className="flex items-center gap-3 text-white/80"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10">
                  <Check className="h-3 w-3" />
                </span>

                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/40">
          © {new Date().getFullYear()} SystemMaster · SM HRMS
        </p>
      </section>

      <section className="relative flex items-center justify-center bg-white p-6 dark:bg-slate-950 sm:p-12">
        <Link
          href="/"
          className="absolute left-5 top-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 lg:hidden dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <LogoFull width={160} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Verify your work email and set up your organization.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Full name
              </label>

              <input
                className={`mt-1.5 ${inputCls}`}
                placeholder="Sunil Tiwari"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Work email
              </label>

              <input
                type="email"
                className={`mt-1.5 ${inputCls}`}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>

              <input
                type="password"
                className={`mt-1.5 ${inputCls}`}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Confirm password
              </label>

              <input
                type="password"
                className={`mt-1.5 ${inputCls}`}
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />

              {loading
                ? "Sending verification code..."
                : "Continue with email verification"}
            </button>

            <p className="text-center text-xs leading-relaxed text-slate-400">
              By creating an account you agree to our Terms of Service
              and Privacy Policy.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
