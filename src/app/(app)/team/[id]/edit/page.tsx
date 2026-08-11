"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  Building2,
  CheckCircle2,
  IdCard,
  LoaderCircle,
  MapPinned,
  Route,
  Save,
  ShieldCheck,
  UserCog,
  UsersRound,
  Workflow,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const fieldCls =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

type AccessLevel = "none" | "self" | "team" | "company";

const accessModules = [
  ["attendance","Attendance"],
  ["leave","Leave"],
  ["tasks","Tasks & Work"],
  ["field_visits","Field Visits"],
  ["live_tracking","Live Team Tracking"],
  ["route_history","Route History / KM"],
  ["field_reports","Field Reports"],
  ["payroll","Payroll"],
  ["team_management","Team Management"],
  ["reports","Management Reports"],
] as const;

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const employeeId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [depts, setDepts] = useState<any[]>([]);
  const [desigs, setDesigs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);

  const [f, setF] = useState<any>({
    full_name: "",
    employee_code: "",
    email: "",
    phone: "",
    role: "employee",
    department: "",
    designation: "",
    branch_id: "",
    manager_id: "",
    work_manager_id: "",
    field_manager_id: "",
    photo_required: false,
    auto_attendance: false,
    auto_in_time: "09:30",
    auto_out_time: "18:30",
    field_tracking_enabled: false,
    employee_type: "office",
    tracking_mode: "working_hours",
    tracking_interval_minutes: "5",
    tracking_stale_after_minutes: "10",
    route_history_enabled: true,
    notify_hr_manager: true,
    notify_work_manager: true,
    notify_field_manager: true,
    access_permissions: {},
  });

  const set = (key: string, value: any) => setF((p: any) => ({ ...p, [key]: value }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: employee, error: employeeErr }, d, g, b, p] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", employeeId).single(),
        supabase.from("departments").select("*").order("name"),
        supabase.from("designations").select("*").order("name"),
        supabase.from("branches").select("*").order("name"),
        supabase.from("profiles")
          .select("id,full_name,role,designation,status")
          .eq("status","active")
          .in("role",["owner","admin","manager"])
          .order("full_name"),
      ]);

      if (employeeErr || !employee) {
        setError(employeeErr?.message || "Employee not found.");
        setLoading(false);
        return;
      }

      setDepts(d.data || []);
      setDesigs(g.data || []);
      setBranches(b.data || []);
      setManagers((p.data || []).filter((x: any) => x.id !== employeeId));

      setF({
        full_name: employee.full_name || "",
        employee_code: employee.employee_code || "",
        email: employee.email || "",
        phone: (employee.phone || "").replace(/^\+91/, ""),
        role: employee.role || "employee",
        department: employee.department || "",
        designation: employee.designation || "",
        branch_id: employee.branch_id || "",
        manager_id: employee.manager_id || "",
        work_manager_id: employee.work_manager_id || "",
        field_manager_id: employee.field_manager_id || "",
        photo_required: !!employee.photo_required,
        auto_attendance: !!employee.auto_attendance,
        auto_in_time: (employee.auto_in_time || "09:30").slice(0,5),
        auto_out_time: (employee.auto_out_time || "18:30").slice(0,5),
        field_tracking_enabled: !!employee.field_tracking_enabled,
        employee_type: employee.employee_type || "office",
        tracking_mode: employee.tracking_mode || "working_hours",
        tracking_interval_minutes: String(employee.tracking_interval_minutes || 5),
        tracking_stale_after_minutes: String(employee.tracking_stale_after_minutes || 10),
        route_history_enabled: employee.route_history_enabled !== false,
        notify_hr_manager: employee.notify_hr_manager !== false,
        notify_work_manager: employee.notify_work_manager !== false,
        notify_field_manager: employee.notify_field_manager !== false,
        access_permissions: employee.access_permissions || {},
      });
      setLoading(false);
    })();
  }, [employeeId, supabase]);

  const managerSelect = (key: string) => (
    <select className={fieldCls} value={f[key] || ""} onChange={(e) => set(key,e.target.value)}>
      <option value="">No manager</option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>{m.full_name}{m.designation ? ` · ${m.designation}` : ""}</option>
      ))}
    </select>
  );

  const accessLevel = (key: string): AccessLevel => (f.access_permissions?.[key] || "none") as AccessLevel;
  const setAccess = (key: string, value: AccessLevel) =>
    set("access_permissions", { ...(f.access_permissions || {}), [key]: value });

  const save = async () => {
    setError("");
    setSuccess("");
    setSaving(true);

    const res = await fetch("/api/team/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        ...f,
        branch_id: f.branch_id || null,
        manager_id: f.manager_id || null,
        work_manager_id: f.work_manager_id || null,
        field_manager_id: f.field_manager_id || null,
      }),
    });

    const out = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(out.error || "Could not update employee.");
      return;
    }

    setSuccess(out.message || "Employee updated successfully.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading employee setup…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/team" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back to Team
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Edit Employee</h1>
          <p className="mt-1 text-sm text-slate-500">
            Update login, organization, reporting, permissions, attendance and field settings.
          </p>
        </div>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
          {saving ? "Saving changes…" : "Save changes"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{success}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><IdCard className="h-5 w-5"/></div>
          <div><h2 className="font-semibold">Identity & Login</h2><p className="text-xs text-slate-500">Login email is synchronized with Supabase Authentication.</p></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Full name *
            <input className={fieldCls} value={f.full_name} onChange={(e)=>set("full_name",e.target.value)} />
          </label>
          <label className="text-sm font-medium">Employee code
            <input className={fieldCls} value={f.employee_code} onChange={(e)=>set("employee_code",e.target.value)} />
          </label>
          <label className="text-sm font-medium">Role
            <select className={fieldCls} value={f.role} onChange={(e)=>set("role",e.target.value)}>
              {f.role === "owner" && <option value="owner">Owner</option>}
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-sm font-medium">Login email *
            <input type="email" className={fieldCls} value={f.email} onChange={(e)=>set("email",e.target.value)} />
            <span className="mt-1 block text-[11px] text-amber-600">Changing this changes the employee's login email.</span>
          </label>
          <label className="text-sm font-medium">Mobile number
            <div className="mt-1.5 flex rounded-xl border border-slate-300 bg-white">
              <span className="grid place-items-center border-r border-slate-200 px-3 text-sm text-slate-500">+91</span>
              <input className="min-w-0 flex-1 rounded-r-xl px-3 py-2.5 text-sm outline-none" value={f.phone} onChange={(e)=>set("phone",e.target.value)} placeholder="9876543210"/>
            </div>
          </label>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Password is intentionally managed separately using <b>Reset</b> from the Team page.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-violet-700"/><div><h2 className="font-semibold">Organization</h2><p className="text-xs text-slate-500">Move employee to another branch, department or designation at any time.</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">Department
            <select className={fieldCls} value={f.department} onChange={(e)=>set("department",e.target.value)}>
              <option value="">Select department</option>{depts.map((x)=><option key={x.id} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Designation
            <select className={fieldCls} value={f.designation} onChange={(e)=>set("designation",e.target.value)}>
              <option value="">Select designation</option>{desigs.map((x)=><option key={x.id} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Branch
            <select className={fieldCls} value={f.branch_id} onChange={(e)=>set("branch_id",e.target.value)}>
              <option value="">No branch</option>{branches.map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-amber-700"/><div><h2 className="font-semibold">Reporting & Monitoring</h2><p className="text-xs text-slate-500">HRMS, Work and Field managers can be different or the same person.</p></div></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <UserCog className="h-5 w-5 text-blue-700"/><h3 className="mt-3 text-sm font-semibold">HRMS Manager</h3>
            <p className="mt-1 text-xs text-slate-500">Attendance, leave and HR reporting.</p>{managerSelect("manager_id")}
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <Workflow className="h-5 w-5 text-violet-700"/><h3 className="mt-3 text-sm font-semibold">Work Manager</h3>
            <p className="mt-1 text-xs text-slate-500">Tasks, checklists and work reporting.</p>{managerSelect("work_manager_id")}
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <MapPinned className="h-5 w-5 text-emerald-700"/><h3 className="mt-3 text-sm font-semibold">Field Manager</h3>
            <p className="mt-1 text-xs text-slate-500">Visits, live GPS, route and field reports.</p>{managerSelect("field_manager_id")}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-brand-700"/><div><h2 className="font-semibold">Module Access Control</h2><p className="text-xs text-slate-500">Change what this employee can see and manage. Field access and own GPS tracking are separate.</p></div></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="rounded-l-xl px-4 py-3">Module</th><th className="px-4 py-3">Access level</th><th className="rounded-r-xl px-4 py-3">Meaning</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accessModules.map(([key,label]) => {
                const level = accessLevel(key);
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium">{label}</td>
                    <td className="px-4 py-3">
                      <select value={level} onChange={(e)=>setAccess(key,e.target.value as AccessLevel)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="none">No access</option>
                        <option value="self">Own / Self</option>
                        <option value="team">Assigned Team</option>
                        <option value="company">All Company</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {level === "none" ? "Module hidden / blocked" : level === "self" ? "Own records only" : level === "team" ? "Assigned reporting team" : "Company-wide"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-700"/><div><h2 className="font-semibold">Attendance Setup</h2><p className="text-xs text-slate-500">Employee-specific attendance controls.</p></div></div>
          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
              <input type="checkbox" checked={f.photo_required} onChange={(e)=>set("photo_required",e.target.checked)} className="mt-1"/>
              <span><span className="block text-sm font-medium">Require attendance photo</span><span className="block text-xs text-slate-500">Selfie/photo proof for attendance when required.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
              <input type="checkbox" checked={f.auto_attendance} onChange={(e)=>set("auto_attendance",e.target.checked)} className="mt-1"/>
              <span><span className="block text-sm font-medium">Automatic attendance</span><span className="block text-xs text-slate-500">Apply configured automatic IN/OUT rules.</span></span>
            </label>
            {f.auto_attendance && <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Auto IN<input type="time" className={fieldCls} value={f.auto_in_time} onChange={(e)=>set("auto_in_time",e.target.value)}/></label>
              <label className="text-sm font-medium">Auto OUT<input type="time" className={fieldCls} value={f.auto_out_time} onChange={(e)=>set("auto_out_time",e.target.value)}/></label>
            </div>}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Route className="h-5 w-5 text-emerald-700"/><div><h2 className="font-semibold">Own Field Tracking</h2><p className="text-xs text-slate-500">ON only for employees whose official role requires field movement.</p></div></div>
          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
              <input type="checkbox" checked={f.field_tracking_enabled} onChange={(e)=>set("field_tracking_enabled",e.target.checked)} className="mt-1"/>
              <span><span className="block text-sm font-medium">Track this employee during authorized duty</span><span className="block text-xs text-slate-500">Viewer permission does not automatically track the viewer's own device.</span></span>
            </label>

            {f.field_tracking_enabled && <>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Employee type
                  <select className={fieldCls} value={f.employee_type} onChange={(e)=>set("employee_type",e.target.value)}>
                    <option value="sales">Sales</option><option value="field">Field</option><option value="hybrid">Hybrid</option><option value="office">Office</option>
                  </select>
                </label>
                <label className="text-sm font-medium">GPS interval
                  <select className={fieldCls} value={f.tracking_interval_minutes} onChange={(e)=>set("tracking_interval_minutes",e.target.value)}>
                    <option value="2">2 minutes</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Tracking mode
                  <select className={fieldCls} value={f.tracking_mode} onChange={(e)=>set("tracking_mode",e.target.value)}>
                    <option value="working_hours">Duty time · Attendance IN → OUT</option>
                    <option value="active_visit">Active visit only</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Stale alert
                  <select className={fieldCls} value={f.tracking_stale_after_minutes} onChange={(e)=>set("tracking_stale_after_minutes",e.target.value)}>
                    <option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option>
                  </select>
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
                <input type="checkbox" checked={f.route_history_enabled} onChange={(e)=>set("route_history_enabled",e.target.checked)} className="mt-1"/>
                <span><span className="block text-sm font-medium">Save route history</span><span className="block text-xs text-slate-500">Required for Daily KM and historical route replay.</span></span>
              </label>
            </>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-rose-600"/><div><h2 className="font-semibold">Manager Notifications</h2><p className="text-xs text-slate-500">Choose which reporting managers receive this employee's operational alerts.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["notify_hr_manager","HRMS alerts","Attendance / HR activity"],
            ["notify_work_manager","Work alerts","Tasks / work activity"],
            ["notify_field_manager","Field alerts","Visits / field activity"],
          ].map(([key,title,desc])=>(
            <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input type="checkbox" checked={!!f[key]} onChange={(e)=>set(key,e.target.checked)} className="mt-1"/>
              <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-slate-500">{desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={()=>router.push("/team")} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Cancel</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
          {saving ? "Saving changes…" : "Save employee changes"}
        </button>
      </div>
    </div>
  );
}
