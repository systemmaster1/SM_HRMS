"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark, LogoFull } from "@/components/Logo";
import { LogIn } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Resolve an email or a mobile number to the account's email
    const res = await fetch("/api/auth/resolve-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    const resolved = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(resolved.error || "Could not find that account.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password,
    });
    setLoading(false);

    if (error) {
      setError("Incorrect credentials. Please try again.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
            Your entire team,
            <br />
            in one place.
          </h1>
          <p className="mt-4 leading-relaxed text-white/70">
            Attendance, leave, tasks and GPS-tracked field visits — all in one
            modern dashboard.
          </p>
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

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Email or mobile number
              </label>
              <input
                className={`mt-1.5 ${inputCls}`}
                placeholder="you@company.com  or  9876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                className={`mt-1.5 ${inputCls}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to SM HRMS?{" "}
            <Link href="/signup" className="font-medium text-brand-700 hover:text-brand-800">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
