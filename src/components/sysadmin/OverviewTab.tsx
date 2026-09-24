"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Ban, Gift, CreditCard, Megaphone, ShieldOff, Users, UserCheck, Sparkles, Inbox, Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { card, featureName } from "./shared";

export default function OverviewTab({ onOpenRequests }: { onOpenRequests: () => void }) {
  const supabase = createClient();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("system_admin_overview").then(({ data, error }) => {
      if (error) setError(error.message); else setD(data);
    });
  }, [supabase]);

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!d) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;

  const kpis: [string, any, any, string][] = [
    ["Total organizations", d.organizations, Building2, "text-slate-900 dark:text-slate-100"],
    ["Active", d.active, CheckCircle2, "text-emerald-600"],
    ["Suspended", d.suspended, Ban, "text-rose-600"],
    ["Free", d.free, Gift, "text-slate-700 dark:text-slate-200"],
    ["Trial", d.trial, Hourglass, "text-blue-600"],
    ["Paid", d.paid, CreditCard, "text-emerald-700"],
    ["Showing ads", d.ads_on, Megaphone, "text-amber-600"],
    ["Ad-free", d.ad_free, ShieldOff, "text-violet-600"],
    ["Total employees", d.employees, Users, "text-slate-900 dark:text-slate-100"],
    ["Active users (30 days)", d.active_users_30d ?? "—", UserCheck, "text-slate-900 dark:text-slate-100"],
    ["New registrations (7 / 30 days)", `${d.new_7d} / ${d.new_30d}`, Sparkles, "text-brand-700 dark:text-brand-300"],
  ];
  const maxReg = Math.max(1, ...d.registrations_by_month.map((m: any) => m.count));
  const tops = d.module_adoption.filter((m: any) => !m.parent);
  const subs = d.module_adoption.filter((m: any) => m.parent);

  return (
    <div className="space-y-5">
      {d.pending_requests > 0 && (
        <button onClick={onOpenRequests}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left text-amber-900 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Inbox className="h-5 w-5" />
          <span className="flex-1 text-sm"><b>{d.pending_requests}</b> module activation request{d.pending_requests === 1 ? "" : "s"} waiting for a decision.</span>
          <span className="text-sm font-semibold">Review →</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([label, value, Icon, tone]) => (
          <div key={label} className={`${card} p-4`}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{label}</span><Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New organizations per month</h3>
          <div className="mt-5 flex h-44 items-end gap-3">
            {d.registrations_by_month.map((m: any) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{m.count}</span>
                <div className="w-full rounded-t-md bg-brand-600" style={{ height: `${Math.max(4, (m.count / maxReg) * 140)}px` }} />
                <span className="text-[11px] text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Module adoption</h3>
          <ul className="mt-4 space-y-3">
            {tops.map((m: any) => {
              const pct = d.organizations ? Math.round((m.organizations / d.organizations) * 100) : 0;
              const kids = subs.filter((s: any) => s.parent === m.key);
              return (
                <li key={m.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-800 dark:text-slate-200">{featureName(m.key)}
                      <span className="ml-2 text-[11px] uppercase text-slate-400">{m.availability.replace("_", " ")}</span>
                    </span>
                    <span className="tabular-nums text-slate-500">{m.organizations} · {pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  {kids.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {kids.map((k: any) => `${featureName(k.key)}: ${k.organizations}`).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
