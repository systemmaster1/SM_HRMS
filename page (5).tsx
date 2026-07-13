import Link from "next/link";
import { LogoFull } from "@/components/Logo";
import { AlertCircle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoFull width={170} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50">
            <AlertCircle className="h-6 w-6 text-rose-600" />
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
            This link has expired
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Confirmation links can only be used once and expire after a short
            time. Please sign in, or request a new link.
          </p>

          <div className="mt-6 flex gap-3">
            <Link
              href="/signup"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign up again
            </Link>
            <Link
              href="/login"
              className="flex-1 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
