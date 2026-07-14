"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, EmptyState, Modal } from "@/components/ui";
import CameraCapture from "@/components/CameraCapture";
import {
  getPosition, reverseGeocode, getPublicIp,
  fmtTime, fmtDuration, todayISO, MONTHS,
} from "@/lib/geo";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  LogIn, LogOut, MapPin, CalendarCheck, Clock, AlertTriangle,
  Camera, Globe, User, Loader2,
} from "lucide-react";

type Mode = "in" | "out";

export default function AttendancePage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [today, setToday] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [teamRows, setTeamRows] = useState<any[]>([]);
  const [needPhoto, setNeedPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"me" | "team">("me");

  // filter
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  // check-in modal
  const [mode, setMode] = useState<Mode | null>(null);
  const [clock, setClock] = useState(new Date());
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [address, setAddress] = useState<string | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    if (p?.company_id) {
      const { data: c } = await supabase
        .from("companies").select("*").eq("id", p.company_id).single();
      setCompany(c);
    }

    const { data: req } = await supabase.rpc("photo_required_for_me");
    setNeedPhoto(!!req);

    const { data: t } = await supabase
      .from("attendance").select("*")
      .eq("employee_id", auth.user!.id)
      .eq("work_date", todayISO())
      .maybeSingle();
    setToday(t);

    setLoading(false);
  }, [supabase]);

  const loadRows = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const last = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${last}`;

    const { data: mine } = await supabase
      .from("attendance").select("*")
      .eq("employee_id", auth.user!.id)
      .gte("work_date", from).lte("work_date", to)
      .order("work_date", { ascending: false });
    setRows(mine || []);

    const { data: p } = await supabase
      .from("profiles").select("role").eq("id", auth.user!.id).single();

    if (isAdminRole(p?.role)) {
      const { data: all } = await supabase
        .from("attendance")
        .select("*, profiles:employee_id(full_name, designation)")
        .gte("work_date", from).lte("work_date", to)
        .order("work_date", { ascending: false });
      setTeamRows(all || []);
    }
  }, [supabase, month, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRows(); }, [loadRows]);

  // live clock while the modal is open
  useEffect(() => {
    if (!mode) return;
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, [mode]);

  const openForm = async (m: Mode) => {
    setMode(m);
    setError("");
    setPhotoBlob(null);
    setAddress(null);
    setIp(null);
    setCoords({ lat: null, lng: null });
    setClock(new Date());

    setLocating(true);
    const pos = await getPosition();
    setCoords(pos);

    const [addr, myIp] = await Promise.all([
      company?.capture_location !== false ? reverseGeocode(pos.lat, pos.lng) : Promise.resolve(null),
      company?.capture_ip !== false ? getPublicIp() : Promise.resolve(null),
    ]);
    setAddress(addr);
    setIp(myIp);
    setLocating(false);
  };

  const submit = async () => {
    setError("");
    if (needPhoto && !photoBlob) {
      return setError("A photo is required. Please take a picture.");
    }

    setSubmitting(true);
    let photoUrl: string | null = null;

    if (photoBlob) {
      const path = `${me!.company_id}/${me!.id}/${Date.now()}-${mode}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("attendance-photos")
        .upload(path, photoBlob, { contentType: "image/jpeg" });

      if (upErr) {
        setSubmitting(false);
        return setError(`Photo upload failed: ${upErr.message}`);
      }
      photoUrl = supabase.storage.from("attendance-photos").getPublicUrl(path).data.publicUrl;
    }

    const args = {
      p_lat: coords.lat, p_lng: coords.lng,
      p_photo: photoUrl, p_address: address, p_ip: ip,
    };

    const { error: rpcErr } = await supabase.rpc(
      mode === "in" ? "check_in" : "check_out", args
    );

    setSubmitting(false);
    if (rpcErr) return setError(rpcErr.message);

    setMode(null);
    load();
    loadRows();
  };

  const admin = isAdminRole(me?.role);
  const checkedIn = !!today?.check_in;
  const checkedOut = !!today?.check_out;
  const liveMins = checkedIn && !checkedOut
    ? Math.max(0, Math.round((Date.now() - new Date(today.check_in).getTime()) / 60000))
    : today?.work_minutes || 0;

  const list = admin && tab === "team" ? teamRows : rows;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const present = rows.filter((r) => r.status === "present").length;
  const late = rows.filter((r) => r.is_late).length;

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark your attendance and review your history." />

      {/* Today */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Today · {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div className="mt-2.5 flex items-center gap-5">
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
            {today?.check_in_address && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="h-3 w-3" /> {today.check_in_address}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {!checkedIn && (
              <button onClick={() => openForm("in")}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700">
                <LogIn className="h-4 w-4" /> Check in
              </button>
            )}
            {checkedIn && !checkedOut && (
              <button onClick={() => openForm("out")}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 font-medium text-white transition hover:bg-rose-700">
                <LogOut className="h-4 w-4" /> Check out
              </button>
            )}
            {checkedOut && (
              <span className="flex items-center gap-2 rounded-lg bg-slate-100 px-6 py-3 text-sm font-medium text-slate-500">
                <Clock className="h-4 w-4" /> Day complete
              </span>
            )}
            {today?.check_in_photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={today.check_in_photo} alt="Check-in"
                className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
            )}
          </div>
        </div>
      </Card>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600">
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        {tab === "me" && (
          <div className="flex gap-4 text-xs text-slate-500">
            <span><strong className="text-slate-900">{present}</strong> present</span>
            <span><strong className="text-amber-600">{late}</strong> late</span>
          </div>
        )}

        {admin && (
          <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["me", "team"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}>
                {t === "me" ? "My records" : "Team"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Records */}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {list.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No records this month"
              hint="Check in to create your first attendance record." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    {admin && tab === "team" && <Th>Employee</Th>}
                    <Th>Date</Th><Th>In</Th><Th>Out</Th><Th>Hours</Th>
                    <Th>Location</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((r: any) => (
                    <tr key={r.id} className="transition hover:bg-slate-50">
                      {admin && tab === "team" && (
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.profiles?.full_name || "—"}</p>
                          <p className="text-xs text-slate-400">{r.profiles?.designation}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(r.work_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.check_in_photo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.check_in_photo} alt="" className="h-7 w-7 rounded object-cover" />
                          )}
                          <span className="tabular-nums text-slate-600">{fmtTime(r.check_in)}</span>
                          {r.is_late && <span className="text-[10px] font-semibold text-amber-600">LATE</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtTime(r.check_out)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtDuration(r.work_minutes)}</td>
                      <td className="max-w-[180px] px-4 py-3">
                        {r.check_in_address ? (
                          <span className="block truncate text-xs text-slate-500" title={r.check_in_address}>
                            {r.check_in_address}
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><Badge value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ---------- Check in / out form ---------- */}
      <Modal open={!!mode} onClose={() => !submitting && setMode(null)}
        title={mode === "in" ? "Check in" : "Check out"}>
        <div className="space-y-4">
          {/* Employee */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white">
              {(me?.full_name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{me?.full_name}</p>
              <p className="truncate text-xs text-slate-500">
                {me?.designation || me?.role}
                {me?.department && ` · ${me.department}`}
              </p>
            </div>
          </div>

          {/* Date & live time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Date</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {clock.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Time</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
              </p>
            </div>
          </div>

          {/* Location + IP */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Location</p>
                {locating ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting…
                  </p>
                ) : (
                  <p className="text-sm text-slate-700">
                    {address || (coords.lat ? `${coords.lat.toFixed(5)}, ${coords.lng?.toFixed(5)}` : "Unavailable")}
                  </p>
                )}
              </div>
            </div>
            {ip && (
              <div className="flex items-center gap-2.5 border-t border-slate-100 pt-2">
                <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">IP address</p>
                  <p className="text-sm tabular-nums text-slate-700">{ip}</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera */}
          {needPhoto && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Camera className="h-4 w-4" /> Photo <span className="text-rose-500">*</span>
              </p>
              <CameraCapture
                onCapture={(blob) => setPhotoBlob(blob)}
                onError={(m) => setError(m)}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={submit} disabled={submitting || locating}
            className={`w-full rounded-lg py-3 font-medium text-white transition disabled:opacity-60 ${
              mode === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}>
            {submitting ? "Submitting…" : mode === "in" ? "Confirm check in" : "Confirm check out"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
      {children}
    </th>
  );
}
