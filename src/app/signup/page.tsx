"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark, LogoFull } from "@/components/Logo";
import { UserPlus, Check, MailCheck, ArrowLeft } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Please enter your full name.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("already")
          ? "An account with this email already exists. Try signing in instead."
          : error.message
      );
      return;
    }

    // Email confirmation is on -> no session yet
    if (!data.session) {
      setSent(true);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  };

  const resend = async () => {
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  /* ---------- Confirmation sent ---------- */
  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <LogoFull width={170} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50">
              <MailCheck className="h-6 w-6 text-brand-700" />
            </div>

            <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
              Confirm your email
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We&apos;ve sent a confirmation link to
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{email}</p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Next steps
              </p>
              <ol className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>1. Open the email and click the confirmation link.</li>
                <li>2. You&apos;ll be taken straight to organization setup.</li>
                <li>3. Add your team and start your 7-day trial.</li>
              </ol>
            </div>

            <p className="mt-5 text-xs text-slate-500">
              Didn&apos;t get it? Check your spam folder, or{" "}
              <button
                onClick={resend}
                className="font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                resend the email
              </button>
              .
            </p>
            {resent && (
              <p className="mt-2 text-xs font-medium text-emerald-600">
                Confirmation email sent again.
              </p>
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

  /* ---------- Sign-up form ---------- */
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white">
            <LogoMark size={36} />
          </div>
          <span className="text-lg font-semibold tracking-tight">SM HRMS</span>
        </div>

        <div className="max-w-md">
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
              "₹19 per active user per month — launch offer",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/80">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-white/40">
          © {new Date().getFullYear()} SystemMaster · SM HRMS
        </p>
      </section>

      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <LogoFull width={160} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Set up your organization in under a minute.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Full name</label>
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
              <label className="text-sm font-medium text-slate-700">Work email</label>
              <input
                type="email"
                className={`mt-1.5 ${inputCls}`}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                className={`mt-1.5 ${inputCls}`}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              <UserPlus className="h-4 w-4" />
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-xs leading-relaxed text-slate-400">
              By creating an account you agree to our Terms of Service and
              Privacy Policy.
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
