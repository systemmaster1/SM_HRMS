"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { todayYMD, addDaysYMD } from "@/lib/date";
import { PageHeader, Card, Modal, EmptyState, inputCls } from "@/components/ui";
import { exportCsv } from "@/lib/export";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  Plus, ListChecks, ClipboardList, Check, Clock, AlertTriangle,
  RotateCcw, Pause, Play, Trash2, Repeat, Lock,
  Download, Upload, BarChart3, ChevronDown,
  MessageSquare, CalendarClock, Send, X, Paperclip, Users, UserCheck,
} from "lucide-react";
import { confirmDialog, promptDialog, alertDialog, toast } from "@/components/Dialogs";
import { PageLoader } from "@/components/ui";
import { useFeature } from "@/lib/features/client";
import ModuleLocked from "@/components/ModuleLocked";
import { PROFILE_COLUMNS, COMPANY_COLUMNS } from "@/lib/profile-columns";
import { friendlyError } from "@/lib/errors";

/** Completed tasks older than this are not loaded on the Tasks screen. */
const HISTORY_DAYS = 90;

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", half_yearly: "Half-yearly", yearly: "Yearly",
};

const CHECKLIST_VISIBILITY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 2,
  monthly: 3,
  quarterly: 5,
  half_yearly: 5,
  yearly: 10,
};

function checklistVisibleFrom(dueDate: string, frequency: string) {
  const days = CHECKLIST_VISIBILITY_DAYS[frequency] ?? 1;
  const due = new Date(`${dueDate}T00:00:00`);
  due.setDate(due.getDate() - days);
  due.setHours(0, 0, 0, 0);
  return due;
}

function checklistCanComplete(dueDate: string, earlyDays = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const unlock = new Date(`${dueDate}T00:00:00`);
  unlock.setDate(unlock.getDate() - Math.max(0, Number(earlyDays) || 0));
  unlock.setHours(0, 0, 0, 0);
  return today >= unlock;
}

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
  pending:      { label: "Pending",       cls: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",    icon: Clock },
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
  today:    { head: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",       ring: "border-brand-200 dark:border-brand-500/30" },
  delayed:  { head: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",         ring: "border-rose-200 dark:border-rose-500/30" },
  upcoming: { head: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",      ring: "border-slate-200 dark:border-slate-700" },
  done:     { head: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",   ring: "border-emerald-200 dark:border-emerald-500/30" },
};

function InstanceWindow({
  title, tone, icon: Icon, items, me, admin, onToggle, onStatus, onUpload, policyFor, locked = false, empty,
}: {
  title: string; tone: string; icon: any; items: any[];
  me: Profile | null; admin: boolean; onToggle: (i: any) => void;
  onStatus: (i: any, status: string) => void;
  onUpload: (i: any, file: File) => void;
  policyFor: (i: any) => any;
  locked?: boolean; empty: string;
}) {
  const t = TONES[tone] || TONES.today;

  return (
    <div className={`overflow-hidden rounded-2xl border ${t.ring} bg-white dark:bg-slate-800 dark:border-slate-700`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${t.head}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className="rounded-full bg-white dark:bg-slate-800/70 px-2 py-0.5 text-[11px] font-bold">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {items.map((i) => {
            const status = computeStatus(i.due_date, i.due_time, i.completed_at);
            // Completed occurrences lock for employees; only admin can re-open.
            const canToggle = i.completed_at
              ? admin
              : ((i.assigned_to === me?.id || admin) && !locked);
            const late = i.completed_at
              ? delayText(i.due_date, i.due_time, i.completed_at)
              : null;

            return (
              <li key={i.id} className="flex items-start gap-3 px-4 py-3.5">
                <button
                  onClick={() => canToggle && onToggle(i)}
                  disabled={!canToggle}
                  title={
                    i.completed_at
                      ? (admin ? "Re-open (admin, reason required)" : "Completed \u2014 locked")
                      : locked ? "This task unlocks on its due date" : undefined
                  }
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                    i.completed_at
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 dark:border-slate-600 hover:border-brand-600"
                  } ${!canToggle ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {i.completed_at ? (
                    admin ? <Check className="h-3 w-3" /> : <Lock className="h-2.5 w-2.5" />
                  ) : locked ? (
                    <Lock className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500" />
                  ) : null}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-medium ${i.completed_at ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"}`}>
                      {i.template?.title}
                    </p>
                    {!locked && <StatusChip status={status} />}
                    <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {FREQ_LABELS[i.template?.frequency]}
                    </span>
                    {late && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {late}
                      </span>
                    )}
                  </div>

                  {i.assignee?.full_name && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{i.assignee.full_name}</p>
                  )}

                  {/* Planned vs completed timestamps */}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
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

                  {!i.completed_at && !locked && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <select
                        className={inputCls}
                        value={i.status || "pending"}
                        onChange={(e) => onStatus(i, e.target.value)}
                      >
                        {policyFor(i)?.status_pending_enabled !== false && <option value="pending">Pending</option>}
                        {policyFor(i)?.status_in_progress_enabled !== false && <option value="in_progress">In Progress</option>}
                        {policyFor(i)?.status_hold_enabled !== false && <option value="hold">Hold</option>}
                        {policyFor(i)?.status_complete_enabled !== false && <option value="complete">Complete</option>}
                      </select>
                      {policyFor(i)?.attachments_enabled !== false && (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-brand-500">
                          <Paperclip className="h-3.5 w-3.5" />
                          Add attachment
                          <input
                            type="file"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onUpload(i, file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {locked && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
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
  // Organization modules: Delegation only, Checklist only, or both.
  const delegationOn = useFeature("tasks.delegation");
  const checklistOn = useFeature("tasks.checklist");
  const [tab, setTab] = useState<"delegation" | "checklist">(delegationOn || !checklistOn ? "delegation" : "checklist");

  /* ---------------- Delegation state ---------------- */
  const [delegations, setDelegations] = useState<any[]>([]);
  const [dOpen, setDOpen] = useState(false);
  const [dSaving, setDSaving] = useState(false);
  const [dError, setDError] = useState("");
  const [dScope, setDScope] = useState<"mine" | "byMe" | "all">("mine");
  const [dStatusView, setDStatusView] = useState<"active" | "pending" | "overdue" | "in_progress" | "hold" | "completed">("active");
  const [teamMemberFilter, setTeamMemberFilter] = useState<string | null>(null);
  const [df, setDf] = useState({
    title: "", kra_id: "", department: "", description: "", assigned_to: "", priority: "medium",
    due_date: "", due_time: "",
  });
  const setD = (k: string, v: string) => setDf((p) => ({ ...p, [k]: v }));

  /* ---------------- Advanced delegation state ---------------- */
  const [expandedId, setExpandedId] = useState<string | null>(null); // which task row is open
  const [subtasks, setSubtasks] = useState<any[]>([]);               // all subtasks (grouped client-side)
  const [comments, setComments] = useState<any[]>([]);               // all task comments
  const [extensions, setExtensions] = useState<any[]>([]);           // all extension requests
  const [attachments, setAttachments] = useState<any[]>([]);         // work proof images
  const [taskPolicies, setTaskPolicies] = useState<any[]>([]);        // company/department/employee task controls
  const [newSub, setNewSub] = useState("");                          // "add subtask" input
  const [commentText, setCommentText] = useState("");                // comment composer
  const [commentSaving, setCommentSaving] = useState(false);
  const [extOpen, setExtOpen] = useState(false);                     // extension form visible?
  const [extForm, setExtForm] = useState({ date: "", time: "", reason: "" });
  const [extError, setExtError] = useState("");

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
    start_date: todayYMD(), start_time: "09:00", end_date: "",
  });
  const setC = (k: string, v: string) => setCf((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }
    const { data: p } = await supabase
      .from("profiles").select(PROFILE_COLUMNS).eq("id", auth.user.id).maybeSingle();
    if (!p?.company_id) { setLoading(false); return; }
    setMe(p as Profile);

    if (isAdminRole((p as Profile)?.role)) {
      const [{ data: c }, { data: m }, { data: dpts }] = await Promise.all([
        supabase.from("companies").select(COMPANY_COLUMNS).eq("id", (p as Profile).company_id).single(),
        supabase.from("profiles").select(PROFILE_COLUMNS).eq("status", "active").order("full_name"),
        supabase.from("departments").select("*").order("name"),
      ]);
      setCompany(c);
      setMembers((m as Profile[]) || []);
      setDepts(dpts || []);
    }

    // Recurring checklists are created by the server every night. This call
    // only catches up the caller's company right away (e.g. a new checklist).
    // Falls back to the old generator if the Phase 2B SQL has not been run yet.
    const gen = await supabase.rpc("generate_my_company_tasks");
    if (gen.error) await supabase.rpc("generate_checklist_instances");

    // Supabase returns max 1000 rows per request. Previously the oldest 1000
    // rows came back and TODAY's tasks silently disappeared once a company
    // crossed that. Now: every open task + everything from the last
    // HISTORY_DAYS days, paged until all rows are read.
    const since = addDaysYMD(todayYMD(), -HISTORY_DAYS);
    const recentOrOpen = `completed_at.is.null,due_date.gte.${since}`;

    const [d, t, i, st, cm, ex, att, pol] = await Promise.all([
      fetchAll((from, to) => supabase.from("delegations")
        .select("*, assignee:assigned_to(full_name), assigner:assigned_by(full_name)")
        .or(recentOrOpen)
        .order("due_date", { ascending: true }).order("id").range(from, to)),
      fetchAll((from, to) => supabase.from("checklist_templates")
        .select("*, assignee:assigned_to(full_name)")
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      fetchAll((from, to) => supabase.from("checklist_instances")
        .select("*, template:template_id(title, description, frequency), assignee:assigned_to(full_name)")
        .or(recentOrOpen)
        .order("due_date", { ascending: true }).order("id").range(from, to)),
      fetchAll((from, to) => supabase.from("delegation_subtasks")
        .select("*")
        .order("sort", { ascending: true }).order("id").range(from, to)),
      fetchAll((from, to) => supabase.from("task_comments")
        .select("*, author:user_id(full_name)")
        .order("created_at", { ascending: true }).order("id").range(from, to)),
      fetchAll((from, to) => supabase.from("task_extensions")
        .select("*, requester:requested_by(full_name)")
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      fetchAll((from, to) => supabase.from("task_attachments")
        .select("id, delegation_id, checklist_instance_id, file_name, storage_path, file_size, mime_type, uploaded_by, created_at")
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      supabase.from("task_management_policies").select("*").eq("company_id", (p as Profile)!.company_id).then(({ data, error }) => { if (error) throw error; return data || []; }),
    ].map((p) => Promise.resolve(p).then((data) => ({ data })).catch((e) => {
      console.error("Tasks load failed:", e);
      return { data: [] as any[] };
    })));

    setDelegations(d.data || []);
    setTemplates(t.data || []);
    setInstances(i.data || []);
    setSubtasks(st.data || []);
    setComments(cm.data || []);
    setExtensions(ex.data || []);
    setAttachments(att.data || []);
    setTaskPolicies(pol.data || []);
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

    if (error) return setDError(friendlyError(error));

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

    // Re-opening a completed task is admin-only, and needs a reason.
    if (!willComplete) {
      if (!admin) return; // employees cannot un-complete
      const reason = await promptDialog({
        title: "Re-open this task?",
        message: "Give a reason. It is saved in the task's comments and the employee is notified.",
        placeholder: "e.g. Report was incomplete",
        confirmText: "Re-open task",
        required: true, multiline: true,
      });
      if (!reason) return;               // cancelled
      await supabase.from("delegations")
        .update({ completed_at: null })
        .eq("id", d.id);
      await supabase.from("task_comments").insert({
        company_id: me!.company_id, delegation_id: d.id, user_id: me!.id,
        body: `Task re-opened by admin. Reason: ${reason.trim()}`,
      });
      if (d.assigned_to && d.assigned_to !== me!.id) {
        await supabase.from("notifications").insert({
          company_id: me!.company_id, user_id: d.assigned_to,
          title: "Task re-opened", body: `${d.title} \u00b7 ${reason.trim()}`,
          kind: "task", link: "/tasks",
        });
      }
      load();
      return;
    }

    const taskSubs = subtasks.filter((s) => s.delegation_id === d.id);
    const unfinished = taskSubs.filter((s) => !s.done);
    if (unfinished.length > 0) {
      await alertDialog({
        title: "Finish subtasks first",
        message: `${unfinished.length} subtask(s) are still pending. Complete them before closing this task.`,
        tone: "info",
      });
      setExpandedId(d.id);
      return;
    }

    const ok = await confirmDialog({
      title: "Complete this task?",
      message: "Confirm only after the work is finished. You can add a work update or photo before completing.",
      confirmText: "Yes, complete task",
    });
    if (!ok) return;

    const { error } = await supabase.from("delegations")
      .update({ completed_at: new Date().toISOString(), status: "complete" })
      .eq("id", d.id);
    if (error) return toast(friendlyError(error, "complete the task"), "error");
    toast("Task completed successfully.");
    setExpandedId(null);
    load();
  };

  /* ---------------- Subtask actions ---------------- */
  const addSubtask = async (d: any) => {
    const title = newSub.trim();
    if (!title) return;
    await supabase.from("delegation_subtasks").insert({
      company_id: me!.company_id,
      delegation_id: d.id,
      title,
      sort: subtasks.filter((s) => s.delegation_id === d.id).length + 1,
    });
    setNewSub("");
    load();
  };

  const toggleSubtask = async (s: any) => {
    await supabase.from("delegation_subtasks").update({ done: !s.done }).eq("id", s.id);
    load();
  };

  const deleteSubtask = async (s: any) => {
    await supabase.from("delegation_subtasks").delete().eq("id", s.id);
    load();
  };

  /* ---------------- Comment actions ---------------- */
  const postComment = async (d: any) => {
    const body = commentText.trim();
    if (!body) return;
    setCommentSaving(true);
    await supabase.from("task_comments").insert({
      company_id: me!.company_id, delegation_id: d.id, user_id: me!.id, body,
    });
    // notify the other party on this task (assigner <-> assignee)
    const target = me!.id === d.assigned_to ? d.assigned_by : d.assigned_to;
    if (target && target !== me!.id) {
      await supabase.from("notifications").insert({
        company_id: me!.company_id, user_id: target,
        title: "New comment on task",
        body: `${d.title}: ${body.slice(0, 80)}`,
        kind: "task", link: "/tasks",
      });
    }
    setCommentText("");
    setCommentSaving(false);
    load();
  };

  /* ---------------- Extension request actions ---------------- */
  const requestExtension = async (d: any) => {
    setExtError("");
    if (!extForm.date) return setExtError("Please choose the new due date.");
    const { error } = await supabase.from("task_extensions").insert({
      company_id: me!.company_id, delegation_id: d.id, requested_by: me!.id,
      requested_date: extForm.date,
      requested_time: extForm.time || null,
      reason: extForm.reason.trim() || null,
    });
    if (error) return setExtError(friendlyError(error));
    if (d.assigned_by && d.assigned_by !== me!.id) {
      await supabase.from("notifications").insert({
        company_id: me!.company_id, user_id: d.assigned_by,
        title: "Task extension requested",
        body: `${d.title} · new date ${extForm.date}`,
        kind: "task", link: "/tasks",
      });
    }
    setExtOpen(false);
    setExtForm({ date: "", time: "", reason: "" });
    load();
  };

  const decideExtension = async (d: any, req: any, approve: boolean) => {
    await supabase.from("task_extensions").update({
      status: approve ? "approved" : "rejected",
      decided_by: me!.id,
      decided_at: new Date().toISOString(),
    }).eq("id", req.id);

    if (approve) {
      await supabase.from("delegations").update({
        due_date: req.requested_date,
        due_time: req.requested_time,
        revised_count: (d.revised_count || 0) + 1,
      }).eq("id", d.id);
    }
    await supabase.from("notifications").insert({
      company_id: me!.company_id, user_id: req.requested_by,
      title: approve ? "Extension approved" : "Extension rejected",
      body: `${d.title}${approve ? ` · new due date ${req.requested_date}` : ""}`,
      kind: "task", link: "/tasks",
    });
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

    if (error) return setCError(friendlyError(error));

    setCOpen(false);
    setCf({ title: "", kra_id: "", department: "", description: "", assigned_to: "",
            priority: "medium", frequency: "weekly",
            start_date: todayYMD(), start_time: "09:00", end_date: "" });
    load();
  };

  const toggleInstanceDone = async (inst: any) => {
    const todayLocal = todayYMD();

    // Re-opening a completed occurrence is admin-only and needs a reason.
    if (inst.completed_at) {
      if (!admin) return;
      const reason = await promptDialog({
        title: "Re-open this task?",
        message: "Give a reason. The employee is notified.",
        placeholder: "e.g. Checklist was not done properly",
        confirmText: "Re-open task",
        required: true, multiline: true,
      });
      if (!reason) return;
      const { error } = await supabase.rpc("set_checklist_done", {
        p_instance: inst.id, p_done: false,
      });
      if (error) { toast(friendlyError(error), "error"); return; }
      await supabase.from("checklist_instances").update({ status: "pending" }).eq("id", inst.id);
      if (inst.assigned_to && inst.assigned_to !== me!.id) {
        await supabase.from("notifications").insert({
          company_id: me!.company_id, user_id: inst.assigned_to,
          title: "Checklist task re-opened",
          body: `${inst.template?.title || "Task"} \u00b7 ${reason.trim()}`,
          kind: "task", link: "/tasks",
        });
      }
      load();
      return;
    }

    const policy = effectiveTaskPolicy(inst);
    const earlyDays = Math.max(0, Number(policy?.checklist_early_complete_days ?? 0));
    if (!checklistCanComplete(inst.due_date, earlyDays)) {
      alertDialog({
        title: "Not due yet",
        message: earlyDays > 0
          ? `Admin allows completion up to ${earlyDays} day(s) before the due date.`
          : "This task can be completed from its due date onward.",
        tone: "info",
      });
      return;
    }
    const { error } = await supabase.rpc("set_checklist_done", {
      p_instance: inst.id, p_done: true,
    });
    if (error) { toast(friendlyError(error), "error"); return; }
    await supabase.from("checklist_instances").update({ status: "complete" }).eq("id", inst.id);
    load();
  };

  const changeChecklistStatus = async (inst: any, nextStatus: string) => {
    if (nextStatus === "complete") {
      await toggleInstanceDone(inst);
      return;
    }
    const { error } = await supabase.from("checklist_instances")
      .update({ status: nextStatus })
      .eq("id", inst.id);
    if (error) return toast(friendlyError(error), "error");
    toast("Checklist status updated.");
    load();
  };

  const compressTaskImage = async (source: File): Promise<File> => {
    const bitmap = await createImageBitmap(source);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing is not supported on this device.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) throw new Error("Could not compress this image.");
    const base = source.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "task-photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  };

  const uploadDelegationAttachment = async (task: any, file: File) => {
    const policy = effectiveTaskPolicy(task);
    if (policy?.attachments_enabled === false) return toast("Attachments are disabled by admin.", "error");
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return toast("Only JPG and PNG images are allowed.", "error");
    }

    let uploadFile: File;
    try {
      uploadFile = await compressTaskImage(file);
    } catch (e: any) {
      return toast(e?.message || "Could not process this image.", "error");
    }
    if (uploadFile.size > 5 * 1024 * 1024) {
      return toast("Image is still above 5 MB after compression. Please choose a smaller image.", "error");
    }

    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${me!.company_id}/delegation/${task.id}/${Date.now()}-${safeName}`;
    const up = await supabase.storage.from("task-attachments").upload(storagePath, uploadFile, {
      upsert: false, contentType: "image/jpeg",
    });
    if (up.error) return toast(friendlyError(up.error), "error");

    const { error } = await supabase.from("task_attachments").insert({
      company_id: me!.company_id,
      delegation_id: task.id,
      uploaded_by: me!.id,
      file_name: uploadFile.name,
      storage_path: storagePath,
      file_size: uploadFile.size,
      mime_type: uploadFile.type,
    });
    if (error) {
      await supabase.storage.from("task-attachments").remove([storagePath]);
      return toast(friendlyError(error), "error");
    }
    toast(`Work photo uploaded · ${Math.max(1, Math.round(uploadFile.size / 1024))} KB`);
  };

  const openTaskAttachment = async (attachment: any, download = false) => {
    if (!attachment?.storage_path) return toast("Attachment path is missing.", "error");
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(attachment.storage_path, 120, {
      download: download ? (attachment.file_name || "task-photo.jpg") : false,
    });
    if (error || !data?.signedUrl) return toast(error?.message || "Could not open attachment.", "error");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const uploadChecklistAttachment = async (inst: any, file: File) => {
    const policy = effectiveTaskPolicy(inst);
    if (policy?.attachments_enabled === false) return toast("Attachments are disabled by admin.", "error");

    // Checklist evidence is image-only. This keeps storage usage predictable
    // and avoids large PDF/Excel/document uploads.
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return toast("Only JPG and PNG images are allowed.", "error");
    }

    let uploadFile: File;
    try {
      uploadFile = await compressTaskImage(file);
    } catch (e: any) {
      return toast(e?.message || "Could not process this image.", "error");
    }

    // Final safety cap after compression: 1 MB.
    if (uploadFile.size > 1024 * 1024) {
      return toast("Image is still above 1 MB after compression. Please choose a smaller image.", "error");
    }

    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${me!.company_id}/checklist/${inst.id}/${Date.now()}-${safeName}`;
    const up = await supabase.storage.from("task-attachments").upload(storagePath, uploadFile, {
      upsert: false,
      contentType: "image/jpeg",
    });
    if (up.error) return toast(friendlyError(up.error), "error");

    const { error } = await supabase.from("task_attachments").insert({
      company_id: me!.company_id,
      checklist_instance_id: inst.id,
      uploaded_by: me!.id,
      file_name: uploadFile.name,
      storage_path: storagePath,
      file_size: uploadFile.size,
      mime_type: uploadFile.type,
    });
    if (error) {
      await supabase.storage.from("task-attachments").remove([storagePath]);
      return toast(friendlyError(error), "error");
    }
    toast(`Image uploaded · ${Math.max(1, Math.round(uploadFile.size / 1024))} KB`);
  };

  const toggleTemplateActive = async (t: any) => {
    await supabase.from("checklist_templates").update({ active: !t.active }).eq("id", t.id);
    load();
  };

  const deleteTemplate = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete this checklist?",
      message: "No new tasks will be created from it. Tasks already created stay in history.",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("checklist_templates").delete().eq("id", id);
    load();
  };

  const admin = isAdminRole(me?.role);

  /* ---------------- Per-user task stats ---------------- */
  const [stats, setStats] = useState<any[]>([]);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!admin || !showStats) return;
    (async () => {
      const y = new Date().getFullYear();
      const { data } = await supabase.rpc("task_user_stats", {
        p_from: `${y}-01-01`, p_to: `${y}-12-31`,
      });
      setStats((data as any[]) || []);
    })();
  }, [admin, showStats, supabase]);

  /* ---------------- Export ---------------- */
  const exportTasks = () => {
    if (tab === "delegation") {
      exportCsv("Delegation_tasks",
        ["Due date", "Due time", "KRA ID", "Title", "Description", "Priority",
         "Employee", "Assigned by", "Completed at", "Status"],
        dList.map((d) => [
          d.due_date, (d.due_time || "").slice(0, 5), d.kra_id || "",
          d.title || "", d.description || "", d.priority || "",
          d.assignee?.full_name || "", d.assigner?.full_name || "",
          d.completed_at ? fmtStamp(d.completed_at) : "",
          computeStatus(d.due_date, d.due_time, d.completed_at).replace(/_/g, " "),
        ]));
    } else {
      exportCsv("Checklist_tasks",
        ["Due date", "Due time", "KRA ID", "Title", "Frequency",
         "Employee", "Completed at", "Status"],
        iList.map((i) => [
          i.due_date, (i.due_time || "").slice(0, 5), i.template?.kra_id || "",
          i.template?.title || "", i.template?.frequency || "",
          i.assignee?.full_name || "",
          i.completed_at ? fmtStamp(i.completed_at) : "",
          computeStatus(i.due_date, i.due_time, i.completed_at).replace(/_/g, " "),
        ]));
    }
  };

  /* ---------------- KRA ID auto-generation ---------------- */
  const genKra = async (): Promise<string> => {
    const { data, error } = await supabase.rpc("next_kra_id");
    if (error || !data) return "";
    return String(data);
  };

  const openDelegation = async () => {
    setDOpen(true);
    if (!df.kra_id) {
      const id = await genKra();
      if (id) setD("kra_id", id);
    }
  };

  const openChecklist = async () => {
    setCOpen(true);
    if (!cf.kra_id) {
      const id = await genKra();
      if (id) setC("kra_id", id);
    }
  };

  const effectiveTaskPolicy = (d: any) => {
    const employee = taskPolicies.find((x) => x.scope_type === "employee" && x.employee_id === d.assigned_to);
    const assignee = members.find((x: any) => x.id === d.assigned_to) as any;
    // profiles store the department NAME; policies store the departments.id
    const deptId = assignee?.department
      ? depts.find((x: any) => String(x.name).trim().toLowerCase() === String(assignee.department).trim().toLowerCase())?.id
      : null;
    const department = deptId ? taskPolicies.find((x) => x.scope_type === "department" && x.department_id === deptId) : null;
    return employee || department || taskPolicies.find((x) => x.scope_type === "company") || null;
  };

  const changeDelegationStatus = async (d: any, nextStatus: string) => {
    if (nextStatus === "complete") {
      await toggleDelegationDone(d);
      return;
    }
    const { error } = await supabase.from("delegations")
      .update(d.completed_at ? { status: nextStatus, completed_at: null } : { status: nextStatus })
      .eq("id", d.id);
    if (error) return toast(friendlyError(error, "update the task"), "error");
    toast(nextStatus === "in_progress" ? "Task started." : nextStatus === "hold" ? "Task put on hold." : "Task status updated.");
    setExpandedId(d.id);
    load();
  };

  /* ---------------- Derived lists ---------------- */
  const dScopedList = delegations.filter((d) => {
    if (teamMemberFilter && d.assigned_to !== teamMemberFilter) return false;
    if (dScope === "mine") return d.assigned_to === me?.id;
    if (dScope === "byMe") return d.assigned_by === me?.id;
    return true; // all
  });

  const delegationWorkflowStatus = (d: any) =>
    d.completed_at ? "completed" : (d.status === "in_progress" || d.status === "hold" ? d.status : "pending");

  const dStatusCounts = {
    active: dScopedList.filter((d) => !d.completed_at).length,
    pending: dScopedList.filter((d) => delegationWorkflowStatus(d) === "pending" && computeStatus(d.due_date, d.due_time, d.completed_at) !== "overdue").length,
    overdue: dScopedList.filter((d) => delegationWorkflowStatus(d) === "pending" && computeStatus(d.due_date, d.due_time, d.completed_at) === "overdue").length,
    in_progress: dScopedList.filter((d) => delegationWorkflowStatus(d) === "in_progress").length,
    hold: dScopedList.filter((d) => delegationWorkflowStatus(d) === "hold").length,
    completed: dScopedList.filter((d) => delegationWorkflowStatus(d) === "completed").length,
  };

  const dList = dScopedList.filter((d) => {
    if (dStatusView === "active") return !d.completed_at;
    if (dStatusView === "overdue") {
      return delegationWorkflowStatus(d) === "pending" && computeStatus(d.due_date, d.due_time, d.completed_at) === "overdue";
    }
    if (dStatusView === "pending") {
      return delegationWorkflowStatus(d) === "pending" && computeStatus(d.due_date, d.due_time, d.completed_at) !== "overdue";
    }
    return delegationWorkflowStatus(d) === dStatusView;
  });

  /* ---- Delegation performance summary (for the current visible list) ---- */
  const dStatuses = dList.map((x) => computeStatus(x.due_date, x.due_time, x.completed_at));
  const dDoneOnTime = dStatuses.filter((s) => s === "done_on_time").length;
  const dDoneLate   = dStatuses.filter((s) => s === "done_late").length;
  const dOverdue    = dStatuses.filter((s) => s === "overdue").length;
  const dPendingN   = dStatuses.filter((s) => s === "pending").length;
  const dDoneTotal  = dDoneOnTime + dDoneLate;
  const dOnTimePct  = dDoneTotal > 0 ? Math.round((dDoneOnTime / dDoneTotal) * 100) : null;

  const iList = instances.filter((i) => {
    if (cScope === "mine" && i.assigned_to !== me?.id) return false;
    if (i.completed_at) return true;
    const frequency = i.template?.frequency || "daily";
    return new Date() >= checklistVisibleFrom(i.due_date, frequency);
  });

  /* ---- Today / Upcoming / Delayed windows ---- */
  const todayStr = todayYMD(); // YYYY-MM-DD, IST

  const iToday     = iList.filter((i) => i.due_date === todayStr);
  const iUpcoming  = iList.filter((i) => i.due_date > todayStr);
  const iDelayed   = iList.filter((i) => i.due_date < todayStr && !i.completed_at);
  const iCompleted = iList.filter((i) => i.due_date < todayStr && i.completed_at);

  const dPendingCount = delegations.filter(
    (d) => d.assigned_to === me?.id && !d.completed_at
  ).length;

  // Simple assignment overview for managers/admins: who has how much work pending.
  const assignmentOverview = members
    .map((member) => {
      const assigned = delegations.filter((d) => d.assigned_to === member.id);
      const pending = assigned.filter((d) => delegationWorkflowStatus(d) === "pending" && computeStatus(d.due_date, d.due_time, d.completed_at) !== "overdue").length;
      const overdue = assigned.filter(
        (d) => delegationWorkflowStatus(d) === "pending" && computeStatus(d.due_date, d.due_time, d.completed_at) === "overdue"
      ).length;
      const inProgress = assigned.filter((d) => delegationWorkflowStatus(d) === "in_progress").length;
      const hold = assigned.filter((d) => delegationWorkflowStatus(d) === "hold").length;
      const completed = assigned.filter((d) => !!d.completed_at).length;
      return { member, pending, overdue, inProgress, hold, completed };
    })
    .filter((row) => row.pending > 0 || row.overdue > 0 || row.inProgress > 0 || row.hold > 0 || row.completed > 0)
    .sort((a, b) => (b.pending + b.overdue + b.inProgress + b.hold) - (a.pending + a.overdue + a.inProgress + a.hold) || b.overdue - a.overdue);
  const iPendingCount = instances.filter(
    (i) => i.assigned_to === me?.id && !i.completed_at
  ).length;

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`Delegation and recurring checklists. Open tasks plus the last ${HISTORY_DAYS} days are shown — older history is in Export and the Google Sheet.`}
        action={
          admin && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={exportTasks}
                className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <Download className="h-4 w-4" /> Export
              </button>
              <Link
                href="/tasks/import"
                className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <Upload className="h-4 w-4" /> Import
              </Link>
              <button
                onClick={() => (tab === "delegation" ? openDelegation() : openChecklist())}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
              >
              <Plus className="h-4 w-4" />
              {tab === "delegation" ? "New delegation" : "New checklist"}
              </button>
            </div>
          )
        }
      />

      {!delegationOn && !checklistOn && (
        <ModuleLocked name="Task Management" description="Delegation and checklist tasks" />
      )}

      {delegationOn && checklistOn && (
      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
        <button onClick={() => setTab("delegation")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "delegation" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}>
          Delegation {dPendingCount > 0 && `(${dPendingCount})`}
        </button>
        <button onClick={() => setTab("checklist")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "checklist" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}>
          Checklist {iPendingCount > 0 && `(${iPendingCount})`}
        </button>
      </div>
      )}

      {/* ================= DELEGATION ================= */}
      {tab === "delegation" && delegationOn && (
        <div>
          <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
            <ScopeBtn on={dScope === "mine"} onClick={() => setDScope("mine")}>Assigned to me</ScopeBtn>
            {admin && <ScopeBtn on={dScope === "byMe"} onClick={() => setDScope("byMe")}>Assigned by me</ScopeBtn>}
            {admin && <ScopeBtn on={dScope === "all"} onClick={() => setDScope("all")}>All</ScopeBtn>}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["active", "To do", dStatusCounts.active, "Finish these first"],
              ["pending", "Pending", dStatusCounts.pending, "Not started"],
              ["overdue", "Overdue", dStatusCounts.overdue, "Past due"],
              ["in_progress", "In Progress", dStatusCounts.in_progress, "Work started"],
              ["hold", "On Hold", dStatusCounts.hold, "Paused"],
              ["completed", "Completed", dStatusCounts.completed, "Finished"],
            ] as const).map(([value, label, count, hint]) => (
              <button key={value} type="button" onClick={() => setDStatusView(value)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  dStatusView === value
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/20"
                    : "border-slate-200 bg-white hover:border-brand-200 dark:border-slate-700 dark:bg-slate-800"
                }`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    value === "hold" ? "bg-amber-50 text-amber-700" :
                    value === "overdue" ? "bg-rose-50 text-rose-700" :
                    value === "completed" ? "bg-emerald-50 text-emerald-700" :
                    value === "in_progress" ? "bg-blue-50 text-blue-700" :
                    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  }`}>{count}</span>
                </span>
                <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>
              </button>
            ))}
          </div>

          {admin && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Users className="h-4 w-4 text-brand-600" /> Team task overview
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    See who has pending work, then assign the next task without leaving Tasks.
                  </p>
                </div>
                <button onClick={openDelegation}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-800">
                  <Plus className="h-4 w-4" /> Assign task
                </button>
              </div>

              {assignmentOverview.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500 dark:bg-slate-900/50">
                  No team task activity yet.
                </p>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {assignmentOverview.map(({ member, pending, overdue, inProgress, hold, completed }) => (
                    <div key={member.id}
                      className={`rounded-xl border p-3 transition ${teamMemberFilter === member.id ? "border-brand-400 bg-brand-50/50 dark:bg-brand-500/10" : "border-slate-200 dark:border-slate-700"}`}>
                      <button type="button"
                        onClick={() => { setDScope("all"); setTeamMemberFilter(member.id); setDStatusView("active"); setExpandedId(null); }}
                        className="flex w-full items-center gap-3 text-left">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                          {(member.full_name || "U").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{member.full_name || "Employee"}</span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">Tap a count to see matching tasks</span>
                        </span>
                        <UserCheck className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] font-semibold sm:grid-cols-3">
                        {[
                          ["pending", "Pending", pending, "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"],
                          ["overdue", "Overdue", overdue, "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"],
                          ["in_progress", "In Progress", inProgress, "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"],
                          ["hold", "Hold", hold, "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"],
                          ["completed", "Done", completed, "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"],
                        ].map(([status, label, count, cls]) => (
                          <button key={String(status)} type="button"
                            onClick={() => { setDScope("all"); setTeamMemberFilter(member.id); setDStatusView(status as "pending" | "overdue" | "in_progress" | "hold" | "completed"); setExpandedId(null); }}
                            className={`rounded-lg px-2 py-1.5 text-left transition hover:ring-1 hover:ring-brand-300 ${cls}`}>
                            <span className="block text-sm font-bold">{count}</span>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {admin && teamMemberFilter && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
              <span className="font-medium text-brand-800 dark:text-brand-200">
                Showing {members.find((m) => m.id === teamMemberFilter)?.full_name || "employee"} · {dStatusView === "active" ? "To do" : dStatusView.replace("_", " ")}
              </span>
              <button type="button" onClick={() => { setTeamMemberFilter(null); setDStatusView("active"); setDScope("all"); }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300">
                Clear team filter
              </button>
            </div>
          )}

          {/* Performance strip for the current filter */}
          {dList.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryTile label="On-time score" value={dOnTimePct === null ? "—" : `${dOnTimePct}%`} accent />
              <SummaryTile label="Done on time" value={String(dDoneOnTime)} />
              <SummaryTile label="Done late" value={String(dDoneLate)} />
              <SummaryTile label="Overdue" value={String(dOverdue)} danger={dOverdue > 0} />
              <SummaryTile label="Pending" value={String(dPendingN)} />
            </div>
          )}

          <Card>
            {dList.length === 0 ? (
              <EmptyState icon={ClipboardList}
                title={dStatusView === "active" ? "No tasks to do" : `No ${dStatusView.replace("_", " ")} tasks`}
                hint={dStatusView === "active"
                  ? (admin ? "No active tasks in this view. Assign a new task when needed." : "You are clear — no active tasks need action.")
                  : "Choose another status above to see other tasks."} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {dList.map((d) => {
                  const status = computeStatus(d.due_date, d.due_time, d.completed_at);
                  // Once completed, only an admin can re-open it (with a reason).
                  const canToggle = d.completed_at
                    ? admin
                    : (d.assigned_to === me?.id || admin);
                  const subs = subtasks.filter((s) => s.delegation_id === d.id);
                  const subsDone = subs.filter((s) => s.done).length;
                  const cmts = comments.filter((c) => c.delegation_id === d.id);
                  const exts = extensions.filter((x) => x.delegation_id === d.id);
                  const taskFiles = attachments.filter((a) => a.delegation_id === d.id);
                  const pendingExt = exts.find((x) => x.status === "pending");
                  const isRowOpen = expandedId === d.id;
                  const isAssignee = d.assigned_to === me?.id;
                  const canManage = admin || d.assigned_by === me?.id; // decide extensions, delete subtasks
                  const canEditSubs = isAssignee || canManage;
                  const workflowStatus = d.completed_at ? "complete" : (d.status || "pending");
                  const primaryAction = workflowStatus === "pending"
                    ? { label: "Start task", next: "in_progress" }
                    : workflowStatus === "in_progress"
                      ? { label: "Complete task", next: "complete" }
                      : workflowStatus === "hold"
                        ? { label: "Resume task", next: "in_progress" }
                        : null;
                  return (
                    <li key={d.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => canToggle && toggleDelegationDone(d)}
                          disabled={!canToggle}
                          title={
                            d.completed_at
                              ? (admin ? "Re-open (admin, reason required)" : "Completed \u2014 locked")
                              : undefined
                          }
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                            d.completed_at
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 hover:border-brand-600 dark:border-slate-600"
                          } ${!canToggle ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          {d.completed_at
                            ? (admin
                                ? <Check className="h-3 w-3" />
                                : <Lock className="h-2.5 w-2.5" />)
                            : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => { setExpandedId(isRowOpen ? null : d.id); setNewSub(""); setCommentText(""); setExtOpen(false); setExtError(""); }} className={`text-left text-sm font-medium hover:text-brand-700 ${d.completed_at ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"}`}>
                              {d.title}
                            </button>
                            <StatusChip status={status} />
                            {d.priority === "high" && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">HIGH</span>
                            )}
                            {subs.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                                <ListChecks className="h-3 w-3" /> {subsDone}/{subs.length}
                              </span>
                            )}
                            {(d.revised_count || 0) > 0 && (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                                Revised ×{d.revised_count}
                              </span>
                            )}
                            {pendingExt && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <CalendarClock className="h-3 w-3" /> Extension requested
                              </span>
                            )}
                          </div>
                          {d.description && (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{d.description}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {d.assignee?.full_name && `${d.assignee.full_name} · `}
                            Due {d.due_date}{d.due_time && ` at ${d.due_time.slice(0, 5)}`}
                            {d.assigner?.full_name && ` · by ${d.assigner.full_name}`}
                          </p>

                          {!d.completed_at && (isAssignee || canManage) && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {primaryAction && (
                                <button type="button"
                                  onClick={() => changeDelegationStatus(d, primaryAction.next)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition ${
                                    primaryAction.next === "complete" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-brand-700 hover:bg-brand-800"
                                  }`}>
                                  {primaryAction.next === "complete" ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                  {primaryAction.label}
                                </button>
                              )}
                              {workflowStatus === "in_progress" && (
                                <button type="button" onClick={() => changeDelegationStatus(d, "hold")}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
                                  <Pause className="h-3.5 w-3.5" /> Put on hold
                                </button>
                              )}
                              <button type="button"
                                onClick={() => { setExpandedId(isRowOpen ? null : d.id); setNewSub(""); setCommentText(""); setExtOpen(false); setExtError(""); }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <MessageSquare className="h-3.5 w-3.5" /> Add update / details
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expand / collapse the details panel */}
                        <button
                          onClick={() => {
                            setExpandedId(isRowOpen ? null : d.id);
                            setNewSub(""); setCommentText(""); setExtOpen(false); setExtError("");
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500 transition hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {cmts.length > 0 && <span>{cmts.length}</span>}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRowOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      {/* ---------- Expanded details: subtasks / extension / comments ---------- */}
                      {isRowOpen && (
                        <div className="ml-8 mt-3 space-y-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
                          {(() => {
                            const policy = effectiveTaskPolicy(d);
                            const options = [
                              ["pending", "Pending", policy?.status_pending_enabled !== false],
                              ["in_progress", "In Progress", policy?.status_in_progress_enabled !== false],
                              ["hold", "Hold", policy?.status_hold_enabled !== false],
                              ["complete", "Complete", policy?.status_complete_enabled !== false],
                            ].filter((x) => x[2]);
                            return (
                              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
                                <div>
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Task status</p>
                                  <select value={workflowStatus} disabled={!(isAssignee || canManage) || !!d.completed_at} onChange={(e) => changeDelegationStatus(d, e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                                    {options.map(([value, label]) => <option key={String(value)} value={String(value)}>{String(label)}</option>)}
                                  </select>
                                </div>
                                {policy?.attachments_enabled !== false && (
                                  <div>
                                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Work photo</p>
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-3 py-2.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:bg-brand-500/10">
                                      <Paperclip className="h-3.5 w-3.5" /> Add work photo
                                      <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) uploadDelegationAttachment(d, file);
                                          e.currentTarget.value = "";
                                        }} />
                                    </label>
                                    <p className="mt-1 text-[10px] text-slate-400">JPG/PNG · automatically compressed</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* Subtasks */}
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Subtasks {subs.length > 0 && `· ${subsDone}/${subs.length} done`}
                            </p>
                            {subs.length === 0 && (
                              <p className="text-xs text-slate-400 dark:text-slate-500">Break this task into smaller steps.</p>
                            )}
                            <ul className="space-y-1.5">
                              {subs.map((s) => (
                                <li key={s.id} className="group flex items-center gap-2.5">
                                  <button
                                    onClick={() => canEditSubs && toggleSubtask(s)}
                                    disabled={!canEditSubs}
                                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                                      s.done
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-slate-300 dark:border-slate-600 hover:border-brand-600"
                                    } ${!canEditSubs ? "cursor-not-allowed opacity-50" : ""}`}
                                  >
                                    {s.done && <Check className="h-2.5 w-2.5" />}
                                  </button>
                                  <span className={`text-xs ${s.done ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-200"}`}>
                                    {s.title}
                                  </span>
                                  {canManage && (
                                    <button onClick={() => deleteSubtask(s)}
                                      className="ml-auto text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100" aria-label="Delete">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {canEditSubs && !d.completed_at && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-brand-600 placeholder:text-slate-400"
                                  placeholder="Add a subtask and press Enter…"
                                  value={newSub}
                                  onChange={(e) => setNewSub(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && addSubtask(d)}
                                />
                                <button onClick={() => addSubtask(d)}
                                  className="grid shrink-0 place-items-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-slate-600 dark:text-slate-300 transition hover:bg-white" aria-label="Add">
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Due-date extension */}
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Due date</p>
                            {pendingExt ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-medium text-amber-800">
                                  {pendingExt.requester?.full_name || "Employee"} requested{" "}
                                  {pendingExt.requested_date}
                                  {pendingExt.requested_time && ` at ${String(pendingExt.requested_time).slice(0, 5)}`}
                                </p>
                                {pendingExt.reason && (
                                  <p className="mt-1 text-xs text-amber-700">“{pendingExt.reason}”</p>
                                )}
                                {canManage && (
                                  <div className="mt-2 flex gap-2">
                                    <button onClick={() => decideExtension(d, pendingExt, true)}
                                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700">
                                      <Check className="h-3 w-3" /> Approve
                                    </button>
                                    <button onClick={() => decideExtension(d, pendingExt, false)}
                                      className="flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50">
                                      <X className="h-3 w-3" /> Reject
                                    </button>
                                  </div>
                                )}
                                {!canManage && (
                                  <p className="mt-1.5 text-[11px] text-amber-600">Waiting for approval.</p>
                                )}
                              </div>
                            ) : isAssignee && !d.completed_at ? (
                              extOpen ? (
                                <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="date"
                                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-2 text-xs outline-none focus:border-brand-600"
                                      value={extForm.date}
                                      onChange={(e) => setExtForm((f) => ({ ...f, date: e.target.value }))} />
                                    <input type="time"
                                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-2 text-xs outline-none focus:border-brand-600"
                                      value={extForm.time}
                                      onChange={(e) => setExtForm((f) => ({ ...f, time: e.target.value }))} />
                                  </div>
                                  <input
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-2 text-xs outline-none focus:border-brand-600 placeholder:text-slate-400"
                                    placeholder="Reason (optional)"
                                    value={extForm.reason}
                                    onChange={(e) => setExtForm((f) => ({ ...f, reason: e.target.value }))} />
                                  {extError && <p className="text-xs text-rose-600">{extError}</p>}
                                  <div className="flex gap-2">
                                    <button onClick={() => requestExtension(d)}
                                      className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800">
                                      Submit request
                                    </button>
                                    <button onClick={() => { setExtOpen(false); setExtError(""); }}
                                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setExtOpen(true)}
                                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-brand-600 hover:text-brand-700">
                                  <CalendarClock className="h-3.5 w-3.5" /> Request extension
                                </button>
                              )
                            ) : (
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                Due {d.due_date}{d.due_time && ` at ${d.due_time.slice(0, 5)}`}
                              </p>
                            )}
                          </div>

                          {taskFiles.length > 0 && (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Work photos · {taskFiles.length}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {taskFiles.map((file) => (
                                  <div key={file.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10">
                                      <Paperclip className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{file.file_name || "Work photo"}</p>
                                      <p className="text-[10px] text-slate-400">{file.file_size ? `${Math.max(1, Math.round(file.file_size / 1024))} KB · ` : ""}{fmtStamp(file.created_at)}</p>
                                    </div>
                                    <button type="button" onClick={() => openTaskAttachment(file)}
                                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300">
                                      View
                                    </button>
                                    <button type="button" onClick={() => openTaskAttachment(file, true)}
                                      className="rounded-lg bg-brand-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-800">
                                      Download
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Activity timeline */}
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Activity timeline
                            </p>
                            <div className="relative ml-1 border-l border-slate-200 pl-4 dark:border-slate-700">
                              {([
                                {
                                  key: "assigned",
                                  at: d.created_at,
                                  title: "Task assigned",
                                  detail: `${d.assigner?.full_name || "Manager"} → ${d.assignee?.full_name || "Employee"}`,
                                },
                                ...cmts.map((item: any) => ({
                                  key: `comment-${item.id}`,
                                  at: item.created_at,
                                  title: item.body?.startsWith("Task re-opened by admin.") ? "Task re-opened" : "Work update",
                                  detail: `${item.author?.full_name || "User"}: ${item.body}`,
                                })),
                                ...exts.map((item: any) => ({
                                  key: `extension-${item.id}`,
                                  at: item.created_at,
                                  title: item.status === "approved" ? "Extension approved" : item.status === "rejected" ? "Extension rejected" : "Extension requested",
                                  detail: `New due date ${item.requested_date}${item.reason ? ` · ${item.reason}` : ""}`,
                                })),
                                ...(d.completed_at ? [{
                                  key: "completed",
                                  at: d.completed_at,
                                  title: "Task completed",
                                  detail: `Completed by ${d.assignee?.full_name || "employee"}`,
                                }] : []),
                              ] as any[])
                                .filter((item) => item.at)
                                .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                                .map((item) => (
                                  <div key={item.key} className="relative pb-3 last:pb-0">
                                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200 dark:border-slate-800" />
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                                    <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</p>
                                    <p className="mt-0.5 text-[10px] text-slate-400">{fmtStamp(item.at)}</p>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Comments */}
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Comments {cmts.length > 0 && `· ${cmts.length}`}
                            </p>
                            {cmts.length === 0 && (
                              <p className="text-xs text-slate-400 dark:text-slate-500">No comments yet.</p>
                            )}
                            <ul className="space-y-2">
                              {cmts.map((c) => (
                                <li key={c.id} className="rounded-lg bg-white dark:bg-slate-800 p-2.5 ring-1 ring-slate-100">
                                  <p className="text-xs text-slate-700 dark:text-slate-200">{c.body}</p>
                                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                    {c.author?.full_name || "User"} · {fmtStamp(c.created_at)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2 flex gap-2">
                              <input
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-brand-600 placeholder:text-slate-400"
                                placeholder="Write work update / comment…"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !commentSaving && postComment(d)}
                              />
                              <button onClick={() => postComment(d)} disabled={commentSaving}
                                className="grid shrink-0 place-items-center rounded-lg bg-brand-700 px-3 text-white transition hover:bg-brand-800 disabled:opacity-60" aria-label="Send">
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ================= CHECKLIST ================= */}
      {tab === "checklist" && checklistOn && (
        <div className="space-y-6">
          {admin && (
            <div>
              <button
                onClick={() => setShowStats((s) => !s)}
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 transition hover:text-brand-700"
              >
                <BarChart3 className="h-4 w-4" />
                Tasks per employee
                <ChevronDown className={`h-4 w-4 transition ${showStats ? "rotate-180" : ""}`} />
              </button>

              {showStats && (
                <Card>
                  {stats.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">Loading…</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                            <th className="p-3 font-medium text-slate-500 dark:text-slate-400">Employee</th>
                            <th className="p-3 font-medium text-slate-500 dark:text-slate-400">Department</th>
                            <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400">
                              Unique checklists
                            </th>
                            <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400">Due</th>
                            <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400">Done</th>
                            <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400">Pending</th>
                            <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400">
                              Delegations
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {stats.map((s) => (
                            <tr key={s.user_id}>
                              <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{s.full_name}</td>
                              <td className="p-3 text-slate-500 dark:text-slate-400">{s.department}</td>
                              <td className="p-3 text-center">
                                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                                  {s.unique_checklists}
                                </span>
                              </td>
                              <td className="p-3 text-center text-slate-600 dark:text-slate-300">{s.checklist_due}</td>
                              <td className="p-3 text-center font-medium text-emerald-600">
                                {s.checklist_done}
                              </td>
                              <td className="p-3 text-center font-medium text-amber-600">
                                {s.checklist_pending}
                              </td>
                              <td className="p-3 text-center text-slate-600 dark:text-slate-300">
                                {s.delegation_done} / {s.delegation_total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="border-t border-slate-100 dark:border-slate-700 px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                        Counts cover the current calendar year. “Unique checklists” is how many
                        distinct recurring tasks that employee owns.
                      </p>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {admin && templates.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Recurring templates</h2>
              <Card>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {templates.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Repeat className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {FREQ_LABELS[t.frequency]} · {t.assignee?.full_name}
                          {!t.active && " · Paused"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => toggleTemplateActive(t)}
                          title={t.active ? "Pause" : "Resume"}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 transition hover:border-brand-600 hover:text-brand-700">
                          {t.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => deleteTemplate(t.id)} title="Delete"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 transition hover:border-rose-300 hover:text-rose-600" aria-label="Delete">
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
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Occurrences</h2>
              {admin && (
                <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
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
                  onStatus={changeChecklistStatus} onUpload={uploadChecklistAttachment} policyFor={effectiveTaskPolicy}
                  empty="Nothing scheduled for today."
                />
                <InstanceWindow
                  title="Delayed" tone="delayed" icon={AlertTriangle}
                  items={iDelayed} me={me} admin={admin} onToggle={toggleInstanceDone}
                  onStatus={changeChecklistStatus} onUpload={uploadChecklistAttachment} policyFor={effectiveTaskPolicy}
                  empty="No delayed tasks — well done."
                />
                <InstanceWindow
                  title="Upcoming" tone="upcoming" icon={Lock}
                  items={iUpcoming} me={me} admin={admin} onToggle={toggleInstanceDone}
                  onStatus={changeChecklistStatus} onUpload={uploadChecklistAttachment} policyFor={effectiveTaskPolicy}
                  locked
                  empty="Nothing scheduled ahead."
                />
                <InstanceWindow
                  title="Completed" tone="done" icon={Check}
                  items={iCompleted} me={me} admin={admin} onToggle={toggleInstanceDone}
                  onStatus={changeChecklistStatus} onUpload={uploadChecklistAttachment} policyFor={effectiveTaskPolicy}
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
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Title *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Submit vendor invoice"
              value={df.title} onChange={(e) => setD("title", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">KRA ID</label>
            <div className="mt-1.5 flex gap-2">
              <input className={inputCls} placeholder="Generating…"
                value={df.kra_id} onChange={(e) => setD("kra_id", e.target.value)} />
              <button type="button"
                onClick={async () => { const id = await genKra(); if (id) setD("kra_id", id); }}
                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700/50" aria-label="Generate a new KRA ID">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Generated automatically — you can overwrite it with your own code.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={2}
              value={df.description} onChange={(e) => setD("description", e.target.value)} />
          </div>

          {company?.task_assignment_mode !== "direct" && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Department</label>
              <select className={`mt-1.5 ${inputCls}`} value={df.department}
                onChange={(e) => { setD("department", e.target.value); setD("assigned_to", ""); }}>
                <option value="">All departments</option>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Choose a department to narrow the list below.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Assign to *</label>
            <select className={`mt-1.5 ${inputCls}`} value={df.assigned_to}
              onChange={(e) => setD("assigned_to", e.target.value)}>
              <option value="">Select employee…</option>
              {members
                .filter((m) => !df.department || m.department === df.department)
                .map((m) => {
                  const openCount = delegations.filter((d) => d.assigned_to === m.id && !d.completed_at).length;
                  const lateCount = delegations.filter((d) => d.assigned_to === m.id && !d.completed_at && computeStatus(d.due_date, d.due_time, d.completed_at) === "overdue").length;
                  return <option key={m.id} value={m.id}>{m.full_name} · {openCount} pending{lateCount ? ` · ${lateCount} overdue` : ""}</option>;
                })}
            </select>
            {df.assigned_to && (() => {
              const selected = members.find((m) => m.id === df.assigned_to);
              const assigned = delegations.filter((d) => d.assigned_to === df.assigned_to);
              const pending = assigned.filter((d) => !d.completed_at).length;
              const overdue = assigned.filter((d) => !d.completed_at && computeStatus(d.due_date, d.due_time, d.completed_at) === "overdue").length;
              const done = assigned.filter((d) => !!d.completed_at).length;
              return (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{selected?.full_name || "Selected employee"}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Current workload before assigning this task</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5 text-[10px] font-semibold">
                    <span className="rounded-full bg-white px-2 py-1 text-amber-700 shadow-sm dark:bg-slate-800">{pending} pending</span>
                    {overdue > 0 && <span className="rounded-full bg-white px-2 py-1 text-rose-700 shadow-sm dark:bg-slate-800">{overdue} overdue</span>}
                    <span className="rounded-full bg-white px-2 py-1 text-emerald-700 shadow-sm dark:bg-slate-800">{done} done</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Due date *</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={df.due_date}
                onChange={(e) => setD("due_date", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Due time</label>
              <input type="time" className={`mt-1.5 ${inputCls}`} value={df.due_time}
                onChange={(e) => setD("due_time", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Priority</label>
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

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Before assigning</p>
            <p className="mt-1">Employee, task title and due date are required. The employee will see this task in their Tasks screen immediately.</p>
          </div>
          <button onClick={createDelegation} disabled={dSaving || !df.title.trim() || !df.assigned_to || !df.due_date}
            className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40">
            {dSaving ? "Assigning…" : df.assigned_to ? `Assign to ${members.find((m) => m.id === df.assigned_to)?.full_name || "employee"}` : "Select employee to continue"}
          </button>
        </div>
      </Modal>

      {/* ---------- New checklist ---------- */}
      <Modal open={cOpen} onClose={() => setCOpen(false)} title="New recurring checklist">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Title *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Weekly stock count"
              value={cf.title} onChange={(e) => setC("title", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">KRA ID</label>
            <div className="mt-1.5 flex gap-2">
              <input className={inputCls} placeholder="Generating…"
                value={cf.kra_id} onChange={(e) => setC("kra_id", e.target.value)} />
              <button type="button"
                onClick={async () => { const id = await genKra(); if (id) setC("kra_id", id); }}
                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700/50" aria-label="Generate a new KRA ID">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Generated automatically — you can overwrite it with your own code.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={2}
              value={cf.description} onChange={(e) => setC("description", e.target.value)} />
          </div>

          {company?.task_assignment_mode !== "direct" && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Department</label>
              <select className={`mt-1.5 ${inputCls}`} value={cf.department}
                onChange={(e) => { setC("department", e.target.value); setC("assigned_to", ""); }}>
                <option value="">All departments</option>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Choose a department to narrow the list below.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Assign to *</label>
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
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Frequency</label>
              <select className={`mt-1.5 ${inputCls}`} value={cf.frequency}
                onChange={(e) => setC("frequency", e.target.value)}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Priority</label>
              <select className={`mt-1.5 ${inputCls}`} value={cf.priority}
                onChange={(e) => setC("priority", e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cf.frequency === "daily" && "Repeats every working day, skipping holidays and weekly offs."}
            {cf.frequency === "weekly" && "Repeats on the same weekday every week."}
            {cf.frequency === "monthly" && "Repeats on the same date every month (31st becomes the last day in shorter months)."}
            {cf.frequency === "quarterly" && "Repeats every 3 months on the same date."}
            {cf.frequency === "half_yearly" && "Repeats every 6 months on the same date."}
            {cf.frequency === "yearly" && "Repeats on the same date every year."}
            {" "}If an occurrence falls on a holiday or weekly off, it shifts to the next working day. Due times are kept within company working hours, and tasks are created automatically up to 7 days ahead.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Start date</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={cf.start_date}
                onChange={(e) => setC("start_date", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Due time</label>
              <input type="time" className={`mt-1.5 ${inputCls}`} value={cf.start_time}
                onChange={(e) => setC("start_time", e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Default 9:00 AM each due day.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Ends on</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={cf.end_date}
                onChange={(e) => setC("end_date", e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Optional</p>
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

function SummaryTile({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${
      accent ? "border-brand-100 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10" : danger ? "border-rose-100 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
    }`}>
      <p className={`text-lg font-semibold ${accent ? "text-brand-700 dark:text-brand-300" : danger ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function ScopeBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
        on ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      }`}>
      {children}
    </button>
  );
}
