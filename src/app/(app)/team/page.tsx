"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, isAdminRole } from "@/lib/types";
import { PageHeader, Card, Modal, EmptyState, inputCls } from "@/components/ui";
import { UserPlus, KeyRound, Users, RefreshCw, Copy, Check, Settings2 } from "lucide-react";

const randomPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};

export default function TeamPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [desigs, setDesigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // add form
  const [f, setF] = useState({
    full_name: "", email: "", phone: "", password: randomPassword(),
    role: "employee", department: "", designation: "", employee_code: "", manager_id: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [newPw, setNewPw] = useState(randomPassword());

  const [attFor, setAttFor] = useState<any>(null);
  const [att, setAtt] = useState({
    photo_required: false,
    auto_attendance: false,
    auto_in_time: "09:30",
    auto_out_time: "18:30",
  });

  const openAtt = (m: any) => {
    setAtt({
      photo_required: !!m.photo_required,
      auto_attendance: !!m.auto_attendance,
      auto_in_time: (m.auto_in_time || "09:30").slice(0, 5),
      auto_out_time: (m.auto_out_time || "18:30").slice(0, 5),
    });
    setAttFor(m);
  };

  const saveAtt = async () => {
    setSaving(true);
    await supabase.from("profiles").update({
      photo_required: att.photo_required,
      auto_attendance: att.auto_attendance,
      auto_in_time: att.auto_in_time,
      auto_out_time: att.auto_out_time,
    }).eq("id", attFor.id);
    setSaving(false);
    setAttFor(null);
    load();
  };

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: mine } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(mine as Profile);

    const { data: list } = await supabase
      .from("profiles")
      .select("*, manager:manager_id(full_name)")
      .order("created_at");
    setMembers((list as any[]) || []);

    const [d, g] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("designations").select("*").order("name"),
    ]);
    setDepts(d.data || []);
    setDesigs(g.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    setError("");
    setSaving(true);
    const res = await fetch("/api/team/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, manager_id: f.manager_id || null }),
    });
    const out = await res.json();
    setSaving(false);

    if (!res.ok) return setError(out.error || "Could not add member.");

    setCreated({ email: f.email, password: f.password });
    setAddOpen(false);
    setF({
      full_name: "", email: "", phone: "", password: randomPassword(),
      role: "employee", department: "", designation: "", employee_code: "", manager_id: "",
    });
    load();
  };

  const resetPassword = async () => {
    setError("");
    setSaving(true);
    const res = await fetch("/api/team/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: resetFor!.id, password: newPw }),
    });
    const out = await res.json();
    setSaving(false);

    if (!res.ok) return setError(out.error || "Could not reset password.");

    setCreated({ email: resetFor!.email || "", password: newPw });
    setResetFor(null);
    setNewPw(randomPassword());
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const admin = isAdminRole(me?.role);
  const managers = members.filter((m) => ["owner", "admin", "manager"].includes(m.role));

  const Avatar = ({ n }: { n: string }) => (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
      {(n || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={`${members.length} ${members.length === 1 ? "member" : "members"}`}
        action={
          admin && (
            <button
              onClick={() => { setF((p) => ({ ...p, password: randomPassword() })); setAddOpen(true); }}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
            >
              <UserPlus className="h-4 w-4" /> Add member
            </button>
          )
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {members.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {members.map((m: any) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar n={m.full_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{m.full_name || "—"}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {m.role}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {m.designation || "—"}
                      {m.department && ` · ${m.department}`}
                      {m.email && ` · ${m.email}`}
                    </p>
                    {m.manager?.full_name && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        Reports to {m.manager.full_name}
                      </p>
                    )}
                  </div>
                  {admin && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => openAtt(m)}
                        title="Attendance settings"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-700"
                      >
                        <Settings2 className="h-3.5 w-3.5" /> Attendance
                      </button>
                      {m.role !== "owner" && (
                        <button
                          onClick={() => { setNewPw(randomPassword()); setResetFor(m); }}
                          title="Reset password"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-700"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title="No team members yet" hint="Add your first team member to get started." />
          )}
        </Card>
      )}

      {/* ---- Add member ---- */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add team member">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Full name *</label>
              <input className={`mt-1.5 ${inputCls}`} placeholder="Anjali Sharma"
                value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Employee code</label>
              <input className={`mt-1.5 ${inputCls}`} placeholder="EMP-001"
                value={f.employee_code} onChange={(e) => set("employee_code", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Login email *</label>
            <input type="email" className={`mt-1.5 ${inputCls}`} placeholder="anjali@company.com"
              value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Mobile number</label>
            <div className="mt-1.5 flex">
              <span className="grid place-items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
              <input className={`${inputCls} rounded-l-none`} placeholder="98765 43210" inputMode="numeric"
                value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">They can sign in with either the email or this number.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password *</label>
            <div className="mt-1.5 flex gap-2">
              <input className={inputCls} value={f.password} onChange={(e) => set("password", e.target.value)} />
              <button type="button" onClick={() => set("password", randomPassword())}
                title="Generate new"
                className="grid w-11 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-brand-600 hover:text-brand-700">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Role</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.role} onChange={(e) => set("role", e.target.value)}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Reports to</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.manager_id} onChange={(e) => set("manager_id", e.target.value)}>
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Department</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.department}
                onChange={(e) => set("department", e.target.value)}>
                <option value="">Select…</option>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Designation</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.designation}
                onChange={(e) => set("designation", e.target.value)}>
                <option value="">Select…</option>
                {desigs.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={addMember} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Creating account…" : "Create account"}
          </button>
        </div>
      </Modal>

      {/* ---- Reset password ---- */}
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title="Reset password">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Set a new password for <strong className="font-medium text-slate-900">{resetFor?.full_name}</strong>.
            Share it with them securely.
          </p>
          <div>
            <label className="text-sm font-medium text-slate-700">New password</label>
            <div className="mt-1.5 flex gap-2">
              <input className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <button type="button" onClick={() => setNewPw(randomPassword())}
                className="grid w-11 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-brand-600 hover:text-brand-700">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={resetPassword} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Resetting…" : "Reset password"}
          </button>
        </div>
      </Modal>

      {/* ---- Per-employee attendance settings ---- */}
      <Modal open={!!attFor} onClose={() => setAttFor(null)} title="Attendance settings">
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            For <strong className="font-medium text-slate-900">{attFor?.full_name}</strong>
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5">
            <input type="checkbox" checked={att.photo_required}
              onChange={(e) => setAtt((p) => ({ ...p, photo_required: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" />
            <span>
              <span className="block text-sm font-medium text-slate-900">Require photo</span>
              <span className="block text-xs text-slate-500">
                Applies when the company photo policy is set to &quot;Selected only&quot;.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-slate-200 p-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={att.auto_attendance}
                onChange={(e) => setAtt((p) => ({ ...p, auto_attendance: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" />
              <span>
                <span className="block text-sm font-medium text-slate-900">Automatic attendance</span>
                <span className="block text-xs text-slate-500">
                  Mark in and out automatically at fixed times each working day.
                </span>
              </span>
            </label>

            {att.auto_attendance && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Auto check-in</label>
                  <input type="time" className={`mt-1 ${inputCls}`} value={att.auto_in_time}
                    onChange={(e) => setAtt((p) => ({ ...p, auto_in_time: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Auto check-out</label>
                  <input type="time" className={`mt-1 ${inputCls}`} value={att.auto_out_time}
                    onChange={(e) => setAtt((p) => ({ ...p, auto_out_time: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          <button onClick={saveAtt} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </Modal>

      {/* ---- Credentials result ---- */}
      <Modal open={!!created} onClose={() => setCreated(null)} title="Account ready">
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4" /> Credentials set
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Share these with the team member. This is the only time the password is shown.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Email</span>
              <span className="truncate text-slate-900">{created?.email}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Password</span>
              <span className="font-semibold text-slate-900">{created?.password}</span>
            </div>
          </div>

          <button
            onClick={() => copy(`Email: ${created?.email}\nPassword: ${created?.password}`)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? <><Check className="h-4 w-4 text-emerald-600" /> Copied</> : <><Copy className="h-4 w-4" /> Copy credentials</>}
          </button>
        </div>
      </Modal>
    </div>
  );
}
