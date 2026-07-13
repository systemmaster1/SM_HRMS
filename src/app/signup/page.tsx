"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark, LogoFull } from "@/components/Logo";
import { UserPlus, Check } from "lucide-react";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Please enter your full name.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("already")
          ? "An account with this email already exists. Try signing in."
          : error.message
      );
      return;
    }

    // Email confirmation off -> session exists -> straight to onboarding
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setError(
        "Account created. Please check your email to confirm, then sign in."
      );
    }
  };

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
              "₹99 per active user per month",
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

      <section className="flex items-center justify-center p-6 sm:p-12">
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
                placeholder="At least 6 characters"
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
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
