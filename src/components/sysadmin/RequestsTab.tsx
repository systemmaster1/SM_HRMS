"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptDialog, toast } from "@/components/Dialogs";
import { card, btnPrimary, btnGhost, fmtDateTime, Chip, featureName } from "./shared";

export default function RequestsTab({ onOpenOrg }: { onOpenOrg: (id: string) => void }) {
  const supabase = createClient();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("system_admin_module_requests", { p_status: status || null });
    setLoading(false);
    if (error) return toast(error.message, "error");
    setRows((data as any[]) || []);
  }, [supabase, status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (r: any, approve: boolean) => {
    const note = await promptDialog({
      title: `${approve ? "Approve" : "Decline"} ${featureName(r.feature_key)} for ${r.org_name}?`,
      message: approve ? "The module is switched on immediately for the whole organization." : "The organization will see the request as declined.",
      placeholder: approve ? "e.g. Paid via invoice #123" : "Reason", required: !approve,
      confirmText: approve ? "Approve" : "Decline",
    });
    if (note === null) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("system_admin_decide_module_request", { p_request: r.id, p_approve: approve, p_note: note || null });
    setBusy(null);
    if (error) return toast(error.message, "error");
    toast(approve ? "Approved: module enabled." : "Request declined.");
    load();
  };

  const tone = (s: string) => (s === "approved" ? "green" : s === "declined" ? "red" : s === "pending" ? "amber" : "slate") as any;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {[["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"], ["cancelled", "Cancelled"], ["", "All"]].map(([v, l]) => (
          <button key={l} onClick={() => setStatus(v)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${status === v ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className={`${card} overflow-hidden`}>
        {loading ? <p className="p-6 text-sm text-slate-400">Loading…</p> : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No requests here.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {featureName(r.feature_key)} <span className="font-normal text-slate-500">for</span>{" "}
                    <button onClick={() => onOpenOrg(r.company_id)} className="text-brand-700 hover:underline dark:text-brand-300">{r.org_name}</button>
                    <span className="ml-2 font-mono text-xs text-slate-400">{r.org_code}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Requested {fmtDateTime(r.requested_at)}{r.requested_by ? ` by ${r.requested_by}` : ""}
                    {r.decided_at ? ` · decided ${fmtDateTime(r.decided_at)}` : ""}{r.decision_note ? ` · "${r.decision_note}"` : ""}
                  </p>
                </div>
                <Chip tone={tone(r.status)}>{r.status}</Chip>
                {r.status === "pending" && (
                  <>
                    <button disabled={busy === r.id} onClick={() => decide(r, true)} className={btnPrimary}>Approve</button>
                    <button disabled={busy === r.id} onClick={() => decide(r, false)} className={btnGhost}>Decline</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
