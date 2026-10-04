"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Plane, CalendarClock, Inbox, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { useFeature } from "@/lib/features/client";
import { toast } from "@/components/Dialogs";

type Me = { id: string; company_id: string; role: string };
type LeaveRow = {
  id: string; employee_id: string; from_date: string; to_date: string; day_type: string | null; days: number | null;
  reason: string | null; created_at: string;
  profiles: { full_name: string | null; department: string | null; manager_id: string | null; work_manager_id: string | null; field_manager_id: string | null } | null;
  leave_types: { name: string | null } | null;
};
type ExtRow = {
  id: string; delegation_id: string; requested_by: string; requested_date: string; requested_time: string | null;
  reason: string | null; created_at: string;
  delegations: { title: string; due_date: string | null; due_time: string | null; assigned_by: string | null; revised_count: number | null } | null;
  requester: { full_name: string | null } | null;
};

const dayLabel = (t: string | null) =>
  ({ full_day: "Full day", first_half: "First half", second_half: "Second half", short_morning: "Short leave (morning)",
     short_evening: "Short leave (evening)", wfh: "Work from home" } as Record<string, string>)[t || "full_day"] || "Leave";
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * One place for Owners, Admins and Managers to act on what is waiting for
 * them. The database decides who may approve (reporting manager / task sender
 * / Owner / Admin); this screen only lists what the signed-in person can see.
 */
export default function ApprovalsPage() {
  const supabase = createClient();
  const leaveOn = useFeature("leave");
  const tasksOn = useFeature("tasks");
  const [me, setMe] = useState<Me | null>(null);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [exts, setExts] = useState<ExtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("id, company_id, role").eq("id", user.id).single();
    if (!p) return;
    setMe(p as Me);
    const admin = p.role === "owner" || p.role === "admin";

    const [lv, ex] = await Promise.all([
      leaveOn
        ? supabase.from("leaves")
            .select("id, employee_id, from_date, to_date, day_type, days, reason, created_at, profiles:employee_id(full_name, department, manager_id, work_manager_id, field_manager_id), leave_types:leave_type_id(name)")
            .eq("status", "pending").neq("employee_id", p.id)
            .order("from_date").limit(200)
        : Promise.resolve({ data: [], error: null }),
      tasksOn
        ? supabase.from("task_extensions")
            .select("id, delegation_id, requested_by, requested_date, requested_time, reason, created_at, delegations:delegation_id(title, due_date, due_time, assigned_by, revised_count), requester:requested_by(full_name)")
            .eq("status", "pending").neq("requested_by", p.id)
            .order("created_at").limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (lv.error || ex.error) setError(friendlyError(lv.error || ex.error, "load approvals"));
    // Buddy requests are visible too; keep only the leave this person can decide.
    setLeaves(((lv.data || []) as unknown as LeaveRow[]).filter((l) => admin
      || [l.profiles?.manager_id, l.profiles?.work_manager_id, l.profiles?.field_manager_id].includes(p.id)));
    // Only requests this person can decide: Owner/Admin, or the task sender.
    setExts(((ex.data || []) as unknown as ExtRow[]).filter((x) => admin || x.delegations?.assigned_by === p.id));
    setLoading(false);
  }, [supabase, leaveOn, tasksOn]);

  useEffect(() => { void load(); }, [load]);

  async function decideLeave(l: LeaveRow, status: "approved" | "rejected") {
    if (!me) return;
    setBusy(l.id);
    const { error: e } = await supabase.from("leaves").update({ status }).eq("id", l.id);
    if (e) { setBusy(null); toast(friendlyError(e, `${status === "approved" ? "approve" : "reject"} the leave`), "error"); return; }
    await supabase.from("notifications").insert({
      company_id: me.company_id, user_id: l.employee_id,
      title: `Leave ${status}`, body: `Your leave from ${l.from_date} has been ${status}.`,
      kind: "leave_status", link: "/leave",
    });
    setLeaves((rows) => rows.filter((r) => r.id !== l.id));
    setBusy(null);
    toast(status === "approved" ? "Leave approved" : "Leave rejected");
  }

  async function decideExt(x: ExtRow, approve: boolean) {
    if (!me) return;
    setBusy(x.id);
    const { error: e } = await supabase.from("task_extensions").update({ status: approve ? "approved" : "rejected" }).eq("id", x.id);
    if (e) { setBusy(null); toast(friendlyError(e, "decide the request"), "error"); return; }
    if (approve) {
      const { error: e2 } = await supabase.from("delegations").update({
        due_date: x.requested_date, due_time: x.requested_time,
        revised_count: (x.delegations?.revised_count || 0) + 1,
      }).eq("id", x.delegation_id);
      if (e2) toast(friendlyError(e2, "update the due date"), "error");
    }
    await supabase.from("notifications").insert({
      company_id: me.company_id, user_id: x.requested_by,
      title: approve ? "Extension approved" : "Extension rejected",
      body: `${x.delegations?.title || "Task"}${approve ? ` · new due date ${x.requested_date}` : ""}`,
      kind: "task", link: "/tasks",
    });
    setExts((rows) => rows.filter((r) => r.id !== x.id));
    setBusy(null);
    toast(approve ? "New due date approved" : "Request rejected");
  }

  const total = leaves.length + exts.length;
  const ActionButtons = ({ id, onApprove, onReject }: { id: string; onApprove: () => void; onReject: () => void }) => (
    <div className="flex shrink-0 gap-2">
      <button onClick={onReject} disabled={busy === id} aria-label="Reject"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300">
        <X className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Reject</span>
      </button>
      <button onClick={onApprove} disabled={busy === id} aria-label="Approve"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy === id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">Approve</span>
      </button>
    </div>
  );

  if (me && !["owner", "admin", "manager"].includes(me.role)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">Approvals are for managers and administrators.</p>
        <Link href="/leave" className="mt-3 inline-block text-sm font-semibold text-brand-700">See my leave requests</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">Approvals</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {loading ? "Loading…" : total ? `${total} waiting for you` : "Nothing is waiting for you."}
      </p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      {!loading && total === 0 && !error && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
          <Inbox className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">All caught up</p>
          <p className="mt-1 text-xs text-slate-500">Leave and due-date requests from your team will appear here.</p>
        </div>
      )}

      {leaves.length > 0 && (
        <section className="mt-6" aria-labelledby="ap-leave">
          <h2 id="ap-leave" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Plane className="h-4 w-4" aria-hidden /> Leave requests ({leaves.length})
          </h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {leaves.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{l.profiles?.full_name || "Employee"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {l.leave_types?.name ? `${l.leave_types.name} · ` : ""}{dayLabel(l.day_type)} · {fmt(l.from_date)}
                    {l.to_date && l.to_date !== l.from_date ? ` – ${fmt(l.to_date)}` : ""}{l.days ? ` · ${l.days} day${l.days === 1 ? "" : "s"}` : ""}
                  </p>
                  {l.reason && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{l.reason}</p>}
                </div>
                <ActionButtons id={l.id} onApprove={() => decideLeave(l, "approved")} onReject={() => decideLeave(l, "rejected")} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {exts.length > 0 && (
        <section className="mt-6" aria-labelledby="ap-ext">
          <h2 id="ap-ext" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <CalendarClock className="h-4 w-4" aria-hidden /> More time on tasks ({exts.length})
          </h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {exts.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{x.delegations?.title || "Task"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {x.requester?.full_name || "Employee"} · due {x.delegations?.due_date ? fmt(x.delegations.due_date) : "—"} → {fmt(x.requested_date)}
                    {x.requested_time ? ` ${x.requested_time.slice(0, 5)}` : ""}
                  </p>
                  {x.reason && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{x.reason}</p>}
                </div>
                <ActionButtons id={x.id} onApprove={() => decideExt(x, true)} onReject={() => decideExt(x, false)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
