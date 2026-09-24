"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Copy, Clock3, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEntitlements } from "@/lib/features/client";
import { FEATURES, isFeatureOn, type FeatureKey } from "@/lib/features/registry";
import { Modal } from "@/components/ui";
import ModulePicker, { type CatalogItem } from "@/components/ModulePicker";
import { toast } from "@/components/Dialogs";

/**
 * Settings → Plan & Features.
 * Shows the Organization ID and each module. Admins can switch free modules
 * on/off and request paid ones (SystemMaster activates them).
 */
export default function PlanFeaturesCard() {
  const ent = useEntitlements();
  const router = useRouter();
  const supabase = createClient();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (!ent.installed) return null;

  const top = (Object.keys(FEATURES) as FeatureKey[]).filter((k) => !FEATURES[k].parent);
  const availability = (k: FeatureKey) => ent.catalog.find((c) => c.key === k)?.availability;
  const requested = (k: FeatureKey) => ent.requests.includes(k);

  const openEditor = () => {
    const current = (Object.keys(FEATURES) as FeatureKey[]).filter((k) => isFeatureOn(ent, k) || requested(k));
    setDraft(current);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("org_set_modules", { p_modules: draft });
    setSaving(false);
    if (error) return toast(error.message, "error");
    const r = data as any;
    const req = (r?.requested || []).filter((k: string) => !FEATURES[k as FeatureKey]?.parent);
    toast(req.length
      ? `Modules updated. Activation requested for ${req.map((k: string) => FEATURES[k as FeatureKey]?.label).join(", ")}.`
      : "Modules updated.");
    setEditing(false);
    router.refresh();
  };

  const request = async (k: FeatureKey) => {
    setBusyKey(k);
    const { data, error } = await supabase.rpc("org_request_module", { p_key: k, p_note: null });
    setBusyKey(null);
    if (error) return toast(error.message, "error");
    toast(data === "already_active" ? "This module is already active." : `Request sent. SystemMaster will contact you to activate ${FEATURES[k].label}.`);
    router.refresh();
  };

  return (
    <section id="plan" className="mb-6 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Plan &amp; Features</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Modules available to everyone in your organization.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button onClick={openEditor}
            className="flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
            <SlidersHorizontal className="h-4 w-4" /> Change modules
          </button>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {top.map((k) => {
          const on = isFeatureOn(ent, k);
          const subs = (Object.keys(FEATURES) as FeatureKey[]).filter((s) => FEATURES[s].parent === k);
          const soon = availability(k) === "coming_soon";
          const isLocked = ent.locked.includes(k);
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
                    {subs.map((s) => `${isFeatureOn(ent, s) ? "✓" : "✕"} ${FEATURES[s].label}${requested(s) ? " (requested)" : ""}`).join("   ")}
                  </p>
                )}
              </div>
              {on ? (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
              ) : requested(k) ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <Clock3 className="h-3 w-3" /> Requested
                </span>
              ) : soon ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">Coming soon</span>
              ) : isLocked ? (
                <span className="text-xs font-medium text-slate-500">Disabled by SystemMaster</span>
              ) : availability(k) === "free" ? (
                <button onClick={openEditor}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
                  Switch on
                </button>
              ) : (
                <button onClick={() => request(k)} disabled={busyKey === k}
                  className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10">
                  {busyKey === k ? "Sending…" : "Request activation"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={editing} onClose={() => setEditing(false)} title="Change modules">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Free modules switch on or off immediately. Paid modules are sent to SystemMaster for activation.
            Switching a module off hides it for everyone; its data is kept and returns when you switch it back on.
          </p>
          <ModulePicker
            catalog={ent.catalog as CatalogItem[]}
            selected={draft}
            onChange={setDraft}
            active={ent.features}
            locked={ent.locked}
            requested={ent.requests}
          />
          <button onClick={save} disabled={saving}
            className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save modules"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
