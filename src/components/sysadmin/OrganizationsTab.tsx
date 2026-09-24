"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { exportCsv } from "@/lib/export";
import { FEATURES, type FeatureKey } from "@/lib/features/registry";
import OrgDrawer from "./OrgDrawer";
import { card, inputCls, btnGhost, fmtDate, ago, billingChip, statusChip, Chip, featureName } from "./shared";

const PAGE = 25;
const topModules = (Object.keys(FEATURES) as FeatureKey[]).filter((k) => !FEATURES[k].parent);

export default function OrganizationsTab() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [billing, setBilling] = useState("");
  const [ads, setAds] = useState("");
  const [moduleKey, setModuleKey] = useState("");
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the search box
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 350); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("system_admin_org_list", {
      p_search: q || null, p_status: status || null, p_billing: billing || null, p_ads: ads || null,
      p_module: moduleKey || null, p_sort: sort, p_dir: dir, p_limit: PAGE, p_offset: page * PAGE,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setError("");
    setRows((data as any)?.rows || []);
    setTotal((data as any)?.total || 0);
  }, [supabase, q, status, billing, ads, moduleKey, sort, dir, page]);

  useEffect(() => { load(); }, [load]);

  const sortBy = (k: string) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(k); setDir(k === "name" || k === "org_code" ? "asc" : "desc"); }
    setPage(0);
  };
  const Th = ({ k, children }: { k?: string; children: React.ReactNode }) => (
    <th className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {k ? (
        <button onClick={() => sortBy(k)} className={`inline-flex items-center gap-1 ${sort === k ? "text-brand-700 dark:text-brand-300" : ""}`}>
          {children}<ArrowUpDown className="h-3 w-3" />
        </button>
      ) : children}
    </th>
  );

  const doExport = async () => {
    const { data } = await supabase.rpc("system_admin_org_list", {
      p_search: q || null, p_status: status || null, p_billing: billing || null, p_ads: ads || null,
      p_module: moduleKey || null, p_sort: sort, p_dir: dir, p_limit: 200, p_offset: 0,
    });
    const list = (data as any)?.rows || [];
    exportCsv("SystemMaster_organizations",
      ["Organization ID", "Name", "Admin", "Admin email", "Phone", "Registered", "Billing", "Plan", "Plan end",
       "Employees", "Modules", "Ads", "Status", "Last activity"],
      list.map((r: any) => [r.org_code, r.name, r.admin?.name || "", r.admin?.email || "", r.phone || "",
        fmtDate(r.created_at), r.billing, r.plan_code || "", fmtDate(r.plan_end), r.employees,
        (r.modules || []).map(featureName).join(", "), r.ads ? "Shown" : "Ad-free", r.account_status, fmtDate(r.last_activity)]));
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-col gap-3 p-4 lg:flex-row lg:items-center`}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-9`} placeholder="Search name, Organization ID, admin, email or phone"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
          <select className={inputCls} value={billing} onChange={(e) => { setBilling(e.target.value); setPage(0); }}>
            <option value="">Free / trial / paid</option><option value="free">Free</option><option value="trial">Trial</option><option value="paid">Paid</option>
          </select>
          <select className={inputCls} value={ads} onChange={(e) => { setAds(e.target.value); setPage(0); }}>
            <option value="">Ads: any</option><option value="on">Showing ads</option><option value="off">Ad-free</option>
          </select>
          <select className={inputCls} value={moduleKey} onChange={(e) => { setModuleKey(e.target.value); setPage(0); }}>
            <option value="">Any module</option>
            {(Object.keys(FEATURES) as FeatureKey[]).map((k) => <option key={k} value={k}>{FEATURES[k].parent ? "— " : ""}{FEATURES[k].label}</option>)}
          </select>
        </div>
        <button onClick={doExport} className={btnGhost}><Download className="h-4 w-4" /> Export</button>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <Th k="org_code">Org ID</Th><Th k="name">Organization</Th><Th>Admin / contact</Th>
                <Th k="created_at">Registered</Th><Th>Plan</Th><Th k="plan_end">Plan end</Th>
                <Th k="employees">Employees</Th><Th>Modules</Th><Th>Ads</Th><Th>Status</Th><Th k="last_activity">Last activity</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">No organizations match these filters.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{r.org_code}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
                    {r.pending_requests > 0 && <Chip tone="amber">{r.pending_requests} request{r.pending_requests > 1 ? "s" : ""}</Chip>}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <p className="text-slate-800 dark:text-slate-200">{r.admin?.name || "—"}</p>
                    <p className="text-slate-500">{r.admin?.email || r.email || ""}</p>
                    <p className="text-slate-500">{r.admin?.phone || r.phone || ""}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-3">{billingChip(r.billing)}<p className="mt-1 text-[11px] capitalize text-slate-500">{r.plan_code || "—"}</p></td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{fmtDate(r.plan_end)}</td>
                  <td className="px-3 py-3 tabular-nums">{r.employees}</td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {topModules.map((k) => (
                        <span key={k} title={FEATURES[k].label}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${(r.modules || []).includes(k)
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-400 line-through dark:bg-slate-700"}`}>
                          {FEATURES[k].label.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">{r.ads ? <Chip tone="amber">Ads</Chip> : <Chip tone="violet">Ad-free</Chip>}</td>
                  <td className="px-3 py-3">{statusChip(r.account_status)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{ago(r.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-700">
          <span className="text-slate-500">{total} organization{total === 1 ? "" : "s"} · page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <button className={btnGhost} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
            <button className={btnGhost} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <OrgDrawer companyId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}
