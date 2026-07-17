"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { FadeIn, StaggerGroup, StaggerItem, HoverLift, MotionButton, SkeletonRows, motion } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import { Users2, SlidersHorizontal, History, Search, Check, X, Clock, Plane } from "lucide-react";

const DAY_LABELS: Record<string, string> = {
  full_day: "Full day", first_half: "First half", second_half: "Second half",
  short_morning: "Short — morning", short_evening: "Short — evening", wfh: "Work from home",
};

export default function TeamLeaveBalancePage() {
  const supabase = createClient();
  const router = useRouter();

  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const [detail, setDetail] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState("");
  const [af, setAf] = useState({ leave_type_id: "", delta_days: "1", reason: "" });

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    if (!isAdminRole((p as Profile)?.role)) {
      router.push("/leave");
      return;
    }

    const { data: t } = await supabase
      .from("leave_types").select("*").eq("active", true).order("sort_order");
    setTypes(t || []);
    if (t?.length) setAf((prev) => ({ ...prev, leave_type_id: prev.leave_type_id || t[0].id }));

    const { data: members } = await supabase
      .from("profiles").select("*").eq("status", "active").order("full_name");

    const balances = await Promise.all(
      (members || []).map(async (m) => {
        const { data: bal } = await supabase.rpc("leave_balance", { p_employee: m.id });
        return { member: m, balances: bal || [] };
      })
    );
    setRows(balances);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  const openHistory = async (member: any, filterType: string | null = null) => {
    setDetail(member);
    setTypeFilter(filterType);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("leaves")
      .select("*, leave_types:leave_type_id(code, name), decider:decided_by(full_name)")
      .eq("employee_id", member.id)
      .order("from_date", { ascending: false });
    setHistory(data || []);
    setHistoryLoading(false);
  };

  const openAdjust = (member: any) => {
    setDetail(member);
    setAf({ leave_type_id: types[0]?.id || "", delta_days: "1", reason: "" });
    setAdjError("");
    setAdjOpen(true);
  };

  const adjustBalance = async () => {
    setAdjError("");
    if (!af.leave_type_id) return setAdjError("Choose a leave type.");
    const delta = parseFloat(af.delta_days);
    if (!delta) return setAdjError("Enter a non-zero number of days.");

    setAdjSaving(true);
    const { error } = await supabase.rpc("adjust_leave_balance", {
      p_employee: detail.id,
      p_leave_type: af.leave_type_id,
      p_delta_days: delta,
      p_reason: af.reason,
    });
    setAdjSaving(false);
    if (error) return setAdjError(error.message);

    setAdjOpen(false);
    load();
  };

  const filtered = rows.filter((r) =>
    !q || r.member.full_name?.toLowerCase().includes(q.toLowerCase())
  );

  const detailRow = rows.find((r) => r.member.id === detail?.id);
  const visibleHistory = typeFilter
    ? history.filter((l) => l.leave_type_id === typeFilter)
    : history;

  const initials = (n: string) =>
    (n || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (loading) return <Card><SkeletonRows rows={6} /></Card>;

  return (
    <div>
      <FadeIn>
        <PageHeader title="Team leave balances" subtitle="Every employee's balance, history and manual adjustments." />
      </FadeIn>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search employee…"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10" />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={Users2} title="No employees found" hint="Try a different search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Employee</th>
                  {types.map((t) => (
                    <th key={t.id} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t.code}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">&nbsp;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((r) => (
                  <tr key={r.member.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 dark:bg-brand-500/10 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                          {r.member.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.member.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : initials(r.member.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{r.member.full_name}</p>
                          <p className="truncate text-xs text-slate-400">
                            {r.member.designation}{r.member.department && ` · ${r.member.department}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    {types.map((t) => {
                      const b = r.balances.find((x: any) => x.type_id === t.id);
                      const bal = b ? Number(b.balance) : 0;
                      const low = b && Number(b.quota) > 0 && bal <= Number(b.quota) * 0.2;
                      return (
                        <td key={t.id} className="px-4 py-3 tabular-nums">
                          <button onClick={() => openHistory(r.member, t.id)}
                            title={`View ${t.code} history`}
                            className="rounded-md px-1.5 py-1 transition hover:bg-brand-50 dark:hover:bg-brand-500/10">
                            <span className={`font-semibold ${low ? "text-rose-600" : "text-slate-900 dark:text-slate-100"}`}>
                              {b ? bal : "—"}
                            </span>
                            {b && <span className="text-xs text-slate-400"> / {Number(b.quota)}</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openHistory(r.member)} title="View history"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-brand-600 hover:text-brand-700">
                          <History className="h-3.5 w-3.5" /> History
                        </button>
                        <button onClick={() => openAdjust(r.member)} title="Adjust balance"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-brand-600 hover:text-brand-700">
                          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* History modal */}
      <Modal open={!!detail && !adjOpen} onClose={() => setDetail(null)} title="Leave history">
        <div className="space-y-4">
          {/* Employee summary header */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 p-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-700 text-sm font-semibold text-white">
              {detail?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : initials(detail?.full_name || "")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{detail?.full_name}</p>
              <p className="truncate text-xs text-slate-500">
                {detail?.designation}{detail?.department && ` · ${detail.department}`}
              </p>
            </div>
          </div>

          {/* Balance summary chips */}
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => {
              const b = detailRow?.balances.find((x: any) => x.type_id === t.id);
              const bal = b ? Number(b.balance) : 0;
              const on = typeFilter === t.id;
              return (
                <button key={t.id} onClick={() => setTypeFilter(on ? null : t.id)}
                  className={`rounded-lg border p-2.5 text-left transition ${
                    on ? "border-brand-600 bg-brand-50 dark:bg-brand-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}>
                  <p className="text-[10px] font-bold uppercase text-slate-400">{t.code}</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {b ? bal : "—"}<span className="text-xs font-normal text-slate-400">/{b ? Number(b.quota) : 0}</span>
                  </p>
                </button>
              );
            })}
          </div>
          {typeFilter && (
            <button onClick={() => setTypeFilter(null)} className="text-xs font-medium text-brand-700 hover:text-brand-800">
              Clear filter — show all types
            </button>
          )}

          {/* Timeline */}
          {historyLoading ? (
            <SkeletonRows rows={3} />
          ) : visibleHistory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No leave requests yet.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {visibleHistory.map((l) => {
                const icon = l.status === "approved" ? Check : l.status === "rejected" ? X : Clock;
                const tone = l.status === "approved" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : l.status === "rejected" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                  : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
                const Icon = icon;
                return (
                  <li key={l.id} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {l.leave_types?.code && (
                          <span className="rounded bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                            {l.leave_types.code}
                          </span>
                        )}
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {DAY_LABELS[l.day_type] || l.day_type}
                        </span>
                        <Badge value={l.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {l.from_date}{l.from_date !== l.to_date && ` → ${l.to_date}`}
                        {l.days > 0 && ` · ${l.days} day(s)`}
                        {l.reason && ` · ${l.reason}`}
                      </p>
                      {l.decider?.full_name && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {l.status === "approved" ? "Approved" : l.status === "rejected" ? "Rejected" : "Decided"} by {l.decider.full_name}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* Adjust modal */}
      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} title={`Adjust balance — ${detail?.full_name || ""}`}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Leave type *</label>
            <select className={`mt-1.5 ${inputCls}`} value={af.leave_type_id}
              onChange={(e) => setAf((p) => ({ ...p, leave_type_id: e.target.value }))}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Days</label>
            <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`} value={af.delta_days}
              onChange={(e) => setAf((p) => ({ ...p, delta_days: e.target.value }))} />
            <p className="mt-1.5 text-xs text-slate-500">
              Positive deducts (e.g. for leave taken without applying). Negative credits back.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="e.g. Took leave on 12 Jul without applying"
              value={af.reason} onChange={(e) => setAf((p) => ({ ...p, reason: e.target.value }))} />
          </div>

          {adjError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{adjError}</p>
          )}

          <MotionButton onClick={adjustBalance} disabled={adjSaving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            {adjSaving ? "Saving…" : "Apply adjustment"}
          </MotionButton>
        </div>
      </Modal>
    </div>
  );
}
