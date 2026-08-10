"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_INTERVAL_MINUTES = 5;

type Context = {
  enabled: boolean;
  interval: number;
};

export default function ActiveVisitTracker() {
  const supabase = createClient();
  const ctx = useRef<Context>({ enabled: false, interval: DEFAULT_INTERVAL_MINUTES });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  const refreshConfig = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { ctx.current = { enabled: false, interval: DEFAULT_INTERVAL_MINUTES }; return; }
    const { data: p } = await supabase.from("profiles")
      .select("field_tracking_enabled,tracking_interval_minutes")
      .eq("id", auth.user.id).single();
    ctx.current = {
      enabled: p?.field_tracking_enabled === true,
      interval: Math.max(1, Number(p?.tracking_interval_minutes || DEFAULT_INTERVAL_MINUTES)),
    };
  }, [supabase]);

  const state = useCallback(async (s: string, reason?: string) => {
    if (!ctx.current.enabled) return;
    await supabase.rpc("record_tracking_state_v7", {
      p_state: s,
      p_reason: reason || null,
      p_app_state: document.visibilityState,
    });
  }, [supabase]);

  const capture = useCallback(async () => {
    if (running.current || !ctx.current.enabled) return;
    running.current = true;
    try {
      if (!navigator.onLine) { await state("offline", "Device/network offline"); return; }
      if (!navigator.geolocation) { await state("unavailable", "Geolocation is not supported by this device/browser"); return; }

      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          await supabase.rpc("record_employee_location_v7", {
            p_latitude: pos.coords.latitude,
            p_longitude: pos.coords.longitude,
            p_accuracy_m: Math.round(pos.coords.accuracy || 0),
            p_speed_mps: pos.coords.speed,
            p_heading: pos.coords.heading,
            p_app_state: document.visibilityState,
          });
        } finally { running.current = false; }
      }, async (err) => {
        try {
          const s = err.code === err.PERMISSION_DENIED ? "permission_denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable";
          await state(s, err.message);
        } finally { running.current = false; }
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: Math.min(45000, ctx.current.interval * 30000) });
      return;
    } finally {
      // geolocation callback owns running=false. For early returns, release here.
      if (!navigator.geolocation || !navigator.onLine) running.current = false;
    }
  }, [state, supabase]);

  useEffect(() => {
    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      await refreshConfig();
      await capture();
      if (cancelled) return;
      timer.current = setTimeout(loop, ctx.current.interval * 60 * 1000);
    };
    loop();

    const onVisible = async () => {
      await refreshConfig();
      if (document.visibilityState === "visible") await capture();
      else await state("background", "HRMS app moved to background");
    };
    const onOnline = async () => { await refreshConfig(); await capture(); };
    const onOffline = async () => { await state("offline", "Device/network offline"); };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [capture, refreshConfig, state]);

  return null;
}
