"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BellRing,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  MapPinned,
  RefreshCw,
  Route,
  Save,
  ShieldCheck,
  UserCog,
  UsersRound,
  Workflow,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const randomPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const fieldCls =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

export default function NewEmployeePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [depts, setDepts] = useState<any[]>([]);
  const [desigs, setDesigs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState<any>(null);

  const [f, setF] = useState({
    full_name: "",
    employee_code: "",
    email: "",
    phone: "",
    password: randomPassword(),
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
  });

  const set = (key: string, value: any) => setF((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    (async () => {
      const [{ data: code }, d, g, b, p] = await Promise.all([
        supabase.rpc("next_employee_code_v9"),
        supabase.from("departments").select("*").order("name"),
        supabase.from("designations").select("*").order("name"),
        supabase.from("branches").select("*").order("name"),
        supabase.from("profiles").select("id,full_name,role,designation").eq("status","active").in("role",["owner","admin","manager"]).order("full_name"),
      ]);
      set("employee_code", code || "EMP-0001");
      setDepts(d.data || []);
      setDesigs(g.data || []);
      setBranches(b.data || []);
      setManagers(p.data || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sameManagerForAll = () => {
    const id = f.manager_id || managers[0]?.id || "";
    setF((p) => ({ ...p, manager_id: id, work_manager_id: id, field_manager_id: id }));
  };

  const submit = async () => {
    setError("");
    if (!f.full_name.trim() || !f.email.trim() || f.password.length < 6) {
      setError("Full name, valid login email and password are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/team/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f,
        manager_id: f.manager_id || null,
        work_manager_id: f.work_manager_id || null,
        field_manager_id: f.field_manager_id || null,
        branch_id: f.branch_id || null,
      }),
    });
    const out = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(out.error || "Could not create employee.");
      return;
    }
    setCreated({ ...out, email: f.email, password: f.password, full_name: f.full_name });
  };

  if (created) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
          <CheckCircle2 className="h-11 w-11 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold">Employee account created</h1>
          <p className="mt-2 text-sm text-slate-500">
            Reporting structure, attendance and field settings were saved with the employee profile.
          </p>
          <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
            <div><div className="text-xs text-slate-400">Employee</div><div className="mt-1 font-semibold">{created.full_name}</div></div>
            <div><div className="text-xs text-slate-400">Employee code</div><div className="mt-1 font-semibold">{created.employee_code}</div></div>
            <div><div className="text-xs text-slate-400">Login email</div><div className="mt-1 font-semibold">{created.email}</div></div>
            <div><div className="text-xs text-slate-400">Temporary password</div><div className="mt-1 font-mono font-semibold">{created.password}</div></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => router.push("/team")} className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white">Back to Team</button>
            <button onClick={() => window.location.reload()} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Add another employee</button>
          </div>
        </div>
      </div>
    );
  }

  const managerOptions = (value: string, onChange: (v: string) => void) => (
    <select className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No manager</option>
      {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.designation ? ` · ${m.designation}` : ""}</option>)}
    </select>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/team" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back to Team
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Add Employee</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create login, reporting hierarchy, attendance rules and field tracking from one place.
          </p>
        </div>
        <button onClick={submit} disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Creating employee…" : "Create employee"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><IdCard className="h-5 w-5" /></div>
          <div><h2 className="font-semibold">Employee Identity & Login</h2><p className="text-xs text-slate-500">Basic employee and account information.</p></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Full name *
            <input className={fieldCls} value={f.full_name} onChange={(e) => set("full_name",e.target.value)} placeholder="Anjali Sharma" autoFocus />
          </label>
          <label className="text-sm font-medium">Employee code
            <div className="mt-1.5 flex rounded-xl border border-slate-300 bg-slate-50">
              <input className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none" value={f.employee_code} readOnly />
              <span className="grid place-items-center px-3 text-xs text-emerald-700">Auto</span>
            </div>
          </label>
          <label className="text-sm font-medium">Role
            <select className={fieldCls} value={f.role} onChange={(e) => set("role",e.target.value)}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-sm font-medium">Login email *
            <input type="email" className={fieldCls} value={f.email} onChange={(e) => set("email",e.target.value)} placeholder="employee@company.com" />
          </label>
          <label className="text-sm font-medium">Mobile number
            <input className={fieldCls} value={f.phone} onChange={(e) => set("phone",e.target.value)} placeholder="9876543210" />
          </label>
          <label className="text-sm font-medium">Temporary password *
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <input type={showPassword ? "text" : "password"} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-10 text-sm outline-none focus:border-brand-600" value={f.password} onChange={(e) => set("password",e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button>
              </div>
              <button type="button" onClick={() => set("password",randomPassword())} className="rounded-xl border border-slate-300 px-3"><RefreshCw className="h-4 w-4"/></button>
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Building2 className="h-5 w-5" /></div>
          <div><h2 className="font-semibold">Organization</h2><p className="text-xs text-slate-500">Where the employee belongs in the company.</p></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">Department
            <select className={fieldCls} value={f.department} onChange={(e) => set("department",e.target.value)}>
              <option value="">Select department</option>{depts.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Designation
            <select className={fieldCls} value={f.designation} onChange={(e) => set("designation",e.target.value)}>
              <option value="">Select designation</option>{desigs.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Branch
            <select className={fieldCls} value={f.branch_id} onChange={(e) => set("branch_id",e.target.value)}>
              <option value="">No branch</option>{branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><UsersRound className="h-5 w-5" /></div>
            <div><h2 className="font-semibold">Reporting & Monitoring Hierarchy</h2><p className="text-xs text-slate-500">Different managers can monitor HRMS, work and field operations.</p></div>
          </div>
          <button type="button" onClick={sameManagerForAll} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Use same manager for all</button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <UserCog className="h-5 w-5 text-blue-700" />
            <h3 className="mt-3 text-sm font-semibold">HRMS Reporting Manager</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Attendance, leave and HR-related monitoring.</p>
            {managerOptions(f.manager_id,(v) => set("manager_id",v))}
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <Workflow className="h-5 w-5 text-violet-700" />
            <h3 className="mt-3 text-sm font-semibold">Work / Task Manager</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Tasks, delegation, checklist and work performance.</p>
            {managerOptions(f.work_manager_id,(v) => set("work_manager_id",v))}
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <MapPinned className="h-5 w-5 text-emerald-700" />
            <h3 className="mt-3 text-sm font-semibold">Field Tracking Manager</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Live location, field visits, route history and field reports.</p>
            {managerOptions(f.field_manager_id,(v) => set("field_manager_id",v))}
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
          The same person can be selected for all three responsibilities, or you can assign different managers for HR, Work and Field operations.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-brand-700"/><div><h2 className="font-semibold">Attendance Setup</h2><p className="text-xs text-slate-500">Employee-specific attendance controls.</p></div></div>
          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
              <input type="checkbox" checked={f.photo_required} onChange={(e) => set("photo_required",e.target.checked)} className="mt-1" />
              <span><span className="block text-sm font-medium">Require attendance photo</span><span className="block text-xs text-slate-500">Use selfie/photo proof for this employee when company policy permits.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
              <input type="checkbox" checked={f.auto_attendance} onChange={(e) => set("auto_attendance",e.target.checked)} className="mt-1" />
              <span><span className="block text-sm font-medium">Automatic attendance</span><span className="block text-xs text-slate-500">Use configured automatic IN/OUT time.</span></span>
            </label>
            {f.auto_attendance && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Auto IN<input type="time" className={fieldCls} value={f.auto_in_time} onChange={(e) => set("auto_in_time",e.target.value)} /></label>
                <label className="text-sm font-medium">Auto OUT<input type="time" className={fieldCls} value={f.auto_out_time} onChange={(e) => set("auto_out_time",e.target.value)} /></label>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Route className="h-5 w-5 text-emerald-700"/><div><h2 className="font-semibold">Field Tracking Setup</h2><p className="text-xs text-slate-500">Configure only if official field work requires location visibility.</p></div></div>
          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
              <input type="checkbox" checked={f.field_tracking_enabled} onChange={(e) => set("field_tracking_enabled",e.target.checked)} className="mt-1" />
              <span><span className="block text-sm font-medium">Enable field tracking</span><span className="block text-xs text-slate-500">Duty-time tracking can be monitored by the assigned Field Manager.</span></span>
            </label>
            {f.field_tracking_enabled && <>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Employee type
                  <select className={fieldCls} value={f.employee_type} onChange={(e) => set("employee_type",e.target.value)}>
                    <option value="sales">Sales</option><option value="field">Field</option><option value="hybrid">Hybrid</option><option value="office">Office</option>
                  </select>
                </label>
                <label className="text-sm font-medium">GPS interval
                  <select className={fieldCls} value={f.tracking_interval_minutes} onChange={(e) => set("tracking_interval_minutes",e.target.value)}>
                    <option value="2">2 minutes</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Tracking mode
                  <select className={fieldCls} value={f.tracking_mode} onChange={(e) => set("tracking_mode",e.target.value)}>
                    <option value="working_hours">Duty time: Attendance IN → OUT</option>
                    <option value="active_visit">Active visit only</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Stale alert
                  <select className={fieldCls} value={f.tracking_stale_after_minutes} onChange={(e) => set("tracking_stale_after_minutes",e.target.value)}>
                    <option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option>
                  </select>
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5">
                <input type="checkbox" checked={f.route_history_enabled} onChange={(e) => set("route_history_enabled",e.target.checked)} className="mt-1" />
                <span><span className="block text-sm font-medium">Save duty route history</span><span className="block text-xs text-slate-500">Enables daily KM, historical route and field activity reports.</span></span>
              </label>
            </>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-rose-600"/><div><h2 className="font-semibold">Manager Notifications</h2><p className="text-xs text-slate-500">Important events appear in the assigned manager's HRMS notification bell. Installed PWA notification support can be expanded further with browser push.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["notify_hr_manager","HRMS alerts","Attendance IN/OUT and HR events"],
            ["notify_work_manager","Work alerts","Important task/work updates"],
            ["notify_field_manager","Field alerts","Field visit and tracking updates"],
          ].map(([key,title,desc]) => (
            <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input type="checkbox" checked={(f as any)[key]} onChange={(e) => set(key,e.target.checked)} className="mt-1" />
              <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs leading-5 text-slate-500">{desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Creating employee…" : "Create employee & apply setup"}
        </button>
      </div>
    </div>
  );
}
