"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { PageHeader, Card, EmptyState, inputCls } from "@/components/ui";
import { exportCsv } from "@/lib/export";
import { todayYMD, monthRangeYMD } from "@/lib/date";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  ChevronLeft, ChevronRight, Download, RefreshCw, CalendarRange, ArrowLeft, Search,
} from "lucide-react";

type Status = "present" | "late" | "half_day" | "on_leave" | "holiday" | "weekly_off" | "absent" | "pending";

const META: Record<Status, { code: string; label: string; cls: string }> = {
  present:    { code: "P",  label: "Present",    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" },
  late:       { code: "L",  label: "Late",       cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
  half_day:   { code: "HD", label: "Half day",   cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200" },
  on_leave:   { code: "LV", label: "On leave",   cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300" },
  holiday:    { code: "H",  label: "Holiday",    cls: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300" },
  weekly_off: { code: "WO", label: "Weekly off", cls: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  absent:     { code: "A",  label: "Absent",     cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" },
  pending:    { code: "–",  label: "Not yet marked", cls: "bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500" },
};
const COUNTED: Status[] = ["present", "late", "half_day", "on_leave", "absent", "holiday", "weekly_off"];

export default function AttendanceRegisterPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const [notice, setNotice] = useState("");

  const range = monthRangeYMD(offset);
  const today = todayYMD();
  const days = useMemo(() => {
    const out: string[] = [];
    const [y, m] = range.from.split("-").map(Number);
    const last = Number(range.to.slice(8, 10));
    for (let d = 1; d <= last; d++) out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    return out;
  }, [range.from, range.to]);

  const monthLabel = new Date(`${range.from}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
      setMe(p as Profile);

      const log = await fetchAll((from, to) => supabase
        .from("attendance_daily_log")
        .select("employee_id, work_date, status, check_in, check_out, note")
        .gte("work_date", range.from).lte("work_date", range.to)
        .order("employee_id").order("work_date").range(from, to));

      const ids = Array.from(new Set(log.map((r: any) => r.employee_id)));
      let ppl: any[] = [];
      if (ids.length) {
        ppl = await fetchAll((from, to) => supabase
          .from("profiles").select("id, full_name, employee_code, department")
          .in("id", ids).order("full_name").order("id").range(from, to));
      }
      setRows(log);
      setPeople(ppl);
    } catch (e: any) {
      setError(/attendance_daily_log/.test(e?.message || "")
        ? "The attendance register is not set up yet. Ask your administrator to run the Phase 2B database update."
        : e?.message || "Could not load the register.");
    } finally {
      setLoading(false);
    }
  }, [supabase, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const admin = isAdminRole(me?.role);

  const byEmp = useMemo(() => {
    const m = new Map<string, Map<string, any>>();
    rows.forEach((r) => {
      if (!m.has(r.employee_id)) m.set(r.employee_id, new Map());
      m.get(r.employee_id)!.set(r.work_date, r);
    });
    return m;
  }, [rows]);

  const departments = useMemo(
    () => Array.from(new Set(people.map((p) => p.department).filter(Boolean))).sort(),
    [people]
  );

  const visible = people.filter((p) =>
    (!dept || p.department === dept) &&
    (!query || `${p.full_name} ${p.employee_code || ""}`.toLowerCase().includes(query.toLowerCase()))
  );

  const totals = (id: string) => {
    const t: Record<string, number> = {};
    COUNTED.forEach((s) => (t[s] = 0));
    byEmp.get(id)?.forEach((r) => { if (t[r.status] !== undefined) t[r.status]++; });
    return t;
  };

  const rebuild = async () => {
    setRebuilding(true);
    setNotice("");
    const to = range.to < today ? range.to : today;
    const { data, error: e } = await supabase.rpc("rebuild_my_attendance_log", { p_from: range.from, p_to: to });
    setRebuilding(false);
    if (e) { setNotice(e.message); return; }
    setNotice(`Register rebuilt: ${Number(data || 0).toLocaleString("en-IN")} entries refreshed.`);
    load();
  };

  const doExport = () => {
    exportCsv(`Attendance_register_${range.from.slice(0, 7)}`,
      ["Employee", "Code", "Department", ...days.map((d) => d.slice(8, 10)),
       "Present", "Late", "Half day", "On leave", "Absent", "Holiday", "Weekly off"],
      visible.map((p) => {
        const m = byEmp.get(p.id);
        const t = totals(p.id);
        return [
          p.full_name || "", p.employee_code || "", p.department || "",
          ...days.map((d) => (m?.get(d) ? META[m.get(d).status as Status]?.code || "" : "")),
          t.present, t.late, t.half_day, t.on_leave, t.absent, t.holiday, t.weekly_off,
        ];
      }));
  };

  return (
    <div>
      <PageHeader
        title="Attendance register"
        subtitle="Day-by-day status for every active employee, including holidays, weekly offs and approved leave. Updated automatically through the day and closed at 11:55 PM."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/attendance"
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50">
              <ArrowLeft className="h-4 w-4" /> Attendance
            </Link>
            <button onClick={doExport} disabled={!visible.length}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50">
              <Download className="h-4 w-4" /> Export
            </button>
            {admin && (
              <button onClick={rebuild} disabled={rebuilding || range.from > today}
                title="Recalculate this month, e.g. after adding a holiday or approving a past leave"
                className="flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${rebuilding ? "animate-spin" : ""}`} />
                {rebuilding ? "Rebuilding…" : "Rebuild month"}
              </button>
            )}
          </div>
        }
      />

      {/* Month + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(offset - 1)} aria-label="Previous month"
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9.5rem] text-center font-semibold text-slate-900 dark:text-slate-100">{monthLabel}</p>
          <button onClick={() => setOffset(offset + 1)} aria-label="Next month" disabled={offset >= 0}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {people.length > 1 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-9 sm:w-56`} placeholder="Search employee"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {departments.length > 0 && (
              <select className={`${inputCls} sm:w-48`} value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(Object.keys(META) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className={`grid h-6 min-w-6 place-items-center rounded px-1 text-[10px] font-bold ${META[s].cls}`}>{META[s].code}</span>
            {META[s].label}
          </span>
        ))}
      </div>

      {notice && (
        <p className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <Card>
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading register…</p>
        ) : visible.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No entries for this month"
            hint={admin ? "Entries appear automatically each day. For earlier months, use “Rebuild month”." : "Your daily entries will appear here."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="sticky left-0 z-10 min-w-[10rem] border-b border-slate-200 bg-white px-3 py-2.5 text-left font-semibold dark:border-slate-700 dark:bg-slate-800">
                    Employee
                  </th>
                  {days.map((d) => {
                    const dow = new Date(`${d}T00:00:00`).getDay();
                    return (
                      <th key={d} className={`border-b border-slate-200 px-0.5 py-1.5 text-center font-medium dark:border-slate-700 ${d === today ? "text-brand-700 dark:text-brand-300" : ""}`}>
                        <div className="text-[10px] uppercase">{"SMTWTFS"[dow]}</div>
                        <div className="tabular-nums">{Number(d.slice(8, 10))}</div>
                      </th>
                    );
                  })}
                  {["P", "L", "HD", "LV", "A"].map((h) => (
                    <th key={h} className="border-b border-l border-slate-200 px-2 py-2.5 text-center font-semibold dark:border-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const m = byEmp.get(p.id);
                  const t = totals(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800">
                        <p className="max-w-[10rem] truncate font-medium text-slate-900 dark:text-slate-100">{p.full_name}</p>
                        <p className="truncate text-[10px] text-slate-400">{[p.employee_code, p.department].filter(Boolean).join(" · ")}</p>
                      </td>
                      {days.map((d) => {
                        const r = m?.get(d);
                        const meta = r ? META[r.status as Status] : null;
                        const tip = r
                          ? [meta?.label, r.note,
                             r.check_in && `In ${new Date(r.check_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
                             r.check_out && `Out ${new Date(r.check_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
                            ].filter(Boolean).join(" · ")
                          : d > today ? "" : "No entry";
                        return (
                          <td key={d} className="border-b border-slate-100 p-0.5 text-center dark:border-slate-700/60" title={tip}>
                            {meta ? (
                              <span className={`mx-auto grid h-7 w-7 place-items-center rounded text-[10px] font-bold ${meta.cls} ${r.note ? "ring-1 ring-brand-500" : ""}`}>
                                {meta.code}
                              </span>
                            ) : (
                              <span className="mx-auto block h-7 w-7" />
                            )}
                          </td>
                        );
                      })}
                      {[t.present, t.late, t.half_day, t.on_leave, t.absent].map((v, i) => (
                        <td key={i} className={`border-b border-l border-slate-100 px-2 text-center font-semibold tabular-nums dark:border-slate-700/60 ${i === 4 && v > 0 ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-500">
        A ringed cell means there is a note, for example work done on a holiday or a half-day leave.
        Tap or hover a cell to see check-in and check-out times.
      </p>
    </div>
  );
}
