"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Modal, EmptyState, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  Plus, ListChecks, ClipboardList, Check, Clock, AlertTriangle,
  RotateCcw, Pause, Play, Trash2, Repeat, Lock,
} from "lucide-react";

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", half_yearly: "Half-yearly", yearly: "Yearly",
};

function computeStatus(dueDate: string, dueTime: string | null, completedAt: string | null) {
  const now = new Date();
  const due = dueTime ? new Date(`${dueDate}T${dueTime}`) : new Date(`${dueDate}T23:59:59`);

  if (completedAt) {
    const done = new Date(completedAt);
    return done > due ? "done_late" : "done_on_time";
  }
  return now > due ? "overdue" : "pending";
}

const STATUS_UI: Record<string, { label: string; cls: string; icon: any }> = {
  pending:      { label: "Pending",       cls: "bg-slate-100 text-slate-600",    icon: Clock },
  overdue:      { label: "Overdue",       cls: "bg-rose-50 text-rose-600",       icon: AlertTriangle },
  done_on_time: { label: "Done on time",  cls: "bg-emerald-50 text-emerald-700", icon: Check },
  done_late:    { label: "Done late",     cls: "bg-amber-50 text-amber-700",     icon: Check },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_UI[status] || STATUS_UI.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

/* ---------- Planned vs completed timestamps ---------- */
function fmtDateTime(dateStr: string, timeStr: string | null) {
  const d = new Date(`${dateStr}T${timeStr || "09:00"}`);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtStamp(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function delayText(dueDate: string, dueTime: string | null, completedAt: string) {
  const due = new Date(`${dueDate}T${dueTime || "09:00"}`);
  const done = new Date(completedAt);
  const mins = Math.round((done.getTime() - due.getTime()) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m late`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m late`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h late`;
}

/* ---------- One task window (Today / Delayed / Upcoming / Completed) ---------- */
const TONES: Record<string, { head: string; ring: string }> = {
  today:    { head: "bg-brand-50 text-brand-700",       ring: "border-brand-200" },
  delayed:  { head: "bg-rose-50 text-rose-700",         ring: "border-rose-200" },
  upcoming: { head: "bg-slate-100 text-slate-500",      ring: "border-slate-200" },
  done:     { head: "bg-emerald-50 text-emerald-700",   ring: "border-emerald-200" },
};

function InstanceWindow({
  title, tone, icon: Icon, items, me, admin, onToggle, locked = false, empty,
}: {
  title: string; tone: string; icon: any; items: any[];
  me: Profile | null; admin: boolean; onToggle: (i: any) => void;
  locked?: boolean; empty: string;
}) {
  const t = TONES[tone] || TONES.today;

  return (
    <div className={`overflow-hidden rounded-2xl border ${t.ring} bg-white`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${t.head}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((i) => {
            const status = computeStatus(i.due_date, i.due_time, i.completed_at);
            const canToggle = (i.assigned_to === me?.id || admin) && !locked;
            const late = i.completed_at
              ? delayText(i.due_date, i.due_time, i.completed_at)
              : null;

            return (
              <li key={i.id} className="flex items-start gap-3 px-4 py-3.5">
                <button
                  onClick={() => canToggle && onToggle(i)}
                  disabled={!canToggle}
                  title={locked ? "This task unlocks on its due date" : undefined}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                    i.completed_at
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 hover:border-brand-600"
                  } ${!canToggle ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {i.completed_at ? (
                    <Check className="h-3 w-3" />
                  ) : locked ? (
                    <Lock className="h-2.5 w-2.5 text-slate-400" />
                  ) : null}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-medium ${i.completed_at ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {i.template?.title}
                    </p>
                    {!locked && <StatusChip status={status} />}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {FREQ_LABELS[i.template?.frequency]}
                    </span>
                    {late && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {late}
                      </span>
                    )}
                  </div>

                  {i.assignee?.full_name && (
                    <p className="mt-1 text-xs text-slate-400">{i.assignee.full_name}</p>
                  )}

                  {/* Planned vs completed timestamps */}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3" />
                      Planned: {fmtDateTime(i.due_date, i.due_time)}
                    </span>
                    {i.completed_at && (
                      <span className={`flex items-center gap-1 font-medium ${late ? "text-amber-600" : "text-emerald-600"}`}>
                        <Check className="h-3 w-3" />
                        Completed: {fmtStamp(i.completed_at)}
                      </span>
                    )}
                  </div>

                  {locked && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <Lock className="h-3 w-3" />
                      Unlocks on its due date — cannot be completed early.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function TasksPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"delegation" | "checklist">("delegation");

  /* ---------------- Delegation state ---------------- */
  const [delegations, setDelegations] = useState<any[]>([]);
  const [dOpen, setDOpen] = useState(false);
  const [dSaving, setDSaving] = useState(false);
  const [dError, setDError] = useState("");
  const [dScope, setDScope] = useState<"mine" | "byMe" | "all">("mine");
  const [df, setDf] = useState({
    title: "", kra_id: "", department: "", description: "", assigned_to: "", priority: "medium",
    due_date: "", due_time: "",
  });
  const setD = (k: string, v: string) => setDf((p) => ({ ...p, [k]: v }));

  /* ---------------- Checklist state ---------------- */
  const [templates, setTemplates] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [cOpen, setCOpen] = useState(false);
  const [cSaving, setCSaving] = useState(false);
  const [cError, setCError] = useState("");
  const [cScope, setCScope] = useState<"mine" | "all">("mine");
  const [cf, setCf] = useState({
    title: "", kra_id: "", department: "", description: "", assigned_to: "",
    priority: "medium", frequency: "weekly",
    start_date: new Date().toISOString().slice(0, 10), start_time: "09:00", end_date: "",
  });
  const setC = (k: string, v: string) => setCf((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    if (isAdminRole((p as Profile)?.role)) {
      const [{ data: c }, { data: m }, { data: dpts }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", (p as Profile)!.company_id).single(),
        supabase.from("profiles").select("*").eq("status", "active").order("full_name"),
        supabase.from("departments").select("*").order("name"),
      ]);
      setCompany(c);
      setMembers((m as Profile[]) || []);
      setDepts(dpts || []);
    }

    // Catch up any due checklist occurrences (safe to call every visit)
    await supabase.rpc("generate_checklist_instances");

    const [d, t, i] = await Promise.all([
      supabase.from("delegations")
        .select("*, assignee:assigned_to(full_name), assigner:assigned_by(full_name)")
        .order("due_date", { ascending: true }),
      supabase.from("checklist_templates")
        .select("*, assignee:assigned_to(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("checklist_instances")
        .select("*, template:template_id(title, description, frequency), assignee:assigned_to(full_name)")
        .order("due_date", { ascending: true }),
    ]);

    setDelegations(d.data || []);
    setTemplates(t.data || []);
    setInstances(i.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  /* ---------------- Delegation actions ---------------- */
  const createDelegation = async () => {
    setDError("");
    if (!df.title.trim()) return setDError("Please enter a title.");
    if (!df.assigned_to) return setDError("Please choose who this is for.");
    if (!df.due_date) return setDError("Please set a due date.");

    setDSaving(true);
    const { data: created, error } = await supabase.from("delegations").insert({
      company_id: me!.company_id,
      title: df.title.trim(),
      kra_id: df.kra_id,
      description: df.description,
      assigned_to: df.assigned_to,
      assigned_by: me!.id,
      priority: df.priority,
      due_date: df.due_date,
      due_time: df.due_time || null,
    }).select().single();
    setDSaving(false);

    if (error) return setDError(error.message);

    await supabase.from("notifications").insert({
      company_id: me!.company_id,
      user_id: df.assigned_to,
      title: "New task delegated to you",
      body: `${df.title} · due ${df.due_date}${df.due_time ? ` ${df.due_time}` : ""}`,
      kind: "task",
      link: "/tasks",
    });

    setDOpen(false);
    setDf({ title: "", kra_id: "", department: "", description: "", assigned_to: "", priority: "medium", due_date: "", due_time: "" });
    load();
  };

  const toggleDelegationDone = async (d: any) => {
    const willComplete = !d.completed_at;
    await supabase.from("delegations")
      .update({ completed_at: willComplete ? new Date().toISOString() : null })
      .eq("id", d.id);
    load();
  };

  /* ---------------- Checklist actions ---------------- */
  const createTemplate = async () => {
    setCError("");
    if (!cf.title.trim()) return setCError("Please enter a title.");
    if (!cf.assigned_to) return setCError("Please choose who this is for.");

    setCSaving(true);
    const { error } = await supabase.from("checklist_templates").insert({
      company_id: me!.company_id,
      title: cf.title.trim(),
      kra_id: cf.kra_id,
      description: cf.description,
      assigned_to: cf.assigned_to,
      assigned_by: me!.id,
      priority: cf.priority,
      due_time: cf.start_time || "09:00",
      frequency: cf.frequency,
      start_date: cf.start_date,
      end_date: cf.end_date || null,
      next_due_date: cf.start_date,
    });
    setCSaving(false);

    if (error) return setCError(error.message);

    setCOpen(false);
    setCf({ title: "", kra_id: "", department: "", description: "", assigned_to: "",
            priority: "medium", frequency: "weekly",
            start_date: new Date().toISOString().slice(0, 10), start_time: "09:00", end_date: "" });
    load();
  };

  const toggleInstanceDone = async (inst: any) => {
    const todayLocal = new Date().toLocaleDateString("en-CA");
    if (!inst.completed_at && inst.due_date > todayLocal) {
      alert("This task is scheduled for a future date and cannot be completed early.");
      return;
    }
    const { error } = await supabase.rpc("set_checklist_done", {
      p_instance: inst.id, p_done: !inst.completed_at,
    });
    if (error) {
      alert(error.message);
      return;
    }
    load();
  };

  const toggleTemplateActive = async (t: any) => {
    await supabase.from("checklist_templates").update({ active: !t.active }).eq("id", t.id);
    load();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("checklist_templates").delete().eq("id", id);
    load();
  };

  const admin = isAdminRole(me?.role);

  /* ---------------- Derived lists ---------------- */
  const dList = delegations.filter((d) => {
    if (dScope === "mine") return d.assigned_to === me?.id;
    if (dScope === "byMe") return d.assigned_by === me?.id;
    return true; // all
  });

  const iList = instances.filter((i) => {
    if (cScope === "mine") return i.assigned_to === me?.id;
    return true;
  });

  /* ---- Today / Upcoming / Delayed windows ---- */
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

  const iToday     = iList.filter((i) => i.due_date === todayStr);
  const iUpcoming  = iList.filter((i) => i.due_date > todayStr);
  const iDelayed   = iList.filter((i) => i.due_date < todayStr && !i.completed_at);
  const iCompleted = iList.filter((i) => i.due_date < todayStr && i.completed_at);

  const dPendingCount = delegations.filter(
    (d) => d.assigned_to === me?.id && !d.completed_at
  ).length;
  const iPendingCount = instances.filter(
    (i) => i.assigned_to === me?.id && !i.completed_at
  ).length;

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Delegation and recurring checklists."
        action={
          admin && (
            <button
              onClick={() => (tab === "delegation" ? setDOpen(true) : setCOpen(true))}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              {tab === "delegation" ? "New delegation" : "New checklist"}
            </button>
          )
        }
      />

      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button onClick={() => setTab("delegation")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "delegation" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}>
          Delegation {dPendingCount > 0 && `(${dPendingCount})`}
        </button>
        <button onClick={() => setTab("checklist")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "checklist" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}>
          Checklist {iPendingCount > 0 && `(${iPendingCount})`}
        </button>
      </div>

      {/* ================= DELEGATION ================= */}
      {tab === "delegation" && (
        <div>
          <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            <ScopeBtn on={dScope === "mine"} onClick={() => setDScope("mine")}>Assigned to me</ScopeBtn>
            {admin && <ScopeBtn on={dScope === "byMe"} onClick={() => setDScope("byMe")}>Assigned by me</ScopeBtn>}
            {admin && <ScopeBtn on={dScope === "all"} onClick={() => setDScope("all")}>All</ScopeBtn>}
          </div>

          <Card>
            {dList.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No delegated tasks"
                hint={admin ? "Assign a task with a due date to track it." : "Tasks assigned to you will appear here."} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {dList.map((d) => {
                  const status = computeStatus(d.due_date, d.due_time, d.completed_at);
                  const canToggle = d.assigned_to === me?.id || admin;
                  return (
                    <li key={d.id} className="flex items-start gap-3 px-4 py-3.5">
                      <button
                        onClick={() => canToggle && toggleDelegationDone(d)}
                        disabled={!canToggle}
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                          d.completed_at
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 hover:border-brand-600"
                        } ${!canToggle ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {d.completed_at && <Check className="h-3 w-3" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-medium ${d.completed_at ? "text-slate-400 line-through" : "text-slate-900"}`}>
                            {d.title}
                          </p>
                          <StatusChip status={status} />
                          {d.priority === "high" && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">HIGH</span>
                          )}
                        </div>
                        {d.description && (
                          <p className="mt-0.5 text-xs text-slate-500">{d.description}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {d.assignee?.full_name && `${d.assignee.full_name} · `}
                          Due {d.due_date}{d.due_time && ` at ${d.due_time.slice(0, 5)}`}
                          {d.assigner?.full_name && ` · by ${d.assigner.full_name}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ================= CHECKLIST ================= */}
      {tab === "checklist" && (
        <div className="space-y-6">
          {admin && templates.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Recurring templates</h2>
              <Card>
                <ul className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Repeat className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{t.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {FREQ_LABELS[t.frequency]} · {t.assignee?.full_name}
                          {!t.active && " · Paused"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => toggleTemplateActive(t)}
                          title={t.active ? "Pause" : "Resume"}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand-600 hover:text-brand-700">
                          {t.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => deleteTemplate(t.id)} title="Delete"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-300 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Occurrences</h2>
              {admin && (
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <ScopeBtn on={cScope === "mine"} onClick={() => setCScope("mine")}>Mine</ScopeBtn>
                  <ScopeBtn on={cScope === "all"} onClick={() => setCScope("all")}>Team</ScopeBtn>
                </div>
              )}
            </div>

            {iList.length === 0 ? (
              <Card>
                <EmptyState icon={ListChecks} title="No checklist items"
                  hint={admin ? "Create a recurring checklist to get started." : "Recurring tasks assigned to you will appear here."} />
              </Card>
            ) : (
              <div className="space-y-5">
                <InstanceWindow
                  title="Today's tasks" tone="today" icon={Clock}
                  items={iToday} me={me} admin={admin} onToggle={toggleInstanceDone}
                  empty="Nothing scheduled for today."
                />
                <InstanceWindow
                  title="Delayed" tone="delayed" icon={AlertTriangle}
                  items={iDelayed} me={me} admin={admin} onToggle={toggleInstanceDone}
                  empty="No delayed tasks — well done."
                />
                <InstanceWindow
                  title="Upcoming" tone="upcoming" icon={Lock}
                  items={iUpcoming} me={me} admin={admin} onToggle={toggleInstanceDone}
                  locked
                  empty="Nothing scheduled ahead."
                />
                <InstanceWindow
                  title="Completed" tone="done" icon={Check}
                  items={iCompleted} me={me} admin={admin} onToggle={toggleInstanceDone}
                  empty="No completed tasks yet."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- New delegation ---------- */}
      <Modal open={dOpen} onClose={() => setDOpen(false)} title="New delegation">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Title *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Submit vendor invoice"
              value={df.title} onChange={(e) => setD("title", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">KRA ID</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Optional reference code"
              value={df.kra_id} onChange={(e) => setD("kra_id", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={2}
              value={df.description} onChange={(e) => setD("description", e.target.value)} />
          </div>

          {company?.task_assignment_mode !== "direct" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Department</label>
              <select className={`mt-1.5 ${inputCls}`} value={df.department}
                onChange={(e) => { setD("department", e.target.value); setD("assigned_to", ""); }}>
                <option value="">All departments</option>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                Choose a department to narrow the list below.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">Assign to *</label>
            <select className={`mt-1.5 ${inputCls}`} value={df.assigned_to}
              onChange={(e) => setD("assigned_to", e.target.value)}>
              <option value="">Select…</option>
              {members
                .filter((m) => !df.department || m.department === df.department)
                .map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Due date *</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={df.due_date}
                onChange={(e) => setD("due_date", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Due time</label>
              <input type="time" className={`mt-1.5 ${inputCls}`} value={df.due_time}
                onChange={(e) => setD("due_time", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select className={`mt-1.5 ${inputCls}`} value={df.priority}
                onChange={(e) => setD("priority", e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {dError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{dError}</p>
          )}

          <button onClick={createDelegation} disabled={dSaving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {dSaving ? "Assigning…" : "Assign task"}
          </button>
        </div>
      </Modal>

      {/* ---------- New checklist ---------- */}
      <Modal open={cOpen} onClose={() => setCOpen(false)} title="New recurring checklist">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Title *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Weekly stock count"
              value={cf.title} onChange={(e) => setC("title", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">KRA ID</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Optional reference code"
              value={cf.kra_id} onChange={(e) => setC("kra_id", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={2}
              value={cf.description} onChange={(e) => setC("description", e.target.value)} />
          </div>

          {company?.task_assignment_mode !== "direct" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Department</label>
              <select className={`mt-1.5 ${inputCls}`} value={cf.department}
                onChange={(e) => { setC("department", e.target.value); setC("assigned_to", ""); }}>
                <option value="">All departments</option>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                Choose a department to narrow the list below.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">Assign to *</label>
            <select className={`mt-1.5 ${inputCls}`} value={cf.assigned_to}
              onChange={(e) => setC("assigned_to", e.target.value)}>
              <option value="">Select…</option>
              {members
                .filter((m) => !cf.department || m.department === cf.department)
                .map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Frequency</label>
              <select className={`mt-1.5 ${inputCls}`} value={cf.frequency}
                onChange={(e) => setC("frequency", e.target.value)}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select className={`mt-1.5 ${inputCls}`} value={cf.priority}
                onChange={(e) => setC("priority", e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {cf.frequency === "daily" && "Repeats every working day, skipping holidays and weekly offs."}
            {cf.frequency === "weekly" && "Repeats on the same weekday every week."}
            {cf.frequency === "monthly" && "Repeats on the same date every month."}
            {cf.frequency === "quarterly" && "Repeats every 90 days from the start date."}
            {cf.frequency === "half_yearly" && "Repeats every 180 days from the start date."}
            {cf.frequency === "yearly" && "Repeats on the same date every year."}
            {" "}If an occurrence falls on a holiday or weekly off, it shifts to the next working day.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Start date</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={cf.start_date}
                onChange={(e) => setC("start_date", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Due time</label>
              <input type="time" className={`mt-1.5 ${inputCls}`} value={cf.start_time}
                onChange={(e) => setC("start_time", e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400">Default 9:00 AM each due day.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Ends on</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={cf.end_date}
                onChange={(e) => setC("end_date", e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400">Optional</p>
            </div>
          </div>

          {cError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{cError}</p>
          )}

          <button onClick={createTemplate} disabled={cSaving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {cSaving ? "Creating…" : "Create checklist"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ScopeBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
        on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}>
      {children}
    </button>
  );
}
