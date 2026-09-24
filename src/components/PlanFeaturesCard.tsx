"use client";

import { Check, Lock, Copy } from "lucide-react";
import { useState } from "react";
import { useEntitlements } from "@/lib/features/client";
import { FEATURES, isFeatureOn, type FeatureKey } from "@/lib/features/registry";

/**
 * Settings → Plan & Features (read-only in Phase A).
 * Shows the Organization ID and which modules are active. Upgrade / enable
 * buttons and online payment arrive in Phase E; the data model is ready.
 */
export default function PlanFeaturesCard() {
  const ent = useEntitlements();
  const [copied, setCopied] = useState(false);
  if (!ent.installed) return null;

  const top = (Object.keys(FEATURES) as FeatureKey[]).filter((k) => !FEATURES[k].parent);
  const availability = (k: FeatureKey) => ent.catalog.find((c) => c.key === k)?.availability;

  return (
    <section id="plan" className="mb-6 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Plan &amp; Features</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Modules available to everyone in your organization.
          </p>
        </div>
        {ent.organization?.org_code && (
          <button
            onClick={() => { navigator.clipboard?.writeText(ent.organization!.org_code!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left dark:border-slate-600"
            title="Copy Organization ID">
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Organization ID</span>
              <span className="block font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{ent.organization.org_code}</span>
            </span>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
          </button>
        )}
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {top.map((k) => {
          const on = isFeatureOn(ent, k);
          const subs = (Object.keys(FEATURES) as FeatureKey[]).filter((s) => FEATURES[s].parent === k);
          const soon = availability(k) === "coming_soon";
          return (
            <li key={k} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"}`}>
                {on ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${on ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
                  {FEATURES[k].label}
                </p>
                {subs.length > 0 && on && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {subs.map((s) => `${isFeatureOn(ent, s) ? "✓" : "✕"} ${FEATURES[s].label}`).join("   ")}
                  </p>
                )}
              </div>
              {on ? (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
              ) : soon ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">Coming soon</span>
              ) : (
                <a href={`mailto:Connect@systemmaster.in?subject=${encodeURIComponent(`Enable ${FEATURES[k].label} for ${ent.organization?.org_code || "my organization"}`)}`}
                  className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10">
                  Upgrade / Enable
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
