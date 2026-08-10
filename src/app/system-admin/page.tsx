"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
  CalendarPlus,
  CircleDollarSign,
  RefreshCcw,
  Search,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ClientRow = {
  company_id: string;
  company_name: string;
  plan_code: string;
  status: string;
  licensed_users: number;
  active_users: number;
  price_per_user: number;
  monthly_value: number;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  cancel_at_period_end: boolean;
};

const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

export default function SystemAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setMessage("");
    const { data: ok, error: authErr } = await supabase.rpc("is_system_admin");
    if (authErr || !ok) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    const { data, error } = await supabase.rpc("system_admin_clients");
    if (error) setMessage(error.message);
    setRows((data || []) as ClientRow[]);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) =>
    `${r.company_name} ${r.plan_code} ${r.status}`.toLowerCase().includes(query.toLowerCase())
  );

  const kpis = {
    clients: rows.length,
    users: rows.reduce((a, b) => a + Number(b.active_users || 0), 0),
    mrr: rows.filter((x) => x.status === "active").reduce((a, b) => a + Number(b.monthly_value || 0), 0),
    trials: rows.filter((x) => x.status === "trial").length,
  };

  const update = async (payload: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.rpc("system_admin_update_subscription", {
      p_company_id: selected.company_id,
      p_plan_code: payload.plan_code ?? null,
      p_status: payload.status ?? null,
      p_licensed_users: payload.licensed_users ?? null,
      p_custom_price_per_user: payload.custom_price_per_user ?? null,
      p_discount_percent: payload.discount_percent ?? null,
      p_extend_days: payload.extend_days ?? null,
      p_cancel_at_period_end: payload.cancel_at_period_end ?? null,
      p_notes: payload.notes ?? null,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSelected(null);
    await load();
  };

  if (allowed === null) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-white">Checking SystemMaster access…</div>;
  }

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-2xl font-bold">SystemMaster Super Admin</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This account is not authorized as a platform administrator.
          </p>
          <p className="mt-4 text-xs text-slate-500">Sign in with the dedicated SystemMaster admin account.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Platform Control Center
            </div>
            <h1 className="mt-3 text-3xl font-bold">SystemMaster Super Admin</h1>
            <p className="mt-2 text-sm text-slate-300">Clients, plans, seats, renewals and subscription overrides.</p>
          </div>
          <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </header>

        {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total Clients", kpis.clients, Building2],
            ["Total Users", kpis.users, UsersRound],
            ["Active MRR", money(kpis.mrr), CircleDollarSign],
            ["Trials", kpis.trials, WalletCards],
          ].map(([label, value, Icon]: any) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-sm text-slate-500"><span>{label}</span><Icon className="h-4 w-4" /></div>
              <div className="mt-3 text-2xl font-bold">{value}</div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Client subscriptions</h2>
              <p className="mt-1 text-xs text-slate-500">Open a client to change plan, seats, price or expiry.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client…" className="w-60 bg-transparent text-sm outline-none" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Monthly value</th>
                  <th className="px-4 py-3">Renewal / Trial</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.company_id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-semibold">{r.company_name}</td>
                    <td className="px-4 py-4 capitalize">{r.plan_code}</td>
                    <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">{r.status}</span></td>
                    <td className="px-4 py-4">{r.active_users} active / {r.licensed_users} seats</td>
                    <td className="px-4 py-4">{money(r.price_per_user)}/user</td>
                    <td className="px-4 py-4 font-semibold">{money(r.monthly_value)}</td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {r.status === "trial" ? (r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleDateString("en-IN") : "—") : (r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("en-IN") : "—")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button onClick={() => setSelected(r)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{selected.company_name}</h2>
                <p className="mt-1 text-sm text-slate-500">Manage subscription override</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-2xl text-slate-400">×</button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Plan
                <select id="sa-plan" defaultValue={selected.plan_code} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                  <option value="starter">Starter · ₹29</option>
                  <option value="business">Business · ₹79</option>
                  <option value="pro">Pro · ₹99</option>
                  <option value="enterprise">Enterprise · ₹149+</option>
                </select>
              </label>
              <label className="text-sm font-medium">Status
                <select id="sa-status" defaultValue={selected.status} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="text-sm font-medium">Licensed users
                <input id="sa-seats" type="number" min="1" defaultValue={selected.licensed_users} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium">Custom ₹ / user
                <input id="sa-price" type="number" min="0" placeholder="Blank = standard" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium">Discount %
                <input id="sa-discount" type="number" min="0" max="100" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium">Extend by days
                <input id="sa-extend" type="number" min="0" placeholder="e.g. 30" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              </label>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button
                disabled={saving}
                onClick={() => {
                  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement)?.value;
                  update({
                    plan_code: val("sa-plan"),
                    status: val("sa-status"),
                    licensed_users: Number(val("sa-seats")),
                    custom_price_per_user: val("sa-price") ? Number(val("sa-price")) : null,
                    discount_percent: Number(val("sa-discount") || 0),
                    extend_days: val("sa-extend") ? Number(val("sa-extend")) : null,
                  });
                }}
                className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white"
              >
                Save changes
              </button>
              <button onClick={() => update({ extend_days: 30 })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">
                <CalendarPlus className="h-4 w-4" /> +30 Days
              </button>
              <button onClick={() => update({ status: "cancelled", cancel_at_period_end: false })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
                <Ban className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
