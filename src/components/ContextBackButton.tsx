"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const FALLBACKS: Record<string, string> = {
  "/route-history": "/field-visits",
  "/field-reports": "/field-visits",
  "/tasks/import": "/tasks",
  "/leave/team": "/leave",
  "/team/new": "/team",
  "/team/access": "/team",
  "/integrations": "/settings",
  "/subscription": "/settings",
};

function fallbackFor(pathname: string) {
  if (/^\/team\/[^/]+\/edit\/?$/.test(pathname)) return "/team";
  return FALLBACKS[pathname] || "/dashboard";
}

function shouldShow(pathname: string) {
  if (FALLBACKS[pathname]) return true;
  if (/^\/team\/[^/]+\/edit\/?$/.test(pathname)) return true;
  return pathname.split("/").filter(Boolean).length > 1;
}

export default function ContextBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (!shouldShow(pathname)) return null;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackFor(pathname));
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
    </div>
  );
}
