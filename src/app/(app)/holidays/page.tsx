"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Modal, EmptyState, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import { CalendarDays, Plus, Trash2 } from "lucide-react";

export default function HolidaysPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("public");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: h } = await supabase
      .from("holidays").select("*").order("holiday_date");
    setRows(h || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setError("");
    if (!name.trim() || !date) return setError("Enter a name and a date.");
    setSaving(true);
    const { error } = await supabase.from("holidays").insert({
      company_id: me!.company_id,
      name: name.trim(),
      holiday_date: date,
      holiday_type: type,
    });
    setSaving(false);
    if (error) return setError(error.message.includes("duplicate") ? "This holiday already exists." : error.message);
    setOpen(false);
    setName(""); setDate(""); setType("public");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("holidays").delete().eq("id", id);
    load();
  };

  const admin = isAdminRole(me?.role);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((r) => r.holiday_date >= today);
  const past = rows.filter((r) => r.holiday_date < today);

  const Row = ({ h, dim }: { h: any; dim?: boolean }) => (
    <li className={`flex items-center gap-3 px-4 py-3.5 ${dim ? "opacity-60" : ""}`}>
      <div className="grid h-11 w-11 shrink-0 flex-col place-items-center rounded-lg bg-brand-50">
        <span className="text-[10px] font-medium uppercase leading-none text-brand-700">
          {new Date(h.holiday_date).toLocaleDateString("en-IN", { month: "short" })}
        </span>
        <span className="text-sm font-semibold leading-tight text-brand-700">
          {new Date(h.holiday_date).getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{h.name}</p>
        <p className="text-xs text-slate-500">
          {new Date(h.holiday_date).toLocaleDateString("en-IN", { weekday: "long" })}
          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
            {h.holiday_type}
          </span>
        </p>
      </div>
      {admin && (
        <button onClick={() => remove(h.id)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-300 hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );

  return (
    <div>
      <PageHeader
        title="Holidays"
        subtitle={`${upcoming.length} upcoming this year`}
        action={
          admin && (
            <button onClick={() => setOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
              <Plus className="h-4 w-4" /> Add holiday
            </button>
          )
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title="No holidays added"
            hint={admin ? "Add your company's holiday calendar for the year." : "Your admin has not added the holiday calendar yet."} />
        </Card>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Upcoming</h2>
              <Card><ul className="divide-y divide-slate-100">
                {upcoming.map((h) => <Row key={h.id} h={h} />)}
              </ul></Card>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Past</h2>
              <Card><ul className="divide-y divide-slate-100">
                {past.map((h) => <Row key={h.id} h={h} dim />)}
              </ul></Card>
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add holiday">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Holiday name *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Diwali"
              value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Date *</label>
              <input type="date" className={`mt-1.5 ${inputCls}`}
                value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Type</label>
              <select className={`mt-1.5 ${inputCls}`} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="public">Public</option>
                <option value="optional">Optional</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={add} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Adding…" : "Add holiday"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
