"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { getPosition, fmtTime } from "@/lib/geo";
import { type Profile, isAdminRole } from "@/lib/types";
import { MapPin, Plus, LogIn, LogOut, Navigation, ExternalLink } from "lucide-react";

export default function FieldVisitsPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [f, setF] = useState({
    client_name: "", purpose: "", address: "",
    visit_date: new Date().toISOString().slice(0, 10),
    employee_id: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: v } = await supabase
      .from("field_visits")
      .select("*, profiles:employee_id(full_name)")
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);
    setVisits(v || []);

    if (isAdminRole((p as Profile)?.role)) {
      const { data: m } = await supabase
        .from("profiles").select("*").eq("status", "active").order("full_name");
      setMembers((m as Profile[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError("");
    if (!f.client_name.trim()) return setError("Please enter the client or site name.");
    setSaving(true);
    const { error } = await supabase.from("field_visits").insert({
      company_id: me!.company_id,
      employee_id: f.employee_id || me!.id,
      client_name: f.client_name.trim(),
      purpose: f.purpose,
      address: f.address,
      visit_date: f.visit_date,
    });
    setSaving(false);
    if (error) return setError(error.message);

    setOpen(false);
    setF({ client_name: "", purpose: "", address: "",
           visit_date: new Date().toISOString().slice(0, 10), employee_id: "" });
    load();
  };

  const start = async (id: string) => {
    setBusyId(id);
    await supabase.from("field_visits").update({ status: "on_the_way" }).eq("id", id);
    setBusyId(null);
    load();
  };

  const checkIn = async (id: string) => {
    setBusyId(id);
    const { lat, lng } = await getPosition();
    await supabase.from("field_visits").update({
      status: "checked_in",
      check_in_at: new Date().toISOString(),
      check_in_lat: lat, check_in_lng: lng,
    }).eq("id", id);
    setBusyId(null);
    load();
  };

  const checkOut = async (id: string) => {
    setBusyId(id);
    const { lat, lng } = await getPosition();
    await supabase.from("field_visits").update({
      status: "completed",
      check_out_at: new Date().toISOString(),
      check_out_lat: lat, check_out_lng: lng,
    }).eq("id", id);
    setBusyId(null);
    load();
  };

  const admin = isAdminRole(me?.role);
  const mapUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div>
      <PageHeader
        title="Field visits"
        subtitle="GPS-verified client visits."
        action={
          <button onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
            <Plus className="h-4 w-4" /> New visit
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {visits.length === 0 ? (
            <EmptyState icon={MapPin} title="No field visits"
              hint="Schedule a visit and check in on location." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visits.map((v: any) => {
                const isMine = v.employee_id === me?.id;
                const busy = busyId === v.id;
                return (
                  <li key={v.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <MapPin className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {v.client_name || "Untitled visit"}
                          </p>
                          <Badge value={v.status} />
                        </div>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {v.profiles?.full_name}
                          {v.purpose && ` · ${v.purpose}`}
                        </p>
                        {v.address && (
                          <p className="mt-0.5 truncate text-xs text-slate-400">{v.address}</p>
                        )}

                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(v.visit_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          {v.check_in_at && ` · In ${fmtTime(v.check_in_at)}`}
                          {v.check_out_at && ` · Out ${fmtTime(v.check_out_at)}`}
                        </p>

                        {v.check_in_lat && (
                          <a href={mapUrl(v.check_in_lat, v.check_in_lng)} target="_blank" rel="noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
                            <Navigation className="h-3 w-3" /> View check-in location
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {isMine && v.status !== "completed" && v.status !== "cancelled" && (
                          <div className="mt-3 flex gap-2">
                            {v.status === "planned" && (
                              <button onClick={() => start(v.id)} disabled={busy}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                Start travel
                              </button>
                            )}
                            {(v.status === "planned" || v.status === "on_the_way") && (
                              <button onClick={() => checkIn(v.id)} disabled={busy}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60">
                                <LogIn className="h-3.5 w-3.5" /> {busy ? "Locating…" : "Check in"}
                              </button>
                            )}
                            {v.status === "checked_in" && (
                              <button onClick={() => checkOut(v.id)} disabled={busy}
                                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-60">
                                <LogOut className="h-3.5 w-3.5" /> {busy ? "Locating…" : "Check out"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New field visit">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Client / site name *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Acme Industries"
              value={f.client_name} onChange={(e) => set("client_name", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Purpose</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Client meeting / Site survey"
              value={f.purpose} onChange={(e) => set("purpose", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Address</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Sector 62, Noida"
              value={f.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Date</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={f.visit_date}
                onChange={(e) => set("visit_date", e.target.value)} />
            </div>
            {admin && (
              <div>
                <label className="text-sm font-medium text-slate-700">Assign to</label>
                <select className={`mt-1.5 ${inputCls}`} value={f.employee_id}
                  onChange={(e) => set("employee_id", e.target.value)}>
                  <option value="">Myself</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={create} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Creating…" : "Create visit"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
