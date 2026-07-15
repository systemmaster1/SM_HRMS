"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { exportCsv, printSalarySlip, printPayrollReport } from "@/lib/export";
import { MONTHS } from "@/lib/geo";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  Wallet, Download, Printer, Plus, Check, X, Users2, IndianRupee,
  FileStack, TrendingDown, UserCheck2,
} from "lucide-react";

export default function PayrollPage() {
  const supabase = createClient();
  const now = new Date();

  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sheet" | "salary" | "actions">("sheet");

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[]>([]);

  const [members, setMembers] = useState<Profile[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  // salary edit modal
  const [salOpen, setSalOpen] = useState(false);
  const [salTarget, setSalTarget] = useState<Profile | null>(null);
  const [sf, setSf] = useState({ monthly_salary: "0", basic: "0", hra: "0", other_allowance: "0", pf: "0", other_deduction: "0" });
  const [saving, setSaving] = useState(false);

  // deduction modal
  const [dedOpen, setDedOpen] = useState(false);
  const [df, setDf] = useState({ employee_id: "", reason: "", deduction_days: "0.5" });
  const [dedError, setDedError] = useState("");

  const admin = isAdminRole(me?.role);
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: c } = await supabase
      .from("companies").select("*").eq("id", p!.company_id).single();
    setCompany(c);

    if (isAdminRole((p as Profile)?.role)) {
      const { data: m } = await supabase
        .from("profiles").select("*").eq("status", "active").order("full_name");
      setMembers((m as Profile[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  const loadSheet = useCallback(async () => {
    const { data } = await supabase.rpc("get_payroll", { p_month: month, p_year: year });
    setRows(data || []);
  }, [supabase, month, year]);

  const loadSalaries = useCallback(async () => {
    const { data } = await supabase.from("salary_master").select("*");
    setSalaries(data || []);
  }, [supabase]);

  const loadActions = useCallback(async () => {
    const { data } = await supabase
      .from("payroll_actions")
      .select("*, employee:employee_id(full_name), creator:created_by(full_name)")
      .order("created_at", { ascending: false });
    setActions(data || []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!loading) loadSheet(); }, [loading, loadSheet]);
  useEffect(() => { if (!loading && admin) { loadSalaries(); loadActions(); } }, [loading, admin, loadSalaries, loadActions]);

  const openSalary = (member: Profile) => {
    const s = salaries.find((x) => x.employee_id === member.id);
    setSf({
      monthly_salary: String(s?.monthly_salary ?? 0),
      basic: String(s?.basic ?? 0),
      hra: String(s?.hra ?? 0),
      other_allowance: String(s?.other_allowance ?? 0),
      pf: String(s?.pf ?? 0),
      other_deduction: String(s?.other_deduction ?? 0),
    });
    setSalTarget(member);
    setSalOpen(true);
  };

  const saveSalary = async () => {
    setSaving(true);
    await supabase.from("salary_master").upsert({
      company_id: me!.company_id,
      employee_id: salTarget!.id,
      monthly_salary: parseFloat(sf.monthly_salary) || 0,
      basic: parseFloat(sf.basic) || 0,
      hra: parseFloat(sf.hra) || 0,
      other_allowance: parseFloat(sf.other_allowance) || 0,
      pf: parseFloat(sf.pf) || 0,
      other_deduction: parseFloat(sf.other_deduction) || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "employee_id" });
    setSaving(false);
    setSalOpen(false);
    loadSalaries();
    loadSheet();
  };

  const createDeduction = async () => {
    setDedError("");
    if (!df.employee_id) return setDedError("Choose an employee.");
    if (!df.reason.trim()) return setDedError("Enter a reason.");
    setSaving(true);
    const { error } = await supabase.from("payroll_actions").insert({
      company_id: me!.company_id,
      employee_id: df.employee_id,
      month, year,
      reason: df.reason.trim(),
      deduction_days: parseFloat(df.deduction_days) || 0.5,
      created_by: me!.id,
    });
    setSaving(false);
    if (error) return setDedError(error.message);
    setDedOpen(false);
    setDf({ employee_id: "", reason: "", deduction_days: "0.5" });
    loadActions();
  };

  const approve = async (id: string, from: string) => {
    const { error } = await supabase.rpc("approve_payroll_action", { p_action_id: id, p_deduct_from: from });
    if (error) alert(error.message);
    loadActions();
    loadSheet();
  };

  const reject = async (id: string) => {
    await supabase.rpc("reject_payroll_action", { p_action_id: id });
    loadActions();
  };

  const doCsv = () => {
    exportCsv(
      `payroll-${MONTHS[month - 1]}-${year}`,
      ["Employee", "Code", "Dept", "Work Days", "Present", "Late", "Absent", "Leave",
       "Late Ded", "Leave Ded", "Short Ded", "Absent Ded", "Salary Ded", "Total Ded",
       "Payable Days", "Per Day", "Monthly", "Net Salary"],
      rows.map((r) => [
        r.full_name, r.employee_code || "", r.department || "",
        r.work_days, r.present_days, r.late_count, r.absent_days, r.leave_days,
        r.late_deduction, r.leave_deduction, r.short_deduction, r.absent_deduction,
        r.salary_deduction, r.total_deduction, r.payable_days, r.per_day_rate,
        r.monthly_salary, r.net_salary,
      ])
    );
  };

  const doSlip = (row: any) => {
    printSalarySlip({ company, row, monthName: MONTHS[month - 1], year });
  };

  const doReport = () => {
    if (rows.length === 0) return;
    printPayrollReport({ company, rows, monthName: MONTHS[month - 1], year });
  };

  const pendingActions = actions.filter((a) => a.status === "pending").length;
  const totalNet = rows.reduce((s, r) => s + Number(r.net_salary || 0), 0);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Salary calculation, master data and deductions." />

      {admin && (
        <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1">
          <TabBtn on={tab === "sheet"} onClick={() => setTab("sheet")}>Payroll</TabBtn>
          <TabBtn on={tab === "salary"} onClick={() => setTab("salary")}>Salary Master</TabBtn>
          <TabBtn on={tab === "actions"} onClick={() => setTab("actions")}>
            Actions {pendingActions > 0 && `(${pendingActions})`}
          </TabBtn>
        </div>
      )}

      {/* ============ PAYROLL SHEET ============ */}
      {(tab === "sheet" || !admin) && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {admin && (
              <>
                <button onClick={doCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
                  <Download className="h-4 w-4" /> Excel
                </button>
                <button onClick={doReport}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
                  <FileStack className="h-4 w-4" /> Full report (PDF)
                </button>
              </>
            )}
          </div>

          {admin && rows.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KpiCard icon={Users2} label="Employees" value={String(rows.length)} tone="slate" />
              <KpiCard icon={UserCheck2} label="Avg present" value={
                (rows.reduce((s, r) => s + Number(r.present_days || 0), 0) / rows.length).toFixed(1)
              } tone="emerald" />
              <KpiCard icon={TrendingDown} label="Total deducted (days)" value={
                rows.reduce((s, r) => s + Number(r.total_deduction || 0), 0).toFixed(1)
              } tone="rose" />
              <KpiCard icon={IndianRupee} label="Total net salary" value={`₹${totalNet.toLocaleString("en-IN")}`} tone="brand" />
            </div>
          )}

          <Card>
            {rows.length === 0 ? (
              <EmptyState icon={Wallet} title="No payroll data"
                hint="Set up Salary Master first, then attendance and leave will compute automatically." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <Th>Employee</Th><Th>Work</Th><Th>Present</Th><Th>Late</Th><Th>Absent</Th>
                      <Th>Leave</Th><Th>Ded.</Th><Th>Payable</Th><Th>Net Salary</Th><Th>&nbsp;</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.employee_id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.full_name}</p>
                          <p className="text-xs text-slate-400">{r.employee_code}{r.department && ` · ${r.department}`}</p>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">{r.work_days}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">{r.present_days}</td>
                        <td className="px-4 py-3 tabular-nums text-amber-600">{r.late_count}</td>
                        <td className="px-4 py-3 tabular-nums text-rose-600">{r.absent_days}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">{r.leave_days}</td>
                        <td className="px-4 py-3 tabular-nums font-medium text-rose-600">{r.total_deduction}</td>
                        <td className="px-4 py-3 tabular-nums font-medium text-slate-900">{r.payable_days}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold text-emerald-700">
                          ₹{Number(r.net_salary).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => doSlip(r)} title="Print salary slip"
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-700">
                            <Printer className="h-3.5 w-3.5" /> Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============ SALARY MASTER ============ */}
      {tab === "salary" && admin && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <Th>Employee</Th><Th>Code</Th><Th>Dept</Th><Th>Monthly</Th>
                  <Th>Basic</Th><Th>HRA</Th><Th>Allow.</Th><Th>PF</Th><Th>Other Ded.</Th><Th>&nbsp;</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const s = salaries.find((x) => x.employee_id === m.id);
                  return (
                    <tr key={m.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{m.full_name}</p>
                        <p className="text-xs text-slate-400">{m.designation}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.employee_code || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{m.department || "—"}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                        ₹{Number(s?.monthly_salary ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">₹{Number(s?.basic ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">₹{Number(s?.hra ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">₹{Number(s?.other_allowance ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">₹{Number(s?.pf ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">₹{Number(s?.other_deduction ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openSalary(m)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-700">
                          <IndianRupee className="h-3.5 w-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ============ ACTIONS ============ */}
      {tab === "actions" && admin && (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={() => setDedOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
              <Plus className="h-4 w-4" /> New deduction
            </button>
          </div>
          <Card>
            {actions.length === 0 ? (
              <EmptyState icon={Users2} title="No payroll actions" hint="Raise a manual deduction and approve it here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {actions.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{a.employee?.full_name}</p>
                        <Badge value={a.status} />
                        {a.deduct_from && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                            {a.deduct_from}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.reason} · {a.deduction_days} day(s) · {MONTHS[a.month - 1]} {a.year}
                      </p>
                    </div>
                    {a.status === "pending" && (
                      <div className="flex shrink-0 gap-1.5">
                        {["cl", "pl", "el", "salary"].map((f) => (
                          <button key={f} onClick={() => approve(a.id, f)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium uppercase text-slate-600 transition hover:border-emerald-600 hover:text-emerald-700">
                            {f}
                          </button>
                        ))}
                        <button onClick={() => reject(a.id)} title="Reject"
                          className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ---------- Salary edit modal ---------- */}
      <Modal open={salOpen} onClose={() => setSalOpen(false)} title="Edit salary">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            For <strong className="font-medium text-slate-900">{salTarget?.full_name}</strong>
          </p>
          <div>
            <label className="text-sm font-medium text-slate-700">Monthly salary (₹)</label>
            <input type="number" className={`mt-1.5 ${inputCls}`} value={sf.monthly_salary}
              onChange={(e) => setSf((p) => ({ ...p, monthly_salary: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Basic</label>
              <input type="number" className={`mt-1.5 ${inputCls}`} value={sf.basic}
                onChange={(e) => setSf((p) => ({ ...p, basic: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">HRA</label>
              <input type="number" className={`mt-1.5 ${inputCls}`} value={sf.hra}
                onChange={(e) => setSf((p) => ({ ...p, hra: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Other allowance</label>
              <input type="number" className={`mt-1.5 ${inputCls}`} value={sf.other_allowance}
                onChange={(e) => setSf((p) => ({ ...p, other_allowance: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">PF deduction</label>
              <input type="number" className={`mt-1.5 ${inputCls}`} value={sf.pf}
                onChange={(e) => setSf((p) => ({ ...p, pf: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Other deduction</label>
            <input type="number" className={`mt-1.5 ${inputCls}`} value={sf.other_deduction}
              onChange={(e) => setSf((p) => ({ ...p, other_deduction: e.target.value }))} />
          </div>
          <button onClick={saveSalary} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save salary"}
          </button>
        </div>
      </Modal>

      {/* ---------- New deduction modal ---------- */}
      <Modal open={dedOpen} onClose={() => setDedOpen(false)} title="New payroll deduction">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Employee *</label>
            <select className={`mt-1.5 ${inputCls}`} value={df.employee_id}
              onChange={(e) => setDf((p) => ({ ...p, employee_id: e.target.value }))}>
              <option value="">Select…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Reason *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="e.g. 6 lates this month"
              value={df.reason} onChange={(e) => setDf((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Deduction (days)</label>
            <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`} value={df.deduction_days}
              onChange={(e) => setDf((p) => ({ ...p, deduction_days: e.target.value }))} />
          </div>
          <p className="text-xs text-slate-500">
            For {MONTHS[month - 1]} {year}. Approve later against CL, PL, EL or salary directly.
          </p>

          {dedError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{dedError}</p>
          )}

          <button onClick={createDeduction} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">{children}</th>;
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "slate" | "emerald" | "rose" | "brand" }) {
  const tones: Record<string, string> = {
    slate: "text-slate-600 bg-slate-50",
    emerald: "text-emerald-700 bg-emerald-50",
    rose: "text-rose-700 bg-rose-50",
    brand: "text-brand-700 bg-brand-50",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}>
      {children}
    </button>
  );
}
