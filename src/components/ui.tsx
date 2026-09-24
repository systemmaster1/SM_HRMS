"use client";

import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* Shared input style — soft rounded field with a brand focus ring */
export const inputCls =
  "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 placeholder:text-slate-400 dark:placeholder:text-slate-500";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {/* small orange accent bar above the title — consistent brand signature */}
        <div className="mb-2 h-1 w-8 rounded-full bg-accent-gradient" />
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-[22px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">{subtitle}</p>
        )}
      </div>
      {/* On phones the buttons sit under the title and can scroll sideways instead of squeezing it */}
      {action && (
        <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-800 dark:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-700/50">
        <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const tones: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  checked_in: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  late: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  on_leave: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  holiday: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  weekly_off: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  meeting: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  assigned: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  planned: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  missed: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  leave: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  half_day: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  on_the_way: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  high: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  absent: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

/** Readable wording for status values stored in the database. */
const LABELS: Record<string, string> = {
  on_the_way: "On the way", checked_in: "Checked in", in_progress: "In progress",
  half_day: "Half day", on_leave: "On leave", weekly_off: "Weekly off",
  past_due: "Payment due", auto_present: "Auto present",
};

export function Badge({ value }: { value: string }) {
  const cls = tones[value] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  const label = LABELS[value] || String(value || "").replace(/_/g, " ");
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}
    >
      {/* status dot in the badge's own colour */}
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          {/* Phones: a bottom sheet (like a native app). Larger screens: a centred dialog. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
            className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10 sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 sm:py-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 sm:h-8 sm:w-8 sm:rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Placeholder shown while a page loads: title bar + cards, in the page's own layout. */
export function PageLoader({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-48 rounded-md bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-72 max-w-full rounded-md bg-slate-200/70 dark:bg-slate-700/60" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/80 dark:bg-slate-800/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-0 dark:border-slate-700/60">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-2/3 rounded bg-slate-200/70 dark:bg-slate-700/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
