"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const FIVE_MINUTES = 5 * 60 * 1000;

export default function ActiveVisitTracker() {
  const supabase = createClient();
  const activeVisitId = useRef<string | null>(null);
  const employeeId = useRef<string | null>(null);
  const companyId = useRef<string | null>(null);

  const refreshActiveVisit = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    employeeId.current = auth.user.id;

    const { data } = await supabase
      .from("field_visits")
      .select("id, company_id")
      .eq("employee_id", auth.user.id)
      .in("status", ["accepted", "on_the_way", "reached", "checked_in", "meeting"])
      .order("travel_started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    activeVisitId.current = data?.id ?? null;
    companyId.current = data?.company_id ?? null;
  }, [supabase]);

  const capture = useCallback(async () => {
    if (!activeVisitId.current || !employeeId.current || !companyId.current) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const payload = {
        company_id: companyId.current,
        visit_id: activeVisitId.current,
        employee_id: employeeId.current,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: Math.round(pos.coords.accuracy || 0),
        speed_mps: pos.coords.speed,
        heading: pos.coords.heading,
        captured_at: new Date().toISOString(),
      };

      await supabase.from("visit_location_history").insert(payload);
      await supabase.from("field_visits").update({
        last_lat: payload.latitude,
        last_lng: payload.longitude,
        last_location_at: payload.captured_at,
      }).eq("id", activeVisitId.current!);
    }, () => undefined, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  }, [supabase]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const boot = async () => {
      await refreshActiveVisit();
      if (cancelled) return;
      await capture();
      timer = setInterval(async () => {
        await refreshActiveVisit();
        await capture();
      }, FIVE_MINUTES);
    };

    boot();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshActiveVisit().then(capture);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [capture, refreshActiveVisit]);

  return null;
}
