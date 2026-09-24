"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog, toast } from "@/components/Dialogs";
import { FEATURES, type FeatureKey } from "@/lib/features/registry";
import { card, inputCls } from "./shared";

const OPTIONS: [string, string, string][] = [
  ["free", "Free", "On by default for every organization"],
  ["paid", "Paid", "Only with a plan that includes it, or approved by SystemMaster"],
  ["coming_soon", "Coming soon", "Visible but not usable, except organizations given beta access"],
  ["disabled", "Disabled", "Off for everyone, even with approvals"],
];

/** Global availability of each module: decides FREE / PAID / COMING SOON / DISABLED without code changes. */
export default function FeaturesTab() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("features").select("*").order("sort_order");
    setRows(data || []);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  const change = async (key: string, value: string, current: string) => {
    if (value === current) return;
    const label = OPTIONS.find((o) => o[0] === value)?.[1];
    const ok = await confirmDialog({
      title: `Make ${FEATURES[key as FeatureKey]?.label || key} "${label}" for all organizations?`,
      message: value === "disabled"
        ? "Every organization loses this module immediately (data is kept)."
        : value === "free"
          ? "Organizations without a SystemMaster decision get this module automatically."
          : "Organizations keep any module that SystemMaster enabled for them individually.",
      confirmText: "Apply to everyone", danger: value === "disabled",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("system_admin_set_feature_availability", { p_key: key, p_availability: value });
    if (error) return toast(error.message, "error");
    toast("Availability updated.");
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Decide how each module is offered. Changes apply to all organizations immediately, and every change is written to the audit log.
      </p>
      <div className={`${card} overflow-hidden`}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map((f) => (
            <li key={f.key} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${f.parent_key ? "pl-10" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${f.parent_key ? "" : "font-semibold"} text-slate-900 dark:text-slate-100`}>{FEATURES[f.key as FeatureKey]?.label || f.name}</p>
                <p className="text-xs text-slate-500">{OPTIONS.find((o) => o[0] === f.availability)?.[2]} · <span className="font-mono">{f.key}</span></p>
              </div>
              <select className={`${inputCls} w-44`} value={f.availability} onChange={(e) => change(f.key, e.target.value, f.availability)}>
                {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
