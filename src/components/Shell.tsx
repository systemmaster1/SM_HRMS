"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { type Profile, type Company, type Role, isAdminRole } from "@/lib/types";
import {
  LayoutDashboard, Users, CalendarCheck, Plane,
  ListChecks, MapPin, LogOut, Menu, Settings, X, CalendarDays, FileText, Building2,
  Contact, LifeBuoy, Wallet, ChevronDown,
} from "lucide-react";

interface Leaf {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
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
      { href: "/attendance", label: "Attendance",  icon: <CalendarCheck className="h-4 w-4" /> },
      { href: "/leave",      label: "Leave",        icon: <Plane className="h-4 w-4" /> },
      { href: "/holidays",   label: "Holidays",     icon: <CalendarDays className="h-4 w-4" /> },
    ],
  },
  {
    key: "work",
    label: "Work",
    icon: <ListChecks className="h-[18px] w-[18px]" />,
    items: [
      { href: "/field-visits", label: "Field visits", icon: <MapPin className="h-4 w-4" /> },
      { href: "/tasks",        label: "Tasks",         icon: <ListChecks className="h-4 w-4" /> },
    ],
  },
  { href: "/payroll", label: "Payroll", icon: <Wallet className="h-[18px] w-[18px]" /> },
  {
    key: "people",
    label: "People",
    icon: <Users className="h-[18px] w-[18px]" />,
    items: [
      { href: "/team",      label: "Team",      icon: <Users className="h-4 w-4" /> },
      { href: "/directory", label: "Directory", icon: <Contact className="h-4 w-4" /> },
    ],
  },
  {
    key: "support",
    label: "Support",
    icon: <LifeBuoy className="h-[18px] w-[18px]" />,
    items: [
      { href: "/helpdesk", label: "Help desk", icon: <LifeBuoy className="h-4 w-4" /> },
      { href: "/policies", label: "Policies",  icon: <FileText className="h-4 w-4" /> },
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
    ],
  },
];

const roleLabel: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

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

  const admin = isAdminRole(profile.role);

  // Auto-expand whichever group contains the current page.
  const initialExpanded = new Set<string>();
  nav.forEach((e) => {
    if (isGroup(e) && e.items.some((i) => i.href === pathname)) initialExpanded.add(e.key);
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

  const leafCls = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${
      active
        ? "bg-white/[0.08] font-medium text-white"
        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
    }`;

  const Sidebar = (
    <div className="flex h-full flex-col bg-brand-900">
      {/* Company */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.08] px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <LogoMark size={30} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {company?.name || "SM HRMS"}
          </p>
          <p className="truncate text-[11px] text-slate-500">SM HRMS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map((entry) => {
          if (entry.adminOnly && !admin) return null;

          if (!isGroup(entry)) {
            const active = pathname === entry.href;
            return (
              <Link key={entry.href} href={entry.href} onClick={() => setOpen(false)} className={leafCls(active)}>
                {entry.icon}
                {entry.label}
              </Link>
            );
          }

          const items = entry.items.filter((i) => !i.adminOnly || admin);
          if (items.length === 0) return null;
          const groupActive = items.some((i) => i.href === pathname);
          const isOpen = expanded.has(entry.key) || groupActive;

          return (
            <div key={entry.key}>
              <button
                onClick={() => toggle(entry.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${
                  groupActive
                    ? "text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                {entry.icon}
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-4">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
                          active
                            ? "bg-white/[0.08] font-medium text-white"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
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
        <div className="mx-3 mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-300">
            Trial · {trialDaysLeft} days left
          </p>
          <p className="mt-0.5 text-[11px] text-amber-400/70">₹99 / user / month</p>
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
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-500/20 text-xs font-semibold text-white">
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
              <p className="truncate text-[11px] text-slate-500">
                {roleLabel[profile.role]}
              </p>
            </div>
          </Link>
          <NotificationBell />
          <button
            onClick={doLogout}
            title="Sign out"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{Sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64">
            <button
              onClick={() => setOpen(false)}
              className="absolute -right-11 top-4 rounded-lg bg-white/10 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="text-slate-600">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-sm font-semibold text-slate-900">
            {company?.name || "SM HRMS"}
          </span>
          <span className="w-6" />
        </header>
        <main className="mx-auto max-w-6xl p-5 sm:p-7 lg:p-9">{children}</main>
      </div>
    </div>
  );
}
