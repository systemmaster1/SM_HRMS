"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCw, Search, IndianRupee, AlertTriangle, CalendarClock, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Chip, card, inputCls, btnGhost, fmtDate, fmtDateTime } from "./shared";

type BillingRow = {
  company_id: string;
  org_code?: string | null;
  name: string;
  email?: string | null;
  plan_code?: string | null;
  status?: string | null;
  licensed_users?: number | null;
  custom_price_per_user?: number | null;
  discount_percent?: number | null;
  billing_cycle?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  next_billing_at?: string | null;
  billing_email?: string | null;
  razorpay_customer_id?: string | null;
  razorpay_subscription_id?: string | null;
  total_paid?: number | null;
  total_due?: number | null;
  latest_paid_at?: string | null;
};

type Overview = {
  total_organizations?: number;
  paid_organizations?: number;
  trial_organizations?: number;
  past_due_organizations?: number;
  expiring_10_days?: number;
  received_total?: number;
  outstanding_total?: number;
  payments_30d?: number;
};

const money = (value?: number | null) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

function billingStatus(status?: string | null) {
  if (status === "active") return <Chip tone="green">Active</Chip>;
  if (status === "past_due") return <Chip tone="red">Past due</Chip>;
  if (status === "trial") return <Chip tone="blue">Trial</Chip>;
  if (status === "paused") return <Chip tone="amber">Paused</Chip>;
  if (status === "cancelled") return <Chip tone="slate">Cancelled</Chip>;
  return <Chip>{status || "Not configured"}</Chip>;
}

export default function BillingTab({ onOpenOrg }: { onOpenOrg?: (companyId: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [overview, setOverview] = useState<Overview>({});
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [overviewResult, listResult] = await Promise.all([
      supabase.rpc("system_admin_billing_overview"),
      supabase.rpc("system_admin_billing_list", {
        p_search: search.trim() || null,
        p_status: status || null,
        p_limit: 100,
        p_offset: 0,
      }),
    ]);

    if (overviewResult.error || listResult.error) {
      setError(overviewResult.error?.message || listResult.error?.message || "Unable to load billing data.");
      setLoading(false);
      return;
    }

    setOverview((overviewResult.data || {}) as Overview);
    const payload = (listResult.data || {}) as { rows?: BillingRow[]; total?: number };
    setRows(payload.rows || []);
    setTotal(Number(payload.total || 0));
    setLoading(false);
  }, [supabase, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const exportCsv = () => {
    const headers = ["Organization","Org Code","Plan","Status","Licensed Users","Total Paid","Total Due","Next Billing","Razorpay Subscription"];
    const values = rows.map((r) => [
      r.name, r.org_code || "", r.plan_code || "", r.status || "", r.licensed_users || "",
      Number(r.total_paid || 0).toFixed(2), Number(r.total_due || 0).toFixed(2),
      r.next_billing_at || r.current_period_end || r.trial_ends_at || "", r.razorpay_subscription_id || "",
    ]);
    const csv = [headers, ...values].map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sm-hrms-billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    ["Received (30d)", money(overview.payments_30d), IndianRupee],
    ["Outstanding", money(overview.outstanding_total), AlertTriangle],
    ["Paid organizations", String(overview.paid_organizations || 0), CreditCard],
    ["Expiring in 10 days", String(overview.expiring_10_days || 0), CalendarClock],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className={`${card} p-4 shadow-sm`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <Icon className="h-4 w-4 text-brand-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <section className={`${card} overflow-hidden shadow-sm`}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Organization billing</h3>
            <p className="mt-0.5 text-xs text-slate-500">{total} organization{total === 1 ? "" : "s"} · Razorpay-linked subscriptions and manual billing records</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className={`${inputCls} min-w-64 pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organization, code, email" />
            </label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
            <button type="button" className={btnGhost} onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />CSV</button>
          </div>
        </div>

        {error && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3">Organization</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Users</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Next billing</th><th className="px-4 py-3">Razorpay</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && !rows.length ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Loading billing data…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No billing records found.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.company_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{r.name}</p><p className="text-xs text-slate-500">{r.org_code || r.email || "—"}</p></td>
                  <td className="px-4 py-3"><p className="font-medium capitalize">{r.plan_code || "—"}</p><p className="text-xs text-slate-500">{r.billing_cycle || "—"}{r.discount_percent ? ` · ${r.discount_percent}% off` : ""}</p></td>
                  <td className="px-4 py-3">{billingStatus(r.status)}</td>
                  <td className="px-4 py-3">{r.licensed_users || "—"}</td>
                  <td className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-300">{money(r.total_paid)}</td>
                  <td className="px-4 py-3 font-medium text-rose-700 dark:text-rose-300">{money(r.total_due)}</td>
                  <td className="px-4 py-3"><p>{fmtDate(r.next_billing_at || r.current_period_end || r.trial_ends_at)}</p>{r.latest_paid_at && <p className="text-xs text-slate-500">Last paid {fmtDateTime(r.latest_paid_at)}</p>}</td>
                  <td className="px-4 py-3">{r.razorpay_subscription_id ? <Chip tone="violet">Linked</Chip> : <Chip>Not linked</Chip>}</td>
                  <td className="px-4 py-3 text-right">{onOpenOrg && <button type="button" className={btnGhost} onClick={() => onOpenOrg(r.company_id)}>Manage</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
