import { createClient } from "@/lib/supabase/server";
import { MapPin, Users, CalendarCheck, Plane, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { isAdminRole, type Role } from "@/lib/types";

const statusStyles: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600",
  on_the_way: "bg-brand-50 text-brand-700",
  checked_in: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-50 text-rose-700",
};

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const stats = [
    { label: "Team members", value: team.count ?? 0, icon: Users, color: "text-brand-700 bg-brand-50" },
    { label: "Present today", value: present.count ?? 0, icon: CalendarCheck, color: "text-emerald-600 bg-emerald-50" },
    { label: "On field", value: onField.count ?? 0, icon: MapPin, color: "text-blue-600 bg-blue-50" },
    { label: "On leave", value: onLeave.count ?? 0, icon: Plane, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {admin ? "Here's how your team is doing today." : "Here's your day at a glance."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <span className="text-[13px] text-slate-500">{s.label}</span>
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s field visits</h2>
          <Link
            href="/field-visits"
            className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-700"
          >
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visits && visits.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {visits.map((v: any) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {(v.profiles?.full_name || "NA").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {v.profiles?.full_name || "Unknown"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {v.address || "No address"}
                      {v.client_name && ` · ${v.client_name}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusStyles[v.status] || "bg-slate-100 text-slate-600"}`}>
                    {v.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-12 text-center">
              <MapPin className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-900">No visits scheduled</p>
              <p className="mt-1 text-xs text-slate-500">
                Field visits scheduled for today will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
