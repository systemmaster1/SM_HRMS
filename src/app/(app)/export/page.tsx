"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import { exportCsv } from "@/lib/export";
import {
  Download, CalendarCheck, Plane, Scale, ListChecks, ClipboardList,
  MapPin, Users, LifeBuoy, Wallet, AlertTriangle, Check, Loader2,
} from "lucide-react";

type ModuleKey =
  | "attendance" | "leaves" | "leave_balances" | "checklist" | "delegation"
  | "field_visits" | "employees" | "tickets" | "salary";

type ModuleDef = {
  key: ModuleKey;
  label: string;
  desc: string;
  icon: any;
  dated: boolean;
};

const MODULES: ModuleDef[] = [
  { key: "attendance",     label: "Attendance",      desc: "Check-in/out, location, late flags",   icon: CalendarCheck,  dated: true },
  { key: "leaves",         label: "Leave requests",  desc: "Applications with status and approver", icon: Plane,         dated: true },
  { key: "leave_balances", label: "Leave balances",  desc: "Current balance per employee per type", icon: Scale,         dated: false },
  { key: "checklist",      label: "Checklist tasks", desc: "Recurring task occurrences",            icon: ListChecks,    dated: true },
  { key: "delegation",     label: "Delegation tasks",desc: "One-off delegated tasks",               icon: ClipboardList, dated: true },
  { key: "field_visits",   label: "Field visits",    desc: "Client visits with GPS timestamps",     icon: MapPin,        dated: true },
  { key: "employees",      label: "Employees",       desc: "Full team directory with details",      icon: Users,         dated: false },
  { key: "tickets",        label: "Help desk",       desc: "Tickets with resolution status",        icon: LifeBuoy,      dated: true },
  { key: "salary",         label: "Salary master",   desc: "Salary structure per employee",         icon: Wallet,        dated: false },
];

const fmt = (ts: string | null) =>
  ts ? new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) : "";

export default function ExportPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);

  const [from, setFrom] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [picked, setPicked] = useState<ModuleKey[]>(["attendance"]);
  const [busy, setBusy] = useState<ModuleKey | "all" | null>(null);
  const [done, setDone] = useState<ModuleKey[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase
        .from("profiles").select("*").eq("id", auth.user.id).single();
      setMe(p as Profile);
      setReady(true);
    })();
  }, [supabase]);

  const toggle = (k: ModuleKey) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const preset = (days: number) => {
    const t = new Date();
    const f = new Date();
    f.setDate(t.getDate() - days);
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  };

  const presetMonth = (offset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  const suffix = `${from}_to_${to}`;

  /* ---------------- One module ---------------- */
  const runOne = async (key: ModuleKey): Promise<boolean> => {
    try {
      if (key === "attendance") {
        const { data } = await supabase
          .from("attendance")
          .select("*, profiles:employee_id(full_name, employee_code, department, designation)")
          .gte("work_date", from).lte("work_date", to)
          .order("work_date");

        exportCsv(`Attendance_${suffix}`,
          ["Date", "Employee", "Code", "Department", "Designation", "Status",
           "Check in", "Check out", "Late", "In office", "Distance (m)", "Address"],
          (data || []).map((r: any) => [
            r.work_date, r.profiles?.full_name || "", r.profiles?.employee_code || "",
            r.profiles?.department || "", r.profiles?.designation || "",
            r.status || "", fmt(r.check_in_at), fmt(r.check_out_at),
            r.is_late ? "Yes" : "No",
            r.out_of_office === null || r.out_of_office === undefined ? "" : r.out_of_office ? "No" : "Yes",
            r.distance_m ?? "", r.check_in_address || "",
          ]));
        return true;
      }

      if (key === "leaves") {
        const { data } = await supabase
          .from("leaves")
          .select("*, profiles:employee_id(full_name, employee_code, department), leave_types:leave_type_id(code, name), decider:decided_by(full_name)")
          .gte("from_date", from).lte("from_date", to)
          .order("from_date");

        exportCsv(`Leave_requests_${suffix}`,
          ["From", "To", "Employee", "Code", "Department", "Type", "Duration",
           "Days", "Status", "Reason", "Decided by", "Applied on"],
          (data || []).map((r: any) => [
            r.from_date, r.to_date, r.profiles?.full_name || "",
            r.profiles?.employee_code || "", r.profiles?.department || "",
            r.leave_types?.name || r.leave_types?.code || "",
            r.duration_type || "", r.days ?? "", r.status || "",
            r.reason || "", r.decider?.full_name || "", fmt(r.created_at),
          ]));
        return true;
      }

      if (key === "leave_balances") {
        const { data: members } = await supabase
          .from("profiles").select("*").eq("status", "active").order("full_name");

        const rows: (string | number)[][] = [];
        for (const m of (members as any[]) || []) {
          const { data: bal } = await supabase.rpc("leave_balance", { p_employee: m.id });
          for (const b of (bal as any[]) || []) {
            rows.push([
              m.full_name || "", m.employee_code || "", m.department || "",
              b.name || b.code || "", b.quota ?? "", b.used ?? "", b.balance ?? "",
            ]);
          }
        }

        exportCsv(`Leave_balances_${new Date().toISOString().slice(0, 10)}`,
          ["Employee", "Code", "Department", "Leave type", "Quota", "Used", "Balance"],
          rows);
        return true;
      }

      if (key === "checklist") {
        const { data } = await supabase
          .from("checklist_instances")
          .select("*, template:template_id(title, description, frequency, kra_id, priority), assignee:assigned_to(full_name, employee_code, department)")
          .gte("due_date", from).lte("due_date", to)
          .order("due_date");

        exportCsv(`Checklist_tasks_${suffix}`,
          ["Due date", "Due time", "KRA ID", "Title", "Description", "Frequency",
           "Priority", "Employee", "Code", "Department", "Completed at", "Status"],
          (data || []).map((r: any) => {
            const dueTs = new Date(`${r.due_date}T${r.due_time || "09:00"}`);
            const doneTs = r.completed_at ? new Date(r.completed_at) : null;
            const status = doneTs
              ? doneTs > dueTs ? "Done late" : "Done on time"
              : dueTs < new Date() ? "Not done" : "Pending";
            return [
              r.due_date, (r.due_time || "").slice(0, 5), r.template?.kra_id || "",
              r.template?.title || "", r.template?.description || "",
              r.template?.frequency || "", r.template?.priority || "",
              r.assignee?.full_name || "", r.assignee?.employee_code || "",
              r.assignee?.department || "", fmt(r.completed_at), status,
            ];
          }));
        return true;
      }

      if (key === "delegation") {
        const { data } = await supabase
          .from("delegations")
          .select("*, assignee:assigned_to(full_name, employee_code, department), assigner:assigned_by(full_name)")
          .gte("due_date", from).lte("due_date", to)
          .order("due_date");

        exportCsv(`Delegation_tasks_${suffix}`,
          ["Due date", "Due time", "KRA ID", "Title", "Description", "Priority",
           "Employee", "Code", "Department", "Assigned by", "Completed at", "Status"],
          (data || []).map((r: any) => {
            const dueTs = new Date(`${r.due_date}T${r.due_time || "23:59"}`);
            const doneTs = r.completed_at ? new Date(r.completed_at) : null;
            const status = doneTs
              ? doneTs > dueTs ? "Done late" : "Done on time"
              : dueTs < new Date() ? "Not done" : "Pending";
            return [
              r.due_date, (r.due_time || "").slice(0, 5), r.kra_id || "",
              r.title || "", r.description || "", r.priority || "",
              r.assignee?.full_name || "", r.assignee?.employee_code || "",
              r.assignee?.department || "", r.assigner?.full_name || "",
              fmt(r.completed_at), status,
            ];
          }));
        return true;
      }

      if (key === "field_visits") {
        const { data } = await supabase
          .from("field_visits")
          .select("*, profiles:employee_id(full_name, employee_code, department)")
          .gte("visit_date", from).lte("visit_date", to)
          .order("visit_date");

        exportCsv(`Field_visits_${suffix}`,
          ["Date", "Employee", "Code", "Department", "Client / site", "Purpose",
           "Address", "Status", "Checked in", "Checked out"],
          (data || []).map((r: any) => [
            r.visit_date, r.profiles?.full_name || "", r.profiles?.employee_code || "",
            r.profiles?.department || "", r.client_name || "", r.purpose || "",
            r.address || "", r.status || "", fmt(r.check_in_at), fmt(r.check_out_at),
          ]));
        return true;
      }

      if (key === "employees") {
        const { data } = await supabase
          .from("profiles").select("*").order("full_name");

        exportCsv(`Employees_${new Date().toISOString().slice(0, 10)}`,
          ["Name", "Code", "Email", "Mobile", "Role", "Department", "Designation",
           "Branch", "Status", "Date of joining"],
          (data || []).map((r: any) => [
            r.full_name || "", r.employee_code || "", r.email || "", r.phone || "",
            r.role || "", r.department || "", r.designation || "", r.branch || "",
            r.status || "", r.date_of_joining || "",
          ]));
        return true;
      }

      if (key === "tickets") {
        const { data } = await supabase
          .from("tickets")
          .select("*, raiser:raised_by(full_name, department), assignee:assigned_to(full_name)")
          .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`)
          .order("created_at");

        exportCsv(`Helpdesk_tickets_${suffix}`,
          ["Raised on", "Raised by", "Department", "Category", "Priority",
           "Subject", "Status", "Assigned to", "Target date", "Resolution plan"],
          (data || []).map((r: any) => [
            fmt(r.created_at), r.raiser?.full_name || "", r.raiser?.department || "",
            r.category || "", r.priority || "", r.subject || r.title || "",
            r.status || "", r.assignee?.full_name || "", r.target_date || "",
            r.resolution_plan || "",
          ]));
        return true;
      }

      if (key === "salary") {
        const { data } = await supabase
          .from("salary_master")
          .select("*, profiles:employee_id(full_name, employee_code, department, designation)");

        exportCsv(`Salary_master_${new Date().toISOString().slice(0, 10)}`,
          ["Employee", "Code", "Department", "Designation", "Monthly salary",
           "Basic", "HRA", "Allowance", "PF", "Other deduction"],
          (data || []).map((r: any) => [
            r.profiles?.full_name || "", r.profiles?.employee_code || "",
            r.profiles?.department || "", r.profiles?.designation || "",
            r.monthly_salary ?? "", r.basic ?? "", r.hra ?? "",
            r.allowance ?? "", r.pf ?? "", r.other_deduction ?? "",
          ]));
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const runSelected = async () => {
    setError("");
    setDone([]);
    if (picked.length === 0) return setError("Choose at least one thing to export.");
    if (from > to) return setError("The start date cannot be after the end date.");

    setBusy("all");
    const finished: ModuleKey[] = [];

    for (const k of picked) {
      const ok = await runOne(k);
      if (ok) finished.push(k);
      setDone([...finished]);
      // small gap so browsers do not block consecutive downloads
      await new Promise((r) => setTimeout(r, 400));
    }

    setBusy(null);
  };

  const admin = isAdminRole(me?.role);

  if (!ready) return <p className="text-sm text-slate-400">Loading…</p>;

  if (!admin) {
    return (
      <Card>
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">Admins only</p>
          <p className="mt-1 text-sm text-slate-500">
            Company-wide data export is restricted to administrators.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <FadeIn>
        <PageHeader
          title="Export data"
          subtitle="Download any part of your HRMS data as a spreadsheet."
        />
      </FadeIn>

      {/* Date range */}
      <Card className="mb-6">
        <div className="p-6">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Date range</p>
          <p className="mt-1 text-xs text-slate-500">
            Applies to everything except employees, leave balances and salary master,
            which are always current.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" className={`mt-1 ${inputCls}`} value={from}
                onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" className={`mt-1 ${inputCls}`} value={to}
                onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { l: "Last 7 days", f: () => preset(7) },
              { l: "Last 30 days", f: () => preset(30) },
              { l: "This month", f: () => presetMonth(0) },
              { l: "Last month", f: () => presetMonth(-1) },
              { l: "This year", f: () => { const y = new Date().getFullYear(); setFrom(`${y}-01-01`); setTo(`${y}-12-31`); } },
            ].map((p) => (
              <button key={p.l} onClick={p.f}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                {p.l}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Modules */}
      <FadeIn delay={0.03}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            What to export
          </h2>
          <button
            onClick={() =>
              setPicked(picked.length === MODULES.length ? [] : MODULES.map((m) => m.key))
            }
            className="text-xs font-medium text-brand-700 hover:text-brand-800">
            {picked.length === MODULES.length ? "Clear all" : "Select all"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const on = picked.includes(m.key);
            const finished = done.includes(m.key);
            return (
              <button key={m.key} onClick={() => toggle(m.key)}
                className={`rounded-xl border p-4 text-left transition ${
                  on
                    ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-600/15 dark:bg-brand-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                }`}>
                <div className="flex items-start justify-between">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${
                    on ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700"
                  }`}>
                    <m.icon className="h-4 w-4" />
                  </span>
                  {finished && <Check className="h-4 w-4 text-emerald-600" />}
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {m.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{m.desc}</p>
                {!m.dated && (
                  <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Current snapshot
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </FadeIn>

      {error && (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-2">
        <button onClick={runSelected} disabled={busy !== null}
          className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy
            ? `Exporting ${done.length + 1} of ${picked.length}…`
            : `Download ${picked.length} file${picked.length === 1 ? "" : "s"}`}
        </button>
        <p className="text-xs text-slate-400">
          Each selection downloads as its own CSV, ready to open in Excel or Google Sheets.
        </p>
      </div>
    </div>
  );
}
