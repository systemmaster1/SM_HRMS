"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  MapPinned,
  Navigation,
  RefreshCcw,
  Route,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  designation?: string | null;
  company_id: string;
  manager_id?: string | null;
  field_tracking_enabled?: boolean | null;
};

type Point = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  captured_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  event_time: string;
  latitude?: number | null;
  longitude?: number | null;
  details?: Record<string, unknown> | null;
};

type Visit = {
  id: string;
  client_name?: string | null;
  purpose?: string | null;
  status: string;
  visit_date: string;
  check_in?: string | null;
  check_out?: string | null;
  travel_started_at?: string | null;
  completed_at?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
};

const fmtTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(value))
    : "—";

const fmtDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+05:30`));

const todayIndia = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function mapUrl(points: Point[]) {
  if (!points.length) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const waypoints = points
    .filter((_, i) => i > 0 && i < points.length - 1)
    .filter((_, i) => i % Math.max(1, Math.floor(points.length / 7)) === 0)
    .slice(0, 7)
    .map((p) => `${p.latitude},${p.longitude}`)
    .join("|");
  const wp = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${first.latitude},${first.longitude}&destination=${last.latitude},${last.longitude}${wp}`;
}

function staticMapEmbed(points: Point[]) {
  if (!points.length) return "";
  const last = points[points.length - 1];
  return `https://maps.google.com/maps?q=${last.latitude},${last.longitude}&z=14&output=embed`;
}

export default function RouteHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(todayIndia());
  const [points, setPoints] = useState<Point[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastWorkingDay, setLastWorkingDay] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,role,designation,company_id,manager_id,field_tracking_enabled")
      .eq("id", auth.user.id)
      .single();
    if (!profile) return;
    setMe(profile as Profile);

    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,role,designation,company_id,manager_id,field_tracking_enabled")
      .eq("company_id", profile.company_id)
      .eq("field_tracking_enabled", true)
      .order("full_name");

    const rows = (data || []) as Profile[];
    setEmployees(rows);
    const defaultId = rows.find((r) => r.id === auth.user?.id)?.id || rows[0]?.id || auth.user.id;
    setEmployeeId((prev) => prev || defaultId);
  }, [supabase]);

  const loadRoute = useCallback(async () => {
    if (!employeeId || !date) return;
    setLoading(true);

    const dayStart = `${date}T00:00:00+05:30`;
    const next = new Date(`${date}T00:00:00+05:30`);
    next.setDate(next.getDate() + 1);
    const dayEnd = next.toISOString();

    const [{ data: pts }, { data: ev }, { data: vs }, { data: sum }, { data: lwd }] = await Promise.all([
      supabase
        .from("employee_location_history")
        .select("id,latitude,longitude,accuracy_m,captured_at")
        .eq("employee_id", employeeId)
        .gte("captured_at", dayStart)
        .lt("captured_at", dayEnd)
        .order("captured_at")
        .limit(2500),
      supabase
        .from("tracking_events")
        .select("id,event_type,event_time,latitude,longitude,details")
        .eq("employee_id", employeeId)
        .gte("event_time", dayStart)
        .lt("event_time", dayEnd)
        .order("event_time")
        .limit(500),
      supabase
        .from("field_visits")
        .select("id,client_name,purpose,status,visit_date,check_in,check_out,travel_started_at,completed_at,check_in_lat,check_in_lng")
        .eq("employee_id", employeeId)
        .eq("visit_date", date)
        .order("created_at"),
      supabase.rpc("route_history_summary_v8", {
        p_employee_id: employeeId,
        p_work_date: date,
      }),
      supabase.rpc("last_working_day_v8", { p_employee_id: employeeId }),
    ]);

    setPoints((pts || []) as Point[]);
    setEvents((ev || []) as EventRow[]);
    setVisits((vs || []) as Visit[]);
    setSummary(sum || null);
    setLastWorkingDay(lwd || null);
    setLoading(false);
  }, [date, employeeId, supabase]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  const employee = employees.find((x) => x.id === employeeId);
  const routeLink = mapUrl(points);
  const embed = staticMapEmbed(points);

  const timeline = useMemo(() => {
    const rows: { time: string; title: string; detail?: string; kind: string }[] = [];
    if (summary?.check_in) rows.push({ time: summary.check_in, title: "Attendance IN", kind: "attendance" });
    for (const e of events) {
      const labels: Record<string, string> = {
        location_permission_denied: "Location permission denied",
        location_timeout: "Location timeout",
        location_unavailable: "Location unavailable",
        location_stale: "Location stale",
        location_restored: "Location restored",
        location_received: "Tracking started / GPS received",
      };
      rows.push({
        time: e.event_time,
        title: labels[e.event_type] || e.event_type.replaceAll("_", " "),
        detail: (e.details?.reason as string) || undefined,
        kind: "tracking",
      });
    }
    for (const v of visits) {
      if (v.travel_started_at)
        rows.push({ time: v.travel_started_at, title: `Travel started · ${v.client_name || "Visit"}`, kind: "visit" });
      if (v.check_in)
        rows.push({ time: v.check_in, title: `Client check-in · ${v.client_name || "Visit"}`, kind: "visit" });
      if (v.completed_at || v.check_out)
        rows.push({
          time: v.completed_at || v.check_out || "",
          title: `Visit completed · ${v.client_name || "Visit"}`,
          kind: "visit",
        });
    }
    if (summary?.check_out) rows.push({ time: summary.check_out, title: "Attendance OUT · Employee Off Duty", kind: "attendance" });
    return rows.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [events, summary, visits]);

  const changeDate = (days: number) => {
    const d = new Date(`${date}T12:00:00+05:30`);
    d.setDate(d.getDate() + days);
    setDate(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d)
    );
  };

  const exportCsv = () => {
    const header = ["Time", "Latitude", "Longitude", "Accuracy (m)"];
    const lines = [
      header.join(","),
      ...points.map((p) =>
        [fmtTime(p.captured_at), p.latitude, p.longitude, p.accuracy_m ?? ""]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${employee?.full_name || "employee"}-route-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 h-1 w-8 rounded-full bg-orange-400" />
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Route History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Replay employee duty movement, visits, GPS interruptions and daily distance using server-recorded activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => lastWorkingDay && setDate(lastWorkingDay)}
            disabled={!lastWorkingDay}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            Last working day
          </button>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            <Download className="h-4 w-4" /> Export route
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <button onClick={() => changeDate(-1)} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-[190px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={() => changeDate(1)} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setDate(todayIndia())}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          Today
        </button>
        <span className="ml-auto text-xs text-slate-400">{fmtDate(date)}</span>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["Distance", `${Number(summary?.distance_km || 0).toFixed(1)} km`, Navigation],
          ["GPS points", summary?.gps_points ?? 0, MapPinned],
          ["Visits", `${summary?.visits_completed ?? 0}/${summary?.visits_total ?? 0}`, UsersRound],
          ["GPS gaps", summary?.gps_gaps ?? 0, ShieldCheck],
          ["Attendance IN", fmtTime(summary?.check_in), Clock3],
          ["Attendance OUT", summary?.check_out ? fmtTime(summary.check_out) : "On duty", Clock3],
          ["First GPS", fmtTime(summary?.first_gps), Route],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold">Daily route map</h2>
              <p className="mt-1 text-xs text-slate-500">
                {employee?.full_name || "Employee"} · {points.length} valid route points
              </p>
            </div>
            {routeLink && (
              <a
                href={routeLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-xs font-semibold text-white"
              >
                <Route className="h-4 w-4" /> Open full route
              </a>
            )}
          </div>

          {embed ? (
            <iframe title="Employee route map" src={embed} className="h-[470px] w-full border-0" loading="lazy" />
          ) : (
            <div className="grid h-[470px] place-items-center px-6 text-center">
              <div>
                <MapPinned className="mx-auto h-9 w-9 text-slate-300" />
                <h3 className="mt-3 font-semibold">No route recorded for this date</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Route history is available only for duty periods where tracking was enabled and GPS points were received.
                </p>
              </div>
            </div>
          )}

          {points.length > 1 && (
            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {points
                  .filter((_, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 8)) === 0)
                  .slice(0, 10)
                  .map((p, i) => (
                    <div key={p.id} className="min-w-[105px] rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{i === 0 ? "Start" : "Point"}</div>
                      <div className="mt-1 text-xs font-semibold">{fmtTime(p.captured_at)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold">Activity timeline</h2>
            <p className="mt-1 text-xs text-slate-500">Attendance, visits and GPS health events in server-time order.</p>
          </div>

          <div className="max-h-[560px] space-y-1 overflow-y-auto p-4">
            {timeline.length ? (
              timeline.map((row, index) => (
                <div key={`${row.time}-${index}`} className="flex gap-3 rounded-xl px-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <div className="mt-1 flex flex-col items-center">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        row.title.toLowerCase().includes("denied") ||
                        row.title.toLowerCase().includes("stale") ||
                        row.title.toLowerCase().includes("unavailable")
                          ? "bg-rose-500"
                          : row.kind === "visit"
                          ? "bg-violet-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    {index < timeline.length - 1 && <div className="mt-1 h-full min-h-8 w-px bg-slate-200 dark:bg-slate-800" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-400">{fmtTime(row.time)}</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{row.title}</div>
                    {row.detail && <div className="mt-1 text-xs leading-5 text-slate-500">{row.detail}</div>}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">No activity events for this date.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Privacy & audit boundary
        </div>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Route history is built only from coordinates recorded during authorized duty tracking. Attendance OUT remains the privacy boundary for new GPS collection. Historical activity uses stored server timestamps; employee device clock changes are not treated as official event time.
        </p>
      </section>
    </div>
  );
}
