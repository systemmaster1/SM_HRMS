"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark, LogoFull } from "@/components/Logo";
import {
  LogIn, ArrowLeft, CalendarCheck, ListChecks, MapPin,
  BarChart3, ShieldCheck, Repeat,
} from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

/* Highlights that scroll into the branded left panel */
const highlights = [
  { icon: CalendarCheck, title: "GPS + selfie attendance", desc: "Verified check-in and check-out, every day." },
  { icon: ListChecks, title: "Tasks & recurring checklists", desc: "Delegation, subtasks and on-time scoring." },
  { icon: MapPin, title: "Field visit tracking", desc: "Live location for sales and service teams." },
  { icon: BarChart3, title: "Reports & payroll", desc: "Automatic payroll and performance insights." },
];

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
      {/* ---------------- Branded left panel ---------------- */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-hero-gradient p-12 text-white lg:flex">
        {/* dotted texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "26px 26px" }} />
        {/* floating accent glows (animated) */}
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 animate-pulse rounded-full bg-accent-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-brand-300/15 blur-3xl" />

        {/* Top: logo + back to home */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/95 shadow-sm">
              <LogoMark size={36} />
            </div>
            <span className="text-lg font-semibold tracking-tight">SM HRMS</span>
          </div>
          <Link href="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>

        {/* Middle: headline + rotating 3D-style feature cards */}
        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-accent-200 ring-1 ring-white/15">
            <ShieldCheck className="h-3 w-3" /> Empowering People. Optimizing Talent.
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight">
            Your entire team,
            <br />
            in one place.
          </h1>
          <p className="mt-4 leading-relaxed text-white/70">
            Attendance, leave, tasks and GPS-tracked field visits — all in one
            modern dashboard, on web and mobile.
          </p>

          {/* Animated feature tiles with a subtle 3D tilt on hover */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2" style={{ perspective: "1000px" }}>
            {highlights.map((h, idx) => (
              <div
                key={h.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.10] hover:[transform:rotateX(6deg)_rotateY(-6deg)]"
                style={{ transformStyle: "preserve-3d", animation: `floatUp 0.5s ease-out ${idx * 0.08}s both` }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient shadow-md transition-transform group-hover:scale-110">
                  <h.icon className="h-4 w-4 text-white" />
                </span>
                <p className="mt-2.5 text-sm font-semibold">{h.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/55">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative text-sm text-white/40">
          © {new Date().getFullYear()} SystemMaster · SM HRMS
        </p>

        <style>{`
          @keyframes floatUp {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </section>

      {/* ---------------- Sign-in form (right) ---------------- */}
      <section className="relative flex items-center justify-center bg-white p-6 dark:bg-slate-950 sm:p-12">
        {/* Mobile back-to-home (left panel hidden on small screens) */}
        <Link href="/"
          className="absolute left-5 top-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 lg:hidden dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <LogoFull width={160} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to your workspace.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            New to SM HRMS?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
