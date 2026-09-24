"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { PageHeader, Card, Modal, EmptyState, inputCls } from "@/components/ui";
import { todayYMD, addDaysYMD, monthRangeYMD } from "@/lib/date";
import { type Profile, isAdminRole, canManageTeam } from "@/lib/types";
import {
  analyseDay, visitLatLng, visitState, STATE_LABEL, visitMinutes, arrivalDelayMinutes,
  visitArrival, fmtMins, fmtClock,
} from "@/lib/tracking";
import { downloadVisitLogPdf, type DaySummary } from "@/lib/visit-pdf";
import { useFeature } from "@/lib/features/client";
import type { LivePin, VisitPin } from "@/components/TrackingMap";
import {
  Radar, Route as RouteIcon, MapPin, Clock, PauseCircle, WifiOff, FileDown, RefreshCw,
  ChevronLeft, ChevronRight, Navigation, CheckCircle2, Timer, Users, ArrowLeft,
} from "lucide-react";
import { PageLoader } from "@/components/ui";

const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
  ssr: false,
  loading: () => <div className="grid h-[360px] place-items-center rounded-xl bg-slate-100 text-sm text-slate-400 dark:bg-slate-800">Loading map…</div>,
});

const dayStart = (d: string) => `${d}T00:00:00+05:30`;
const dayEnd = (d: string) => `${addDaysYMD(d, 1)}T00:00:00+05:30`;
const minsAgo = (ts?: string | null) => (ts ? Math.round((Date.now() - new Date(ts).getTime()) / 60000) : null);
const agoLabel = (m: number | null) =>
  m == null ? "never" : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;

const STATE_CHIP: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  missed: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400",
};

export default function TrackingPage() {
  const supabase = createClient();
  // Visits-only organizations (no GPS module) still get visits, timeline and PDF.
  const trackingOn = useFeature("field.tracking");
  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [kmToday, setKmToday] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [emp, setEmp] = useState<string>("");
  const [date, setDate] = useState(todayYMD());
  const [dayRows, setDayRows] = useState<any[]>([]);
  const [dayVisits, setDayVisits] = useState<any[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfFrom, setPdfFrom] = useState(monthRangeYMD(0).from);
  const [pdfTo, setPdfTo] = useState(todayYMD());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const manager = !!me && (canManageTeam(me.role) ||
    ["team", "company"].includes(String(me.access_permissions?.live_tracking || me.access_permissions?.field_visits || "")));

  /* ---------- Who can I see ---------- */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
      const profile = p as Profile;
      setMe(profile);

      const { data: c } = await supabase.from("companies")
        .select("name, logo_url, address, city").eq("id", profile.company_id).single();
      setCompany(c);

      const isMgr = canManageTeam(profile.role) ||
        ["team", "company"].includes(String(profile.access_permissions?.live_tracking || profile.access_permissions?.field_visits || ""));
      let list: Profile[] = [profile];
      if (isMgr) {
        let q = supabase.from("profiles").select("*").eq("status", "active").eq("field_tracking_enabled", true).order("full_name");
        const scope = String(profile.access_permissions?.live_tracking || profile.access_permissions?.field_visits || "");
        if (!isAdminRole(profile.role) && scope !== "company") {
          q = q.or(`field_manager_id.eq.${profile.id},manager_id.eq.${profile.id}`);
        }
        const { data: m } = await q;
        list = (m as Profile[]) || [];
        if (profile.field_tracking_enabled && !list.some((x) => x.id === profile.id)) list = [profile, ...list];
      }
      setPeople(list);
      setEmp(list[0]?.id || profile.id);
      setReady(true);
    })();
  }, [supabase]);

  /* ---------- Live positions + today's km ---------- */
  const loadLive = useCallback(async () => {
    if (!manager || !trackingOn || people.length === 0) return;
    setLiveLoading(true);
    const ids = people.map((p) => p.id);
    const [{ data: ll }, hist] = await Promise.all([
      supabase.from("employee_live_locations").select("*").in("employee_id", ids),
      fetchAll((from, to) => supabase.from("employee_location_history")
        .select("employee_id, latitude, longitude, accuracy_m, captured_at")
        .in("employee_id", ids)
        .gte("captured_at", dayStart(todayYMD())).lt("captured_at", dayEnd(todayYMD()))
        .order("captured_at").order("id").range(from, to)).catch(() => [] as any[]),
    ]);
    setLive(ll || []);
    const byEmp: Record<string, any[]> = {};
    hist.forEach((r: any) => { (byEmp[r.employee_id] ||= []).push(r); });
    const km: Record<string, number> = {};
    Object.entries(byEmp).forEach(([id, rows]) => { km[id] = analyseDay(rows).km; });
    setKmToday(km);
    setLastSync(new Date());
    setLiveLoading(false);
  }, [supabase, manager, people, trackingOn]);

  useEffect(() => {
    if (!ready) return;
    loadLive();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") loadLive(); }, 60_000);
    return () => window.clearInterval(t);
  }, [ready, loadLive]);

  const liveRows = useMemo(() => people.map((p) => {
    const l = live.find((x) => x.employee_id === p.id);
    const ago = minsAgo(l?.last_seen_at);
    const staleAfter = Number(p.tracking_stale_after_minutes || 10);
    const offDuty = l?.duty_status === "off_duty";
    const state: LivePin["state"] = offDuty || ago == null || ago > 60 ? "offline" : ago > staleAfter ? "stale" : "live";
    const status = offDuty ? "Off duty"
      : l?.tracking_state === "at_client" || l?.tracking_state === "meeting" ? "At client"
      : l?.tracking_state === "travelling" || l?.tracking_state === "on_the_way" ? "Travelling"
      : state === "live" ? "Live" : state === "stale" ? "Signal weak" : "Offline";
    return { p, l, ago, state, status, km: kmToday[p.id] || 0 };
  }), [people, live, kmToday]);

  const livePins: LivePin[] = useMemo(() => liveRows
    .filter((r) => r.l && Number.isFinite(Number(r.l.latitude)) && r.l.latitude != null)
    .map((r) => ({
      id: r.p.id, name: r.p.full_name || "Employee",
      lat: Number(r.l.latitude), lng: Number(r.l.longitude), state: r.state,
      detail: `${r.status} · ${agoLabel(r.ago)} · ${r.km.toFixed(1)} km today`,
    })), [liveRows]);

  /* ---------- Day review ---------- */
  const loadDay = useCallback(async () => {
    if (!emp) return;
    setDayLoading(true);
    const [hist, { data: v }] = await Promise.all([
      !trackingOn ? Promise.resolve([] as any[]) : fetchAll((from, to) => supabase.from("employee_location_history")
        .select("latitude, longitude, accuracy_m, captured_at")
        .eq("employee_id", emp)
        .gte("captured_at", dayStart(date)).lt("captured_at", dayEnd(date))
        .order("captured_at").order("id").range(from, to)).catch(() => [] as any[]),
      supabase.from("field_visits").select("*")
        .eq("employee_id", emp).eq("visit_date", date)
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
    ]);
    setDayRows(hist);
    setDayVisits(v || []);
    setDayLoading(false);
  }, [supabase, emp, date, trackingOn]);

  useEffect(() => { if (ready) loadDay(); }, [ready, loadDay]);

  const day = useMemo(() => analyseDay(dayRows), [dayRows]);

  const visitPins: VisitPin[] = useMemo(() => dayVisits
    .map((v, i) => ({ v, i, pos: visitLatLng(v) }))
    .filter((x) => x.pos)
    .map(({ v, i, pos }) => ({
      n: i + 1, lat: pos!.lat, lng: pos!.lng, state: visitState(v),
      title: v.client_name || "Client visit",
      detail: `${STATE_LABEL[visitState(v)]} · planned ${fmtClock(v.scheduled_at)} · reached ${fmtClock(visitArrival(v))}`,
    })), [dayVisits]);

  const done = dayVisits.filter((v) => visitState(v) === "completed").length;
  const delays = dayVisits.map(arrivalDelayMinutes).filter((d): d is number => d != null);
  const onTimePct = delays.length ? Math.round((delays.filter((d) => d <= 15).length / delays.length) * 100) : null;

  /** Everything that happened, in order. */
  const timeline = useMemo(() => {
    const items: { at: number; title: string; sub?: string; tone: string }[] = [];
    if (day.first) items.push({ at: day.first, title: "First GPS position", sub: "Tracking started", tone: "bg-teal-500" });
    dayVisits.forEach((v, i) => {
      const name = `#${i + 1} ${v.client_name || "Client visit"}`;
      const push = (ts: any, what: string, tone: string, sub?: string) => {
        if (ts) items.push({ at: new Date(ts).getTime(), title: `${what} · ${name}`, sub, tone });
      };
      push(v.travel_started_at, "Travel started", "bg-blue-500");
      const delay = arrivalDelayMinutes(v);
      push(visitArrival(v), "Reached", "bg-indigo-500",
        delay == null ? undefined : delay > 0 ? `${delay} min after planned time` : delay < 0 ? `${-delay} min early` : "On time");
      push(v.meeting_started_at, "Meeting started", "bg-violet-500");
      push(v.completed_at, "Completed", "bg-emerald-500",
        [v.outcome && String(v.outcome).replace(/_/g, " "), visitMinutes(v) != null && `${fmtMins(visitMinutes(v))} at client`]
          .filter(Boolean).join(" · ") || undefined);
    });
    day.stops.forEach((s) => items.push({
      at: s.from, title: `Stopped for ${fmtMins(s.minutes)}`, sub: `${fmtClock(s.from)} – ${fmtClock(s.to)}`, tone: "bg-amber-500",
    }));
    day.gaps.forEach((g) => items.push({
      at: g.from, title: `No GPS for ${fmtMins(g.minutes)}`, sub: `${fmtClock(g.from)} – ${fmtClock(g.to)} · phone off, no signal or tracking stopped`, tone: "bg-rose-500",
    }));
    if (day.last && day.last !== day.first) items.push({ at: day.last, title: "Last GPS position", tone: "bg-purple-500" });
    return items.sort((a, b) => a.at - b.at);
  }, [day, dayVisits]);

  /* ---------- PDF ---------- */
  const person = people.find((p) => p.id === emp) || me;

  const makePdf = async () => {
    setPdfError("");
    if (pdfFrom > pdfTo) return setPdfError("The start date must be before the end date.");
    const span = (new Date(pdfTo).getTime() - new Date(pdfFrom).getTime()) / 86400000;
    if (span > 92) return setPdfError("Please choose up to 3 months at a time.");
    setPdfBusy(true);
    try {
      const [visits, hist] = await Promise.all([
        fetchAll((from, to) => supabase.from("field_visits").select("*")
          .eq("employee_id", emp).gte("visit_date", pdfFrom).lte("visit_date", pdfTo)
          .order("visit_date").order("id").range(from, to)),
        !trackingOn ? Promise.resolve([] as any[]) : fetchAll((from, to) => supabase.from("employee_location_history")
          .select("latitude, longitude, accuracy_m, captured_at")
          .eq("employee_id", emp)
          .gte("captured_at", dayStart(pdfFrom)).lt("captured_at", dayEnd(pdfTo))
          .order("captured_at").order("id").range(from, to)).catch(() => [] as any[]),
      ]);
      const byDay: Record<string, any[]> = {};
      hist.forEach((r: any) => {
        const d = new Date(r.captured_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        (byDay[d] ||= []).push(r);
      });
      const dates = Array.from(new Set([...Object.keys(byDay), ...visits.map((v: any) => v.visit_date)])).sort();
      const days: DaySummary[] = dates.map((d) => {
        const a = analyseDay(byDay[d] || []);
        return {
          date: d, km: a.km, first: a.first, last: a.last, fieldMinutes: a.fieldMinutes,
          stops: a.stops.length, gaps: a.gaps.length, gapMinutes: a.gaps.reduce((s, g) => s + g.minutes, 0),
        };
      });
      await downloadVisitLogPdf({
        company: company || {}, employee: person || {}, from: pdfFrom, to: pdfTo,
        visits, days, generatedBy: me?.full_name,
      });
      setPdfOpen(false);
    } catch (e: any) {
      setPdfError(e?.message || "Could not create the PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  if (!ready) return <PageLoader />;

  const liveCount = liveRows.filter((r) => r.state === "live").length;
  const staleCount = liveRows.filter((r) => r.state === "stale").length;
  const offCount = liveRows.filter((r) => r.state === "offline").length;
  const teamKm = liveRows.reduce((a, r) => a + r.km, 0);

  return (
    <div>
      <PageHeader
        title={manager ? "Field tracking" : "My day"}
        subtitle={manager
          ? "Where your field team is now, the route each person took, distance travelled and every client visit."
          : "Your route, distance and visits for any day, plus a downloadable visit log."}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/field-visits"
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50">
              <ArrowLeft className="h-4 w-4" /> Field visits
            </Link>
            <button onClick={() => { setPdfError(""); setPdfOpen(true); }} disabled={!emp}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
              <FileDown className="h-4 w-4" /> Visit log PDF
            </button>
          </div>
        }
      />

      {/* ================= LIVE (managers) ================= */}
      {manager && trackingOn && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Radar className="h-4 w-4 text-emerald-600" /> Live now
              </h2>
              <p className="text-xs text-slate-500">
                Refreshes every minute{lastSync ? ` · last update ${fmtClock(lastSync.getTime())}` : ""}. Tap a person to review their day.
              </p>
            </div>
            <button onClick={loadLive}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50">
              <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Field staff", String(people.length), Users, "text-slate-900 dark:text-slate-100"],
              ["Live", String(liveCount), Radar, "text-emerald-600"],
              ["Weak signal", String(staleCount), Clock, "text-amber-600"],
              ["Offline / off duty", String(offCount), WifiOff, "text-slate-500"],
              ["Team distance today", `${teamKm.toFixed(1)} km`, RouteIcon, "text-brand-700 dark:text-brand-300"],
            ].map(([label, value, Icon, tone]: any) => (
              <Card key={label}>
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <Icon className={`h-4 w-4 ${tone}`} />
                  </div>
                  <p className={`mt-1.5 text-xl font-semibold ${tone}`}>{value}</p>
                </div>
              </Card>
            ))}
          </div>

          {people.length === 0 ? (
            <Card>
              <EmptyState icon={Users} title="No field staff to show"
                hint="Turn on field tracking for employees in Team → Edit employee → Own Field Tracking." />
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <TrackingMap live={livePins} onSelect={(id) => { setEmp(id); setDate(todayYMD()); }}
                className="h-[320px] sm:h-[420px]" />
              <Card className="max-h-[420px] overflow-hidden">
                <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                  {liveRows.map((r) => (
                    <li key={r.p.id}>
                      <button onClick={() => { setEmp(r.p.id); setDate(todayYMD()); }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/40 ${emp === r.p.id ? "bg-brand-50/60 dark:bg-brand-500/10" : ""}`}>
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.state === "live" ? "bg-emerald-500" : r.state === "stale" ? "bg-amber-500" : "bg-slate-300"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.p.full_name}</span>
                          <span className="block truncate text-xs text-slate-500">{r.status} · {agoLabel(r.ago)}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {r.km.toFixed(1)} km
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </section>
      )}

      {/* ================= DAY REVIEW ================= */}
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <RouteIcon className="h-4 w-4 text-brand-700 dark:text-brand-300" /> Day review
            </h2>
            <p className="text-xs text-slate-500">Route on the map, distance, stops, GPS gaps and every visit, planned vs actual.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {people.length > 1 && (
              <select className={`${inputCls} sm:w-56`} value={emp} onChange={(e) => setEmp(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setDate(addDaysYMD(date, -1))} aria-label="Previous day"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input type="date" className={`${inputCls} sm:w-44`} value={date} max={todayYMD()}
                onChange={(e) => e.target.value && setDate(e.target.value)} />
              <button onClick={() => setDate(addDaysYMD(date, 1))} aria-label="Next day" disabled={date >= todayYMD()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Distance", `${day.km.toFixed(1)} km`, Navigation],
            ["Visits done", `${done} / ${dayVisits.length}`, CheckCircle2],
            ["On-time arrival", onTimePct == null ? "—" : `${onTimePct}%`, Timer],
            ["Time in field", fmtMins(day.fieldMinutes || null), Clock],
            ["Stops (10+ min)", String(day.stops.length), PauseCircle],
            ["GPS gaps", day.gaps.length ? `${day.gaps.length} · ${fmtMins(day.gaps.reduce((a, g) => a + g.minutes, 0))}` : "None", WifiOff],
          ].map(([label, value, Icon]: any) => (
            <Card key={label}>
              <div className="p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">{label}</p>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className={`mt-1.5 text-lg font-semibold ${label === "GPS gaps" && day.gaps.length ? "text-rose-600" : "text-slate-900 dark:text-slate-100"}`}>
                  {dayLoading ? "…" : value}
                </p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div>
            {!trackingOn ? (
              <Card>
                <EmptyState icon={MapPin} title="GPS tracking is not part of your plan"
                  hint="Visits, timings and the PDF visit log work without it. Add Field Tracking to see routes and distance." />
              </Card>
            ) : !dayLoading && day.track.length === 0 && visitPins.length === 0 ? (
              <Card>
                <EmptyState icon={MapPin} title="No GPS data for this day"
                  hint="Tracking was off, the phone had no signal, or this person did not go on duty." />
              </Card>
            ) : (
              <TrackingMap route={day.track} stops={day.stops} gaps={day.gaps} visits={visitPins}
                className="h-[340px] sm:h-[460px]" />
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span><b className="text-teal-700">S</b> start</span>
              <span><b className="text-purple-700">E</b> last position</span>
              <span><span className="font-bold text-blue-700">━</span> route</span>
              <span><span className="font-bold text-rose-600">┅</span> no GPS</span>
              <span><span className="font-bold text-amber-600">◯</span> stop</span>
              <span>Numbered pins = visits (green done · blue in progress · red missed)</span>
            </div>
          </div>

          {/* Timeline */}
          <Card className="max-h-[520px] overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Timeline</p>
              <p className="text-xs text-slate-500">All times are recorded by the system and cannot be edited.</p>
            </div>
            {timeline.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">{dayLoading ? "Loading…" : "Nothing recorded for this day."}</p>
            ) : (
              <ol className="max-h-[450px] overflow-y-auto px-4 py-3">
                {timeline.map((t, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < timeline.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200 dark:bg-slate-700" />}
                    <span className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white dark:ring-slate-800 ${t.tone}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tabular-nums text-slate-500">{fmtClock(t.at)}</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{t.title}</p>
                      {t.sub && <p className="text-xs text-slate-500">{t.sub}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Visits: planned vs actual */}
        <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">Visits: planned vs actual</h3>
        {dayVisits.length === 0 ? (
          <Card><p className="p-4 text-sm text-slate-500">No visits planned for this day.</p></Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {dayVisits.map((v, i) => {
              const st = visitState(v);
              const delay = arrivalDelayMinutes(v);
              const rescheduled = v.original_scheduled_at && v.scheduled_at && v.original_scheduled_at !== v.scheduled_at;
              return (
                <Card key={v.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          <span className="mr-1.5 text-slate-400">#{i + 1}</span>{v.client_name || "Client visit"}
                        </p>
                        <p className="truncate text-xs text-slate-500">{[v.company_name, v.purpose].filter(Boolean).join(" · ") || v.address || "—"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_CHIP[st]}`}>{STATE_LABEL[st]}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-400">Planned</dt>
                        <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{fmtClock(v.scheduled_at)}</dd>
                        {rescheduled && <dd className="text-[10px] text-slate-400">first: {fmtClock(v.original_scheduled_at)}</dd>}
                      </div>
                      <div>
                        <dt className="text-slate-400">Reached</dt>
                        <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{fmtClock(visitArrival(v))}</dd>
                        {delay != null && (
                          <dd className={`text-[10px] ${delay > 15 ? "text-orange-600" : "text-emerald-600"}`}>
                            {delay > 0 ? `${delay} min late` : delay < 0 ? `${-delay} min early` : "on time"}
                          </dd>
                        )}
                      </div>
                      <div>
                        <dt className="text-slate-400">Completed</dt>
                        <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{fmtClock(v.completed_at)}</dd>
                        {visitMinutes(v) != null && <dd className="text-[10px] text-slate-400">{fmtMins(visitMinutes(v))} at client</dd>}
                      </div>
                    </dl>
                    {(v.outcome || v.completion_notes) && (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                        {[v.outcome && String(v.outcome).replace(/_/g, " "), v.completion_notes].filter(Boolean).join(" — ")}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ================= PDF ================= */}
      <Modal open={pdfOpen} onClose={() => setPdfOpen(false)} title="Download visit log (PDF)">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            A professional report for <b>{person?.full_name}</b>: every visit with planned and actual times,
            time at each client, outcomes, plus daily distance, stops and GPS gaps.
          </p>
          {people.length > 1 && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Employee</label>
              <select className={`mt-1.5 ${inputCls}`} value={emp} onChange={(e) => setEmp(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">From</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={pdfFrom} max={pdfTo} onChange={(e) => setPdfFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">To</label>
              <input type="date" className={`mt-1.5 ${inputCls}`} value={pdfTo} max={todayYMD()} onChange={(e) => setPdfTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["Today", todayYMD(), todayYMD()],
              ["This day", date, date],
              ["Last 7 days", addDaysYMD(todayYMD(), -6), todayYMD()],
              ["This month", monthRangeYMD(0).from, todayYMD()],
              ["Last month", monthRangeYMD(-1).from, monthRangeYMD(-1).to],
            ].map(([label, f, t]) => (
              <button key={label} type="button" onClick={() => { setPdfFrom(f); setPdfTo(t); }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50">
                {label}
              </button>
            ))}
          </div>
          {pdfError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pdfError}</p>}
          <button onClick={makePdf} disabled={pdfBusy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            <FileDown className="h-4 w-4" /> {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
