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

  const overall = rows.length
    ? Math.round(
        (100 -
          rows.reduce((a, r) => a + Number(r.actual_pct || 0), 0) / rows.length) * 10
      ) / 10
    : 0;

  const isCurrentWeek = year === today.year && week === today.week;

  return (
    <div>
      <FadeIn>
        <PageHeader
          title="EM Report"
          subtitle="Weekly work-not-done scoring for checklist and delegation tasks."
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

      {/* The matrix */}
      <FadeIn delay={0.03}>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <table className="w-full border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="w-44" />
                {METRICS.map((m) => (
                  <th key={m.key} className="min-w-[150px]">
                    <div className="rounded-lg bg-gradient-to-br from-brand-800 to-brand-600 px-3 py-3 text-center">
                      <p className="text-[11px] font-bold leading-tight text-white">
                        {m.l1}
                      </p>
                      <p className="text-[11px] font-bold leading-tight text-white">
                        {m.l2}
                      </p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* This Week Planned */}
              <tr>
                <td>
                  <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                    <p className="text-sm font-semibold text-white">This Week Planned</p>
                  </div>
                </td>
                {METRICS.map((m) => {
                  const r = rowFor(m.key);
                  return (
                    <td key={m.key}>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-600 py-3 text-center">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {r?.planned ?? 0}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Actual Score */}
              <tr>
                <td>
                  <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                    <p className="text-sm font-semibold text-white">Actual Score</p>
                  </div>
                </td>
                {METRICS.map((m) => {
                  const r = rowFor(m.key);
                  const has = (r?.no_of_task ?? 0) > 0;
                  const score = Number(r?.actual_score ?? 0);
                  const target = Number(r?.planned ?? 0);
                  const ok = score >= target;
                  return (
                    <td key={m.key}>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-600 py-3 text-center">
                        {!has ? (
                          <span className="font-bold text-slate-400">–</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              ok ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {ok ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {score}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* No. Of Task */}
              <tr>
                <td>
                  <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                    <p className="text-sm font-semibold text-white">No. Of Task</p>
                  </div>
                </td>
                {METRICS.map((m) => {
                  const r = rowFor(m.key);
                  return (
                    <td key={m.key}>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-600 py-3 text-center">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {r?.no_of_task ?? 0}
                        </span>
                        {(r?.affected ?? 0) > 0 && (
                          <span className="ml-1.5 text-xs font-medium text-rose-500">
                            ({r?.affected} affected)
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Next Week Planned */}
              <tr>
                <td>
                  <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                    <p className="text-sm font-semibold text-white">Next Week Planned</p>
                  </div>
                </td>
                {METRICS.map((m) => (
                  <td key={m.key}>
                    <input
                      type="number"
                      placeholder="-10"
                      value={nextPlanned[m.key] ?? ""}
                      onChange={(e) =>
                        setNextPlanned((p) => ({ ...p, [m.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent py-3 text-center font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-xs text-slate-500">
              Targets are set as negative numbers — e.g. <strong>-10</strong> means
              &ldquo;no more than 10% of my work will be left undone&rdquo;.
            </p>
            <button
              onClick={saveTargets}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : saved ? "Saved" : "Save next week plan"}
            </button>
          </div>
        </div>
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
