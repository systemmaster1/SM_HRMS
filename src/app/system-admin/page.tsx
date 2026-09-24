"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, LayoutDashboard, Building2, Inbox, SlidersHorizontal, History, ArrowLeft } from "lucide-react";
import OverviewTab from "@/components/sysadmin/OverviewTab";
import OrganizationsTab from "@/components/sysadmin/OrganizationsTab";
import RequestsTab from "@/components/sysadmin/RequestsTab";
import FeaturesTab from "@/components/sysadmin/FeaturesTab";
import AuditTab from "@/components/sysadmin/AuditTab";
import OrgDrawer from "@/components/sysadmin/OrgDrawer";

type Tab = "overview" | "organizations" | "requests" | "features" | "audit";
const TABS: [Tab, string, any][] = [
  ["overview", "Overview", LayoutDashboard],
  ["organizations", "Organizations", Building2],
  ["requests", "Module requests", Inbox],
  ["features", "Features & availability", SlidersHorizontal],
  ["audit", "Audit log", History],
];

/** SystemMaster Super Admin (access is checked on the server in layout.tsx). */
export default function SystemAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openOrg, setOpenOrg] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Platform Control Center
            </div>
            <h1 className="mt-3 text-3xl font-bold">SystemMaster Super Admin</h1>
            <p className="mt-2 text-sm text-slate-300">Organizations, modules, subscriptions, ads and platform audit.</p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 self-start rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 lg:self-auto">
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
        </header>

        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {TABS.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === k
                ? "bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300"
                : "text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"}`}>
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </nav>

        {tab === "overview" && <OverviewTab onOpenRequests={() => setTab("requests")} />}
        {tab === "organizations" && <OrganizationsTab />}
        {tab === "requests" && <RequestsTab onOpenOrg={setOpenOrg} />}
        {tab === "features" && <FeaturesTab />}
        {tab === "audit" && <AuditTab />}
      </div>
      <OrgDrawer companyId={openOrg} onClose={() => setOpenOrg(null)} onChanged={() => undefined} />
    </main>
  );
}
