"use client";

import { FEATURES, type FeatureKey } from "@/lib/features/registry";

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export const ago = (v?: string | null) => {
  if (!v) return "never";
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

export const featureName = (k: string) => FEATURES[k as FeatureKey]?.label || k;

export function Chip({ tone = "slate", children }: { tone?: "slate" | "green" | "red" | "amber" | "blue" | "violet"; children: React.ReactNode }) {
  const map = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>{children}</span>;
}

export const billingChip = (b?: string) =>
  b === "paid" ? <Chip tone="green">Paid</Chip> : b === "trial" ? <Chip tone="blue">Trial</Chip> : <Chip>Free</Chip>;

export const statusChip = (s?: string) =>
  s === "suspended" ? <Chip tone="red">Suspended</Chip> : <Chip tone="green">Active</Chip>;

export const card = "rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800";
export const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
export const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50";
export const btnPrimary = `${btn} bg-brand-700 text-white hover:bg-brand-800`;
export const btnGhost = `${btn} border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700`;
export const btnDanger = `${btn} border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10`;
