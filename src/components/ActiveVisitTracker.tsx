"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_INTERVAL_MINUTES = 5;

export default function ActiveVisitTracker() {
  const supabase = createClient();
  const activeVisitId = useRef<string | null>(null);
  const employeeId = useRef<string | null>(null);
  const companyId = useRef<string | null>(null);
  const trackingEnabled = useRef(false);
  const intervalMinutes = useRef(DEFAULT_INTERVAL_MINUTES);
  const lastEvent = useRef<string>("");

  const logEvent = useCallback(async (eventType: string, details: Record<string, unknown> = {}, lat?: number | null, lng?: number | null) => {
    if (!employeeId.current || !companyId.current) return;
    const signature = `${eventType}:${JSON.stringify(details)}`;
    if (eventType !== "location_received" && lastEvent.current === signature) return;
    lastEvent.current = signature;
    await supabase.from("tracking_events").insert({
      company_id: companyId.current,
      visit_id: activeVisitId.current,
      employee_id: employeeId.current,
      event_type: eventType,
      latitude: lat ?? null,
      longitude: lng ?? null,
      details,
    });
  }, [supabase]);

  const refreshContext = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    employeeId.current = auth.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, field_tracking_enabled, tracking_interval_minutes")
      .eq("id", auth.user.id)
      .single();

    companyId.current = profile?.company_id ?? null;
    trackingEnabled.current = profile?.field_tracking_enabled === true;
    intervalMinutes.current = Math.max(1, Number(profile?.tracking_interval_minutes || DEFAULT_INTERVAL_MINUTES));

    if (!trackingEnabled.current) {
      activeVisitId.current = null;
      return;
    }

    const { data } = await supabase
      .from("field_visits")
      .select("id, company_id")
      .eq("employee_id", auth.user.id)
      .in("status", ["accepted", "on_the_way", "reached", "checked_in", "meeting"])
      .order("travel_started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    activeVisitId.current = data?.id ?? null;
    if (data?.company_id) companyId.current = data.company_id;
  }, [supabase]);

  const capture = useCallback(async () => {
    if (!trackingEnabled.current || !activeVisitId.current || !employeeId.current || !companyId.current) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      await logEvent("location_unavailable", { reason: "geolocation_not_supported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const now = new Date().toISOString();
      const payload = {
        company_id: companyId.current!,
        visit_id: activeVisitId.current!,
        employee_id: employeeId.current!,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: Math.round(pos.coords.accuracy || 0),
        speed_mps: pos.coords.speed,
        heading: pos.coords.heading,
        captured_at: now,
      };

      const { error } = await supabase.from("visit_location_history").insert(payload);
      if (!error) {
        await supabase.from("field_visits").update({
          last_lat: payload.latitude,
          last_lng: payload.longitude,
          last_location_at: now,
        }).eq("id", activeVisitId.current!);
        await logEvent("location_received", { accuracy_m: payload.accuracy_m }, payload.latitude, payload.longitude);
      }
    }, async (err) => {
      const eventType = err.code === err.PERMISSION_DENIED
        ? "location_permission_denied"
        : err.code === err.TIMEOUT
          ? "location_timeout"
          : "location_unavailable";
      await logEvent(eventType, { code: err.code, message: err.message });
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  }, [logEvent, supabase]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = async () => {
      if (cancelled) return;
      await refreshContext();
      await capture();
      if (cancelled) return;
      timer = setTimeout(schedule, intervalMinutes.current * 60 * 1000);
    };

    schedule();

    const onVisible = async () => {
      if (document.visibilityState === "visible") {
        await refreshContext();
        if (trackingEnabled.current && activeVisitId.current) {
          await logEvent("tracking_resumed", { source: "visibility" });
          await capture();
        }
      } else if (trackingEnabled.current && activeVisitId.current) {
        await logEvent("app_backgrounded", { visibility: document.visibilityState });
      }
    };

    const onOnline = () => logEvent("tracking_resumed", { source: "network_online" });
    const onOffline = () => logEvent("network_offline", {});

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [capture, logEvent, refreshContext]);

  return null;
}
