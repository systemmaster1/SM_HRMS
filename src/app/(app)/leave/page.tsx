"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import { Plane, Plus, Check, X } from "lucide-react";

const LEAVE_LABELS: Record<string, string> = {
  casual: "Casual (CL)",
  sick: "Sick (SL)",
  earned: "Earned (PL)",
  short: "Short leave",
  unpaid: "Unpaid",
};

export default function LeavePage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"me" | "team">("me");

  const [f, setF] = useState({
    leave_type: "casual",
    from_date: "",
    to_date: "",
    reason: "",
    hours: "2",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    if (p?.company_id) {
      const { data: c } = await supabase
        .from("companies").select("*").eq("id", p.company_id).single();
      setCompany(c);
    }

    const { data: bal } = await supabase.rpc("leave_balance");
    setBalances(bal || []);

    const { data: l } = await supabase
      .from("leaves")
      .select("*, profiles:employee_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(80);
    setLeaves(l || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const days = (from: string, to: string) => {
    if (!from || !to) return 0;
    const d = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1;
    return d > 0 ? d : 0;
  };

  const apply = async () => {
    setError("");
    if (!f.from_date || !f.to_date) return setError("Please select the dates.");
    const isShort = f.leave_type === "short";
    const n = isShort ? 0 : days(f.from_date, f.to_date);
    if (!isShort && n <= 0) return setError("The end date must be after the start date.");

    setSaving(true);
    const { error } = await supabase.from("leaves").insert({
      company_id: me!.company_id,
      employee_id: me!.id,
      leave_type: f.leave_type,
      from_date: f.from_date,
      to_date: isShort ? f.from_date : f.to_date,
      days: isShort ? 0 : n,
      hours: isShort ? parseFloat(f.hours) : 0,
      reason: f.reason,
    });
    setSaving(false);
    if (error) return setError(error.message);

    setOpen(false);
    setF({ leave_type: "casual", from_date: "", to_date: "", reason: "", hours: "2" });
    load();
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    await supabase
      .from("leaves")
      .update({ status, decided_by: me!.id, decided_at: new Date().toISOString() })
      .eq("id", id);
    load();
  };

  const admin = isAdminRole(me?.role);
  const rows = admin && tab === "team"
    ? leaves
    : leaves.filter((l) => l.employee_id === me?.id);
  const pending = leaves.filter((l) => l.status === "pending" && l.employee_id !== me?.id).length;

  const balCard = (key: string, label: string) => {
    const b = balances.find((x) => x.leave_type === key);
    return (
      <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900">
          {b ? Number(b.balance).toFixed(b.balance % 1 ? 1 : 0) : "0"}
          <span className="ml-1 text-xs font-normal text-slate-400">
            / {b ? Number(b.quota).toFixed(0) : "0"}
          </span>
        </p>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle={admin && pending ? `${pending} request${pending === 1 ? "" : "s"} awaiting approval` : "Apply for leave and track balances."}
        action={
          <button onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
            <Plus className="h-4 w-4" /> Apply for leave
          </button>
        }
      />

      {/* Balances */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {balCard("casual", "Casual (CL)")}
        {balCard("sick", "Sick (SL)")}
        {balCard("earned", "Earned (PL)")}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Short leave / month</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900">
            {company?.short_leave_per_month ?? 2}
            <span className="ml-1 text-xs font-normal text-slate-400">
              × {company?.short_leave_hours ?? 2}h
            </span>
          </p>
        </div>
      </div>

      {admin && (
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          {(["me", "team"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t === "me" ? "My leave" : `Team requests${pending ? ` (${pending})` : ""}`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {rows.length === 0 ? (
            <EmptyState icon={Plane} title="No leave requests"
              hint="Apply for leave and it will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((l: any) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {admin && tab === "team" && (
                        <p className="text-sm font-medium text-slate-900">
                          {l.profiles?.full_name || "—"}
                        </p>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {LEAVE_LABELS[l.leave_type] || l.leave_type}
                      </span>
                      <Badge value={l.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {l.leave_type === "short"
                        ? `${l.from_date} · ${l.hours}h`
                        : `${l.from_date} → ${l.to_date} · ${l.days} day${l.days == 1 ? "" : "s"}`}
                      {l.reason && ` · ${l.reason}`}
                    </p>
                  </div>

                  {admin && l.status === "pending" && l.employee_id !== me?.id && (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => decide(l.id, "approved")} title="Approve"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => decide(l.id, "rejected")} title="Reject"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Apply for leave">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Leave type</label>
            <select className={`mt-1.5 ${inputCls}`} value={f.leave_type}
              onChange={(e) => set("leave_type", e.target.value)}>
              <option value="casual">Casual leave (CL)</option>
              <option value="sick">Sick leave (SL)</option>
              <option value="earned">Earned leave (PL)</option>
              <option value="short">Short leave</option>
              <option value="unpaid">Unpaid leave</option>
            </select>
          </div>

          {f.leave_type === "short" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input type="date" className={`mt-1.5 ${inputCls}`} value={f.from_date}
                  onChange={(e) => set("from_date", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Hours</label>
                <input type="number" step="0.5" min="0.5" max="4" className={`mt-1.5 ${inputCls}`}
                  value={f.hours} onChange={(e) => set("hours", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">From</label>
                <input type="date" className={`mt-1.5 ${inputCls}`} value={f.from_date}
                  onChange={(e) => set("from_date", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">To</label>
                <input type="date" className={`mt-1.5 ${inputCls}`} value={f.to_date}
                  onChange={(e) => set("to_date", e.target.value)} />
              </div>
            </div>
          )}

          {f.leave_type !== "short" && f.from_date && f.to_date && (
            <p className="text-xs text-slate-500">
              Total: <strong>{days(f.from_date, f.to_date)}</strong> day(s)
            </p>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={3} placeholder="Brief reason"
              value={f.reason} onChange={(e) => set("reason", e.target.value)} />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={apply} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
