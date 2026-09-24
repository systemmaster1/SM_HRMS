"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { card, inputCls, btnGhost, fmtDateTime, featureName } from "./shared";

const PAGE = 50;

const summary = (a: any) => {
  const o = a.old_value || {}, n = a.new_value || {};
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter((k) => !["company_id", "id", "updated_at", "created_at"].includes(k));
  return keys.slice(0, 4).map((k) => `${k}: ${JSON.stringify(o[k] ?? null)} → ${JSON.stringify(n[k] ?? null)}`).join(" · ");
};

export default function AuditTab() {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 350); return () => clearTimeout(t); }, [search]);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("system_admin_audit", { p_search: q || null, p_limit: PAGE, p_offset: page * PAGE });
    setRows((data as any)?.rows || []);
    setTotal((data as any)?.total || 0);
  }, [supabase, q, page]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className={`${inputCls} pl-9`} placeholder="Search Organization ID, name, action, module or person"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
              <tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Organization</th><th className="px-4 py-2.5">By</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Change</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((a, i) => (
                <tr key={i} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(a.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs"><span className="font-mono text-brand-700 dark:text-brand-300">{a.org_code || "—"}</span><br /><span className="text-slate-500">{a.org_name || "All organizations"}</span></td>
                  <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200">{a.actor_label}</td>
                  <td className="px-4 py-2.5 text-xs"><b className="text-slate-800 dark:text-slate-100">{a.action.replaceAll("_", " ")}</b>{a.entity_key ? <><br /><span className="text-slate-500">{featureName(a.entity_key)}</span></> : null}</td>
                  <td className="max-w-md break-words px-4 py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{summary(a)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No entries.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-700">
          <span className="text-slate-500">{total} entries · page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <button className={btnGhost} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
            <button className={btnGhost} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
