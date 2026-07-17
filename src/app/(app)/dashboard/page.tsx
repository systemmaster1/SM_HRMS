import { createClient } from "@/lib/supabase/server";
import { MapPin, Users, CalendarCheck, Plane } from "lucide-react";
import { isAdminRole, type Role } from "@/lib/types";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  const admin = isAdminRole(profile?.role as Role);
  const today = new Date().toISOString().slice(0, 10);

  const [team, present, onField, onLeave] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("attendance").select("*", { count: "exact", head: true }).eq("work_date", today).eq("status", "present"),
    supabase.from("field_visits").select("*", { count: "exact", head: true }).eq("visit_date", today).in("status", ["on_the_way", "checked_in"]),
    supabase.from("leaves").select("*", { count: "exact", head: true }).eq("status", "approved").lte("from_date", today).gte("to_date", today),
  ]);

  const { data: visits } = await supabase
    .from("field_visits")
    .select("id, client_name, address, status, profiles:employee_id(full_name)")
    .eq("visit_date", today)
    .order("created_at", { ascending: false })
    .limit(6);

  const hour = parseInt(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false })
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const stats = [
    { label: "Team members", value: team.count ?? 0, icon: Users, color: "text-brand-700 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-300" },
    { label: "Present today", value: present.count ?? 0, icon: CalendarCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400" },
    { label: "On field", value: onField.count ?? 0, icon: MapPin, color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400" },
    { label: "On leave", value: onLeave.count ?? 0, icon: Plane, color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400" },
  ];

  return (
    <DashboardClient
      greeting={greeting}
      firstName={firstName}
      admin={admin}
      stats={stats}
      visits={visits || []}
    />
  );
}
