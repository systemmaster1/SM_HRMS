"use client";

import { Check, Lock, Clock3 } from "lucide-react";
import { FEATURES, type FeatureKey } from "@/lib/features/registry";

export type CatalogItem = {
  key: FeatureKey;
  parent: FeatureKey | null;
  name: string;
  availability: "free" | "paid" | "coming_soon" | "disabled" | string;
};

/**
 * Module selection used at registration and in Settings → Plan & Features.
 * Built from the feature catalogue, so a new module appears here automatically.
 *
 * Sub-features:
 *   2 sub-features  → "A only / B only / Both" (e.g. Delegation / Checklist / Both)
 *   more            → checkboxes
 */
export default function ModulePicker({
  catalog, selected, onChange,
  active = {}, locked = [], requested = [],
}: {
  catalog: CatalogItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** currently enabled modules (Settings) */
  active?: Partial<Record<string, boolean>>;
  /** SystemMaster decisions the organization cannot change */
  locked?: string[];
  /** paid modules already requested */
  requested?: string[];
}) {
  const visible = catalog.filter((c) => c.availability !== "disabled" && FEATURES[c.key as FeatureKey]);
  const tops = visible.filter((c) => !c.parent);
  const childrenOf = (k: string) => visible.filter((c) => c.parent === k);
  const has = (k: string) => selected.includes(k);

  const toggleTop = (top: CatalogItem) => {
    const kids = childrenOf(top.key).map((c) => c.key);
    if (has(top.key)) {
      onChange(selected.filter((k) => k !== top.key && !kids.includes(k as FeatureKey)));
    } else {
      // Turning a module on selects all of its sub-features by default.
      const kidsAllowed = childrenOf(top.key).filter((c) => c.availability !== "coming_soon").map((c) => c.key);
      onChange(Array.from(new Set([...selected, top.key, ...kidsAllowed])));
    }
  };

  const setKids = (top: string, keys: string[]) => {
    const kids = childrenOf(top).map((c) => c.key as string);
    onChange(Array.from(new Set([...selected.filter((k) => !kids.includes(k)), top, ...keys])));
  };

  const badge = (c: CatalogItem) => {
    if (locked.includes(c.key)) return { text: "Set by SystemMaster", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", icon: Lock };
    if (active[c.key]) return { text: "Active", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", icon: Check };
    if (requested.includes(c.key)) return { text: "Requested", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", icon: Clock3 };
    if (c.availability === "free") return { text: "Free", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", icon: null };
    if (c.availability === "coming_soon") return { text: "Coming soon", cls: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400", icon: null };
    return { text: "Paid · on request", cls: "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300", icon: null };
  };

  return (
    <div className="space-y-3">
      {tops.map((top) => {
        const on = has(top.key);
        const kids = childrenOf(top.key);
        const b = badge(top);
        const isLocked = locked.includes(top.key);
        const soon = top.availability === "coming_soon" && !active[top.key];
        const chosenKids = kids.filter((k) => has(k.key)).map((k) => k.key as string);

        return (
          <div key={top.key}
            className={`rounded-xl border p-4 transition ${on
              ? "border-brand-600 bg-brand-50/40 dark:border-brand-400 dark:bg-brand-500/10"
              : "border-slate-200 dark:border-slate-700"}`}>
            <label className={`flex items-start gap-3 ${isLocked || soon ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700"
                checked={on} disabled={isLocked || soon}
                onChange={() => toggleTop(top)} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{FEATURES[top.key].label}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
                    {b.icon && <b.icon className="h-3 w-3" />}{b.text}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{FEATURES[top.key].description}</span>
              </span>
            </label>

            {on && kids.length === 2 && (
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[
                  { label: `${FEATURES[kids[0].key].label} only`, keys: [kids[0].key] },
                  { label: `${FEATURES[kids[1].key].label} only`, keys: [kids[1].key] },
                  { label: "Both", keys: [kids[0].key, kids[1].key] },
                ].map((opt) => {
                  const active = chosenKids.length === opt.keys.length && opt.keys.every((k) => chosenKids.includes(k));
                  const blocked = opt.keys.some((k) => locked.includes(k) || (visible.find((v) => v.key === k)?.availability === "coming_soon"));
                  return (
                    <button key={opt.label} type="button" disabled={blocked}
                      onClick={() => setKids(top.key, opt.keys)}
                      className={`rounded-md px-2 py-2 text-xs font-semibold transition disabled:opacity-40 ${active
                        ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300"}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {on && kids.length > 2 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {kids.map((k) => (
                  <label key={k.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-600">
                    <input type="checkbox" className="accent-brand-700" checked={has(k.key)} disabled={locked.includes(k.key)}
                      onChange={() => setKids(top.key, has(k.key) ? chosenKids.filter((x) => x !== k.key) : [...chosenKids, k.key])} />
                    {FEATURES[k.key].label}
                  </label>
                ))}
              </div>
            )}

            {on && kids.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {kids.map((k) => `${FEATURES[k.key].label}: ${FEATURES[k.key].description}`).join(" · ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Default selection for a new organization: every free module with all its sub-features. */
export function defaultSelection(catalog: CatalogItem[]): string[] {
  const free = catalog.filter((c) => c.availability === "free");
  const tops = free.filter((c) => !c.parent).map((c) => c.key as string);
  const kids = free.filter((c) => c.parent && tops.includes(c.parent)).map((c) => c.key as string);
  return [...tops, ...kids];
}
