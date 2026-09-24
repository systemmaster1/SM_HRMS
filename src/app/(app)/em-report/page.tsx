"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, EmptyState, inputCls } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  BarChart3, ChevronLeft, ChevronRight, Save, Check,
  TrendingUp, TrendingDown, Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  ISO week helpers                                                   */
/* ------------------------------------------------------------------ */
function isoWeekOf(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

function weekRange(year: number, week: number) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - dow + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function shiftWeek(year: number, week: number, by: number) {
  const monday = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  monday.setUTCDate(monday.getUTCDate() + by * 7);
  return isoWeekOf(monday);
}

const METRICS = [
  { key: "checklist_nd",     l1: "CHECKLIST",  l2: "% WORK NOT DONE" },
  { key: "checklist_nd_ot",  l1: "CHECKLIST",  l2: "% WORK NOT DONE OT" },
  { key: "delegation_nd",    l1: "DELEGATION", l2: "% WORK NOT DONE" },
  { key: "delegation_nd_ot", l1: "DELEGATION", l2: "% WORK NOT DONE OT" },
];

type Row = {
  metric: string;
  label: string;
  no_of_task: number;
  affected: number;
  actual_pct: number;
  actual_score: number;
  planned: number | null;
};

export default function EMReportPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [admin, setAdmin] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const today = isoWeekOf(new Date());
  const [year, setYear] = useState(today.year);
  const [week, setWeek] = useState(today.week);

  const [rows, setRows] = useState<Row[]>([]);
  const [nextPlanned, setNextPlanned] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [summary, setSummary] = useState<any[]>([]);

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase
        .from("profiles").select("*").eq("id", auth.user.id).single();
      setMe(p as Profile);
      setUserId(auth.user.id);

      const isAdmin = isAdminRole((p as Profile)?.role);
      setAdmin(isAdmin);

      if (isAdmin) {
        const { data: m } = await supabase
          .from("profiles").select("*").eq("status", "active").order("full_name");
        setMembers((m as Profile[]) || []);
      }
    })();
  }, [supabase]);

  /* ---------- load report ---------- */
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase.rpc("em_report", {
      p_user: userId, p_year: year, p_week: week,
    });
    setRows((data as Row[]) || []);

    // Pre-fill the "next week planned" boxes with whatever is already saved
    const nxt = shiftWeek(year, week, 1);
    const { data: t } = await supabase
      .from("em_weekly_targets")
      .select("metric, planned")
      .eq("user_id", userId)
      .eq("iso_year", nxt.year)
      .eq("iso_week", nxt.week);

    const map: Record<string, string> = {};
    (t || []).forEach((x: any) => { map[x.metric] = String(x.planned); });
    setNextPlanned(map);

    if (admin) {
      const { data: all } = await supabase.rpc("em_report_all", {
        p_year: year, p_week: week,
      });
      setSummary(all || []);
    }

    setLoading(false);
  }, [supabase, userId, year, week, admin]);

  useEffect(() => { load(); }, [load]);

  /* ---------- save next week targets ---------- */
  const saveTargets = async () => {
    setSaving(true);
    const nxt = shiftWeek(year, week, 1);

    for (const m of METRICS) {
      const raw = nextPlanned[m.key];
      if (raw === undefined || raw === "") continue;
      await supabase.rpc("em_save_target", {
        p_user: userId,
        p_year: nxt.year,
        p_week: nxt.week,
        p_metric: m.key,
        p_planned: Number(raw),
      });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const rowFor = (key: string) => rows.find((r) => r.metric === key);

  // Overall score is based only on metrics that actually had tasks this week.
  // Empty categories must not inflate the employee's score.
  const activeRows = rows.filter((r) => Number(r.no_of_task || 0) > 0);
  const overall = activeRows.length
    ? Math.max(0, Math.min(100, Math.round(
        (100 - activeRows.reduce((a, r) => a + Number(r.actual_pct || 0), 0) / activeRows.length) * 10
      ) / 10))
    : 0;

  const isCurrentWeek = year === today.year && week === today.week;

  return (
    <div>
      <FadeIn>
        <PageHeader
          title="Task scorecard"
          subtitle="Weekly score of tasks not done on time, per employee, for checklist and delegation tasks (EM report)."
        />
      </FadeIn>

      {/* Controls */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          {admin && (
            <div className="sm:w-64">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Employee
              </label>
              <select
                className={`mt-1.5 ${inputCls}`}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Week
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={() => { const p = shiftWeek(year, week, -1); setYear(p.year); setWeek(p.week); }}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-[150px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Week {week} · {year}
                </p>
                <p className="text-[11px] text-slate-500">{weekRange(year, week)}</p>
              </div>

              <button
                onClick={() => { const n = shiftWeek(year, week, 1); setYear(n.year); setWeek(n.week); }}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {!isCurrentWeek && (
                <button
                  onClick={() => { setYear(today.year); setWeek(today.week); }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                >
                  This week
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-brand-700 px-5 py-3 text-center text-white">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">
              EM Score
            </p>
            <p className="text-2xl font-bold">{overall}%</p>
          </div>
        </div>
      </Card>

      {/* Scorecard — cards on phones, matrix on larger screens */}
      <FadeIn delay={0.03}>
        <Card>
          <div className="p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Weekly performance</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Planned limit, actual result and task count for each task category.
              </p>
            </div>

            <div className="grid gap-3 md:hidden">
              {METRICS.map((m) => {
                const row = rowFor(m.key);
                const has = Number(row?.no_of_task || 0) > 0;
                const actualPct = Number(row?.actual_pct || 0);
                return (
                  <div key={m.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{m.l1}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {m.l2 === "% WORK NOT DONE OT" ? "Work not done on time" : "Work not done"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${!has ? "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300" : actualPct <= Math.abs(Number(row?.planned || 0)) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"}`}>
                        {has ? `${actualPct.toFixed(1)}%` : "No tasks"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900/40">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Plan</p>
                        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{row?.planned ?? 0}%</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900/40">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Actual</p>
                        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{has ? `${actualPct.toFixed(1)}%` : "—"}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900/40">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tasks</p>
                        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{row?.no_of_task ?? 0}</p>
                      </div>
                    </div>

                    <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Next week plan · max not-done %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="10"
                      value={nextPlanned[m.key] ?? ""}
                      onChange={(e) => setNextPlanned((p) => ({ ...p, [m.key]: e.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Metric</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">This week plan</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Actual</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Tasks</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Affected</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Next week plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {METRICS.map((m) => {
                    const row = rowFor(m.key);
                    const has = Number(row?.no_of_task || 0) > 0;
                    return (
                      <tr key={m.key}>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{m.l1}</p>
                          <p className="text-xs text-slate-500">{m.l2 === "% WORK NOT DONE OT" ? "Work not done on time" : "Work not done"}</p>
                        </td>
                        <td className="px-3 py-4 text-center font-medium">{row?.planned ?? 0}%</td>
                        <td className="px-3 py-4 text-center font-semibold">{has ? `${Number(row?.actual_pct || 0).toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-4 text-center">{row?.no_of_task ?? 0}</td>
                        <td className="px-3 py-4 text-center">{row?.affected ?? 0}</td>
                        <td className="px-3 py-4">
                          <input type="number" min="0" max="100" placeholder="10" value={nextPlanned[m.key] ?? ""}
                            onChange={(e) => setNextPlanned((p) => ({ ...p, [m.key]: e.target.value }))}
                            className="mx-auto block w-28 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-center font-semibold outline-none focus:border-brand-600 dark:border-slate-600" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                Plan is the maximum acceptable not-done percentage. Example: <strong>10</strong> means no more than 10% of work should remain undone.
              </p>
              <button onClick={saveTargets} disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60 sm:ml-auto sm:w-auto">
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : saved ? "Saved" : "Save next week plan"}
              </button>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* Admin: everyone at a glance */}
      {admin && (
        <FadeIn delay={0.06}>
          <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Team scorecard · Week {week}
          </h2>
          <Card>
            {summary.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No task data for this week"
                hint="Once tasks are assigned and due in this week, scores will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                      <th className="p-4 font-medium text-slate-500">Employee</th>
                      <th className="p-4 font-medium text-slate-500">Department</th>
                      <th className="p-4 text-center font-medium text-slate-500">Tasks</th>
                      <th className="p-4 text-center font-medium text-slate-500">On time</th>
                      <th className="p-4 text-center font-medium text-slate-500">Late</th>
                      <th className="p-4 text-center font-medium text-slate-500">Not done</th>
                      <th className="p-4 text-center font-medium text-slate-500">EM Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {summary.map((s) => (
                      <tr
                        key={s.user_id}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-700/40"
                        onClick={() => setUserId(s.user_id)}
                      >
                        <td className="p-4 font-medium text-slate-900 dark:text-slate-100">
                          {s.full_name}
                        </td>
                        <td className="p-4 text-slate-500">{s.department}</td>
                        <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                          {s.total_tasks}
                        </td>
                        <td className="p-4 text-center font-medium text-emerald-600">
                          {s.done_on_time}
                        </td>
                        <td className="p-4 text-center font-medium text-amber-600">
                          {s.done_late}
                        </td>
                        <td className="p-4 text-center font-medium text-rose-600">
                          {s.not_done}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                              Number(s.em_score) >= 90
                                ? "bg-emerald-50 text-emerald-700"
                                : Number(s.em_score) >= 70
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {s.em_score}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </FadeIn>
      )}

      {loading && (
        <p className="mt-6 text-center text-sm text-slate-400">Loading…</p>
      )}
    </div>
  );
}
