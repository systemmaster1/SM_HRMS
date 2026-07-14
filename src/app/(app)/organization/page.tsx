"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Modal, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import { Building2, Briefcase, Plane, Plus, Trash2, Check, Users2 } from "lucide-react";

const DAY_TYPES = [
  { v: "full_day",       l: "Full day" },
  { v: "first_half",     l: "First half day" },
  { v: "second_half",    l: "Second half day" },
  { v: "short_morning",  l: "Short leave — morning" },
  { v: "short_evening",  l: "Short leave — evening" },
  { v: "wfh",            l: "Work from home" },
];

export default function OrganizationPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [depts, setDepts] = useState<any[]>([]);
  const [desigs, setDesigs] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");

  const [modal, setModal] = useState<"dept" | "desig" | "type" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [quota, setQuota] = useState("12");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: c } = await supabase
      .from("companies").select("*").eq("id", p!.company_id).single();
    setCompany(c);

    const [d, g, t] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("designations").select("*").order("name"),
      supabase.from("leave_types").select("*").order("sort_order"),
    ]);
    setDepts(d.data || []);
    setDesigs(g.data || []);
    setTypes(t.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(""), 2500); };

  const add = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter a name.");
    setSaving(true);

    let err;
    if (modal === "dept") {
      ({ error: err } = await supabase.from("departments")
        .insert({ company_id: me!.company_id, name: name.trim() }));
    } else if (modal === "desig") {
      ({ error: err } = await supabase.from("designations")
        .insert({ company_id: me!.company_id, name: name.trim() }));
    } else {
      if (!code.trim()) { setSaving(false); return setError("Please enter a short code (e.g. CL)."); }
      ({ error: err } = await supabase.from("leave_types").insert({
        company_id: me!.company_id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        annual_quota: parseFloat(quota) || 0,
        sort_order: types.length + 1,
      }));
    }

    setSaving(false);
    if (err) return setError(err.message.includes("duplicate") ? "This already exists." : err.message);

    setModal(null);
    setName(""); setCode(""); setQuota("12");
    load();
  };

  const del = async (table: string, id: string) => {
    await supabase.from(table).delete().eq("id", id);
    load();
  };

  const updateQuota = async (id: string, q: string) => {
    await supabase.from("leave_types")
      .update({ annual_quota: parseFloat(q) || 0 }).eq("id", id);
    flash("Quota updated");
    load();
  };

  const toggleDayType = async (v: string) => {
    const cur: string[] = company.day_types || [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    await supabase.from("companies").update({ day_types: next }).eq("id", company.id);
    flash("Leave options updated");
    load();
  };

  const saveBuddy = async (patch: any) => {
    await supabase.from("companies").update(patch).eq("id", company.id);
    flash("Buddy settings updated");
    load();
  };

  const admin = isAdminRole(me?.role);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  if (!admin) {
    return (
      <div>
        <PageHeader title="Organization" subtitle="Only an admin can manage this." />
      </div>
    );
  }

  const dayTypes: string[] = company?.day_types || [];

  const Chip = ({ item, table }: { item: any; table: string }) => (
    <span className="group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-2 text-sm text-slate-700">
      {item.name}
      <button onClick={() => del(table, item.id)}
        className="text-slate-300 transition hover:text-rose-600">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Organization"
        subtitle="Departments, designations and leave configuration."
      />

      {saved && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          <Check className="h-4 w-4" /> {saved}
        </p>
      )}

      <div className="space-y-5">
        {/* Departments */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Departments</h2>
              <span className="text-xs text-slate-400">({depts.length})</span>
            </div>
            <button onClick={() => { setModal("dept"); setName(""); setError(""); }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            {depts.length === 0
              ? <p className="text-sm text-slate-400">No departments yet.</p>
              : depts.map((d) => <Chip key={d.id} item={d} table="departments" />)}
          </div>
        </Card>

        {/* Designations */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Designations</h2>
              <span className="text-xs text-slate-400">({desigs.length})</span>
            </div>
            <button onClick={() => { setModal("desig"); setName(""); setError(""); }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            {desigs.length === 0
              ? <p className="text-sm text-slate-400">No designations yet.</p>
              : desigs.map((d) => <Chip key={d.id} item={d} table="designations" />)}
          </div>
        </Card>

        {/* Leave types */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Leave types</h2>
            </div>
            <button onClick={() => { setModal("type"); setName(""); setCode(""); setQuota("12"); setError(""); }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {types.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                  {t.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.is_paid ? "Paid" : "Unpaid"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.5" defaultValue={t.annual_quota}
                    onBlur={(e) => updateQuota(t.id, e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand-600" />
                  <span className="text-xs text-slate-400">/ year</span>
                  <button onClick={() => del("leave_types", t.id)}
                    className="ml-1 text-slate-300 transition hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {types.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-slate-400">
                No leave types. Add CL, SL, EL and any others you use.
              </li>
            )}
          </ul>
        </Card>

        {/* Day types */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Leave duration options</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose what employees can select when applying for leave.
            </p>
          </div>
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {DAY_TYPES.map((d) => {
              const on = dayTypes.includes(d.v);
              return (
                <label key={d.v}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                    on ? "border-brand-700 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                  }`}>
                  <input type="checkbox" checked={on} onChange={() => toggleDayType(d.v)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" />
                  <span className={`text-sm font-medium ${on ? "text-brand-700" : "text-slate-700"}`}>
                    {d.l}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        {/* Buddy system */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Users2 className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Buddy system</h2>
          </div>
          <div className="space-y-4 p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={!!company?.buddy_enabled}
                onChange={(e) => saveBuddy({ buddy_enabled: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" />
              <span>
                <span className="block text-sm font-medium text-slate-900">Enable buddy system</span>
                <span className="block text-xs text-slate-500">
                  Employees nominate a colleague to cover their work while they are away.
                </span>
              </span>
            </label>

            {company?.buddy_enabled && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={!!company?.buddy_required}
                    onChange={(e) => saveBuddy({ buddy_required: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">Make it mandatory</span>
                    <span className="block text-xs text-slate-500">
                      A buddy must be selected for full-day leave.
                    </span>
                  </span>
                </label>

                <div>
                  <p className="text-sm font-medium text-slate-700">Who can be chosen as a buddy?</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      { v: "department", t: "Same department only", d: "Colleagues from their own team" },
                      { v: "company", t: "Anyone in the company", d: "All active employees" },
                    ].map((o) => (
                      <button key={o.v} type="button"
                        onClick={() => saveBuddy({ buddy_scope: o.v })}
                        className={`rounded-xl border p-3 text-left transition ${
                          company?.buddy_scope === o.v
                            ? "border-brand-700 bg-brand-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}>
                        <p className={`text-sm font-medium ${
                          company?.buddy_scope === o.v ? "text-brand-700" : "text-slate-900"
                        }`}>{o.t}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{o.d}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Add modal */}
      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal === "dept" ? "Add department" : modal === "desig" ? "Add designation" : "Add leave type"}>
        <div className="space-y-4">
          {modal === "type" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Short code *</label>
              <input className={`mt-1.5 ${inputCls} uppercase`} placeholder="CL"
                maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Name *</label>
            <input className={`mt-1.5 ${inputCls}`}
              placeholder={modal === "dept" ? "Sales" : modal === "desig" ? "Field Executive" : "Casual Leave"}
              value={name} onChange={(e) => setName(e.target.value)}
              autoFocus={modal !== "type"} />
          </div>
          {modal === "type" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Annual quota (days)</label>
              <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`}
                value={quota} onChange={(e) => setQuota(e.target.value)} />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={add} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
