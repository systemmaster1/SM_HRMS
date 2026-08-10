"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { getPosition, fmtTime } from "@/lib/geo";
import { type Profile, canManageTeam, isAdminRole } from "@/lib/types";
import { MapPin, Plus, LogIn, LogOut, Navigation, ExternalLink, Route, CheckCircle2 } from "lucide-react";

const activeStatuses = ["accepted", "on_the_way", "reached", "checked_in", "meeting"];

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
  const [completionVisit, setCompletionVisit] = useState<any | null>(null);
  const [completion, setCompletion] = useState({ person_met: "", outcome: "successful", completion_notes: "", next_followup_at: "" });

  const [f, setF] = useState({
    client_name: "", purpose: "", address: "",
    visit_date: new Date().toISOString().slice(0, 10),
    employee_id: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
    const profile = p as Profile;
    setMe(profile);

    const { data: v } = await supabase
      .from("field_visits")
      .select("*, profiles:employee_id(full_name)")
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setVisits(v || []);

    if (canManageTeam(profile?.role)) {
      let q = supabase.from("profiles").select("*").eq("status", "active").order("full_name");
      if (!isAdminRole(profile.role)) q = q.eq("manager_id", profile.id);
      const { data: m } = await q;
      setMembers((m as Profile[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError("");
    if (!f.client_name.trim()) return setError("Please enter the client or site name.");
    if (!me?.company_id) return;

    setSaving(true);
    const assignee = f.employee_id || me.id;
    const { error: insertError } = await supabase.from("field_visits").insert({
      company_id: me.company_id,
      employee_id: assignee,
      assigned_by: me.id,
      client_name: f.client_name.trim(),
      purpose: f.purpose,
      address: f.address,
      visit_date: f.visit_date,
      status: assignee === me.id ? "planned" : "assigned",
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);

    setOpen(false);
    setF({ client_name: "", purpose: "", address: "", visit_date: new Date().toISOString().slice(0, 10), employee_id: "" });
    load();
  };

  const updateVisit = async (id: string, patch: Record<string, unknown>) => {
    setBusyId(id);
    const { error: updateError } = await supabase.from("field_visits").update(patch).eq("id", id);
    setBusyId(null);
    if (updateError) setError(updateError.message);
    await load();
  };

  const accept = (id: string) => updateVisit(id, { status: "accepted", accepted_at: new Date().toISOString() });

  const start = async (id: string) => {
    const { lat, lng } = await getPosition();
    await updateVisit(id, {
      status: "on_the_way",
      travel_started_at: new Date().toISOString(),
      last_lat: lat,
      last_lng: lng,
      last_location_at: new Date().toISOString(),
    });
  };

  const checkIn = async (id: string) => {
    setBusyId(id);
    const { lat, lng } = await getPosition();
    await supabase.from("field_visits").update({
      status: "checked_in",
      reached_at: new Date().toISOString(),
      check_in_at: new Date().toISOString(),
      check_in_lat: lat, check_in_lng: lng,
      last_lat: lat, last_lng: lng, last_location_at: new Date().toISOString(),
    }).eq("id", id);
    setBusyId(null);
    load();
  };

  const beginMeeting = (id: string) => updateVisit(id, { status: "meeting", meeting_started_at: new Date().toISOString() });

  const completeVisit = async () => {
    if (!completionVisit) return;
    setBusyId(completionVisit.id);
    const { lat, lng } = await getPosition();
    const now = new Date().toISOString();
    const { error: completeError } = await supabase.from("field_visits").update({
      status: "completed",
      check_out_at: now,
      completed_at: now,
      check_out_lat: lat,
      check_out_lng: lng,
      last_lat: lat,
      last_lng: lng,
      last_location_at: now,
      person_met: completion.person_met,
      outcome: completion.outcome,
      completion_notes: completion.completion_notes,
      next_followup_at: completion.next_followup_at || null,
    }).eq("id", completionVisit.id);
    setBusyId(null);
    if (completeError) return setError(completeError.message);
    setCompletionVisit(null);
    setCompletion({ person_met: "", outcome: "successful", completion_notes: "", next_followup_at: "" });
    load();
  };

  const manager = canManageTeam(me?.role);
  const mapUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div>
      <PageHeader
        title="Field visits"
        subtitle="Assign visits, track travel, verify GPS and capture visit outcomes."
        action={
          <button onClick={() => setOpen(true)} className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
            <Plus className="h-4 w-4" /> New visit
          </button>
        }
      />

      {manager && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card><div className="p-4"><p className="text-xs text-slate-500">Active field staff</p><p className="mt-1 text-2xl font-semibold text-slate-900">{visits.filter((v) => activeStatuses.includes(v.status)).length}</p></div></Card>
          <Card><div className="p-4"><p className="text-xs text-slate-500">Completed today</p><p className="mt-1 text-2xl font-semibold text-slate-900">{visits.filter((v) => v.status === "completed" && v.visit_date === new Date().toISOString().slice(0,10)).length}</p></div></Card>
          <Card><div className="p-4"><p className="text-xs text-slate-500">Live GPS</p><p className="mt-1 text-sm font-semibold text-emerald-700">5-minute visit tracking enabled</p><p className="mt-1 text-[11px] text-slate-400">While the web/PWA app is active.</p></div></Card>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {visits.length === 0 ? (
            <EmptyState icon={MapPin} title="No field visits" hint="Schedule a visit and check in on location." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visits.map((v: any) => {
                const isMine = v.employee_id === me?.id;
                const busy = busyId === v.id;
                const currentLat = v.last_lat ?? v.check_in_lat;
                const currentLng = v.last_lng ?? v.check_in_lng;
                return (
                  <li key={v.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><MapPin className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{v.client_name || "Untitled visit"}</p>
                          <Badge value={v.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{v.profiles?.full_name}{v.purpose && ` · ${v.purpose}`}</p>
                        {v.address && <p className="mt-0.5 truncate text-xs text-slate-400">{v.address}</p>}
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(v.visit_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          {v.travel_started_at && ` · Travel ${fmtTime(v.travel_started_at)}`}
                          {v.check_in_at && ` · In ${fmtTime(v.check_in_at)}`}
                          {v.check_out_at && ` · Out ${fmtTime(v.check_out_at)}`}
                        </p>

                        {currentLat != null && currentLng != null && (
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            <a href={mapUrl(currentLat, currentLng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"><Navigation className="h-3 w-3" /> Current / latest location <ExternalLink className="h-3 w-3" /></a>
                            {v.last_location_at && <span className="text-slate-400">Updated {fmtTime(v.last_location_at)}</span>}
                          </div>
                        )}

                        {v.outcome && <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Outcome:</span> {String(v.outcome).replaceAll("_", " ")}{v.person_met ? ` · Met ${v.person_met}` : ""}</p>}

                        {isMine && v.status !== "completed" && v.status !== "cancelled" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {v.status === "assigned" && <button onClick={() => accept(v.id)} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Accept</button>}
                            {["planned", "accepted"].includes(v.status) && <button onClick={() => start(v.id)} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"><Route className="h-3.5 w-3.5" /> Start travel</button>}
                            {["planned", "accepted", "on_the_way", "reached"].includes(v.status) && <button onClick={() => checkIn(v.id)} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"><LogIn className="h-3.5 w-3.5" /> {busy ? "Locating…" : "Check in"}</button>}
                            {v.status === "checked_in" && <button onClick={() => beginMeeting(v.id)} disabled={busy} className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60">Start meeting</button>}
                            {["checked_in", "meeting"].includes(v.status) && <button onClick={() => setCompletionVisit(v)} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"><LogOut className="h-3.5 w-3.5" /> Complete visit</button>}
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
          <div><label className="text-sm font-medium text-slate-700">Client / site name *</label><input className={`mt-1.5 ${inputCls}`} placeholder="Acme Industries" value={f.client_name} onChange={(e) => set("client_name", e.target.value)} autoFocus /></div>
          <div><label className="text-sm font-medium text-slate-700">Purpose</label><input className={`mt-1.5 ${inputCls}`} placeholder="Client meeting / Site survey" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700">Address</label><input className={`mt-1.5 ${inputCls}`} placeholder="Sector 62, Noida" value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium text-slate-700">Date</label><input type="date" className={`mt-1.5 ${inputCls}`} value={f.visit_date} onChange={(e) => set("visit_date", e.target.value)} /></div>
            {manager && <div><label className="text-sm font-medium text-slate-700">Assign to</label><select className={`mt-1.5 ${inputCls}`} value={f.employee_id} onChange={(e) => set("employee_id", e.target.value)}><option value="">Myself</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>}
          </div>
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <button onClick={create} disabled={saving} className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-60">{saving ? "Creating…" : "Create visit"}</button>
        </div>
      </Modal>

      <Modal open={!!completionVisit} onClose={() => setCompletionVisit(null)} title="Complete field visit">
        <div className="space-y-4">
          <div><label className="text-sm font-medium text-slate-700">Person met</label><input className={`mt-1.5 ${inputCls}`} value={completion.person_met} onChange={(e) => setCompletion((p) => ({ ...p, person_met: e.target.value }))} placeholder="Mr. Rajesh Sharma" /></div>
          <div><label className="text-sm font-medium text-slate-700">Outcome</label><select className={`mt-1.5 ${inputCls}`} value={completion.outcome} onChange={(e) => setCompletion((p) => ({ ...p, outcome: e.target.value }))}><option value="successful">Successful</option><option value="follow_up_required">Follow-up required</option><option value="client_not_available">Client not available</option><option value="no_response">No response</option><option value="cancelled">Cancelled</option></select></div>
          <div><label className="text-sm font-medium text-slate-700">Visit notes</label><textarea className={`mt-1.5 min-h-24 ${inputCls}`} value={completion.completion_notes} onChange={(e) => setCompletion((p) => ({ ...p, completion_notes: e.target.value }))} placeholder="What happened in the meeting?" /></div>
          <div><label className="text-sm font-medium text-slate-700">Next follow-up</label><input type="datetime-local" className={`mt-1.5 ${inputCls}`} value={completion.next_followup_at} onChange={(e) => setCompletion((p) => ({ ...p, next_followup_at: e.target.value }))} /></div>
          <button onClick={completeVisit} disabled={!!busyId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 className="h-4 w-4" /> Save & complete</button>
        </div>
      </Modal>
    </div>
  );
}
