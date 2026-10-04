"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type NativeTokens = { accessToken?: string; refreshToken?: string; updatedAt?: number };

declare global {
  interface Window {
    SMHRMSNative?: any;
  }
}

/**
 * Keeps ONE valid login session between the web app and the Android GPS
 * service. Supabase refresh tokens rotate: if both sides refreshed with the
 * same token, one of them would be signed out ("random logout").
 *
 *  - Web refreshed (or signed in)  -> hand the new pair to the phone.
 *  - Phone refreshed while the app was closed -> on resume, adopt its pair.
 *  - Signed out -> phone stops tracking, forgets tokens and queued points.
 *
 * Does nothing in a normal browser.
 */
export default function NativeSessionSync() {
  useEffect(() => {
    const native = typeof window !== "undefined" ? window.SMHRMSNative : null;
    if (!native?.getSessionTokens) return;
    const supabase = createClient();
    let lastPushedAt = 0;

    const adoptNativeSession = async () => {
      try {
        const n: NativeTokens = JSON.parse(native.getSessionTokens() || "{}");
        if (!n.accessToken || !n.refreshToken || !n.updatedAt || n.updatedAt <= lastPushedAt) return;
        const { data } = await supabase.auth.getSession();
        const current = data.session;
        if (!current || current.refresh_token === n.refreshToken) return;
        // The phone holds the newer pair (it refreshed while the app was closed).
        await supabase.auth.setSession({ access_token: n.accessToken, refresh_token: n.refreshToken });
      } catch {
        /* keep the current web session */
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (event === "SIGNED_OUT") {
          native.clearSession?.();
          return;
        }
        if (session && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) {
          lastPushedAt = Date.now();
          native.updateSessionTokens?.(JSON.stringify({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
          }));
        }
      } catch {
        /* bridge unavailable */
      }
    });

    void adoptNativeSession();
    const onVisible = () => { if (document.visibilityState === "visible") void adoptNativeSession(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("smhrms-native-ready", adoptNativeSession);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("smhrms-native-ready", adoptNativeSession);
    };
  }, []);

  return null;
}
