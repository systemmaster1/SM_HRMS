"use client";

import {
  UsersRound,
  Route,
  CalendarRange,
  MapPinned,
  Camera,
  IndianRupee,
  ReceiptText,
  Navigation,
  BellRing,
  BarChart3,
  Sparkles,
  Clock3,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: UsersRound,
    title: "Customer / Dealer CRM",
    description:
      "Customer master, GPS location, contact person, territory, assigned salesperson, outstanding balance and complete visit history.",
    tag: "High priority",
  },
  {
    icon: Route,
    title: "Beat & Route Planning",
    description:
      "Manager-defined weekly beats, customer sequence, route planning, planned-vs-actual movement and route deviation analysis.",
    tag: "High priority",
  },
  {
    icon: CalendarRange,
    title: "Day Plan",
    description:
      "Today's customer sequence with planned time, purpose, priority, visit status and missed-visit reason.",
    tag: "High priority",
  },
  {
    icon: MapPinned,
    title: "Monthly Journey Plan",
    description:
      "Employee proposal, manager approval, revisions, monthly travel plan and actual-vs-plan comparison.",
    tag: "Coming soon",
  },
  {
    icon: Camera,
    title: "Advanced Visit Proof",
    description:
      "GPS verified visit, camera-only proof, person met, notes, outcome and next action for stronger field accountability.",
    tag: "Coming soon",
  },
  {
    icon: IndianRupee,
    title: "Payment Collection",
    description:
      "Cash, UPI, bank and cheque collections with reference number, receipt proof, outstanding tracking and collection reports.",
    tag: "Coming soon",
  },
  {
    icon: ReceiptText,
    title: "Expense & TA/DA",
    description:
      "Travel, food, hotel, parking and other claims with bill proof, manager approval and reimbursement status.",
    tag: "Coming soon",
  },
  {
    icon: Navigation,
    title: "Travel Distance",
    description:
      "Daily, visit-wise and employee-wise KM with route history, planned-vs-actual distance and travel productivity.",
    tag: "Coming soon",
  },
  {
    icon: BellRing,
    title: "Next Visit & Follow-up",
    description:
      "Automatic follow-up reminders, next visit schedule, overdue alerts and manager visibility.",
    tag: "Coming soon",
  },
  {
    icon: BarChart3,
    title: "Advanced Field Analytics",
    description:
      "Visits planned/completed/missed, delay, conversion, route compliance, collections, expenses and employee productivity.",
    tag: "Coming soon",
  },
];

export default function UpcomingFeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              Product roadmap
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Upcoming Field Force Automation Features
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              SM HRMS is evolving into a single platform for HRMS, Task Management and Field Force Automation.
              These modules are planned for upcoming releases and will work with your existing employee, manager,
              attendance and live-tracking structure.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Product direction</p>
            <p className="mt-2 text-lg font-bold">One App. Multiple Business Operations.</p>
            <p className="mt-1 text-xs text-slate-400">HRMS + Tasks + Field Sales + Reports</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature, index) => (
          <article
            key={feature.title}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <feature.icon className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                {feature.tag}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <Clock3 className="h-3.5 w-3.5" />
              Phase {index + 1}
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{feature.description}</p>

            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
              Planned for future release <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Already available today</span>
            <h2 className="mt-2 text-2xl font-bold">Your current SM HRMS foundation is already active</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Upcoming modules will be added on top of the existing platform, so customers can start using the current product now and receive more capabilities as the roadmap is released.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Attendance & GPS",
              "Leave Management",
              "Payroll",
              "Task Management",
              "Field Visits",
              "Live Field Tracking",
              "Field Reports",
              "Team & Organization",
              "Help Desk",
              "Export & Integrations",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-slate-400">
        Roadmap items are planned features and may be released in stages. Availability can vary by subscription plan and platform.
      </p>
    </div>
  );
}
