import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown instead of a module that the organization does not have. */
export default function ModuleLocked({ name, description }: { name: string; description?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {name} is not enabled
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {description ? `${description}. ` : ""}This module is not part of your organization&apos;s current plan.
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your administrator can enable it from Settings → Plan &amp; Features.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/settings#plan"
            className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
            View Plan &amp; Features
          </Link>
          <Link href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
