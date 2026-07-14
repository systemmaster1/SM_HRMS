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
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export const fmtTime = (t: string | null) =>
  t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtDuration = (mins: number) => {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
