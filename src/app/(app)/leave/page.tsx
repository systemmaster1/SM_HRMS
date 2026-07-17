"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { FadeIn, StaggerGroup, StaggerItem, HoverLift, MotionButton, SkeletonRows, motion } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import { MONTHS } from "@/lib/geo";
import { Plane, Plus, Check, X, Users2, Clock, SlidersHorizontal } from "lucide-react";

const DAY_LABELS: Record<string, string> = {
  full_day: "Full day",
  first_half: "First half",
  second_half: "Second half",
  short_morning: "Short — morning",
  short_evening: "Short — evening",
  wfh: "Work from home",
};

const DAY_VALUE: Record<string, number> = {
  full_day: 1, first_half: 0.5, second_half: 0.5,
  short_morning: 0, short_evening: 0, wfh: 0,
};

export default function LeavePage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [balances, setBalances] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [colleagues, setColleagues] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"me" | "team" | "buddy">("me");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState("");
  const [af, setAf] = useState({ employee_id: "", leave_type_id: "", delta_days: "1", reason: "" });

  const [f, setF] = useState({
    day_type: "full_day",
    leave_type_id: "",
    from_date: "",
    to_date: "",
    reason: "",
    buddy_id: "",
    buddy_note: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: c } = await supabase
      .from("companies").select("*").eq("id", p!.company_id).single();
    setCompany(c);

    const { data: t } = await supabase
      .from("leave_types").select("*").eq("active", true).order("sort_order");
    setTypes(t || []);
    if (t?.length) {
      setF((prev) => ({ ...prev, leave_type_id: prev.leave_type_id || t[0].id }));
      setAf((prev) => ({ ...prev, leave_type_id: prev.leave_type_id || t[0].id }));
    }

    if (isAdminRole((p as Profile)?.role)) {
      const { data: mem } = await supabase
        .from("profiles").select("*").eq("status", "active").order("full_name");
      setMembers((mem as Profile[]) || []);
    }

    const { data: bal } = await supabase.rpc("leave_balance");
    setBalances(bal || []);

    const { data: l } = await supabase
      .from("leaves")
      .select("*, profiles:employee_id(full_name, department), buddy:buddy_id(full_name), leave_types:leave_type_id(code, name)")
      .gte("from_date", `${year}-01-01`).lte("from_date", `${year}-12-31`)
      .order("created_at", { ascending: false });
    setLeaves(l || []);

    // possible buddies
    let q = supabase.from("profiles").select("*").eq("status", "active").neq("id", auth.user!.id);
    if (c?.buddy_scope === "department" && p?.department) {
      q = q.eq("department", p.department);
    }
    const { data: co } = await q.order("full_name");
    setColleagues((co as Profile[]) || []);

    setLoading(false);
  }, [supabase, year]);

  useEffect(() => { load(); }, [load]);

  const days = () => {
    const dv = DAY_VALUE[f.day_type];
    if (dv === 0) return 0;
    if (dv === 0.5) return 0.5;
    if (!f.from_date || !f.to_date) return 0;
    const n = (new Date(f.to_date).getTime() - new Date(f.from_date).getTime()) / 86400000 + 1;
    return n > 0 ? n : 0;
  };

  const isFullDay = f.day_type === "full_day";
  const isSingle = ["first_half", "second_half", "short_morning", "short_evening"].includes(f.day_type);

  const apply = async () => {
    setError("");
    if (!f.from_date) return setError("Please select a date.");
    if (isFullDay && !f.to_date) return setError("Please select the end date.");
    if (!f.leave_type_id && f.day_type !== "wfh")
      return setError("Please choose a leave type.");
    if (company?.buddy_enabled && company?.buddy_required && isFullDay && !f.buddy_id)
      return setError("Please nominate a buddy for full-day leave.");

    setSaving(true);
    const to = isFullDay ? f.to_date : f.from_date;
    const n = days();

    const { data: created, error: err } = await supabase.from("leaves").insert({
      company_id: me!.company_id,
      employee_id: me!.id,
      leave_type_id: f.leave_type_id || null,
      day_type: f.day_type,
      from_date: f.from_date,
      to_date: to,
      days: n,
      reason: f.reason,
      buddy_id: f.buddy_id || null,
      buddy_status: f.buddy_id ? "pending" : "none",
      buddy_note: f.buddy_note,
    }).select().single();

    if (err) { setSaving(false); return setError(err.message); }

    // Notify the reporting manager, or admins if none is set
    const notifyTargets: string[] = [];
    if (me!.manager_id) {
      notifyTargets.push(me!.manager_id);
    } else {
      const { data: admins } = await supabase
        .from("profiles").select("id").in("role", ["owner", "admin"]);
      admins?.forEach((a: any) => notifyTargets.push(a.id));
    }
    if (notifyTargets.length) {
      await supabase.from("notifications").insert(
        notifyTargets.map((uidTarget) => ({
          company_id: me!.company_id,
          user_id: uidTarget,
          title: "New leave request",
          body: `${me!.full_name} applied for ${DAY_LABELS[f.day_type].toLowerCase()} leave from ${f.from_date}${isFullDay ? ` to ${to}` : ""}.`,
          kind: "leave_status",
          link: "/leave",
        }))
      );
    }

    // Notify the buddy
    if (f.buddy_id) {
      await supabase.from("notifications").insert({
        company_id: me!.company_id,
        user_id: f.buddy_id,
        title: "You have been nominated as a buddy",
        body: `${me!.full_name} is on ${DAY_LABELS[f.day_type].toLowerCase()} leave from ${f.from_date}${isFullDay ? ` to ${to}` : ""}. Please accept to cover their work.`,
        kind: "buddy_request",
        link: "/leave",
      });
    }

    setSaving(false);
    setOpen(false);
    setF({ day_type: "full_day", leave_type_id: types[0]?.id || "", from_date: "", to_date: "", reason: "", buddy_id: "", buddy_note: "" });
    load();
  };

  const decide = async (l: any, status: "approved" | "rejected") => {
    await supabase.from("leaves")
      .update({ status, decided_by: me!.id, decided_at: new Date().toISOString() })
      .eq("id", l.id);

    await supabase.from("notifications").insert({
      company_id: me!.company_id,
      user_id: l.employee_id,
      title: `Leave ${status}`,
      body: `Your leave from ${l.from_date} has been ${status}.`,
      kind: "leave_status",
      link: "/leave",
    });
    load();
  };

  const adjustBalance = async () => {
    setAdjError("");
    if (!af.employee_id) return setAdjError("Choose an employee.");
    if (!af.leave_type_id) return setAdjError("Choose a leave type.");
    const delta = parseFloat(af.delta_days);
    if (!delta) return setAdjError("Enter a non-zero number of days.");

    setAdjSaving(true);
    const { error } = await supabase.rpc("adjust_leave_balance", {
      p_employee: af.employee_id,
      p_leave_type: af.leave_type_id,
      p_delta_days: delta,
      p_reason: af.reason,
    });
    setAdjSaving(false);
    if (error) return setAdjError(error.message);

    setAdjOpen(false);
    setAf({ employee_id: "", leave_type_id: types[0]?.id || "", delta_days: "1", reason: "" });
    load();
  };

  const buddyRespond = async (l: any, status: "accepted" | "declined") => {
    await supabase.from("leaves").update({ buddy_status: status }).eq("id", l.id);
    await supabase.from("notifications").insert({
      company_id: me!.company_id,
      user_id: l.employee_id,
      title: `Buddy ${status}`,
      body: `${me!.full_name} has ${status} your buddy request.`,
      kind: "buddy_request",
      link: "/leave",
    });
    load();
  };

  const admin = isAdminRole(me?.role);
  const mine = leaves.filter((l) => l.employee_id === me?.id);
  const buddyReqs = leaves.filter((l) => l.buddy_id === me?.id);
  const teamReqs = leaves.filter((l) => l.employee_id !== me?.id);
  const pending = teamReqs.filter((l) => l.status === "pending").length;
  const pendingBuddy = buddyReqs.filter((l) => l.buddy_status === "pending").length;

  const list = tab === "team" ? teamReqs : tab === "buddy" ? buddyReqs : mine;
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const allowed: string[] = company?.day_types || ["full_day"];

  if (loading) return <Card><SkeletonRows rows={5} /></Card>;

  return (
    <div>
      <FadeIn>
      <PageHeader
        title="Leave"
        subtitle="Apply for leave and track your balance."
        action={
          <div className="flex shrink-0 gap-2">
            {admin && (
              <button onClick={() => setAdjOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
                <SlidersHorizontal className="h-4 w-4" /> Adjust balance
              </button>
            )}
            <button onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
              <Plus className="h-4 w-4" /> Apply for leave
            </button>
          </div>
        }
      />
      </FadeIn>

      {/* Balances */}
      <StaggerGroup className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {balances.map((b) => {
          const pending = leaves.filter(
            (l) => l.employee_id === me?.id && l.status === "pending" && l.leave_type_id === b.type_id
          ).reduce((s, l) => s + Number(l.days || 0), 0);
          return (
            <StaggerItem key={b.type_id}>
              <HoverLift className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{b.name}</p>
                  <span className="rounded bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                    {b.code}
                  </span>
                </div>
                <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {Number(b.balance)}
                  <span className="ml-1 text-xs font-normal text-slate-400">/ {Number(b.quota)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {Number(b.used)} used
                  {pending > 0 && <span className="ml-1.5 text-amber-500">· {pending} pending</span>}
                </p>
              </HoverLift>
            </StaggerItem>
          );
        })}
        {balances.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">
            No leave types configured. Set them up in Organization.
          </p>
        )}
      </StaggerGroup>

      {/* Tabs + year */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1">
          <TabBtn on={tab === "me"} onClick={() => setTab("me")}>My leave</TabBtn>
          {company?.buddy_enabled && (
            <TabBtn on={tab === "buddy"} onClick={() => setTab("buddy")}>
              Buddy{pendingBuddy ? ` (${pendingBuddy})` : ""}
            </TabBtn>
          )}
          {admin && (
            <TabBtn on={tab === "team"} onClick={() => setTab("team")}>
              Requests{pending ? ` (${pending})` : ""}
            </TabBtn>
          )}
        </div>
      </div>

      {/* List */}
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={Plane} title="Nothing here yet"
            hint={tab === "buddy" ? "Buddy requests will appear here." : "Apply for leave and it will appear here."} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((l: any, i: number) => (
              <motion.li key={l.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.3) }}
                className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {tab !== "me" && (
                        <p className="text-sm font-medium text-slate-900">
                          {l.profiles?.full_name}
                        </p>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {DAY_LABELS[l.day_type] || l.day_type}
                      </span>
                      {l.leave_types?.code && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                          {l.leave_types.code}
                        </span>
                      )}
                      <Badge value={l.status} />
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {l.from_date}
                      {l.from_date !== l.to_date && ` → ${l.to_date}`}
                      {l.days > 0 && ` · ${l.days} day${l.days == 1 ? "" : "s"}`}
                      {l.reason && ` · ${l.reason}`}
                    </p>

                    {l.buddy?.full_name && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                        <Users2 className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-500">Buddy: {l.buddy.full_name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          l.buddy_status === "accepted" ? "bg-emerald-50 text-emerald-700"
                          : l.buddy_status === "declined" ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                        }`}>
                          {l.buddy_status}
                        </span>
                      </p>
                    )}
                    {l.buddy_note && tab === "buddy" && (
                      <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {l.buddy_note}
                      </p>
                    )}
                  </div>

                  {/* Buddy actions */}
                  {tab === "buddy" && l.buddy_status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => buddyRespond(l, "accepted")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700">
                        Accept
                      </button>
                      <button onClick={() => buddyRespond(l, "declined")}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                        Decline
                      </button>
                    </div>
                  )}

                  {/* Admin actions */}
                  {tab === "team" && admin && l.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => decide(l, "approved")} title="Approve"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => decide(l, "rejected")} title="Reject"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>

      {/* Apply modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Apply for leave">
        <div className="space-y-4">
          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-slate-700">Duration</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {allowed.map((d) => (
                <button key={d} type="button" onClick={() => set("day_type", d)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    f.day_type === d
                      ? "border-brand-700 bg-brand-50 font-medium text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Leave type */}
          {f.day_type !== "wfh" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Leave type</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.leave_type_id}
                onChange={(e) => set("leave_type_id", e.target.value)}>
                {types.map((t) => {
                  const b = balances.find((x) => x.type_id === t.id);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}){b ? ` — ${Number(b.balance)} left` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className={`grid gap-3 ${isFullDay ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="text-sm font-medium text-slate-700">
                {isFullDay ? "From" : "Date"}
              </label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={f.from_date}
                onChange={(e) => set("from_date", e.target.value)} />
            </div>
            {isFullDay && (
              <div>
                <label className="text-sm font-medium text-slate-700">To</label>
                <input type="date" className={`mt-1.5 ${inputCls}`} value={f.to_date}
                  onChange={(e) => set("to_date", e.target.value)} />
              </div>
            )}
          </div>

          {days() > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Total: <strong>{days()}</strong> day(s)
            </p>
          )}

          {/* Reason */}
          <div>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={2} placeholder="Brief reason"
              value={f.reason} onChange={(e) => set("reason", e.target.value)} />
          </div>

          {/* Buddy */}
          {company?.buddy_enabled && isFullDay && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <Users2 className="h-4 w-4" /> Work buddy
                {company?.buddy_required && <span className="text-rose-500">*</span>}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {company?.buddy_scope === "department"
                  ? "A colleague from your department who will cover your work."
                  : "A colleague who will cover your work."}
              </p>
              <select className={`mt-2.5 ${inputCls}`} value={f.buddy_id}
                onChange={(e) => set("buddy_id", e.target.value)}>
                <option value="">No buddy</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}{c.designation ? ` — ${c.designation}` : ""}
                  </option>
                ))}
              </select>
              {f.buddy_id && (
                <textarea className={`mt-2.5 ${inputCls}`} rows={2}
                  placeholder="Handover notes for your buddy (optional)"
                  value={f.buddy_note} onChange={(e) => set("buddy_note", e.target.value)} />
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <MotionButton onClick={apply} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Submitting…" : "Submit request"}
          </MotionButton>
        </div>
      </Modal>

      {/* Adjust balance (admin) */}
      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} title="Adjust leave balance">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Employee *</label>
            <select className={`mt-1.5 ${inputCls}`} value={af.employee_id}
              onChange={(e) => setAf((p) => ({ ...p, employee_id: e.target.value }))}>
              <option value="">Select…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
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
              Positive deducts (e.g. <code>1</code>), negative credits back (e.g. <code>-1</code>).
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="e.g. Correction, goodwill credit"
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

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
        on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}>
      {children}
    </button>
  );
}
