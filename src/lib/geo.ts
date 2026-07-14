export interface Coords {
  lat: number | null;
  lng: number | null;
}

/** Asks the browser for the current position. Never rejects. */
export function getPosition(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve({ lat: null, lng: null });
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

/** Turns coordinates into a human-readable address. Returns null on failure. */
export async function reverseGeocode(
  lat: number | null,
  lng: number | null
): Promise<string | null> {
  if (lat == null || lng == null) return null;
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return null;
    const d = await res.json();
    const parts = [
      d.locality,
      d.city && d.city !== d.locality ? d.city : null,
      d.principalSubdivision,
      d.postcode,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

/** Best-effort public IP lookup. Returns null on failure. */
export async function getPublicIp(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) return null;
    const d = await res.json();
    return d.ip || null;
  } catch {
    return null;
  }
}

export const fmtTime = (t: string | null) =>
  t
    ? new Date(t).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

export const fmtDuration = (mins: number) => {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
