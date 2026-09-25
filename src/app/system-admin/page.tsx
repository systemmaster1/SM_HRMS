"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Inbox,
  SlidersHorizontal,
  History,
  ArrowLeft,
  CreditCard,
  UserCog,
} from "lucide-react";

import OverviewTab from "@/components/sysadmin/OverviewTab";
import OrganizationsTab from "@/components/sysadmin/OrganizationsTab";
import AccountsTab from "@/components/sysadmin/AccountsTab";
import RequestsTab from "@/components/sysadmin/RequestsTab";
import FeaturesTab from "@/components/sysadmin/FeaturesTab";
import AuditTab from "@/components/sysadmin/AuditTab";
import OrgDrawer from "@/components/sysadmin/OrgDrawer";

type Tab =
  | "overview"
  | "organizations"
  | "accounts"
  | "billing"
  | "requests"
  | "features"
  | "audit";

type TabItem = {
  key: Tab;
  label: string;
  icon: React.ElementType;
  ready: boolean;
};

const TABS: TabItem[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    key: "organizations",
    label: "Organizations",
    icon: Building2,
    ready: true,
  },
  {
    key: "accounts",
    label: "Accounts",
    icon: UserCog,
    ready: true,
  },
  {
    key: "billing",
    label: "Billing & Payments",
    icon: CreditCard,
    ready: false,
  },
  {
    key: "requests",
    label: "Module Requests",
    icon: Inbox,
    ready: true,
  },
  {
    key: "features",
    label: "Features",
    icon: SlidersHorizontal,
    ready: true,
  },
  {
    key: "audit",
    label: "Audit Log",
    icon: History,
    ready: true,
  },
];

export default function SystemAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const [openOrg, setOpenOrg] = useState<string | null>(null);

  const currentTab =
    TABS.find((item) => item.key === tab) || TABS[0];

  const openOrganization = (companyId: string) => {
    setOpenOrg(companyId);
  };

  const closeOrganization = () => {
    setOpenOrg(null);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <header className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
                <ShieldCheck className="h-3.5 w-3.5" />

                SystemMaster Platform Control Center
              </div>

              <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                SystemMaster Super Admin
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Manage organizations, accounts, subscriptions,
                payments, modules and platform-level access from
                one secure control center.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex self-start items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 lg:self-auto"
            >
              <ArrowLeft className="h-4 w-4" />

              Back to HRMS
            </Link>
          </div>
        </header>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((item) => {
              const Icon = item.icon;

              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!item.ready}
                  onClick={() => {
                    if (!item.ready) {
                      return;
                    }

                    setTab(item.key);
                  }}
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                      : item.ready
                        ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        : "cursor-not-allowed text-slate-300 dark:text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />

                  {item.label}

                  {!item.ready && (
                    <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Setup
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </section>

        {/* =====================================================
            CURRENT SECTION
        ===================================================== */}

        <section className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Platform Administration
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {currentTab.label}
            </h2>
          </div>
        </section>

        {/* =====================================================
            OVERVIEW
        ===================================================== */}

        {tab === "overview" && (
          <OverviewTab
            onOpenRequests={() => setTab("requests")}
          />
        )}

        {/* =====================================================
            ORGANIZATIONS
        ===================================================== */}

        {tab === "organizations" && (
          <OrganizationsTab />
        )}

        {/* =====================================================
            ACCOUNT MANAGEMENT
        ===================================================== */}

        {tab === "accounts" && (
          <AccountsTab />
        )}

        {/* =====================================================
            BILLING

            BillingTab hum next steps me create karenge.
            Tab abhi disabled hai, isliye missing component se
            build break nahi hoga.
        ===================================================== */}

        {tab === "billing" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CreditCard className="mx-auto h-9 w-9 text-brand-600" />

            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              Billing & Payments
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Subscription billing, received payments,
              outstanding dues, expiry management and payment
              history will be managed from this section.
            </p>

            <div className="mx-auto mt-5 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Setup pending
            </div>
          </div>
        )}

        {/* =====================================================
            MODULE REQUESTS
        ===================================================== */}

        {tab === "requests" && (
          <RequestsTab
            onOpenOrg={openOrganization}
          />
        )}

        {/* =====================================================
            FEATURES
        ===================================================== */}

        {tab === "features" && (
          <FeaturesTab />
        )}

        {/* =====================================================
            AUDIT LOG
        ===================================================== */}

        {tab === "audit" && (
          <AuditTab />
        )}
      </div>

      {/* =======================================================
          GLOBAL ORGANIZATION DRAWER

          Module Requests se organization directly open ho sakti
          hai. OrganizationsTab apna drawer internally manage
          karta hai.
      ======================================================= */}

      <OrgDrawer
        companyId={openOrg}
        onClose={closeOrganization}
        onChanged={() => undefined}
      />
    </main>
  );
}
