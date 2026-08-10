"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import { canManageTeam, isAdminRole, type Profile } from "@/lib/types";
import { ArrowLeft, Download, FileText, Printer, RefreshCw } from "lucide-react";

type VisitRow = {
  id: string;
  employee_id: string;
  client_name: string;
  visit_date: string;
  scheduled_at: string | null;
  travel_started_at: string | null;
  check_in_at: string | null;
  completed_at: string | null;
  status: string;
  outcome: string | null;
  target_duration_minutes: number | null;
  profiles?: { full_name?: string | null; designation?: string | null } | null;
};

function minutesBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
function fmtMins(v: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  if (Math.abs(v) < 60) return `${v}m`;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}${Math.floor(abs / 60)}h ${abs % 60}m`;
}

export default function FieldReportsPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const first = new Date(); first.setDate(first.getDate() - 30);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [me, setMe] = useState<Profile | null>(null);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
    const profile = p as Profile;
    setMe(profile);
    let q = supabase.from("field_visits")
      .select("id, employee_id, client_name, visit_date, scheduled_at, travel_started_at, check_in_at, completed_at, status, outcome, target_duration_minutes, profiles:employee_id(full_name, designation)")
      .gte("visit_date", from).lte("visit_date", to).order("visit_date", { ascending: false });
    const { data } = await q;
    setRows((data as unknown as VisitRow[]) || []);
    setLoading(false);
  }, [from, supabase, to]);

  useEffect(() => { load(); }, [load]);

  const report = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of rows) {
      const current = map.get(r.employee_id) || {
        employee_id: r.employee_id,
        name: r.profiles?.full_name || "Employee",
        designation: r.profiles?.designation || "",
        total: 0, completed: 0, pending: 0, missed: 0, delayed: 0,
        successful: 0, followups: 0, delayTotal: 0, delaySamples: 0, durationTotal: 0, durationSamples: 0,
      };
      current.total += 1;
      if (r.status === "completed") current.completed += 1;
      else current.pending += 1;
      if (r.status !== "completed" && r.visit_date < today) current.missed += 1;
      const delay = minutesBetween(r.scheduled_at, r.travel_started_at);
      if (delay != null) {
        current.delaySamples += 1; current.delayTotal += delay;
        if (delay > 0) current.delayed += 1;
      }
      const duration = minutesBetween(r.travel_started_at, r.completed_at);
      if (duration != null) { current.durationSamples += 1; current.durationTotal += duration; }
      if (r.outcome === "successful") current.successful += 1;
      if (r.outcome === "follow_up_required") current.followups += 1;
      map.set(r.employee_id, current);
    }
    return Array.from(map.values()).map((x) => ({
      ...x,
      completionRate: x.total ? Math.round((x.completed / x.total) * 100) : 0,
      avgDelay: x.delaySamples ? Math.round(x.delayTotal / x.delaySamples) : null,
      avgDuration: x.durationSamples ? Math.round(x.durationTotal / x.durationSamples) : null,
    })).sort((a, b) => b.completed - a.completed);
  }, [rows, today]);

  const totals = useMemo(() => ({
    total: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    pending: rows.filter((r) => r.status !== "completed").length,
    missed: rows.filter((r) => r.status !== "completed" && r.visit_date < today).length,
  }), [rows, today]);

  const exportCsv = () => {
    const head = ["Employee","Designation","Total Visits","Completed","Pending","Missed","Delayed Starts","Completion %","Avg Start Delay","Avg Visit Duration","Successful","Follow-ups"];
    const lines = report.map((r) => [r.name,r.designation,r.total,r.completed,r.pending,r.missed,r.delayed,r.completionRate,fmtMins(r.avgDelay),fmtMins(r.avgDuration),r.successful,r.followups]);
    const csv = [head, ...lines].map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `field-performance-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const canView = me && canManageTeam(me.role);
  if (!loading && !canView) return <Card><div className="p-8 text-center text-sm text-slate-500">Field performance reports are available to Owner, Admin and Reporting Managers.</div></Card>;

  return <div>
    <PageHeader title="Field Performance Reports" subtitle="Employee-wise visits, completion, delay, missed activity and field productivity." action={<div className="flex flex-wrap gap-2"><Link href="/field-visits" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"><ArrowLeft className="h-4 w-4" /> Field operations</Link><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"><Download className="h-4 w-4" /> CSV</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white"><Printer className="h-4 w-4" /> Print / PDF</button></div>} />

    <Card className="mb-5"><div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-slate-500">From<input type="date" className={`mt-1 ${inputCls}`} value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs text-slate-500">To<input type="date" className={`mt-1 ${inputCls}`} value={to} onChange={(e) => setTo(e.target.value)} /></label><button onClick={load} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"><RefreshCw className="h-4 w-4" /> Refresh</button></div></Card>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Total visits",totals.total],["Completed",totals.completed],["Pending",totals.pending],["Missed / not completed",totals.missed]].map(([l,v]) => <Card key={String(l)}><div className="p-4"><p className="text-xs text-slate-500">{l}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{v}</p></div></Card>)}</div>

    <Card className="overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Employee performance</h2><p className="mt-0.5 text-xs text-slate-500">Delay is measured from scheduled start to actual travel start when a schedule is available.</p></div>
      <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Employee","Visits","Completed","Pending","Missed","Delayed","Completion","Avg delay","Avg duration","Successful","Follow-ups"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{report.map((r) => <tr key={r.employee_id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{r.name}</p><p className="text-[11px] text-slate-400">{r.designation}</p></td><td className="px-4 py-3">{r.total}</td><td className="px-4 py-3 text-emerald-700">{r.completed}</td><td className="px-4 py-3">{r.pending}</td><td className="px-4 py-3 text-rose-700">{r.missed}</td><td className="px-4 py-3 text-amber-700">{r.delayed}</td><td className="px-4 py-3 font-semibold">{r.completionRate}%</td><td className="px-4 py-3">{fmtMins(r.avgDelay)}</td><td className="px-4 py-3">{fmtMins(r.avgDuration)}</td><td className="px-4 py-3">{r.successful}</td><td className="px-4 py-3">{r.followups}</td></tr>)}{!loading && report.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400"><FileText className="mx-auto mb-2 h-6 w-6" />No visits in this date range.</td></tr>}</tbody></table></div>
    </Card>
    <style jsx global>{`@media print { aside, header, button, a[href='/field-visits'] { display:none !important; } main { padding:0 !important; } body { background:white !important; } }`}</style>
  </div>;
}
