"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { unregisterThisDevice } from "@/components/PushRegistrar";
import ThemeToggle from "@/components/ThemeToggle";
import LiveClock from "@/components/LiveClock";
import { RouteTransition } from "@/components/motion";
import { type Profile, type Company, type Role, isAdminRole } from "@/lib/types";
import {
  LayoutDashboard, Users, CalendarCheck, Plane,
  ListChecks, MapPin, LogOut, Menu, Settings, X, CalendarDays, FileText, Building2,
  Contact, LifeBuoy, Wallet, WalletCards, ChevronDown, HelpCircle, BarChart3, Download, Sheet, Sparkles,
  Home, MoreHorizontal, Radar,
} from "lucide-react";

interface Leaf {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  accessKey?: string;
}
interface Group {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: Leaf[];
  adminOnly?: boolean;
}
type NavEntry = Leaf | Group;

const isGroup = (e: NavEntry): e is Group => "items" in e;

const nav: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },

  {
    key: "attendance",
    label: "Attendance & Leave",
    icon: <CalendarCheck className="h-[18px] w-[18px]" />,
    items: [
      { href: "/attendance", label: "Attendance",  icon: <CalendarCheck className="h-4 w-4" />, accessKey: "attendance" },
      { href: "/attendance/register", label: "Attendance register", icon: <CalendarDays className="h-4 w-4" />, accessKey: "attendance" },
      { href: "/leave",      label: "Leave",        icon: <Plane className="h-4 w-4" />, accessKey: "leave" },
      { href: "/leave/team", label: "Team balances", icon: <Users className="h-4 w-4" />, adminOnly: true },
      { href: "/holidays",   label: "Holidays",     icon: <CalendarDays className="h-4 w-4" /> },
    ],
  },
  {
    key: "work",
    label: "Work",
    icon: <ListChecks className="h-[18px] w-[18px]" />,
    items: [
      { href: "/field-visits", label: "Field visits", icon: <MapPin className="h-4 w-4" />, accessKey: "field_visits" },
      { href: "/tracking",     label: "Field tracking", icon: <Radar className="h-4 w-4" />, accessKey: "field_visits" },
      { href: "/field-reports", label: "Field reports", icon: <BarChart3 className="h-4 w-4" />, accessKey: "field_reports" },
      { href: "/tasks",        label: "Tasks",         icon: <ListChecks className="h-4 w-4" />, accessKey: "tasks" },
      { href: "/em-report",    label: "EM Report",     icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  { href: "/payroll", label: "Payroll", icon: <Wallet className="h-[18px] w-[18px]" />, accessKey: "payroll" },
  { href: "/team", label: "Team", icon: <Users className="h-[18px] w-[18px]" />, accessKey: "team" },
  {
    key: "support",
    label: "Support",
    icon: <LifeBuoy className="h-[18px] w-[18px]" />,
    items: [
      { href: "/helpdesk", label: "Help desk", icon: <LifeBuoy className="h-4 w-4" /> },
      { href: "/policies", label: "Policies",  icon: <FileText className="h-4 w-4" /> },
      { href: "/help",     label: "User guide", icon: <HelpCircle className="h-4 w-4" /> },
      { href: "/upcoming-features", label: "Product roadmap", icon: <Sparkles className="h-4 w-4" /> },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: <Settings className="h-[18px] w-[18px]" />,
    adminOnly: true,
    items: [
      { href: "/organization", label: "Organization", icon: <Building2 className="h-4 w-4" /> },
      { href: "/settings",     label: "Settings",      icon: <Settings className="h-4 w-4" /> },
      { href: "/subscription", label: "Subscription & Billing", icon: <WalletCards className="h-4 w-4" /> },
      { href: "/export",       label: "Export data",   icon: <Download className="h-4 w-4" /> },
      { href: "/integrations", label: "Integrations",  icon: <Sheet className="h-4 w-4" /> },
    ],
  },
];

const roleLabel: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

/** Mobile bottom bar: the four screens field staff use every day, plus "More". */
const bottomNav: { href: string; label: string; icon: React.ElementType; accessKey?: string }[] = [
  { href: "/dashboard",    label: "Home",       icon: Home },
  { href: "/attendance",   label: "Attendance", icon: CalendarCheck, accessKey: "attendance" },
  { href: "/tasks",        label: "Tasks",      icon: ListChecks,    accessKey: "tasks" },
  { href: "/field-visits", label: "Visits",     icon: MapPin,        accessKey: "field_visits" },
];

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Every sidebar link, used to find the single most specific match. */
const allNavHrefs = (): string[] =>
  nav.flatMap((e) => (isGroup(e) ? e.items.map((i) => i.href) : [e.href]));

export default function Shell({
  profile,
  company,
  children,
}: {
  profile: Profile;
  company: Company | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  // e.g. on /leave/team only "Team balances" is highlighted, not "Leave" too.
  const bestMatch = allNavHrefs()
    .filter((h) => isActivePath(pathname, h))
    .sort((a, b) => b.length - a.length)[0];

  // Lock background scrolling while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const admin = isAdminRole(profile.role);
  const hasAccess = (key?: string) => admin || !key || (profile.access_permissions?.[key] && profile.access_permissions[key] !== "none");

  // Auto-expand whichever group contains the current page.
  const initialExpanded = new Set<string>();
  nav.forEach((e) => {
    if (isGroup(e) && e.items.some((i) => isActivePath(pathname, i.href))) initialExpanded.add(e.key);
  });
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const doLogout = async () => {
    await unregisterThisDevice();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = (profile.full_name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const trialDaysLeft = company?.trial_ends_on
    ? Math.max(
        0,
        Math.ceil(
          (new Date(company.trial_ends_on).getTime() - Date.now()) / 86400000
        )
      )
    : null;

  /* Leaf link — active items get a soft white pill + orange indicator bar */
  const leafCls = (active: boolean) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${
      active
        ? "bg-white/[0.10] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-accent-500 before:content-['']"
        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
    }`;

  const Sidebar = (
    <div className="flex h-full flex-col border-r border-white/[0.06] bg-sidebar-gradient">
      {/* Company */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.08] px-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center keep-light overflow-hidden rounded-xl bg-white p-0.5 ring-1 ring-white/20">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <LogoMark size={34} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {company?.name || "SM HRMS"}
          </p>
          <p className="truncate text-[11px] text-slate-400/80">SM HRMS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map((entry) => {
          if (entry.adminOnly && !admin) return null;
          if (!isGroup(entry) && !hasAccess(entry.accessKey)) return null;

          if (!isGroup(entry)) {
            const active = entry.href === bestMatch;
            return (
              <Link key={entry.href} href={entry.href} onClick={() => setOpen(false)} className={leafCls(active)}>
                {entry.icon}
                {entry.label}
              </Link>
            );
          }

          const items = entry.items.filter((i) => (!i.adminOnly || admin) && hasAccess(i.accessKey));
          if (items.length === 0) return null;
          const groupActive = items.some((i) => isActivePath(pathname, i.href));
          const isOpen = expanded.has(entry.key) || groupActive;

          return (
            <div key={entry.key}>
              <button
                onClick={() => toggle(entry.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${
                  groupActive
                    ? "text-white"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                }`}
              >
                {entry.icon}
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-4">
                  {items.map((item) => {
                    const active = item.href === bestMatch;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
                          active
                            ? "bg-white/[0.10] font-medium text-white before:absolute before:-left-[17px] before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-accent-500 before:content-['']"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Trial banner — visible to the owner/admin only */}
      {admin && company?.plan === "trial" && trialDaysLeft !== null && (
        <div className="mx-3 mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-300">
            Trial · {trialDaysLeft} days left
          </p>
          <p className="mt-0.5 text-[11px] text-amber-400/70">₹{company?.price_per_user ?? 19} / user / month · launch offer</p>
        </div>
      )}

      {/* User — click to open profile */}
      <div className="border-t border-white/[0.08] p-3">
        <div className="flex items-center gap-3 px-1.5 py-1.5">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-white/5"
            title="My profile"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-gradient text-xs font-semibold text-white ring-1 ring-white/20">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {profile.full_name || "User"}
              </p>
              <p className="truncate text-[11px] text-slate-400/80">
                {roleLabel[profile.role]}
              </p>
            </div>
          </Link>
          <button
            onClick={doLogout}
            title="Sign out"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{Sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[82vw] max-w-[18rem] pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute -right-12 top-[calc(env(safe-area-inset-top)+0.75rem)] rounded-lg bg-white/15 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80">
         <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <button onClick={() => setOpen(true)} aria-label="Open menu"
              className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 active:bg-slate-100 dark:text-slate-300 dark:active:bg-slate-800">
              <Menu className="h-6 w-6" />
            </button>
            <span className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              {company?.name || "SM HRMS"}
            </span>
          </div>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <LiveClock className="hidden text-slate-500 dark:text-slate-400 sm:flex" />
            <Link href="/help" title="Help & user guide"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              <HelpCircle className="h-[18px] w-[18px]" />
            </Link>
            <ThemeToggle className="text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" />
            <NotificationBell userId={profile.id} companyId={profile.company_id} />
          </div>
         </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pt-7 lg:p-9">
          <RouteTransition routeKey={pathname}>{children}</RouteTransition>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {bottomNav.filter((b) => hasAccess(b.accessKey)).map((b) => {
            const active = isActivePath(pathname, b.href);
            const Icon = b.icon;
            return (
              <Link key={b.href} href={b.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95 ${
                  active ? "text-brand-700 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}`}>
                {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-accent-500" />}
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
                {b.label}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)}
            className="flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500 transition active:scale-95 dark:text-slate-400">
            <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.8} />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
