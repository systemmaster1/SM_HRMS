"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, EmptyState, Modal, inputCls } from "@/components/ui";
import { FadeIn, StaggerGroup, StaggerItem, MotionButton, SkeletonRows, motion } from "@/components/motion";
import CameraCapture from "@/components/CameraCapture";
import { exportCsv, printReport } from "@/lib/export";
import {
  getPosition, reverseGeocode, getPublicIp,
  fmtTime, fmtDuration, todayISO,
} from "@/lib/geo";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  LogIn, LogOut, MapPin, CalendarCheck, Clock, AlertTriangle,
  Camera, Globe, Loader2, Download, Printer, ExternalLink, Navigation,
} from "lucide-react";

type Mode = "in" | "out";

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export default function AttendancePage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [today, setToday] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [needPhoto, setNeedPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"me" | "team">("me");

  // filters
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [emp, setEmp] = useState("");

  // check in/out form
  const [mode, setMode] = useState<Mode | null>(null);
  const [clock, setClock] = useState(new Date());
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [address, setAddress] = useState<string | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // detail
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: c } = await supabase
      .from("companies").select("*").eq("id", p!.company_id).single();
    setCompany(c);

    const { data: req } = await supabase.rpc("photo_required_for_me");
    setNeedPhoto(!!req);

    const { data: t } = await supabase
      .from("attendance").select("*")
      .eq("employee_id", auth.user!.id)
      .eq("work_date", todayISO())
      .maybeSingle();
    setToday(t);

    if (isAdminRole((p as Profile)?.role)) {
      const { data: m } = await supabase
        .from("profiles").select("*").eq("status", "active").order("full_name");
      setMembers((m as Profile[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  const loadRows = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("role").eq("id", auth.user!.id).single();
    const admin = isAdminRole(p?.role);

    let q = supabase
      .from("attendance")
      .select("*, profiles:employee_id(full_name, designation, department, employee_code)")
      .gte("work_date", from).lte("work_date", to)
      .order("work_date", { ascending: false });

    if (!admin || tab === "me") {
      q = q.eq("employee_id", auth.user!.id);
    } else if (emp) {
      q = q.eq("employee_id", emp);
    }

    const { data } = await q;
    setRows(data || []);
  }, [supabase, from, to, emp, tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRows(); }, [loadRows]);

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
    if (needPhoto && !photoBlob) return setError("A photo is required. Please take a picture.");

    setSubmitting(true);
    let photoUrl: string | null = null;

    if (photoBlob) {
      const path = `${me!.company_id}/${me!.id}/${Date.now()}-${mode}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("attendance-photos")
        .upload(path, photoBlob, { contentType: "image/jpeg", upsert: false });

      if (upErr) {
        setSubmitting(false);
        return setError(`Photo upload failed: ${upErr.message}`);
      }
      photoUrl = supabase.storage.from("attendance-photos").getPublicUrl(path).data.publicUrl;
    }

    const { error: rpcErr } = await supabase.rpc(mode === "in" ? "check_in" : "check_out", {
      p_lat: coords.lat, p_lng: coords.lng,
      p_photo: photoUrl, p_address: address, p_ip: ip,
    });

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

  const mapUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

  /* ---------- Exports ---------- */
  const doCsv = () => {
    exportCsv(
      `attendance-${from}-to-${to}`,
      ["Employee", "Code", "Date", "Check in", "Check out", "Hours", "Status", "Late (min)", "Location", "Distance (m)", "Office"],
      rows.map((r) => [
        r.profiles?.full_name || "",
        r.profiles?.employee_code || "",
        r.work_date,
        fmtTime(r.check_in),
        fmtTime(r.check_out),
        fmtDuration(r.work_minutes),
        r.status,
        r.late_minutes || 0,
        r.check_in_address || "",
        r.check_in_distance_m ?? "",
        r.check_in_outside ? "Out of office" : "In office",
      ])
    );
  };

  const doPdf = () => {
    // group by employee, one page each
    const byEmp: Record<string, any[]> = {};
    rows.forEach((r) => {
      const k = r.profiles?.full_name || "Me";
      (byEmp[k] ||= []).push(r);
    });

    const html = Object.entries(byEmp).map(([name, list]) => {
      const present = list.filter((r) => r.status === "present").length;
      const late = list.filter((r) => r.is_late).length;
      const outside = list.filter((r) => r.check_in_outside).length;
      const p0 = list[0]?.profiles;

      const trs = list
        .slice()
        .sort((a, b) => a.work_date.localeCompare(b.work_date))
        .map((r) => `<tr>
          <td>${new Date(r.work_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
          <td class="${r.is_late ? "late" : ""}">${fmtTime(r.check_in)}${r.is_late ? " (late)" : ""}</td>
          <td>${fmtTime(r.check_out)}</td>
          <td>${fmtDuration(r.work_minutes)}</td>
          <td>${(r.check_in_address || "—").replace(/</g, "")}</td>
          <td class="${r.check_in_outside ? "out" : "in"}">
            ${r.check_in_outside
              ? `Out of office${r.check_in_distance_m ? ` (${r.check_in_distance_m} m)` : ""}`
              : "In office"}
          </td>
          <td>${r.status.replace("_", " ")}</td>
        </tr>`).join("");

      return `<div class="emp">
        <h1>${name}</h1>
        <div class="sub">${p0?.designation || ""}${p0?.department ? ` · ${p0.department}` : ""}${p0?.employee_code ? ` · ${p0.employee_code}` : ""}</div>
        <div class="card"><div class="grid">
          <div><span>Period</span><strong>${from} → ${to}</strong></div>
          <div><span>Present</span><strong>${present}</strong></div>
          <div><span>Late</span><strong>${late}</strong></div>
          <div><span>Out of office</span><strong>${outside}</strong></div>
        </div></div>
        <table>
          <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Location</th><th>Office</th><th>Status</th></tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`;
    }).join("");

    printReport(`Attendance ${from} to ${to}`, html || "<p>No records.</p>");
  };

  const present = rows.filter((r) => r.status === "present").length;
  const lateN = rows.filter((r) => r.is_late).length;
  const outN = rows.filter((r) => r.check_in_outside).length;

  return (
    <div>
      <FadeIn>
        <PageHeader title="Attendance" subtitle="Mark your attendance and review records." />
      </FadeIn>

      {/* Today */}
      <FadeIn delay={0.05}>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Today · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div className="mt-2.5 flex items-center gap-5">
              <Stat label="Check in" value={fmtTime(today?.check_in)} />
              <div className="h-8 w-px bg-slate-200" />
              <Stat label="Check out" value={fmtTime(today?.check_out)} />
              <div className="h-8 w-px bg-slate-200" />
              <Stat label="Worked" value={fmtDuration(liveMins)} />
            </div>
            {today?.is_late && (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Late by {today.late_minutes} min
              </p>
            )}
            {today?.check_in_outside && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                <Navigation className="h-3.5 w-3.5" />
                Out of office · {today.check_in_distance_m} m away
              </p>
            )}
            {today?.check_in_address && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="h-3 w-3" /> {today.check_in_address}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {today?.check_in_photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={today.check_in_photo} alt="Check-in"
                className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
            )}
            {!checkedIn && (
              <MotionButton onClick={() => openForm("in")}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
                <LogIn className="h-4 w-4" /> Check in
              </MotionButton>
            )}
            {checkedIn && !checkedOut && (
              <MotionButton onClick={() => openForm("out")}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-rose-700">
                <LogOut className="h-4 w-4" /> Check out
              </MotionButton>
            )}
            {checkedOut && (
              <span className="flex items-center gap-2 rounded-lg bg-slate-100 px-6 py-3 text-sm font-medium text-slate-500">
                <Clock className="h-4 w-4" /> Day complete
              </span>
            )}
          </div>
        </div>
      </Card>
      </FadeIn>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600" />
        </div>

        {admin && tab === "team" && (
          <div>
            <label className="text-xs font-medium text-slate-500">Employee</label>
            <select value={emp} onChange={(e) => setEmp(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600">
              <option value="">All employees</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        )}

        {admin && (
          <div className="flex gap-2">
            <button onClick={doCsv}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
              <Download className="h-4 w-4" /> Excel
            </button>
            <button onClick={doPdf}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-700">
              <Printer className="h-4 w-4" /> PDF
            </button>
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

      {/* Summary */}
      <div className="mb-3 flex gap-5 text-xs text-slate-500">
        <span><strong className="text-slate-900">{rows.length}</strong> records</span>
        <span><strong className="text-emerald-600">{present}</strong> present</span>
        <span><strong className="text-amber-600">{lateN}</strong> late</span>
        {company?.geofence_enabled && (
          <span><strong className="text-rose-600">{outN}</strong> out of office</span>
        )}
      </div>

      {/* Records */}
      {loading ? (
        <Card><SkeletonRows rows={6} /></Card>
      ) : (
        <Card>
          {rows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No records in this range"
              hint="Adjust the dates, or check in to create a record." />
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
                  {rows.map((r: any, i: number) => (
                    <motion.tr key={r.id} onClick={() => setDetail(r)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.3) }}
                      whileHover={{ backgroundColor: "rgba(148,163,184,0.08)" }}
                      className="cursor-pointer">
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
                          {r.is_auto && <span className="text-[10px] font-semibold text-slate-400" title="Marked automatically">AUTO</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtTime(r.check_out)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtDuration(r.work_minutes)}</td>
                      <td className="max-w-[190px] px-4 py-3">
                        {r.check_in_outside ? (
                          <span className="text-xs font-medium text-rose-600">
                            Out of office · {r.check_in_distance_m} m
                          </span>
                        ) : r.check_in_address ? (
                          <span className="block truncate text-xs text-slate-500" title={r.check_in_address}>
                            {r.check_in_address}
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><Badge value={r.status} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ---------- Log activity detail ---------- */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Activity log">
        {detail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-sm font-semibold text-slate-900">
                {detail.profiles?.full_name || me?.full_name}
              </p>
              <p className="text-xs text-slate-500">
                {detail.profiles?.designation || me?.designation}
                {" · "}
                {new Date(detail.work_date).toLocaleDateString("en-IN",
                  { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <div className="mt-2 flex gap-2">
                <Badge value={detail.status} />
                {detail.is_late && <Badge value="late" />}
              </div>
            </div>

            <Leg title="Check in" time={detail.check_in} photo={detail.check_in_photo}
              address={detail.check_in_address} lat={detail.check_in_lat} lng={detail.check_in_lng}
              ip={detail.check_in_ip} outside={detail.check_in_outside}
              distance={detail.check_in_distance_m} mapUrl={mapUrl} tone="emerald" />

            <Leg title="Check out" time={detail.check_out} photo={detail.check_out_photo}
              address={detail.check_out_address} lat={detail.check_out_lat} lng={detail.check_out_lng}
              ip={detail.check_out_ip} outside={detail.check_out_outside}
              distance={detail.check_out_distance_m} mapUrl={mapUrl} tone="rose" />

            <div className="flex justify-between rounded-xl border border-slate-200 p-3.5 text-sm">
              <span className="text-slate-500">Total worked</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {fmtDuration(detail.work_minutes)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Check in / out form ---------- */}
      <Modal open={!!mode} onClose={() => !submitting && setMode(null)}
        title={mode === "in" ? "Check in" : "Check out"}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white">
              {(me?.full_name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{me?.full_name}</p>
              <p className="truncate text-xs text-slate-500">
                {me?.designation || me?.role}{me?.department && ` · ${me.department}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Box label="Date" value={clock.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
            <Box label="Time" value={clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} />
          </div>

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

          {needPhoto && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Camera className="h-4 w-4" /> Photo <span className="text-rose-500">*</span>
              </p>
              <CameraCapture
                onCapture={(blob) => { setPhotoBlob(blob); if (blob) setError(""); }}
                onError={(m) => setError(m)}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <MotionButton onClick={submit} disabled={submitting || locating}
            className={`w-full rounded-lg py-3 font-medium text-white transition-colors disabled:opacity-60 ${
              mode === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}>
            {submitting ? "Submitting…" : mode === "in" ? "Confirm check in" : "Confirm check out"}
          </MotionButton>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- small pieces ---------- */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">{children}</th>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Leg({
  title, time, photo, address, lat, lng, ip, outside, distance, mapUrl, tone,
}: any) {
  if (!time) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-3.5 text-center">
        <p className="text-xs text-slate-400">{title} — not recorded</p>
      </div>
    );
  }
  const ring = tone === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className={`h-2 w-2 rounded-full ${ring}`} /> {title}
        </p>
        <p className="text-sm font-semibold tabular-nums text-slate-900">{fmtTime(time)}</p>
      </div>

      <div className="mt-3 flex gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt=""
            className="h-24 w-24 shrink-0 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-slate-50 text-[10px] text-slate-300">
            No photo
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5 text-xs">
          {address && (
            <p className="flex items-start gap-1.5 text-slate-600">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
              <span>{address}</span>
            </p>
          )}
          {outside ? (
            <p className="flex items-center gap-1.5 font-medium text-rose-600">
              <Navigation className="h-3 w-3" /> Out of office · {distance} m away
            </p>
          ) : distance != null ? (
            <p className="flex items-center gap-1.5 font-medium text-emerald-600">
              <Navigation className="h-3 w-3" /> In office · {distance} m
            </p>
          ) : null}
          {ip && (
            <p className="flex items-center gap-1.5 tabular-nums text-slate-400">
              <Globe className="h-3 w-3" /> {ip}
            </p>
          )}
          {lat && (
            <a href={mapUrl(lat, lng)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800">
              Open in Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
