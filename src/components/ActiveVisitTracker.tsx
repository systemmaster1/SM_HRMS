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
  routeHistory: boolean;
};

export default function ActiveVisitTracker() {
  const supabase = createClient();
  const ctx = useRef<Context | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvent = useRef("");

  const logEvent = useCallback(async (
    eventType: string,
    details: Record<string, unknown> = {},
    lat?: number | null,
    lng?: number | null
  ) => {
    const c = ctx.current;
    if (!c?.companyId || !c.userId) return;
    const signature = `${eventType}:${JSON.stringify(details)}`;
    if (eventType !== "location_received" && signature === lastEvent.current) return;
    lastEvent.current = signature;
    await supabase.from("tracking_events").insert({
      company_id: c.companyId,
      visit_id: c.visitId,
      employee_id: c.userId,
      event_type: eventType,
      latitude: lat ?? null,
      longitude: lng ?? null,
      details,
    });
  }, [supabase]);

  const upsertLive = useCallback(async (patch: Record<string, unknown>) => {
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
      .select("company_id, field_tracking_enabled, tracking_mode, tracking_interval_minutes, route_history_enabled")
      .eq("id", auth.user.id)
      .single();
    if (!p?.company_id) { ctx.current = null; return; }

    let visitId: string | null = null;
    const { data: visit } = await supabase
      .from("field_visits")
      .select("id")
      .eq("employee_id", auth.user.id)
      .in("status", ACTIVE_VISIT_STATUSES)
      .order("travel_started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    visitId = visit?.id ?? null;

    ctx.current = {
      userId: auth.user.id,
      companyId: p.company_id,
      visitId,
      enabled: p.field_tracking_enabled === true,
      mode: (p.tracking_mode || "active_visit") as Context["mode"],
      interval: Math.max(1, Number(p.tracking_interval_minutes || DEFAULT_INTERVAL_MINUTES)),
      routeHistory: p.route_history_enabled !== false,
    };
  }, [supabase]);

  const capture = useCallback(async () => {
    const c = ctx.current;
    if (!c) return;

    if (!c.enabled) {
      await upsertLive({ tracking_state: "disabled", app_state: document.visibilityState, last_error: null });
      return;
    }

    const shouldTrack = c.mode === "active_visit" ? !!c.visitId : true;
    if (!shouldTrack) {
      await upsertLive({ tracking_state: "idle", app_state: document.visibilityState, last_error: null });
      return;
    }

    if (!navigator.geolocation) {
      await upsertLive({ permission_state: "unavailable", tracking_state: "error", last_error: "Geolocation is not supported" });
      await logEvent("location_unavailable", { reason: "geolocation_not_supported" });
      return;
    }

    try {
      const permissionsApi = navigator.permissions as Permissions | undefined;
      if (permissionsApi?.query) {
        const permission = await permissionsApi.query({ name: "geolocation" as PermissionName });
        if (permission.state === "denied") {
          await upsertLive({ permission_state: "denied", tracking_state: "blocked", app_state: document.visibilityState, last_error: "Location permission denied" });
          await logEvent("location_permission_denied", { source: "permissions_api" });
          return;
        }
      }
    } catch {
      // Some browsers do not expose geolocation through Permissions API. getCurrentPosition remains authoritative.
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const now = new Date().toISOString();
      const payload = {
        company_id: c.companyId,
        employee_id: c.userId,
        visit_id: c.visitId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: Math.round(pos.coords.accuracy || 0),
        speed_mps: pos.coords.speed,
        heading: pos.coords.heading,
        captured_at: now,
        source: "web_pwa",
      };

      if (c.routeHistory) await supabase.from("employee_location_history").insert(payload);

      if (c.visitId) {
        await supabase.from("visit_location_history").insert({
          company_id: c.companyId,
          visit_id: c.visitId,
          employee_id: c.userId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy_m: payload.accuracy_m,
          speed_mps: payload.speed_mps,
          heading: payload.heading,
          captured_at: now,
        });
        await supabase.from("field_visits").update({
          last_lat: payload.latitude,
          last_lng: payload.longitude,
          last_location_at: now,
        }).eq("id", c.visitId);
      }

      await upsertLive({
        visit_id: c.visitId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy_m: payload.accuracy_m,
        speed_mps: payload.speed_mps,
        heading: payload.heading,
        permission_state: "granted",
        tracking_state: "active",
        app_state: document.visibilityState,
        last_seen_at: now,
        last_error: null,
      });
      await logEvent("location_received", { accuracy_m: payload.accuracy_m, mode: c.mode }, payload.latitude, payload.longitude);
    }, async (err) => {
      const eventType = err.code === err.PERMISSION_DENIED ? "location_permission_denied" : err.code === err.TIMEOUT ? "location_timeout" : "location_unavailable";
      const permission = err.code === err.PERMISSION_DENIED ? "denied" : "unknown";
      await upsertLive({
        permission_state: permission,
        tracking_state: err.code === err.PERMISSION_DENIED ? "blocked" : "error",
        app_state: document.visibilityState,
        last_error: err.message,
      });
      await logEvent(eventType, { code: err.code, message: err.message });
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  }, [logEvent, supabase, upsertLive]);

  useEffect(() => {
    let cancelled = false;

    const schedule = async () => {
      if (cancelled) return;
      await refreshContext();
      await capture();
      if (cancelled) return;
      timer.current = setTimeout(schedule, (ctx.current?.interval || DEFAULT_INTERVAL_MINUTES) * 60 * 1000);
    };
    schedule();

    const onVisibility = async () => {
      await refreshContext();
      if (document.visibilityState === "visible") {
        await logEvent("tracking_resumed", { source: "visibility" });
        await capture();
      } else {
        await upsertLive({ app_state: "background" });
        await logEvent("app_backgrounded", {});
      }
    };
    const onOnline = async () => { await logEvent("tracking_resumed", { source: "network_online" }); await capture(); };
    const onOffline = async () => { await upsertLive({ tracking_state: "offline", last_error: "Device offline" }); await logEvent("network_offline", {}); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [capture, logEvent, refreshContext, upsertLive]);

  return null;
}
