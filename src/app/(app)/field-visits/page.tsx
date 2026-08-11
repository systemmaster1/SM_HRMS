"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { getPosition, fmtTime } from "@/lib/geo";
import { type Profile, canManageTeam, isAdminRole } from "@/lib/types";
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle2, Clock3, ExternalLink,
  Eye, LocateFixed, MapPin, Navigation, Plus, Route, Settings2, ShieldAlert,
  Users, UserCheck, XCircle, LogIn, LogOut, Download, BarChart3, RefreshCw, Wifi, WifiOff,
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

type LiveLocation = {
  employee_id: string; company_id: string; visit_id: string | null;
  latitude: number | null; longitude: number | null; accuracy_m: number | null;
  permission_state: string; tracking_state: string; app_state: string;
  duty_status?: string; duty_started_at?: string | null; duty_ended_at?: string | null; last_state_changed_at?: string | null;
  last_seen_at: string | null; last_error: string | null; updated_at: string;
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
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [distanceToday, setDistanceToday] = useState<Record<string, number>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [visitCustomFields, setVisitCustomFields] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [nextSyncSeconds, setNextSyncSeconds] = useState(120);
  const [lastDashboardSync, setLastDashboardSync] = useState<Date | null>(null);
  const [visitSearch, setVisitSearch] = useState("");
  const [visitStatusFilter, setVisitStatusFilter] = useState("all");
  const [visitEmployeeFilter, setVisitEmployeeFilter] = useState("all");
  const [visitDateFrom, setVisitDateFrom] = useState("");
  const [visitDateTo, setVisitDateTo] = useState("");
  const [selectedVisitDetail, setSelectedVisitDetail] = useState<any>(null);

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
    client_name: "", company_name: "", contact_person: "", contact_number: "", contact_email: "",
    purpose: "", address: "",
    visit_date: new Date().toISOString().slice(0, 10),
    scheduled_at: "", target_duration_minutes: "60",
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

    const { data: customDefs } = await supabase
      .from("visit_custom_fields")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at");
    setVisitCustomFields(customDefs || []);

    const { data: v } = await supabase
      .from("field_visits")
      .select("*, profiles:employee_id(full_name, role, designation, manager_id, field_tracking_enabled, tracking_stale_after_minutes)")
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setVisits(v || []);

    const fieldScope = profile?.access_permissions?.live_tracking || profile?.access_permissions?.field_visits || "none";
    const canViewFieldTeam = canManageTeam(profile?.role) || fieldScope === "team" || fieldScope === "company";
    if (canViewFieldTeam) {
      let q = supabase.from("profiles").select("*").eq("status", "active").order("full_name");
      if (!isAdminRole(profile.role) && fieldScope !== "company") q = q.eq("field_manager_id", profile.id);
      const { data: m } = await q;
      setMembers((m as Profile[]) || []);

      await supabase.rpc("refresh_tracking_health_v7");
      const { data: ll } = await supabase
        .from("employee_live_locations")
        .select("employee_id, company_id, visit_id, latitude, longitude, accuracy_m, permission_state, tracking_state, app_state, duty_status, duty_started_at, duty_ended_at, last_state_changed_at, last_seen_at, last_error, updated_at");
      setLiveLocations((ll as LiveLocation[]) || []);
      const { data: dist } = await supabase.rpc("tracking_distance_today_v7");
      const distanceMap: Record<string, number> = {};
      for (const row of (dist || []) as any[]) distanceMap[row.employee_id] = Number(row.distance_km || 0);
      setDistanceToday(distanceMap);
    }
    setLastDashboardSync(new Date());
    setNextSyncSeconds(120);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!me?.company_id || !(canManageTeam(me.role) || ["team","company"].includes(me.access_permissions?.live_tracking || "none"))) return;
    const id = window.setInterval(() => {
      setNextSyncSeconds((prev) => {
        if (prev <= 1) {
          load(true);
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [load, me?.company_id, me?.role]);

  useEffect(() => {
    if (!me?.company_id || !(canManageTeam(me.role) || ["team","company"].includes(me.access_permissions?.live_tracking || "none"))) return;
    const channel = supabase
      .channel(`field-ops-${me.company_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "field_visits", filter: `company_id=eq.${me.company_id}` }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_live_locations", filter: `company_id=eq.${me.company_id}` }, (payload: any) => {
        const row = payload.new as LiveLocation;
        if (!row?.employee_id) return;
        setLiveLocations((prev) => {
          const next = prev.filter((x) => x.employee_id !== row.employee_id);
          return [row, ...next];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, me?.company_id, me?.role, supabase]);

  const create = async () => {
    setError("");
    if (!f.client_name.trim()) return setError("Please enter the client or site name.");
    const missingCustom = visitCustomFields.find((field: any) => {
      if (!field.is_required) return false;
      const value = customValues[field.field_key];
      return field.field_type === "checkbox" ? value !== true : value == null || String(value).trim() === "";
    });
    if (missingCustom) return setError(`${missingCustom.label} is required.`);
    if (!me?.company_id) return;
    setSaving(true);
    const assignee = f.employee_id || me.id;
    const { error: insertError } = await supabase.from("field_visits").insert({
      company_id: me.company_id,
      employee_id: assignee,
      assigned_by: me.id,
      client_name: f.client_name.trim(),
      company_name: f.company_name.trim() || null,
      contact_person: f.contact_person.trim() || null,
      contact_number: f.contact_number.trim() || null,
      contact_email: f.contact_email.trim() || null,
      purpose: f.purpose,
      address: f.address,
      custom_data: customValues,
      visit_date: f.visit_date,
      scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
      target_duration_minutes: Math.max(5, Number(f.target_duration_minutes || 60)),
      status: assignee === me.id ? "planned" : "assigned",
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setOpen(false);
    setF({ client_name: "", company_name: "", contact_person: "", contact_number: "", contact_email: "", purpose: "", address: "", visit_date: new Date().toISOString().slice(0, 10), scheduled_at: "", target_duration_minutes: "60", employee_id: "" });
    setCustomValues({});
    load(true);
  };

  const visitAction = async (visit: any, action: string, extra: Record<string, unknown> = {}) => {
    setBusyId(visit.id); setError("");
    let lat: number | null = null, lng: number | null = null;
    if (["start_travel","check_in","complete"].includes(action)) {
      const pos = await getPosition(); lat = pos.lat; lng = pos.lng;
    }
    const { error: e } = await supabase.rpc("field_visit_action_v6", {
      p_visit_id: visit.id, p_action: action, p_lat: lat, p_lng: lng,
      p_person_met: extra.person_met || null, p_outcome: extra.outcome || null,
      p_completion_notes: extra.completion_notes || null,
      p_next_followup_at: extra.next_followup_at ? new Date(String(extra.next_followup_at)).toISOString() : null,
    });
    setBusyId(null);
    if (e) { setError(e.message); return false; }
    await load(true); return true;
  };

  const accept = (visit: any) => visitAction(visit, "accept");
  const start = (visit: any) => visitAction(visit, "start_travel");
  const checkIn = (visit: any) => visitAction(visit, "check_in");
  const beginMeeting = (visit: any) => visitAction(visit, "meeting");

  const completeVisit = async () => {
    if (!completionVisit) return;
    const ok = await visitAction(completionVisit, "complete", completion);
    if (!ok) return;
    setCompletionVisit(null);
    setCompletion({ person_met: "", outcome: "successful", completion_notes: "", next_followup_at: "" });
  };

  const manager = canManageTeam(me?.role) || ["team","company"].includes(me?.access_permissions?.live_tracking || "none") || ["team","company"].includes(me?.access_permissions?.field_visits || "none");
  const admin = isAdminRole(me?.role);
  const today = new Date().toISOString().slice(0, 10);
  const trackedMembers = members.filter((m) => m.field_tracking_enabled);
  const totalDistanceToday = trackedMembers.reduce((sum, m) => sum + (distanceToday[m.id] || 0), 0);

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

  const liveByEmployee = useMemo(() => {
    const map = new Map<string, LiveLocation>();
    for (const loc of liveLocations) map.set(loc.employee_id, loc);
    return map;
  }, [liveLocations]);

  const staffRows = useMemo(() => trackedMembers.map((member) => {
    const visit = activeByEmployee.get(member.id);
    const latestEvent = latestEventByEmployee.get(member.id);
    const live = liveByEmployee.get(member.id);
    const staleAfter = Number(member.tracking_stale_after_minutes || 10);
    const lastSeen = live?.last_seen_at || visit?.last_location_at || null;
    const mins = ageMinutes(lastSeen);
    const blocked = live?.permission_state === "denied" || live?.tracking_state === "blocked";
    const badEvent = latestEvent && badTrackingEvents.includes(latestEvent.event_type) && (!lastSeen || new Date(latestEvent.event_time) > new Date(lastSeen));
    let health: "live" | "stale" | "off" | "off_duty" | "idle" = "idle";
    if (live?.duty_status === "off_duty" || live?.tracking_state === "off_duty") health = "off_duty";
    else if (blocked || badEvent) health = "off";
    else if (lastSeen && mins <= staleAfter) health = "live";
    else if (live?.duty_status === "on_duty" || lastSeen || visit) health = "stale";
    return { member, visit, latestEvent, live, health, mins, lastSeen };
  }), [activeByEmployee, latestEventByEmployee, liveByEmployee, trackedMembers]);

  const teamMapRow = selectedEmployee === "all"
    ? staffRows.find((r) =>
        (r.live?.latitude ?? r.visit?.last_lat ?? r.visit?.check_in_lat) != null &&
        (r.live?.longitude ?? r.visit?.last_lng ?? r.visit?.check_in_lng) != null
      )
    : staffRows.find((r) =>
        r.member.id === selectedEmployee &&
        (r.live?.latitude ?? r.visit?.last_lat ?? r.visit?.check_in_lat) != null &&
        (r.live?.longitude ?? r.visit?.last_lng ?? r.visit?.check_in_lng) != null
      );

  const onDutyCount = staffRows.filter((r) => r.live?.duty_status === "on_duty").length;
  const activeCount = staffRows.filter((r) => r.health === "live").length;
  const travellingCount = staffRows.filter((r) => r.visit && travellingStatuses.includes(r.visit.status)).length;
  const atClientCount = staffRows.filter((r) => r.visit && atClientStatuses.includes(r.visit.status)).length;
  const offCount = staffRows.filter((r) => r.health === "off").length;
  const staleCount = staffRows.filter((r) => r.health === "stale").length;
  const offDutyCount = staffRows.filter((r) => r.health === "off_duty").length;
  const completedToday = visits.filter((v) => v.status === "completed" && v.visit_date === today).length;

  const filteredVisits = visits.filter((v) => filter === "all" || v.status === filter);

  const updateTracking = async (member: Profile, patch: Partial<Profile>) => {
    setBusyId(member.id); setError("");
    const next = { ...member, ...patch };
    const { error: e } = await supabase.rpc("set_employee_tracking_config", {
      p_employee_id: member.id,
      p_enabled: !!next.field_tracking_enabled,
      p_employee_type: next.employee_type || "field",
      p_tracking_mode: next.tracking_mode || "active_visit",
      p_interval_minutes: Number(next.tracking_interval_minutes || 5),
      p_stale_minutes: Number(next.tracking_stale_after_minutes || 10),
      p_route_history: next.route_history_enabled !== false,
    });
    setBusyId(null);
    if (e) setError(`Tracking setup failed: ${e.message}`);
    else await load(true);
  };

  const openLiveMap = async (visitLike: any) => {
    setLiveVisit(visitLike);
    setEvents([]);
    const { data } = await supabase
      .from("tracking_events")
      .select("id, employee_id, visit_id, event_type, event_time, latitude, longitude, details")
      .eq("employee_id", visitLike.employee_id)
      .order("event_time", { ascending: false })
      .limit(50);
    setEvents((data as TrackingEvent[]) || []);
  };

  const selectedTimeline = liveVisit ? events.slice(0, 12) : [];
  const selectedLat = liveVisit?.last_lat ?? liveVisit?.check_in_lat;
  const selectedLng = liveVisit?.last_lng ?? liveVisit?.check_in_lng;

  return (
    <div>
      <PageHeader
        title={manager ? "Field Operations" : "My Field Visits"}
        subtitle={manager ? "Live sales-team visibility, visit control, GPS health and client outcomes." : "Manage assigned visits, travel, GPS check-ins and outcomes."}
        action={
          <div className="flex flex-wrap gap-2">
            {manager && (
              <>
                <Link
                  href="/field-reports"
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <BarChart3 className="h-4 w-4" />
                  Reports
                </Link>
                <Link
                  href="/route-history"
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Route className="h-4 w-4" />
                  Route history
                </Link>
                <Link
                  href="/field-visits/form-builder"
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Settings2 className="h-4 w-4" />
                  Visit form setup
                </Link>
                <button
                  onClick={() => load(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </>
            )}
            {admin && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" />
                Tracking setup
              </button>
            )}
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              New visit
            </button>
          </div>
        }
      />

      {manager && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500 shadow-sm">
          <div className="flex items-center gap-2">
            <Wifi className="h-3.5 w-3.5 text-emerald-600" />
            <span>Realtime enabled</span>
            <span className="text-slate-300">•</span>
            <span>Auto refresh in <b className="text-slate-700">{String(Math.floor(nextSyncSeconds / 60)).padStart(2,"0")}:{String(nextSyncSeconds % 60).padStart(2,"0")}</b></span>
          </div>
          <div>
            Last dashboard sync: <b className="text-slate-700">{lastDashboardSync ? lastDashboardSync.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Waiting…"}</b>
          </div>
        </div>
      )}

      {manager && <>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9">
          {[
            ["Tracked", trackedMembers.length, Users, "text-slate-900"],
            ["On duty", onDutyCount, UserCheck, "text-cyan-700"],
            ["Live GPS", activeCount, Activity, "text-emerald-700"],
            ["Travelling", travellingCount, Navigation, "text-blue-700"],
            ["At client", atClientCount, MapPin, "text-violet-700"],
            ["GPS off", offCount, XCircle, "text-rose-700"],
            ["Stale", staleCount, AlertTriangle, "text-amber-700"],
            ["Off duty", offDutyCount, LogOut, "text-slate-500"],
            ["Distance today", `${totalDistanceToday.toFixed(1)} km`, Route, "text-indigo-700"],
          ].map(([label, value, Icon, tone]: any) => <Card key={label}><div className="p-4"><div className="flex items-center justify-between"><p className="text-[11px] text-slate-500">{label}</p><Icon className={`h-4 w-4 ${tone}`} /></div><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p></div></Card>)}
        </div>

        <Card className="mb-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Live field team</h2><p className="mt-0.5 text-xs text-slate-500">Only employees enabled by Owner/Admin are included.</p></div>
            <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">{completedToday} visits completed today</div>
          </div>
          {staffRows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No employees are enabled for field tracking. Use <b>Tracking setup</b>.</div> :
          <div className="divide-y divide-slate-100">
            {staffRows.map(({ member, visit, latestEvent, live, health, lastSeen }) => {
              const lat = live?.latitude ?? visit?.last_lat ?? visit?.check_in_lat;
              const lng = live?.longitude ?? visit?.last_lng ?? visit?.check_in_lng;
              const healthLabel = health === "live" ? "Live" : health === "off" ? "GPS off / blocked" : health === "stale" ? "Stale" : health === "off_duty" ? "Employee Off Duty" : "Waiting";
              const healthCls = health === "live" ? "bg-emerald-50 text-emerald-700" : health === "off" ? "bg-rose-50 text-rose-700" : health === "stale" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
              return <div key={member.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_.8fr_1.4fr_auto] lg:items-center">
                <div><p className="text-sm font-semibold text-slate-900">{member.full_name}</p><p className="text-xs text-slate-500">{member.designation || member.role} · {member.employee_type || "field"}</p><p className="mt-1 text-[11px] font-semibold text-indigo-600">Today: {(distanceToday[member.id] || 0).toFixed(1)} km</p></div>
                <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${healthCls}`}>{healthLabel}</span>{visit && <p className="mt-1 text-xs text-slate-500 capitalize">{String(visit.status).replaceAll("_", " ")}</p>}</div>
                <div>{visit ? <><p className="text-sm font-medium text-slate-700">{visit.client_name}</p><p className="mt-0.5 text-xs text-slate-500">{lat != null && lng != null ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : "Waiting for first GPS location"}</p><p className="mt-0.5 text-[11px] text-slate-400">Last location: {timeAgo(lastSeen)}{latestEvent ? ` · Last event ${String(latestEvent.event_type).replaceAll("_", " ")}` : ""}</p></> : <p className="text-xs text-slate-400">No active visit</p>}</div>
                <button disabled={lat == null || lng == null} onClick={() => openLiveMap({ ...(visit || {}), employee_id: member.id, profiles: { full_name: member.full_name }, client_name: visit?.client_name || "No active visit", status: visit?.status || live?.tracking_state || "idle", last_lat: lat, last_lng: lng, last_location_at: lastSeen })} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"><Eye className="h-3.5 w-3.5" /> Live map</button>
              </div>;
            })}
          </div>}
        </Card>

        <Card className="mb-5 overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1fr_1.6fr]">
            <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
              <h2 className="font-semibold text-slate-900">Location health monitor</h2>
              <p className="mt-1 text-xs text-slate-500">Permission, last GPS and app status for employees enabled in Tracking setup.</p>
              <div className="mt-4 space-y-2">
                {staffRows.slice(0, 8).map(({ member, live, health, lastSeen }) => <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                  <div><p className="text-sm font-medium text-slate-800">{member.full_name}</p><p className="text-[11px] text-slate-400">{live?.permission_state || "permission unknown"} · {timeAgo(lastSeen)}</p></div>
                  <div className="flex items-center gap-2">{health === "live" ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className={`h-4 w-4 ${health === "off" ? "text-rose-600" : "text-amber-600"}`} />}<span className="text-[11px] capitalize text-slate-500">{health}</span></div>
                </div>)}
                {!staffRows.length && <p className="py-6 text-center text-xs text-slate-400">Enable a sales/field employee to start monitoring.</p>}
              </div>
            </div>
            <div className="min-h-[300px] bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Live map</h2><p className="mt-1 text-xs text-slate-500">Employee-wise or combined monitoring · dashboard auto-syncs every 2 min.</p></div><div className="flex items-center gap-2"><select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600"><option value="all">All tracked employees</option>{trackedMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {(distanceToday[m.id] || 0).toFixed(1)} km</option>)}</select><button onClick={() => load(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button></div></div>
              <div className="mt-4 min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white">{teamMapRow ? (() => { const lat = teamMapRow.live?.latitude ?? teamMapRow.visit?.last_lat ?? teamMapRow.visit?.check_in_lat; const lng = teamMapRow.live?.longitude ?? teamMapRow.visit?.last_lng ?? teamMapRow.visit?.check_in_lng; return <div className="relative h-[260px]"><iframe title="Team live map" src={mapEmbed(Number(lat), Number(lng))} className="h-full w-full border-0" loading="lazy" /><div className="absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 shadow-lg backdrop-blur"><p className="text-xs font-semibold text-slate-900">{teamMapRow.member.full_name}</p><p className="text-[11px] text-slate-500">{teamMapRow.visit?.client_name || "Latest employee location"} · {timeAgo(teamMapRow.lastSeen)}</p></div></div>; })() : <div className="grid h-[260px] place-items-center p-8 text-center"><div><LocateFixed className="mx-auto h-9 w-9 text-brand-600" /><p className="mt-3 text-sm font-semibold text-slate-800">Waiting for first GPS</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Enable tracking and ask the employee to open HRMS and allow Location permission. The latest map appears automatically.</p></div></div>}</div>
            </div>
          </div>
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
            <p className="mt-0.5 text-xs text-slate-500">{v.profiles?.full_name}{v.purpose && ` · ${v.purpose}`}</p>
            {(v.company_name || v.contact_person || v.contact_number || v.contact_email) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {v.company_name && <span><b>Company:</b> {v.company_name}</span>}
                {v.contact_person && <span><b>Contact:</b> {v.contact_person}</span>}
                {v.contact_number && <span><b>Phone:</b> {v.contact_number}</span>}
                {v.contact_email && <span><b>Email:</b> {v.contact_email}</span>}
              </div>
            )}
            {v.custom_data && Object.keys(v.custom_data).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(v.custom_data).slice(0,6).map(([key,value]: any) => {
                  const def = visitCustomFields.find((x:any)=>x.field_key===key);
                  return <span key={key} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600"><b>{def?.label || key.replaceAll("_"," ")}:</b> {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</span>;
                })}
              </div>
            )}
            {v.address && <p className="mt-0.5 truncate text-xs text-slate-400">{v.address}</p>}
            <div className="mt-3">
              <button
                onClick={() => setSelectedVisitDetail(v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-200 hover:text-brand-700"
              >
                <Eye className="h-3.5 w-3.5" />
                Visit details
              </button>
            </div>
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

      
      <Modal
        open={!!selectedVisitDetail}
        onClose={() => setSelectedVisitDetail(null)}
        title="Visit details"
      >
        {selectedVisitDetail && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Client / Site</p>
                  <h3 className="mt-1 text-xl font-bold">{selectedVisitDetail.client_name || "—"}</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {selectedVisitDetail.company_name || "No company name"}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold capitalize">
                  {String(selectedVisitDetail.status || "unknown").replaceAll("_"," ")}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Employee", selectedVisitDetail.profiles?.full_name],
                ["Visit Date", selectedVisitDetail.visit_date],
                ["Contact Person", selectedVisitDetail.contact_person],
                ["Contact Number", selectedVisitDetail.contact_number],
                ["Email", selectedVisitDetail.contact_email],
                ["Purpose", selectedVisitDetail.purpose],
                ["Address", selectedVisitDetail.address],
                ["Outcome", selectedVisitDetail.outcome],
                ["Next Action", selectedVisitDetail.next_action],
                ["Remarks", selectedVisitDetail.remarks],
              ].map(([label,value]: any) => (
                <div key={label} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">{value || "—"}</div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-800">Visit timeline</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["Scheduled", selectedVisitDetail.scheduled_at],
                  ["Travel Started", selectedVisitDetail.travel_started_at],
                  ["Checked In", selectedVisitDetail.check_in_at || selectedVisitDetail.check_in],
                  ["Meeting Started", selectedVisitDetail.meeting_started_at],
                  ["Completed", selectedVisitDetail.completed_at],
                  ["Checked Out", selectedVisitDetail.check_out_at || selectedVisitDetail.check_out],
                  ["Next Follow-up", selectedVisitDetail.next_follow_up_at],
                ].map(([label,value]: any) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {value ? new Date(value).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedVisitDetail.custom_data && Object.keys(selectedVisitDetail.custom_data).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Additional visit information</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(selectedVisitDetail.custom_data).map(([key,value]: any) => {
                    const def = visitCustomFields.find((x:any)=>x.field_key===key);
                    return (
                      <div key={key} className="rounded-xl border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">
                          {def?.label || key.replaceAll("_"," ")}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-800">
                          {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(selectedVisitDetail.last_lat || selectedVisitDetail.check_in_lat) && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedVisitDetail.last_lat || selectedVisitDetail.check_in_lat},${selectedVisitDetail.last_lng || selectedVisitDetail.check_in_lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <MapPin className="h-4 w-4" />
                Open visit location
              </a>
            )}
          </div>
        )}
      </Modal>

<Modal open={open} onClose={() => setOpen(false)} title="New field visit"><div className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          Visit form fields can be managed by Admin/Manager from <b>Visit form setup</b>.
        </div>
        <div><label className="text-sm font-medium text-slate-700">Client / site name *</label><input className={`mt-1.5 ${inputCls}`} placeholder="Client / Site" value={f.client_name} onChange={(e) => set("client_name", e.target.value)} autoFocus /></div>
        <div><label className="text-sm font-medium text-slate-700">Company name</label><input className={`mt-1.5 ${inputCls}`} placeholder="ABC Industries Pvt Ltd" value={f.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-sm font-medium text-slate-700">Contact person</label><input className={`mt-1.5 ${inputCls}`} placeholder="Mr. Sharma" value={f.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700">Contact number</label><input type="tel" className={`mt-1.5 ${inputCls}`} placeholder="9876543210" value={f.contact_number} onChange={(e) => set("contact_number", e.target.value)} /></div>
        </div>
        <div><label className="text-sm font-medium text-slate-700">Email</label><input type="email" className={`mt-1.5 ${inputCls}`} placeholder="contact@company.com" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></div>
        <div><label className="text-sm font-medium text-slate-700">Purpose</label><input className={`mt-1.5 ${inputCls}`} placeholder="Client meeting / Site survey" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} /></div>
        <div><label className="text-sm font-medium text-slate-700">Address</label><input className={`mt-1.5 ${inputCls}`} placeholder="Sector 62, Noida" value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="text-sm font-medium text-slate-700">Visit date</label><input type="date" className={`mt-1.5 ${inputCls}`} value={f.visit_date} onChange={(e) => set("visit_date", e.target.value)} /></div><div><label className="text-sm font-medium text-slate-700">Scheduled start</label><input type="datetime-local" className={`mt-1.5 ${inputCls}`} value={f.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} /></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="text-sm font-medium text-slate-700">Target duration</label><select className={`mt-1.5 ${inputCls}`} value={f.target_duration_minutes} onChange={(e) => set("target_duration_minutes", e.target.value)}><option value="30">30 min</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option></select></div>{manager && <div><label className="text-sm font-medium text-slate-700">Assign to</label><select className={`mt-1.5 ${inputCls}`} value={f.employee_id} onChange={(e) => set("employee_id", e.target.value)}><option value="">Myself</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>}</div>

        {visitCustomFields.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Additional visit information</p>
              <p className="mt-0.5 text-xs text-slate-500">Company-specific fields configured by Admin/Manager.</p>
            </div>
            {visitCustomFields.map((field: any) => {
              const value = customValues[field.field_key];
              const setCustom = (v: any) => setCustomValues((prev) => ({ ...prev, [field.field_key]: v }));
              const label = <label className="text-sm font-medium text-slate-700">{field.label}{field.is_required ? " *" : ""}</label>;

              if (field.field_type === "textarea") return <div key={field.id}>{label}<textarea rows={3} className={`mt-1.5 ${inputCls}`} placeholder={field.placeholder || ""} value={value || ""} onChange={(e)=>setCustom(e.target.value)} /></div>;
              if (field.field_type === "select") return <div key={field.id}>{label}<select className={`mt-1.5 ${inputCls}`} value={value || ""} onChange={(e)=>setCustom(e.target.value)}><option value="">Select</option>{(field.options || []).map((opt:string)=><option key={opt} value={opt}>{opt}</option>)}</select></div>;
              if (field.field_type === "checkbox") return <label key={field.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={value === true} onChange={(e)=>setCustom(e.target.checked)} />{field.label}{field.is_required ? " *" : ""}</label>;

              const htmlType =
                field.field_type === "number" ? "number" :
                field.field_type === "email" ? "email" :
                field.field_type === "phone" ? "tel" :
                field.field_type === "date" ? "date" :
                field.field_type === "datetime" ? "datetime-local" : "text";

              return <div key={field.id}>{label}<input type={htmlType} className={`mt-1.5 ${inputCls}`} placeholder={field.placeholder || ""} value={value || ""} onChange={(e)=>setCustom(e.target.value)} /></div>;
            })}
          </div>
        )}

                {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}<button onClick={create} disabled={saving} className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white">{saving ? "Creating…" : "Create visit"}</button>
      </div></Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Field tracking setup"><div className="space-y-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800"><ShieldAlert className="mr-1 inline h-4 w-4" /><b>Duty-only privacy control:</b> location tracking can run only after Attendance IN and automatically stops after Attendance OUT. All tracking/audit timestamps come from the server, not the employee device clock.</div>
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {members.map((m) => <div key={m.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{m.full_name}</p><p className="text-xs text-slate-500">{m.designation || m.role}</p></div><button disabled={busyId === m.id} onClick={() => updateTracking(m, { field_tracking_enabled: !m.field_tracking_enabled, employee_type: m.employee_type || "field", tracking_mode: m.tracking_mode || "working_hours" })} className={`relative h-7 w-12 rounded-full transition ${m.field_tracking_enabled ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${m.field_tracking_enabled ? "left-6" : "left-1"}`} /></button></div>
          {m.field_tracking_enabled && <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-slate-500">Employee type<select value={m.employee_type || "field"} onChange={(e) => updateTracking(m, { employee_type: e.target.value as Profile["employee_type"] })} className={`mt-1 ${inputCls}`}><option value="sales">Sales</option><option value="field">Field</option><option value="hybrid">Hybrid</option><option value="office">Office</option></select></label><label className="text-[11px] text-slate-500">Tracking mode<select value={m.tracking_mode || "active_visit"} onChange={(e) => updateTracking(m, { tracking_mode: e.target.value as Profile["tracking_mode"] })} className={`mt-1 ${inputCls}`}><option value="working_hours">Duty time (Attendance IN → OUT) · Recommended</option><option value="active_visit">Active visit only (still duty-time bounded)</option></select></label><label className="text-[11px] text-slate-500">GPS interval<select value={m.tracking_interval_minutes || 5} onChange={(e) => updateTracking(m, { tracking_interval_minutes: Number(e.target.value) })} className={`mt-1 ${inputCls}`}><option value="2">2 min</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label><label className="text-[11px] text-slate-500">Stale alert after<select value={m.tracking_stale_after_minutes || 10} onChange={(e) => updateTracking(m, { tracking_stale_after_minutes: Number(e.target.value) })} className={`mt-1 ${inputCls}`}><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label></div>}
        </div>)}
      </div></Modal>

      {liveVisit && <div className="fixed inset-0 z-[70] bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4"><div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-white sm:h-[94vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-3"><button onClick={() => setLiveVisit(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button><div><h3 className="font-semibold text-slate-900">{liveVisit.profiles?.full_name || "Employee"} · Live Tracking</h3><p className="text-xs text-slate-500">{liveVisit.client_name} · last location {timeAgo(liveVisit.last_location_at)}</p></div></div><button onClick={() => setLiveVisit(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Close</button></div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.8fr_1fr]"><div className="min-h-[48vh] bg-slate-100">{selectedLat != null && selectedLng != null ? <iframe title="Live location map" src={mapEmbed(selectedLat, selectedLng)} className="h-full min-h-[48vh] w-full border-0" loading="lazy" /> : <div className="grid h-full place-items-center p-8 text-center text-slate-500"><div><MapPin className="mx-auto mb-3 h-8 w-8" /><p>No GPS location received yet.</p></div></div>}</div>
          <div className="overflow-y-auto p-5"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Visit status</p><p className="mt-1 text-sm font-semibold capitalize">{String(liveVisit.status).replaceAll("_", " ")}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Last GPS</p><p className="mt-1 text-sm font-semibold">{timeAgo(liveVisit.last_location_at)}</p></div></div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">Current visit</p><p className="mt-2 text-sm text-slate-700">{liveVisit.client_name}</p><p className="mt-1 text-xs text-slate-500">{liveVisit.address || "No address added"}</p>{selectedLat != null && selectedLng != null && <a href={`https://www.google.com/maps?q=${selectedLat},${selectedLng}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">Open in Google Maps <ExternalLink className="h-3 w-3" /></a>}</div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><b>Privacy:</b> tracking is duty-only. After Attendance OUT, the employee is shown as <b>Off Duty</b> and no new GPS coordinates are stored.</div>
            <div className="mt-5"><p className="mb-3 text-sm font-semibold text-slate-900">Tracking timeline</p><div className="space-y-3">{selectedTimeline.length ? selectedTimeline.map((ev) => <div key={ev.id} className="flex gap-3"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${badTrackingEvents.includes(ev.event_type) ? "bg-rose-500" : "bg-emerald-500"}`} /><div><p className="text-xs font-medium capitalize text-slate-700">{ev.event_type.replaceAll("_", " ")}</p><p className="text-[11px] text-slate-400">{new Date(ev.event_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Server time{ev.details?.time_source === "server_derived" ? " · inferred" : ""}</p></div></div>) : <p className="text-xs text-slate-400">No tracking events yet.</p>}</div></div>
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
