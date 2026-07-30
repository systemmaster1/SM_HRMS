import Link from "next/link";
import { Wrench, ArrowLeft } from "lucide-react";

/** Friendly placeholder for modules that arrive in an upcoming phase. */
export function ComingSoon({ title }: { title: string }) {
  const pretty = title.replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
        <Wrench className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink dark:text-slate-100">{pretty}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        This module is being built and will be available in an upcoming update. The rest of CMW ERP is fully usable in the meantime.
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-white/10 dark:text-brand-200">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
    </div>
  );
}
