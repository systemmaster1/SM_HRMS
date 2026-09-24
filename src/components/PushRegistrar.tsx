"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BellRing, X } from "lucide-react";

/**
 * Registers this phone / browser for push notifications.
 *
 *  - Android app: the native side hands us its Firebase (FCM) token.
 *  - Browser / installed PWA: standard Web Push. The browser only allows the
 *    permission prompt after a tap, so we show a small "Turn on" card.
 */
const TOKEN_KEY = "smhrms-push-token";
const DISMISS_KEY = "smhrms-push-dismissed-until";

type NativeApi = {
  getPushToken?: () => string;
  notificationsEnabled?: () => boolean;
  openNotificationSettings?: () => void;
};

const native = (): NativeApi | null =>
  typeof window !== "undefined" && (window as any).SMHRMSNative ? (window as any).SMHRMSNative : null;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Call BEFORE signing out, so this device stops getting the old user's alerts. */
export async function unregisterThisDevice() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await createClient().rpc("unregister_push_device", { p_token: token });
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* never block sign-out */ }
}

export default function PushRegistrar() {
  const supabase = createClient();
  const [card, setCard] = useState<null | "web" | "android-off">(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const register = useCallback(async (platform: "android" | "web", token: string, subscription?: any) => {
    if (!token) return;
    const { error } = await supabase.rpc("register_push_device", {
      p_platform: platform,
      p_token: token,
      p_subscription: subscription ?? null,
      p_user_agent: navigator.userAgent,
    });
    if (!error) localStorage.setItem(TOKEN_KEY, token);
    else console.warn("Push registration failed:", error.message);
  }, [supabase]);

  const dismissedRecently = () => {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return until > Date.now();
  };

  /* ---------- Android app ---------- */
  const syncNative = useCallback(() => {
    const api = native();
    if (!api?.getPushToken) return false; // old APK without push support
    const token = api.getPushToken();
    if (token) register("android", token);
    if (api.notificationsEnabled && !api.notificationsEnabled() && !dismissedRecently()) {
      setCard("android-off");
    }
    return true;
  }, [register]);

  /* ---------- Browser / PWA ---------- */
  const syncWeb = useCallback(async () => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (Notification.permission === "granted") {
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await register("web", sub.endpoint, sub.toJSON());
      return;
    }
    if (Notification.permission === "default" && !dismissedRecently()) setCard("web");
  }, [register]);

  useEffect(() => {
    if (native()) {
      syncNative();
      // The native side may get its token a moment after the page loads.
      const onToken = () => syncNative();
      window.addEventListener("smhrms-push-token", onToken);
      window.addEventListener("smhrms-native-ready", onToken);
      return () => {
        window.removeEventListener("smhrms-push-token", onToken);
        window.removeEventListener("smhrms-native-ready", onToken);
      };
    }
    syncWeb().catch((e) => console.warn("Web push setup failed:", e));
  }, [syncNative, syncWeb]);

  const enableWeb = async () => {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications are blocked. Allow them from the lock icon next to the address bar.");
        return;
      }
      await syncWeb();
      setCard(null);
    } catch (e: any) {
      setMsg(e?.message || "Could not turn on notifications.");
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setCard(null);
  };

  if (!card) return null;

  return (
    <div className="fixed inset-x-3 top-16 z-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:left-auto sm:right-6 sm:w-96">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {card === "web" ? "Get alerts on this device" : "Notifications are turned off"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {card === "web"
              ? "New tasks, leave approvals and reminders will pop up even when SM HRMS is closed."
              : "Turn on notifications for SM HRMS so you don't miss tasks and approvals."}
          </p>
          {msg && <p className="mt-2 text-xs text-rose-600">{msg}</p>}
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={card === "web" ? enableWeb : () => { native()?.openNotificationSettings?.(); setCard(null); }}
              className="rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60">
              {busy ? "Turning on…" : card === "web" ? "Turn on notifications" : "Open settings"}
            </button>
            <button onClick={later}
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              Later
            </button>
          </div>
        </div>
        <button onClick={later} aria-label="Close"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
