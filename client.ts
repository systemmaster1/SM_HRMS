"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { getPosition, fmtTime, fmtDuration, todayISO } from "@/lib/geo";
import { type Profile, isAdminRole } from "@/lib/types";
import { LogIn, LogOut, MapPin, CalendarCheck, Clock, AlertTriangle } from "lucide-react";

export default function AttendancePage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [today, setToday] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"me" | "team">("me");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: t } = await supabase
      .from("attendance").select("*")
      .eq("employee_id", auth.user!.id)
      .eq("work_date", todayISO())
      .maybeSingle();
    setToday(t);

    const { data: hist } = await supabase
      .from("attendance").select("*")
      .eq("employee_id", auth.user!.id)
      .order("work_date", { ascending: false })
      .limit(30);
    setMine(hist || []);

    if (isAdminRole((p as Profile)?.role)) {
      const { data: all } = await supabase
        .from("attendance")
        .select("*, profiles:employee_id(full_name)")
        .order("work_date", { ascending: false })
        .limit(60);
      setTeam(all || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const doCheckIn = async () => {
    setBusy(true); setError("");
    const { lat, lng } = await getPosition();
    const { error } = await supabase.rpc("check_in", { p_lat: lat, p_lng: lng });
    setBusy(false);
    if (error) return setError(error.message);
    load();
  };

  const doCheckOut = async () => {
    setBusy(true); setError("");
    const { lat, lng } = await getPosition();
    const { error } = await supabase.rpc("check_out", { p_lat: lat, p_lng: lng });
    setBusy(false);
    if (error) return setError(error.message);
    load();
  };

  const admin = isAdminRole(me?.role);
  const checkedIn = !!today?.check_in;
  const checkedOut = !!today?.check_out;

  const liveMins = checkedIn && !checkedOut
    ? Math.max(0, Math.round((Date.now() - new Date(today.check_in).getTime()) / 60000))
    : today?.work_minutes || 0;

  const rows = admin && tab === "team" ? team : mine;

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark your attendance and view records." />

      <Card className="mb-6">
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Today · {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </p>

              <div className="mt-2 flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-500">Check in</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{fmtTime(today?.check_in)}</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-500">Check out</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{fmtTime(today?.check_out)}</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-500">Worked</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{fmtDuration(liveMins)}</p>
                </div>
              </div>

              {today?.is_late && (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> Late by {today.late_minutes} min
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {!checkedIn && (
                <button onClick={doCheckIn} disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60">
                  <LogIn className="h-4 w-4" /> {busy ? "Locating…" : "Check in"}
                </button>
              )}
              {checkedIn && !checkedOut && (
                <button onClick={doCheckOut} disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-3 font-medium text-white transition hover:bg-rose-700 disabled:opacity-60">
                  <LogOut className="h-4 w-4" /> {busy ? "Locating…" : "Check out"}
                </button>
              )}
              {checkedOut && (
                <span className="flex items-center gap-2 rounded-lg bg-slate-100 px-5 py-3 text-sm font-medium text-slate-500">
                  <Clock className="h-4 w-4" /> Day complete
                </span>
              )}
              {today?.check_in_lat && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin className="h-3 w-3" /> Location captured
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}
        </div>
      </Card>

      {admin && (
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          {(["me", "team"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t === "me" ? "My records" : "Team records"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {rows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No records yet"
              hint="Check in to create your first attendance record." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    {admin && tab === "team" && (
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Employee</th>
                    )}
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Date</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">In</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Out</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Hours</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r: any) => (
                    <tr key={r.id} className="transition hover:bg-slate-50">
                      {admin && tab === "team" && (
                        <td className="px-4 py-3 font-medium text-slate-900">{r.profiles?.full_name || "—"}</td>
                      )}
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(r.work_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {fmtTime(r.check_in)}
                        {r.is_late && <span className="ml-1.5 text-[10px] font-medium text-amber-600">LATE</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtTime(r.check_out)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtDuration(r.work_minutes)}</td>
                      <td className="px-4 py-3"><Badge value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
