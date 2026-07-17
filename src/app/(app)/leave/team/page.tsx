"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { FadeIn, StaggerGroup, StaggerItem, HoverLift, MotionButton, SkeletonRows } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import { Users2, SlidersHorizontal, History, Search } from "lucide-react";

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

  const openHistory = async (member: any) => {
    setDetail(member);
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
    if (history.length) openHistory(detail);
  };

  const filtered = rows.filter((r) =>
    !q || r.member.full_name?.toLowerCase().includes(q.toLowerCase())
  );

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
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10" />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={Users2} title="No employees found" hint="Try a different search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Employee</th>
                  {types.map((t) => (
                    <th key={t.id} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t.code}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">&nbsp;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.member.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.member.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {r.member.designation}{r.member.department && ` · ${r.member.department}`}
                      </p>
                    </td>
                    {types.map((t) => {
                      const b = r.balances.find((x: any) => x.type_id === t.id);
                      const bal = b ? Number(b.balance) : 0;
                      return (
                        <td key={t.id} className="px-4 py-3 tabular-nums">
                          <span className={bal < 0 ? "font-semibold text-rose-600" : "text-slate-700"}>
                            {b ? bal : "—"}
                          </span>
                          {b && <span className="text-xs text-slate-400"> / {Number(b.quota)}</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openHistory(r.member)} title="View history"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-700">
                          <History className="h-3.5 w-3.5" /> History
                        </button>
                        <button onClick={() => openAdjust(r.member)} title="Adjust balance"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-700">
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
      <Modal open={!!detail && !adjOpen} onClose={() => setDetail(null)} title={detail ? `${detail.full_name} — leave history` : ""}>
        <div className="space-y-3">
          {historyLoading ? (
            <SkeletonRows rows={3} />
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No leave requests yet.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {history.map((l) => (
                <li key={l.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                      {l.leave_types?.code || "—"}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
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
                </li>
              ))}
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
