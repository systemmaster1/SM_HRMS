"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Ban, CheckCircle2, CalendarPlus, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog, promptDialog, toast } from "@/components/Dialogs";
import { FEATURES, type FeatureKey } from "@/lib/features/registry";
import { Chip, billingChip, statusChip, fmtDate, fmtDateTime, ago, inputCls, btnPrimary, btnGhost, btnDanger, featureName } from "./shared";

const SOURCE_LABEL: Record<string, string> = {
  platform: "SystemMaster", organization: "Organization", grandfathered: "Existing client",
};
const FALLBACK_PLANS = [["starter", "Starter"], ["business", "Business"], ["pro", "Pro"], ["enterprise", "Enterprise"]];
const SUB_STATUSES = ["trial", "active", "past_due", "paused", "cancelled"];

export default function OrgDrawer({ companyId, onClose, onChanged }: {
  companyId: string | null; onClose: () => void; onChanged: () => void;
}) {
  const supabase = createClient();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<string[][]>(FALLBACK_PLANS);
  const [copied, setCopied] = useState(false);
  const [sub, setSub] = useState<any>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase.rpc("system_admin_org_detail", { p_company: companyId });
    if (error) { setError(error.message); return; }
    setError("");
    setD(data);
    const s = (data as any)?.subscription || {};
    setSub({ plan_code: s.plan_code || "starter", status: s.status || "trial", licensed_users: s.licensed_users || "",
             custom_price_per_user: "", discount_percent: s.discount_percent || 0, extend_days: "" });
  }, [supabase, companyId]);

  useEffect(() => { setD(null); load(); }, [load]);
  useEffect(() => {
    supabase.from("subscription_plans").select("code, name").then(({ data }) => {
      if (data && data.length) setPlans(data.map((p: any) => [p.code, p.name || p.code]));
    });
  }, [supabase]);

  if (!companyId) return null;
  const org = d?.organization;

  const run = async (fn: () => PromiseLike<{ error: any }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast(error.message, "error"); return false; }
    toast(ok);
    await load();
    onChanged();
    return true;
  };

  const setFeature = async (key: string, value: boolean | null) => {
    const reason = await promptDialog({
      title: `${value === null ? "Reset" : value ? "Enable" : "Disable"} ${featureName(key)}?`,
      message: value === null
        ? "The module will follow the organization's plan and choices again."
        : `This decision is locked for ${org?.name}; their admin cannot change it.`,
      placeholder: "Reason (recorded in the audit log)", required: value !== null, confirmText: "Apply",
    });
    if (reason === null) return;
    await run(() => supabase.rpc("system_admin_set_feature", { p_company: companyId, p_key: key, p_enabled: value, p_reason: reason || null }),
      `${featureName(key)} updated.`);
  };

  const setStatus = async (suspend: boolean) => {
    if (suspend) {
      const reason = await promptDialog({
        title: `Suspend ${org?.name}?`,
        message: "All users of this organization will be blocked immediately. Data is kept and returns on re-activation.",
        placeholder: "Reason shown to the organization", required: true, confirmText: "Suspend",
      });
      if (!reason) return;
      await run(() => supabase.rpc("system_admin_set_org_status", { p_company: companyId, p_status: "suspended", p_reason: reason }), "Organization suspended.");
    } else {
      if (!(await confirmDialog({ title: `Re-activate ${org?.name}?`, message: "Users regain access immediately.", confirmText: "Activate" }))) return;
      await run(() => supabase.rpc("system_admin_set_org_status", { p_company: companyId, p_status: "active", p_reason: null }), "Organization activated.");
    }
  };

  const setAds = (v: boolean | null) =>
    run(() => supabase.rpc("system_admin_set_ads", { p_company: companyId, p_enabled: v }),
      v === null ? "Ads now follow the plan." : v ? "Ads enabled." : "Organization is now ad-free.");

  const decide = async (id: string, approve: boolean) => {
    const note = await promptDialog({
      title: approve ? "Approve request?" : "Decline request?",
      message: approve ? "The module is switched on immediately." : "The organization will see the request as declined.",
      placeholder: approve ? "e.g. Paid via invoice #123" : "Reason", required: !approve,
      confirmText: approve ? "Approve" : "Decline",
    });
    if (note === null) return;
    await run(() => supabase.rpc("system_admin_decide_module_request", { p_request: id, p_approve: approve, p_note: note || null }),
      approve ? "Request approved." : "Request declined.");
  };

  const saveSubscription = (extra?: Record<string, any>) => {
    const p = { ...sub, ...extra };
    return run(() => supabase.rpc("system_admin_update_subscription", {
      p_company_id: companyId,
      p_plan_code: p.plan_code || null,
      p_status: p.status || null,
      p_licensed_users: p.licensed_users ? Number(p.licensed_users) : null,
      p_custom_price_per_user: p.custom_price_per_user !== "" && p.custom_price_per_user != null ? Number(p.custom_price_per_user) : null,
      p_discount_percent: p.discount_percent !== "" ? Number(p.discount_percent) : null,
      p_extend_days: p.extend_days ? Number(p.extend_days) : null,
      p_cancel_at_period_end: p.cancel_at_period_end ?? null,
      p_notes: null,
    }), "Subscription updated.");
  };

  const features: any[] = d?.features || [];
  const tops = features.filter((f) => !f.parent);
  const pending = (d?.requests || []).filter((r: any) => r.status === "pending");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-900">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{org?.name || "Loading…"}</h2>
              {org && statusChip(org.account_status)}{d && billingChip(d.billing)}
            </div>
            {org?.org_code && (
              <button onClick={() => { navigator.clipboard?.writeText(org.org_code); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-brand-700 dark:text-brand-300">
                {org.org_code}{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          {!d ? <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /> : (<>

          {/* Profile */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Organization</h3>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Admin", d.admin?.name], ["Admin email", d.admin?.email], ["Mobile", d.admin?.phone || org.phone],
                ["Organization email", org.email], ["Industry", org.industry], ["Size", org.size && `${org.size} employees`],
                ["Address", [org.address, org.city, org.state, org.pincode].filter(Boolean).join(", ")],
                ["Time zone", org.timezone], ["Registered", fmtDate(org.created_at)],
                ["Last activity", ago(d.last_activity)], ["Employees", d.counts?.employees],
                ["Field-tracked staff", d.counts?.field_tracked],
              ].map(([k, v]) => (
                <div key={k as string} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-slate-500">{k}</dt>
                  <dd className="min-w-0 break-words text-slate-900 dark:text-slate-100">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Account + Ads */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Account status</h3>
              {org.account_status === "suspended" ? (
                <>
                  <p className="mt-1 text-sm text-rose-600">Suspended{org.suspended_reason ? `: ${org.suspended_reason}` : ""}</p>
                  <button disabled={busy} onClick={() => setStatus(false)} className={`${btnPrimary} mt-3 w-full`}><CheckCircle2 className="h-4 w-4" /> Activate</button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-500">Active. Users can sign in and use enabled modules.</p>
                  <button disabled={busy} onClick={() => setStatus(true)} className={`${btnDanger} mt-3 w-full`}><Ban className="h-4 w-4" /> Suspend</button>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ads</h3>
              <p className="mt-1 text-sm text-slate-500">Currently: <b>{d.ads_effective ? "showing ads" : "ad-free"}</b></p>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                {([[null, "Follow plan"], [true, "Show ads"], [false, "Ad-free"]] as [boolean | null, string][]).map(([v, l]) => {
                  const current = (org.ads_enabled ?? null) === v;
                  return (
                    <button key={l} disabled={busy || current} onClick={() => setAds(v)}
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold ${current ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Pending requests */}
          {pending.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Module requests</h3>
              <ul className="mt-2 space-y-2">
                {pending.map((r: any) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1 text-amber-900 dark:text-amber-100">{featureName(r.feature_key)} · {fmtDateTime(r.requested_at)}</span>
                    <button disabled={busy} onClick={() => decide(r.id, true)} className={btnPrimary}>Approve</button>
                    <button disabled={busy} onClick={() => decide(r.id, false)} className={btnGhost}>Decline</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Modules */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Modules</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              <b>Default</b> follows the plan and the organization&apos;s own choices. <b>On</b> / <b>Off</b> are SystemMaster decisions the organization cannot change.
            </p>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
              {tops.flatMap((t) => [t, ...features.filter((f) => f.parent === t.key)]).map((f) => {
                const mode = f.source === "platform" ? (f.override ? "on" : "off") : "default";
                return (
                  <li key={f.key} className={`flex flex-wrap items-center gap-2 py-2.5 ${f.parent ? "pl-5" : ""}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${f.effective ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`text-sm ${f.parent ? "" : "font-semibold"} text-slate-900 dark:text-slate-100`}>{FEATURES[f.key as FeatureKey]?.label || f.name}</span>
                      <span className="ml-2 text-[11px] text-slate-500">
                        {f.effective ? "enabled" : "disabled"}
                        {f.source ? ` · ${SOURCE_LABEL[f.source] || f.source}` : f.by_plan ? " · plan/default" : ""}
                        {f.availability !== "free" && f.availability !== "paid" ? ` · ${f.availability.replace("_", " ")}` : ""}
                      </span>
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                      {([["default", null, "Default"], ["on", true, "On"], ["off", false, "Off"]] as [string, boolean | null, string][]).map(([m, v, l]) => (
                        <button key={m} disabled={busy || mode === m} onClick={() => setFeature(f.key, v)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${mode === m
                            ? m === "on" ? "bg-emerald-600 text-white" : m === "off" ? "bg-rose-600 text-white" : "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                            : "text-slate-500"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Subscription */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Subscription</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Plan end: {fmtDate(d.subscription?.current_period_end || d.subscription?.trial_ends_at)}
              {d.subscription?.licensed_users ? ` · ${d.subscription.licensed_users} licensed users` : ""}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Plan
                <select className={`${inputCls} mt-1`} value={sub.plan_code} onChange={(e) => setSub({ ...sub, plan_code: e.target.value })}>
                  {plans.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Status
                <select className={`${inputCls} mt-1`} value={sub.status} onChange={(e) => setSub({ ...sub, status: e.target.value })}>
                  {SUB_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Licensed users
                <input type="number" min={1} className={`${inputCls} mt-1`} value={sub.licensed_users} onChange={(e) => setSub({ ...sub, licensed_users: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Custom ₹ / user
                <input type="number" min={0} placeholder="Standard" className={`${inputCls} mt-1`} value={sub.custom_price_per_user} onChange={(e) => setSub({ ...sub, custom_price_per_user: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Discount %
                <input type="number" min={0} max={100} className={`${inputCls} mt-1`} value={sub.discount_percent} onChange={(e) => setSub({ ...sub, discount_percent: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Extend by days
                <input type="number" min={0} placeholder="e.g. 30" className={`${inputCls} mt-1`} value={sub.extend_days} onChange={(e) => setSub({ ...sub, extend_days: e.target.value })} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => saveSubscription()} className={btnPrimary}>Save subscription</button>
              <button disabled={busy} onClick={() => saveSubscription({ extend_days: 30 })} className={btnGhost}><CalendarPlus className="h-4 w-4" /> +30 days</button>
            </div>
          </section>

          {/* Audit */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent changes</h3>
            {(d.audit || []).length === 0 ? <p className="mt-2 text-sm text-slate-500">No changes recorded yet.</p> : (
              <ul className="mt-2 divide-y divide-slate-100 text-xs dark:divide-slate-700">
                {d.audit.map((a: any, i: number) => (
                  <li key={i} className="py-2">
                    <p className="text-slate-800 dark:text-slate-200">
                      <b>{a.action.replaceAll("_", " ")}</b>{a.entity_key ? ` · ${featureName(a.entity_key)}` : ""}
                    </p>
                    <p className="text-slate-500">{fmtDateTime(a.created_at)} · {a.actor_label}
                      {a.new_value?.reason ? ` · "${a.new_value.reason}"` : ""}
                      {a.new_value && "enabled" in a.new_value ? ` · → ${a.new_value.enabled ? "on" : "off"}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </>)}
        </div>
      </aside>
    </div>
  );
}

