"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { getPosition, fmtTime } from "@/lib/geo";
import { type Profile, canManageTeam, isAdminRole } from "@/lib/types";
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle2, Clock3, ExternalLink,
  Eye, LocateFixed, MapPin, Navigation, Plus, Route, Settings2, ShieldAlert,
  Users, UserCheck, XCircle, LogIn, LogOut,
} from "lucide-react";

const activeStatuses = ["accepted", "on_the_way", "reached", "checked_in", "meeting"];
const travellingStatuses = ["accepted", "on_the_way", "reached"];
const atClientStatuses = ["checked_in", "meeting"];
const badTrackingEvents = ["location_permission_denied", "location_unavailable", "location_timeout"];

type TrackingEvent = {
  id: string;
  employee_id: string;
  visit_id: string | null;
  event_type: string;
  event_time: string;
  latitude: number | null;
  longitude: number | null;
  details?: Record<string, unknown>;
};

function ageMinutes(ts?: string | null) {
  if (!ts) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
}

function timeAgo(ts?: string | null) {
  const mins = ageMinutes(ts);
  if (!Number.isFinite(mins)) return "Never";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return new Date(ts!).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function mapEmbed(lat: number, lng: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

export default function FieldVisitsPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveVisit, setLiveVisit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [completionVisit, setCompletionVisit] = useState<any | null>(null);
  const [completion, setCompletion] = useState({ person_met: "", outcome: "successful", completion_notes: "", next_followup_at: "" });
  const [filter, setFilter] = useState("all");

  const [f, setF] = useState({
    client_name: "", purpose: "", address: "",
    visit_date: new Date().toISOString().slice(0, 10),
    employee_id: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
    const profile = p as Profile;
    setMe(profile);

    const { data: v } = await supabase
      .from("field_visits")
      .select("*, profiles:employee_id(full_name, role, designation, manager_id, field_tracking_enabled, tracking_stale_after_minutes)")
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(150);
    setVisits(v || []);

    if (canManageTeam(profile?.role)) {
      let q = supabase.from("profiles").select("*").eq("status", "active").order("full_name");
      if (!isAdminRole(profile.role)) q = q.eq("manager_id", profile.id);
      const { data: m } = await q;
      setMembers((m as Profile[]) || []);

      const { data: ev } = await supabase
        .from("tracking_events")
        .select("id, employee_id, visit_id, event_type, event_time, latitude, longitude, details")
        .order("event_time", { ascending: false })
        .limit(300);
      setEvents((ev as TrackingEvent[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!me?.company_id || !canManageTeam(me.role)) return;
    const channel = supabase
      .channel(`field-ops-${me.company_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "field_visits", filter: `company_id=eq.${me.company_id}` }, () => load(true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visit_location_history", filter: `company_id=eq.${me.company_id}` }, () => load(true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracking_events", filter: `company_id=eq.${me.company_id}` }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, me?.company_id, me?.role, supabase]);

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
    load(true);
  };

  const updateVisit = async (id: string, patch: Record<string, unknown>) => {
    setBusyId(id);
    const { error: updateError } = await supabase.from("field_visits").update(patch).eq("id", id);
    setBusyId(null);
    if (updateError) setError(updateError.message);
    await load(true);
  };

  const logAction = async (visit: any, event_type: string, lat?: number | null, lng?: number | null) => {
    if (!me?.company_id) return;
    await supabase.from("tracking_events").insert({
      company_id: me.company_id,
      visit_id: visit.id,
      employee_id: me.id,
      event_type,
      latitude: lat ?? null,
      longitude: lng ?? null,
      details: { source: "field_visit_action" },
    });
  };

  const accept = async (visit: any) => {
    await updateVisit(visit.id, { status: "accepted", accepted_at: new Date().toISOString() });
    await logAction(visit, "tracking_ready");
  };

  const start = async (visit: any) => {
    const { lat, lng } = await getPosition();
    const now = new Date().toISOString();
    await updateVisit(visit.id, { status: "on_the_way", travel_started_at: now, last_lat: lat, last_lng: lng, last_location_at: lat != null ? now : null });
    await logAction(visit, "tracking_started", lat, lng);
  };

  const checkIn = async (visit: any) => {
    setBusyId(visit.id);
    const { lat, lng } = await getPosition();
    const now = new Date().toISOString();
    await supabase.from("field_visits").update({
      status: "checked_in", reached_at: now, check_in_at: now,
      check_in_lat: lat, check_in_lng: lng, last_lat: lat, last_lng: lng, last_location_at: lat != null ? now : null,
    }).eq("id", visit.id);
    await logAction(visit, "client_check_in", lat, lng);
    setBusyId(null);
    load(true);
  };

  const beginMeeting = (visit: any) => updateVisit(visit.id, { status: "meeting", meeting_started_at: new Date().toISOString() });

  const completeVisit = async () => {
    if (!completionVisit) return;
    setBusyId(completionVisit.id);
    const { lat, lng } = await getPosition();
    const now = new Date().toISOString();
    const { error: completeError } = await supabase.from("field_visits").update({
      status: "completed", check_out_at: now, completed_at: now, check_out_lat: lat, check_out_lng: lng,
      last_lat: lat, last_lng: lng, last_location_at: lat != null ? now : completionVisit.last_location_at,
      person_met: completion.person_met, outcome: completion.outcome, completion_notes: completion.completion_notes,
      next_followup_at: completion.next_followup_at || null,
    }).eq("id", completionVisit.id);
    await logAction(completionVisit, "tracking_stopped", lat, lng);
    setBusyId(null);
    if (completeError) return setError(completeError.message);
    setCompletionVisit(null);
    setCompletion({ person_met: "", outcome: "successful", completion_notes: "", next_followup_at: "" });
    load(true);
  };

  const manager = canManageTeam(me?.role);
  const admin = isAdminRole(me?.role);
  const today = new Date().toISOString().slice(0, 10);
  const trackedMembers = members.filter((m) => m.field_tracking_enabled);

  const latestEventByEmployee = useMemo(() => {
    const map = new Map<string, TrackingEvent>();
    for (const ev of events) if (!map.has(ev.employee_id)) map.set(ev.employee_id, ev);
    return map;
  }, [events]);

  const activeByEmployee = useMemo(() => {
    const map = new Map<string, any>();
    for (const visit of visits) {
      if (activeStatuses.includes(visit.status) && !map.has(visit.employee_id)) map.set(visit.employee_id, visit);
    }
    return map;
  }, [visits]);

  const staffRows = useMemo(() => trackedMembers.map((member) => {
    const visit = activeByEmployee.get(member.id);
    const latestEvent = latestEventByEmployee.get(member.id);
    const staleAfter = Number(member.tracking_stale_after_minutes || 10);
    const mins = ageMinutes(visit?.last_location_at);
    const badEvent = latestEvent && badTrackingEvents.includes(latestEvent.event_type) && (!visit?.last_location_at || new Date(latestEvent.event_time) > new Date(visit.last_location_at));
    let health: "live" | "stale" | "off" | "idle" = "idle";
    if (badEvent) health = "off";
    else if (visit && mins <= staleAfter) health = "live";
    else if (visit) health = "stale";
    return { member, visit, latestEvent, health, mins };
  }), [activeByEmployee, latestEventByEmployee, trackedMembers]);

  const activeCount = staffRows.filter((r) => r.visit).length;
  const travellingCount = staffRows.filter((r) => r.visit && travellingStatuses.includes(r.visit.status)).length;
  const atClientCount = staffRows.filter((r) => r.visit && atClientStatuses.includes(r.visit.status)).length;
  const offCount = staffRows.filter((r) => r.health === "off").length;
  const staleCount = staffRows.filter((r) => r.health === "stale").length;
  const completedToday = visits.filter((v) => v.status === "completed" && v.visit_date === today).length;

  const filteredVisits = visits.filter((v) => filter === "all" || v.status === filter);

  const updateTracking = async (member: Profile, patch: Partial<Profile>) => {
    setBusyId(member.id);
    const { error: e } = await supabase.from("profiles").update(patch).eq("id", member.id);
    setBusyId(null);
    if (e) setError(e.message);
    else load(true);
  };

  const selectedTimeline = liveVisit ? events.filter((e) => e.employee_id === liveVisit.employee_id).slice(0, 12) : [];
  const selectedLat = liveVisit?.last_lat ?? liveVisit?.check_in_lat;
  const selectedLng = liveVisit?.last_lng ?? liveVisit?.check_in_lng;

  return (
    <div>
      <PageHeader
        title={manager ? "Field Operations" : "My Field Visits"}
        subtitle={manager ? "Live sales-team visibility, visit control, GPS health and client outcomes." : "Manage assigned visits, travel, GPS check-ins and outcomes."}
        action={<div className="flex gap-2">
          {admin && <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Settings2 className="h-4 w-4" /> Tracking setup</button>}
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"><Plus className="h-4 w-4" /> New visit</button>
        </div>}
      />

      {manager && <>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Tracked staff", trackedMembers.length, Users, "text-slate-900"],
            ["Active now", activeCount, Activity, "text-emerald-700"],
            ["Travelling", travellingCount, Navigation, "text-blue-700"],
            ["At client", atClientCount, MapPin, "text-violet-700"],
            ["GPS off / blocked", offCount, XCircle, "text-rose-700"],
            ["Location stale", staleCount, AlertTriangle, "text-amber-700"],
          ].map(([label, value, Icon, tone]: any) => <Card key={label}><div className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{label}</p><Icon className={`h-4 w-4 ${tone}`} /></div><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p></div></Card>)}
        </div>

        <Card className="mb-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Live field team</h2><p className="mt-0.5 text-xs text-slate-500">Only employees enabled by Owner/Admin are included.</p></div>
            <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">{completedToday} visits completed today</div>
          </div>
          {staffRows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No employees are enabled for field tracking. Use <b>Tracking setup</b>.</div> :
          <div className="divide-y divide-slate-100">
            {staffRows.map(({ member, visit, latestEvent, health }) => {
              const lat = visit?.last_lat ?? visit?.check_in_lat;
              const lng = visit?.last_lng ?? visit?.check_in_lng;
              const healthLabel = health === "live" ? "Live" : health === "off" ? "GPS off / blocked" : health === "stale" ? "Stale" : "No active visit";
              const healthCls = health === "live" ? "bg-emerald-50 text-emerald-700" : health === "off" ? "bg-rose-50 text-rose-700" : health === "stale" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
              return <div key={member.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_.8fr_1.4fr_auto] lg:items-center">
                <div><p className="text-sm font-semibold text-slate-900">{member.full_name}</p><p className="text-xs text-slate-500">{member.designation || member.role} · {member.employee_type || "field"}</p></div>
                <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${healthCls}`}>{healthLabel}</span>{visit && <p className="mt-1 text-xs text-slate-500 capitalize">{String(visit.status).replaceAll("_", " ")}</p>}</div>
                <div>{visit ? <><p className="text-sm font-medium text-slate-700">{visit.client_name}</p><p className="mt-0.5 text-xs text-slate-500">{lat != null && lng != null ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : "Waiting for first GPS location"}</p><p className="mt-0.5 text-[11px] text-slate-400">Last location: {timeAgo(visit.last_location_at)}{latestEvent ? ` · Last event ${String(latestEvent.event_type).replaceAll("_", " ")}` : ""}</p></> : <p className="text-xs text-slate-400">No active visit</p>}</div>
                <button disabled={!visit} onClick={() => setLiveVisit(visit)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"><Eye className="h-3.5 w-3.5" /> Live map</button>
              </div>;
            })}
          </div>}
        </Card>
      </>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {["all", "assigned", "planned", "on_the_way", "checked_in", "meeting", "completed"].map((s) => <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${filter === s ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{s.replaceAll("_", " ")}</button>)}
      </div>

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : <Card>
        {filteredVisits.length === 0 ? <EmptyState icon={MapPin} title="No field visits" hint="Schedule a visit and check in on location." /> : <ul className="divide-y divide-slate-100">{filteredVisits.map((v: any) => {
          const isMine = v.employee_id === me?.id; const busy = busyId === v.id; const currentLat = v.last_lat ?? v.check_in_lat; const currentLng = v.last_lng ?? v.check_in_lng;
          return <li key={v.id} className="px-4 py-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><MapPin className="h-4 w-4" /></div><div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-900">{v.client_name || "Untitled visit"}</p><Badge value={v.status} /></div>
            <p className="mt-0.5 text-xs text-slate-500">{v.profiles?.full_name}{v.purpose && ` · ${v.purpose}`}</p>{v.address && <p className="mt-0.5 truncate text-xs text-slate-400">{v.address}</p>}
            <p className="mt-1 text-xs text-slate-400">{new Date(v.visit_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{v.travel_started_at && ` · Travel ${fmtTime(v.travel_started_at)}`}{v.check_in_at && ` · In ${fmtTime(v.check_in_at)}`}{v.check_out_at && ` · Out ${fmtTime(v.check_out_at)}`}</p>
            {currentLat != null && currentLng != null && <div className="mt-2 flex flex-wrap gap-3 text-xs"><button onClick={() => setLiveVisit(v)} className="inline-flex items-center gap-1 font-medium text-brand-700"><LocateFixed className="h-3 w-3" /> Live / latest map</button><span className="text-slate-400">Updated {timeAgo(v.last_location_at)}</span></div>}
            {v.outcome && <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Outcome:</span> {String(v.outcome).replaceAll("_", " ")}{v.person_met ? ` · Met ${v.person_met}` : ""}</p>}
            {isMine && v.status !== "completed" && v.status !== "cancelled" && <div className="mt-3 flex flex-wrap gap-2">
              {v.status === "assigned" && <button onClick={() => accept(v)} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Accept</button>}
              {["planned", "accepted"].includes(v.status) && <button onClick={() => start(v)} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white"><Route className="h-3.5 w-3.5" /> Start travel</button>}
              {["planned", "accepted", "on_the_way", "reached"].includes(v.status) && <button onClick={() => checkIn(v)} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"><LogIn className="h-3.5 w-3.5" /> {busy ? "Locating…" : "Check in"}</button>}
              {v.status === "checked_in" && <button onClick={() => beginMeeting(v)} disabled={busy} className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700">Start meeting</button>}
              {["checked_in", "meeting"].includes(v.status) && <button onClick={() => setCompletionVisit(v)} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"><LogOut className="h-3.5 w-3.5" /> Complete visit</button>}
            </div>}
          </div></div></li>;
        })}</ul>}
      </Card>}

      <Modal open={open} onClose={() => setOpen(false)} title="New field visit"><div className="space-y-4">
        <div><label className="text-sm font-medium text-slate-700">Client / site name *</label><input className={`mt-1.5 ${inputCls}`} placeholder="Acme Industries" value={f.client_name} onChange={(e) => set("client_name", e.target.value)} autoFocus /></div>
        <div><label className="text-sm font-medium text-slate-700">Purpose</label><input className={`mt-1.5 ${inputCls}`} placeholder="Client meeting / Site survey" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} /></div>
        <div><label className="text-sm font-medium text-slate-700">Address</label><input className={`mt-1.5 ${inputCls}`} placeholder="Sector 62, Noida" value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium text-slate-700">Date</label><input type="date" className={`mt-1.5 ${inputCls}`} value={f.visit_date} onChange={(e) => set("visit_date", e.target.value)} /></div>{manager && <div><label className="text-sm font-medium text-slate-700">Assign to</label><select className={`mt-1.5 ${inputCls}`} value={f.employee_id} onChange={(e) => set("employee_id", e.target.value)}><option value="">Myself</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>}</div>
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}<button onClick={create} disabled={saving} className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white">{saving ? "Creating…" : "Create visit"}</button>
      </div></Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Field tracking setup"><div className="space-y-3">
        <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"><ShieldAlert className="mr-1 inline h-4 w-4" />Enable tracking only for employees whose job requires official field travel. Browser/PWA tracking works best while the app is active.</div>
        {members.map((m) => <div key={m.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{m.full_name}</p><p className="text-xs text-slate-500">{m.designation || m.role}</p></div><button disabled={busyId === m.id} onClick={() => updateTracking(m, { field_tracking_enabled: !m.field_tracking_enabled, employee_type: m.employee_type || "field" })} className={`relative h-7 w-12 rounded-full transition ${m.field_tracking_enabled ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${m.field_tracking_enabled ? "left-6" : "left-1"}`} /></button></div>
          {m.field_tracking_enabled && <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] text-slate-500">Employee type<select value={m.employee_type || "field"} onChange={(e) => updateTracking(m, { employee_type: e.target.value as Profile["employee_type"] })} className={`mt-1 ${inputCls}`}><option value="sales">Sales</option><option value="field">Field</option><option value="hybrid">Hybrid</option><option value="office">Office</option></select></label><label className="text-[11px] text-slate-500">Stale alert after<select value={m.tracking_stale_after_minutes || 10} onChange={(e) => updateTracking(m, { tracking_stale_after_minutes: Number(e.target.value) })} className={`mt-1 ${inputCls}`}><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label></div>}
        </div>)}
      </div></Modal>

      {liveVisit && <div className="fixed inset-0 z-[70] bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4"><div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-white sm:h-[94vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-3"><button onClick={() => setLiveVisit(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button><div><h3 className="font-semibold text-slate-900">{liveVisit.profiles?.full_name || "Employee"} · Live Tracking</h3><p className="text-xs text-slate-500">{liveVisit.client_name} · last location {timeAgo(liveVisit.last_location_at)}</p></div></div><button onClick={() => setLiveVisit(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Close</button></div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.8fr_1fr]"><div className="min-h-[48vh] bg-slate-100">{selectedLat != null && selectedLng != null ? <iframe title="Live location map" src={mapEmbed(selectedLat, selectedLng)} className="h-full min-h-[48vh] w-full border-0" loading="lazy" /> : <div className="grid h-full place-items-center p-8 text-center text-slate-500"><div><MapPin className="mx-auto mb-3 h-8 w-8" /><p>No GPS location received yet.</p></div></div>}</div>
          <div className="overflow-y-auto p-5"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Visit status</p><p className="mt-1 text-sm font-semibold capitalize">{String(liveVisit.status).replaceAll("_", " ")}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Last GPS</p><p className="mt-1 text-sm font-semibold">{timeAgo(liveVisit.last_location_at)}</p></div></div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">Current visit</p><p className="mt-2 text-sm text-slate-700">{liveVisit.client_name}</p><p className="mt-1 text-xs text-slate-500">{liveVisit.address || "No address added"}</p>{selectedLat != null && selectedLng != null && <a href={`https://www.google.com/maps?q=${selectedLat},${selectedLng}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">Open in Google Maps <ExternalLink className="h-3 w-3" /></a>}</div>
            <div className="mt-5"><p className="mb-3 text-sm font-semibold text-slate-900">Tracking timeline</p><div className="space-y-3">{selectedTimeline.length ? selectedTimeline.map((ev) => <div key={ev.id} className="flex gap-3"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${badTrackingEvents.includes(ev.event_type) ? "bg-rose-500" : "bg-emerald-500"}`} /><div><p className="text-xs font-medium capitalize text-slate-700">{ev.event_type.replaceAll("_", " ")}</p><p className="text-[11px] text-slate-400">{new Date(ev.event_time).toLocaleString("en-IN")}</p></div></div>) : <p className="text-xs text-slate-400">No tracking events yet.</p>}</div></div>
          </div></div>
      </div></div>}

      <Modal open={!!completionVisit} onClose={() => setCompletionVisit(null)} title="Complete field visit"><div className="space-y-4">
        <div><label className="text-sm font-medium text-slate-700">Person met</label><input className={`mt-1.5 ${inputCls}`} value={completion.person_met} onChange={(e) => setCompletion((p) => ({ ...p, person_met: e.target.value }))} placeholder="Mr. Rajesh Sharma" /></div>
        <div><label className="text-sm font-medium text-slate-700">Outcome</label><select className={`mt-1.5 ${inputCls}`} value={completion.outcome} onChange={(e) => setCompletion((p) => ({ ...p, outcome: e.target.value }))}><option value="successful">Successful</option><option value="follow_up_required">Follow-up required</option><option value="client_not_available">Client not available</option><option value="no_response">No response</option><option value="cancelled">Cancelled</option></select></div>
        <div><label className="text-sm font-medium text-slate-700">Visit notes</label><textarea className={`mt-1.5 min-h-24 ${inputCls}`} value={completion.completion_notes} onChange={(e) => setCompletion((p) => ({ ...p, completion_notes: e.target.value }))} placeholder="What happened in the meeting?" /></div>
        <div><label className="text-sm font-medium text-slate-700">Next follow-up</label><input type="datetime-local" className={`mt-1.5 ${inputCls}`} value={completion.next_followup_at} onChange={(e) => setCompletion((p) => ({ ...p, next_followup_at: e.target.value }))} /></div>
        <button onClick={completeVisit} disabled={!!busyId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-medium text-white"><CheckCircle2 className="h-4 w-4" /> Save & complete</button>
      </div></Modal>
    </div>
  );
}
