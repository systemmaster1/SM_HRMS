/**
 * GPS route analysis for field staff: cleans raw points, measures distance,
 * finds stops and GPS gaps. Pure functions — used by the tracking screen and
 * the PDF visit log so both always show the same numbers.
 */
export type GpsPoint = { lat: number; lng: number; at: number; accuracy?: number | null };

export type Stop = { lat: number; lng: number; from: number; to: number; minutes: number };
export type Gap = { from: number; to: number; minutes: number };

const R = 6371_000; // metres
const rad = (d: number) => (d * Math.PI) / 180;

export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Converts database rows (latitude/longitude/captured_at) into sorted points. */
export function toPoints(rows: any[]): GpsPoint[] {
  return rows
    .map((r) => ({
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      at: new Date(r.captured_at || r.event_time || r.created_at).getTime(),
      accuracy: r.accuracy_m ?? null,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.0001 && Number.isFinite(p.at))
    .sort((a, b) => a.at - b.at);
}

/**
 * Removes noise: very inaccurate fixes (> 150 m), duplicates, and
 * "teleport" jumps that would need more than 150 km/h.
 */
export function cleanTrack(points: GpsPoint[]): GpsPoint[] {
  const out: GpsPoint[] = [];
  for (const p of points) {
    if (p.accuracy != null && p.accuracy > 150) continue;
    const prev = out[out.length - 1];
    if (prev) {
      const d = metres(prev, p);
      const secs = Math.max(1, (p.at - prev.at) / 1000);
      if (d < 3 && secs < 60) continue;                   // duplicate
      if (d / secs > 41.7 && d > 500) continue;            // > 150 km/h jump
    }
    out.push(p);
  }
  return out;
}

/**
 * Road-distance estimate in km. Movements under 25 m (GPS drift while
 * standing still) are ignored.
 */
export function distanceKm(track: GpsPoint[]): number {
  let m = 0;
  let anchor = track[0];
  for (let i = 1; i < track.length; i++) {
    const d = metres(anchor, track[i]);
    if (d >= 25) { m += d; anchor = track[i]; }
  }
  return m / 1000;
}

/** Places where the person stayed within ~120 m for at least `minMinutes`. */
export function findStops(track: GpsPoint[], minMinutes = 10, radiusM = 120, gapMinutes = 20): Stop[] {
  const stops: Stop[] = [];
  let i = 0;
  while (i < track.length) {
    let j = i + 1;
    // Stay inside the radius, but never stretch a stop across a GPS gap —
    // we do not know where the person was while there was no signal.
    while (
      j < track.length &&
      metres(track[i], track[j]) <= radiusM &&
      track[j].at - track[j - 1].at < gapMinutes * 60000
    ) j++;
    const from = track[i].at;
    const to = track[j - 1].at;
    const minutes = (to - from) / 60000;
    if (minutes >= minMinutes) {
      const seg = track.slice(i, j);
      stops.push({
        lat: seg.reduce((a, p) => a + p.lat, 0) / seg.length,
        lng: seg.reduce((a, p) => a + p.lng, 0) / seg.length,
        from, to, minutes: Math.round(minutes),
      });
      i = j;
    } else {
      i++;
    }
  }
  return stops;
}

/** Periods with no GPS signal for longer than `minMinutes`. */
export function findGaps(track: GpsPoint[], minMinutes = 20): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 1; i < track.length; i++) {
    const minutes = (track[i].at - track[i - 1].at) / 60000;
    if (minutes >= minMinutes) gaps.push({ from: track[i - 1].at, to: track[i].at, minutes: Math.round(minutes) });
  }
  return gaps;
}

/** Full summary for one person-day. */
export function analyseDay(rows: any[]) {
  const track = cleanTrack(toPoints(rows));
  const stops = findStops(track);
  const gaps = findGaps(track);
  const first = track[0]?.at ?? null;
  const last = track[track.length - 1]?.at ?? null;
  return {
    track,
    stops,
    gaps,
    km: distanceKm(track),
    first,
    last,
    fieldMinutes: first && last ? Math.round((last - first) / 60000) : 0,
    rawPoints: rows.length,
  };
}

/* ---------- Visit helpers (planned vs actual) ---------- */

export const visitArrival = (v: any): string | null => v.reached_at || v.check_in_at || null;

/** Minutes spent at the client: arrival (or meeting start) → completion. */
export function visitMinutes(v: any): number | null {
  const start = v.meeting_started_at || visitArrival(v);
  if (!start || !v.completed_at) return null;
  const m = Math.round((new Date(v.completed_at).getTime() - new Date(start).getTime()) / 60000);
  return m >= 0 ? m : null;
}

/** + late / − early, against the planned time. */
export function arrivalDelayMinutes(v: any): number | null {
  const a = visitArrival(v);
  if (!a || !v.scheduled_at) return null;
  return Math.round((new Date(a).getTime() - new Date(v.scheduled_at).getTime()) / 60000);
}

export function visitState(v: any): "completed" | "in_progress" | "planned" | "missed" | "cancelled" {
  const st = String(v.status || "").toLowerCase();
  if (v.completed_at || st === "completed") return "completed";
  if (st === "cancelled" || st === "rejected") return "cancelled";
  if (v.travel_started_at || v.reached_at || v.check_in_at || v.meeting_started_at) return "in_progress";
  const planned = v.scheduled_at
    ? new Date(v.scheduled_at).getTime()
    : v.visit_date ? new Date(`${v.visit_date}T23:59:00+05:30`).getTime() : null;
  if (planned && planned < Date.now()) return "missed";
  return "planned";
}

export const STATE_LABEL: Record<ReturnType<typeof visitState>, string> = {
  completed: "Completed",
  in_progress: "In progress",
  planned: "Planned",
  missed: "Missed / pending",
  cancelled: "Cancelled",
};

/** Best-known map position of a visit. */
export function visitLatLng(v: any): { lat: number; lng: number } | null {
  const pairs: [any, any][] = [
    [v.check_in_lat, v.check_in_lng],
    [v.destination_lat, v.destination_lng],
    [v.last_lat, v.last_lng],
  ];
  for (const [a, b] of pairs) {
    const lat = Number(a), lng = Number(b);
    if (Number.isFinite(lat) && Number.isFinite(lng) && a != null && b != null && Math.abs(lat) > 0.0001) return { lat, lng };
  }
  return null;
}

export const fmtMins = (m: number | null | undefined) => {
  if (m == null) return "—";
  const h = Math.floor(Math.abs(m) / 60), mm = Math.abs(m) % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
};

export const fmtClock = (t: number | string | null | undefined) =>
  t == null || t === "" ? "—"
    : new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
