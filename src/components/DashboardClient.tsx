"use client";

import Link from "next/link";
import { MapPin, Users, CalendarCheck, Plane, ArrowUpRight, Activity, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import TodayUpdates from "@/components/TodayUpdates";
import { FadeIn, StaggerGroup, StaggerItem, HoverLift } from "@/components/motion";

const statusStyles: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  on_the_way: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  checked_in: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  completed: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

const iconMap: Record<string, any> = {
  users: Users,
  calendar: CalendarCheck,
  map: MapPin,
  plane: Plane,
};

export default function DashboardClient({
  greeting, firstName, admin, stats, visits, fieldSummary,
}: {
  greeting: string;
  firstName: string;
  admin: boolean;
  stats: { label: string; value: number; icon: string; color: string; href: string }[];
  visits: any[];
  fieldSummary?: { tracked: number; liveNow: number; onVisit: number; completed: number; gpsBlocked: number; stale: number };
}) {
  const quickActions = [
    { href: "/attendance", label: "Mark attendance", icon: CalendarCheck },
    { href: "/leave", label: "Apply for leave", icon: Plane },
    { href: "/field-visits", label: "Log a visit", icon: MapPin },
    { href: "/helpdesk", label: "Raise a ticket", icon: Users },
  ];

  return (
    <div>
      <FadeIn>
        <div className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {admin ? "Here's how your team is doing today." : "Here's your day at a glance."}
          </p>
        </div>
      </FadeIn>

      <StaggerGroup className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = iconMap[s.icon] || Users;
          return (
            <StaggerItem key={s.label}>
              <HoverLift>
                <Link href={s.href}
                  className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 transition-colors hover:border-brand-400 dark:hover:border-brand-500">
                  <div className="flex items-start justify-between">
                    <span className="text-[13px] text-slate-500 dark:text-slate-400">{s.label}</span>
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${s.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{s.value}</p>
                </Link>
              </HoverLift>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      {admin && fieldSummary && <FadeIn delay={0.08}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live field operations</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sales-team tracking, GPS health and today&apos;s field progress.</p></div>
            <div className="flex gap-2"><Link href="/field-reports" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">Reports</Link><Link href="/field-visits" className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-medium text-white">Open live tracking</Link></div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6 dark:bg-slate-700">
            {[
              ["Tracked", fieldSummary.tracked, Users, "text-slate-900"],
              ["Live now", fieldSummary.liveNow, Activity, "text-emerald-600"],
              ["On visit", fieldSummary.onVisit, MapPin, "text-blue-600"],
              ["Completed", fieldSummary.completed, CheckCircle2, "text-violet-600"],
              ["GPS blocked", fieldSummary.gpsBlocked, WifiOff, "text-rose-600"],
              ["Stale", fieldSummary.stale, AlertTriangle, "text-amber-600"],
            ].map(([label, value, Icon, tone]: any) => <div key={label} className="bg-white p-4 dark:bg-slate-800"><div className="flex items-center justify-between"><p className="text-[11px] text-slate-500">{label}</p><Icon className={`h-4 w-4 ${tone}`} /></div><p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p></div>)}
          </div>
        </div>
      </FadeIn>}

      <FadeIn delay={0.1}>
        <TodayUpdates />
      </FadeIn>

      {/* Quick actions */}
      <StaggerGroup className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.04}>
        {quickActions.map((a) => (
          <StaggerItem key={a.href}>
            <HoverLift>
              <Link href={a.href}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-600 hover:text-brand-700 dark:hover:text-brand-300">
                <a.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{a.label}</span>
              </Link>
            </HoverLift>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <FadeIn delay={0.15}>
        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Today&apos;s field visits</h2>
            <Link
              href="/field-visits"
              className="flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {visits && visits.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {visits.map((v: any) => (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 dark:bg-brand-500/10 text-xs font-semibold text-brand-700 dark:text-brand-300">
                      {(v.profiles?.full_name || "NA").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {v.profiles?.full_name || "Unknown"}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
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
                <MapPin className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">No visits scheduled</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Field visits scheduled for today will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
