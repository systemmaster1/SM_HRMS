"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_INTERVAL_MINUTES = 5;
const ACTIVE_VISIT_STATUSES = ["accepted", "on_the_way", "reached", "checked_in", "meeting"];

type Context = {
  userId: string;
  companyId: string;
  visitId: string | null;
  enabled: boolean;
  mode: "active_visit" | "working_hours" | "manual";
  interval: number;
};

export default function ActiveVisitTracker() {
  const supabase = createClient();
  const ctx = useRef<Context | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvent = useRef("");

  const logEvent = useCallback(async (
    eventType: string,
    details: Record<string, unknown> = {}
  ) => {
    const c = ctx.current;
    if (!c?.companyId || !c.userId) return;
    const signature = `${eventType}:${JSON.stringify(details)}`;
    if (signature === lastEvent.current) return;
    lastEvent.current = signature;
    await supabase.from("tracking_events").insert({
      company_id: c.companyId,
      visit_id: c.visitId,
      employee_id: c.userId,
      event_type: eventType,
      details,
    });
  }, [supabase]);

  const upsertStatus = useCallback(async (patch: Record<string, unknown>) => {
    const c = ctx.current;
    if (!c) return;
    await supabase.from("employee_live_locations").upsert({
      employee_id: c.userId,
      company_id: c.companyId,
      visit_id: c.visitId,
      updated_at: new Date().toISOString(),
      ...patch,
    }, { onConflict: "employee_id" });
  }, [supabase]);

  const refreshContext = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { ctx.current = null; return; }

    const { data: p } = await supabase
      .from("profiles")
      .select("company_id, field_tracking_enabled, tracking_mode, tracking_interval_minutes")
      .eq("id", auth.user.id)
      .single();
    if (!p?.company_id) { ctx.current = null; return; }

    const { data: visit } = await supabase
      .from("field_visits")
      .select("id")
      .eq("employee_id", auth.user.id)
      .in("status", ACTIVE_VISIT_STATUSES)
      .order("travel_started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    ctx.current = {
      userId: auth.user.id,
      companyId: p.company_id,
      visitId: visit?.id ?? null,
      enabled: p.field_tracking_enabled === true,
      mode: (p.tracking_mode || "active_visit") as Context["mode"],
      interval: Math.max(1, Number(p.tracking_interval_minutes || DEFAULT_INTERVAL_MINUTES)),
    };
  }, [supabase]);

  const capture = useCallback(async () => {
    const c = ctx.current;
    if (!c) return;

    if (!c.enabled) return;

    const shouldTrack = c.mode === "active_visit" ? !!c.visitId : true;
    if (!shouldTrack) {
      await upsertStatus({ tracking_state: "idle", app_state: document.visibilityState, last_error: null });
      return;
    }

    if (!navigator.geolocation) {
      await upsertStatus({ permission_state: "unavailable", tracking_state: "error", last_error: "Geolocation is not supported" });
      await logEvent("location_unavailable", { reason: "geolocation_not_supported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase.rpc("record_employee_location_v5", {
        p_latitude: pos.coords.latitude,
        p_longitude: pos.coords.longitude,
        p_accuracy_m: Math.round(pos.coords.accuracy || 0),
        p_speed_mps: pos.coords.speed,
        p_heading: pos.coords.heading,
        p_app_state: document.visibilityState,
      });
      if (error) {
        await upsertStatus({ tracking_state: "error", last_error: error.message });
        await logEvent("location_save_error", { message: error.message });
      }
    }, async (err) => {
      const eventType =
        err.code === err.PERMISSION_DENIED ? "location_permission_denied" :
        err.code === err.TIMEOUT ? "location_timeout" : "location_unavailable";
      await upsertStatus({
        permission_state: err.code === err.PERMISSION_DENIED ? "denied" : "unknown",
        tracking_state: err.code === err.PERMISSION_DENIED ? "blocked" : "error",
        app_state: document.visibilityState,
        last_error: err.message,
      });
      await logEvent(eventType, { code: err.code, message: err.message });
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  }, [logEvent, supabase, upsertStatus]);

  useEffect(() => {
    let cancelled = false;

    const schedule = async () => {
      if (cancelled) return;
      await refreshContext();
      await capture();
      if (cancelled) return;
      timer.current = setTimeout(
        schedule,
        (ctx.current?.interval || DEFAULT_INTERVAL_MINUTES) * 60 * 1000
      );
    };
    schedule();

    const onVisible = async () => {
      if (document.visibilityState !== "visible") {
        await upsertStatus({ app_state: "background" });
        return;
      }
      await refreshContext();
      await capture();
    };
    const onOnline = async () => { await refreshContext(); await capture(); };
    const onOffline = async () => {
      await upsertStatus({ tracking_state: "offline", last_error: "Device offline", app_state: document.visibilityState });
    };

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
  }, [capture, refreshContext, upsertStatus]);

  return null;
}
