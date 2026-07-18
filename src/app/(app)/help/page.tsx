"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card } from "@/components/ui";
import { FadeIn, StaggerGroup, StaggerItem, HoverLift } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  Users, ShieldCheck, Download, Mail, Phone, Globe, Building2,
  CalendarCheck, Plane, ListChecks, MapPin, LifeBuoy, User as UserIcon,
  UserPlus, Settings, Wallet, ArrowRight, Smartphone, Monitor, Camera,
  Navigation, Check,
} from "lucide-react";

type Step = { title: string; desc: string; icon: any };

const employeeSteps: Step[] = [
  { icon: UserPlus, title: "Sign in", desc: "Use the email or mobile number your admin gave you, plus your password." },
  { icon: CalendarCheck, title: "Mark attendance", desc: "Open Attendance → Check in. Allow location (and camera, if your company asks for a photo)." },
  { icon: Plane, title: "Apply for leave", desc: "Open Leave → Apply for leave. Pick the type and dates — your balance updates immediately." },
  { icon: ListChecks, title: "Do your tasks", desc: "Open Tasks to see what's due today, and tick things off as you finish them." },
  { icon: MapPin, title: "Log a field visit", desc: "If you visit clients, open Field visits and check in/out with GPS." },
  { icon: LifeBuoy, title: "Need help?", desc: "Raise a ticket under Help desk — IT, HR or payroll — and track it to resolution." },
];

const adminSteps: Step[] = [
  { icon: Building2, title: "Set up your organization", desc: "Add departments, designations and, if needed, branches under Organization." },
  { icon: UserPlus, title: "Add your team", desc: "Team → Add member. Set their role, department, designation and manager — a password is generated for you to share." },
  { icon: Settings, title: "Configure policies", desc: "Under Settings, set your grace period, office location, photo policy, leave quotas and payroll deduction rules." },
  { icon: CalendarCheck, title: "Watch attendance roll in", desc: "Attendance and Leave show your whole team; approve requests as they arrive." },
  { icon: Wallet, title: "Run payroll", desc: "Set each employee's salary under Payroll → Salary Master, then let the month's sheet calculate itself." },
  { icon: ShieldCheck, title: "Manage the team", desc: "Disable an account, offboard someone, or restore access — all from their profile in Team." },
];

const employeeFaqs = [
  { q: "I forgot my password", a: "Ask your admin or reporting manager to reset it from Team → your profile → Reset password." },
  { q: "My leave balance looks wrong", a: "Applying for leave deducts immediately; if it's rejected, the days are returned automatically. Approved leave stays deducted." },
  { q: "My photo or location wasn't captured", a: "Check that you've allowed camera and location access for this site in your browser settings, then try again." },
  { q: "How do I know who's my reporting manager?", a: "Open Team and search your own name — your manager is shown alongside your role." },
];

const adminFaqs = [
  { q: "How do I stop a leave type or department from being used?", a: "Departments, designations and leave types can be renamed or removed from Organization at any time." },
  { q: "An employee left the company — what do I do?", a: "Open their profile from Team and choose 'Mark as left'. Their history stays on record under the Left tab." },
  { q: "Can I control who sees the employee directory?", a: "Yes — Settings → Directory & visibility lets you turn it off, scope it to department, and hide email/phone." },
  { q: "How does the recurring checklist scheduling work?", a: "Daily repeats every working day; weekly the same weekday; monthly the same date; quarterly/half-yearly every 90/180 days; yearly the same date next year. A holiday or weekly off automatically shifts the date to the next working day." },
];

function StepFlow({ steps }: { steps: Step[] }) {
  return (
    <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s, i) => (
        <StaggerItem key={s.title}>
          <HoverLift className="relative h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-500">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.desc}</p>
          </HoverLift>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

function DeviceMock({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-700 text-white">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      <p className="text-xs leading-relaxed text-slate-500">
        Same account, same data — SM HRMS works the same way whether you're on your
        phone's browser or a desktop.
      </p>
    </div>
  );
}

export default function HelpPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"employee" | "admin">("employee");
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase
        .from("profiles").select("role").eq("id", auth.user.id).single();
      const isAdmin = isAdminRole((p as Profile)?.role);
      setAdmin(isAdmin);
      if (isAdmin) setTab("admin");
    })();
  }, [supabase]);

  const faqs = tab === "employee" ? employeeFaqs : adminFaqs;
  const steps = tab === "employee" ? employeeSteps : adminSteps;

  return (
    <div>
      <FadeIn>
        <PageHeader
          title="Help & user guide"
          subtitle="A quick walkthrough for everyone on SM HRMS."
          action={
            <a href="/SM_HRMS_User_Guide.pdf" download
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
              <Download className="h-4 w-4" /> Download PDF guide
            </a>
          }
        />
      </FadeIn>

      {/* Tabs */}
      <div className="mb-7 flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
        <button onClick={() => setTab("employee")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "employee" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500"
          }`}>
          <Users className="h-4 w-4" /> Employee guide
        </button>
        {admin && (
          <button onClick={() => setTab("admin")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === "admin" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500"
            }`}>
            <ShieldCheck className="h-4 w-4" /> Admin guide
          </button>
        )}
      </div>

      {/* Step flow */}
      <FadeIn delay={0.03}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          {tab === "employee" ? "Your first week, step by step" : "Setting up your organization, step by step"}
        </h2>
      </FadeIn>
      <StepFlow steps={steps} />

      {/* Works on both */}
      <FadeIn delay={0.06}>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <DeviceMock label="Mobile app" icon={Smartphone} />
          <DeviceMock label="Web / desktop" icon={Monitor} />
        </div>
      </FadeIn>

      {/* Feature spotlight — GPS + selfie, relevant regardless of tab */}
      <FadeIn delay={0.09}>
        <Card className="mt-10 overflow-hidden">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Camera className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">
                How GPS + selfie check-in works
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                When you tap Check in, SM HRMS reads your location, turns it into a readable
                address, and — if your admin has asked for it — opens your camera for a live
                photo. If your company has set an office location, you'll immediately see
                whether you're inside or outside it, and by how many metres.
              </p>
            </div>
            <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-700/30 p-6">
              <div className="w-full max-w-[220px] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <Navigation className="h-3.5 w-3.5" /> In office · 18m
                </p>
                <p className="mt-1.5 text-xs text-slate-400">Sector 62, Noida</p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-full w-4/5 rounded-full bg-emerald-500" />
                </div>
                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <Check className="h-3 w-3" /> Checked in 09:14 AM
                </p>
              </div>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* FAQ */}
      <FadeIn delay={0.12}>
        <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Frequently asked questions
        </h2>
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {faqs.map((f) => (
              <li key={f.q} className="p-5">
                <p className="font-medium text-slate-900 dark:text-slate-100">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.a}</p>
              </li>
            ))}
          </ul>
        </Card>
      </FadeIn>

      {/* Branding + contact */}
      <FadeIn delay={0.15}>
        <div className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-brand-900 p-7 text-white">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Built by SystemMaster Automations
              </p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight">
                SM HRMS — Empowering People. Optimizing Talent.
              </h3>
              <p className="mt-1.5 max-w-md text-sm text-white/60">
                Still stuck on something? Reach out and we'll help you get set up.
              </p>
              <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                Explore our other products <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2 font-medium text-white">
                <UserIcon className="h-4 w-4 text-white/60" /> Sunil Tiwari, Founder
              </p>
              <a href="mailto:Connect@systemmaster.in" className="flex items-center gap-2 text-white/80 hover:text-white">
                <Mail className="h-4 w-4" /> Connect@systemmaster.in
              </a>
              <a href="tel:+919027965956" className="flex items-center gap-2 text-white/80 hover:text-white">
                <Phone className="h-4 w-4" /> +91 90279 65956
              </a>
              <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-white/80 hover:text-white">
                <Globe className="h-4 w-4" /> www.systemmaster.in
              </a>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
