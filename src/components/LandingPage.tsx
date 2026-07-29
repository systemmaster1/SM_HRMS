"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { motion, FadeIn, StaggerGroup, StaggerItem, HoverLift, useReducedMotion } from "@/components/motion";
import {
  CalendarCheck, Plane, Wallet, ListChecks, Users, LifeBuoy, MapPin,
  Camera, Navigation, ShieldCheck, Check, ArrowRight, Download, Building2,
  Moon, Bell, FileText, Clock, User, Phone, Mail,
  Repeat, MessageSquare, CalendarClock, BarChart3, Lock, Smartphone,
  Sun, TrendingUp, LayoutDashboard, Sheet, ClipboardCheck, Globe,
} from "lucide-react";

const employeeFeatures = [
  { icon: CalendarCheck, title: "GPS + selfie attendance", desc: "Check in with a live photo and location — no buddy punching, no disputes." },
  { icon: Plane, title: "Apply for leave in seconds", desc: "Casual, sick, earned, short leave, work-from-home — balance updates instantly." },
  { icon: ListChecks, title: "Daily tasks & recurring checklists", desc: "See what's due today; recurring work reschedules itself around holidays, automatically." },
  { icon: ClipboardCheck, title: "Subtasks, comments & tracking", desc: "Break a task into steps, discuss it in comments, and request a deadline extension when needed." },
  { icon: MapPin, title: "Field visit logging", desc: "Log client visits with GPS check-in/out — perfect for sales and service teams." },
  { icon: Wallet, title: "Payslips on your phone", desc: "View and download your monthly payslip anytime — no need to ask HR." },
  { icon: Users, title: "Employee directory", desc: "Find any colleague's contact, department and reporting line in one place." },
  { icon: LifeBuoy, title: "Raise a help desk ticket", desc: "IT, HR or payroll issue — raise it, track it, get notified when it's resolved." },
  { icon: Moon, title: "Light & dark mode", desc: "Switch to a comfortable dark theme with one tap — easy on the eyes, day or night." },
];

const adminFeatures = [
  { icon: Wallet, title: "Automatic payroll", desc: "Late arrivals, short leave and absences deduct automatically — every rule is yours to set." },
  { icon: Navigation, title: "Office geofencing", desc: "Know instantly if someone checked in from outside the office, and how far away." },
  { icon: Lock, title: "Mandatory location & locked tasks", desc: "Force location on for attendance, and lock completed tasks so only an admin can re-open them." },
  { icon: Repeat, title: "Recurring task engine", desc: "Set a checklist once — daily, weekly, monthly or yearly — and it generates itself forever." },
  { icon: BarChart3, title: "On-time performance scoring", desc: "See each employee's on-time %, done, late and overdue counts at a glance." },
  { icon: Building2, title: "Multi-branch, multi-department", desc: "Run one or ten office locations, each with its own geofence and team structure." },
  { icon: ShieldCheck, title: "Full control over every account", desc: "Disable, offboard or restore any employee — their history stays on record." },
  { icon: Sheet, title: "Export & Google Sheet backup", desc: "Export any module to CSV, or auto-back-up your data straight to Google Sheets." },
  { icon: FileText, title: "Documents & KYC on file", desc: "ID proof, bank details, address — stored against every employee, always ready." },
];

/* Everything the platform covers — shown as a compact module strip */
const modules = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: Plane, label: "Leave" },
  { icon: Wallet, label: "Payroll" },
  { icon: ListChecks, label: "Tasks" },
  { icon: Repeat, label: "Checklists" },
  { icon: MapPin, label: "Field visits" },
  { icon: Users, label: "Directory" },
  { icon: Building2, label: "Organization" },
  { icon: LifeBuoy, label: "Help desk" },
  { icon: FileText, label: "Policies" },
  { icon: BarChart3, label: "Reports" },
  { icon: Bell, label: "Notifications" },
  { icon: Sheet, label: "Exports" },
];

export default function LandingPage() {
  const [yearly, setYearly] = useState(false);
  const reduce = useReducedMotion();

  const monthly = 19;
  const yearlyPerMonth = 15;
  const price = yearly ? yearlyPerMonth : monthly;

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient shadow-sm">
              <LogoMark size={22} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">SM HRMS</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-brand-600 dark:hover:text-brand-300">Features</a>
            <a href="#platform" className="transition hover:text-brand-600 dark:hover:text-brand-300">Platform</a>
            <a href="#apps" className="transition hover:text-brand-600 dark:hover:text-brand-300">App &amp; Web</a>
            <a href="#pricing" className="transition hover:text-brand-600 dark:hover:text-brand-300">Pricing</a>
            <a href="/SM_HRMS_User_Guide.pdf" className="transition hover:text-brand-600 dark:hover:text-brand-300">User guide</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-300 sm:block">
              Sign in
            </Link>
            <Link href="/signup"
              className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        {/* soft accent glow */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <FadeIn>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-accent-200 ring-1 ring-white/15">
              <Clock className="h-3 w-3" /> Launch offer · ₹19/user, limited time
            </span>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Run your whole team from one screen.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/75">
              Attendance with GPS and a selfie, leave that updates itself, payroll that
              calculates on its own, and a task engine that keeps everyone on track —
              built for Indian businesses, from five people to five hundred.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/signup"
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-slate-100">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#apps"
                className="flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3 font-medium text-white transition hover:bg-white/10">
                <Smartphone className="h-4 w-4" /> Get the app
              </a>
            </div>
            <p className="mt-4 text-sm text-white/50">7-day free trial · No card required · Works on phone &amp; web</p>
          </FadeIn>

          {/* Signature: live check-in mockup */}
          <FadeIn delay={0.1}>
            <CheckInMockup reduce={!!reduce} />
          </FadeIn>
        </div>
      </section>

      {/* Trust / summary bar */}
      <section className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-6 text-center sm:grid-cols-4">
          {[
            { icon: Navigation, label: "GPS + geofence" },
            { icon: Camera, label: "Selfie verified" },
            { icon: Repeat, label: "Auto-recurring tasks" },
            { icon: Smartphone, label: "App + Web" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <s.icon className="h-4 w-4 text-brand-600 dark:text-brand-300" /> {s.label}
            </div>
          ))}
        </div>
      </section>

      {/* Employee features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">For your team</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            What every employee gets
          </h2>
        </FadeIn>
        <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {employeeFeatures.map((f) => (
            <StaggerItem key={f.title}>
              <HoverLift className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
              </HoverLift>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* Admin features */}
      <section className="bg-slate-50 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-5">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-500">For the owner</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              What you control as admin
            </h2>
          </FadeIn>
          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {adminFeatures.map((f) => (
              <StaggerItem key={f.title}>
                <HoverLift className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Platform / all modules */}
      <section id="platform" className="mx-auto max-w-6xl px-5 py-20">
        <FadeIn>
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">One platform</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Every HR module, in one place
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
              No add-ons, no hidden tiers. Every feature below is included from day one.
            </p>
          </div>
        </FadeIn>
        <StaggerGroup className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {modules.map((m) => (
            <StaggerItem key={m.label}>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center transition hover:border-brand-300 hover:shadow-card dark:border-slate-700 dark:bg-slate-800">
                <m.icon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{m.label}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* App + Web */}
      <section id="apps" className="bg-hero-gradient py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-200">Anywhere access</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Works on the phone and the web</h2>
            <p className="mt-4 max-w-lg leading-relaxed text-white/75">
              Your team checks in and manages tasks from the mobile app; you run the whole
              business from any browser. Same account, same data, always in sync.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                { icon: Smartphone, t: "Mobile app", d: "Install it on Android — fast, offline-friendly, home-screen ready." },
                { icon: Globe, t: "Web dashboard", d: "Full admin control from any laptop or desktop browser." },
                { icon: Bell, t: "Instant notifications", d: "Approvals, comments and task alerts reach you in real time." },
              ].map((r) => (
                <li key={r.t} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <r.icon className="h-4 w-4 text-accent-200" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{r.t}</p>
                    <p className="text-sm text-white/60">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="https://hrms.systemmaster.in" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-slate-100">
                <Globe className="h-4 w-4" /> Open web app
              </a>
              <a href="/SM_HRMS_User_Guide.pdf" download
                className="flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3 font-medium text-white transition hover:bg-white/10">
                <Download className="h-4 w-4" /> Setup guide
              </a>
            </div>
            <p className="mt-3 text-xs text-white/50">Play Store listing coming soon.</p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <PhoneMockup reduce={!!reduce} />
          </FadeIn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-3xl px-5 py-20 text-center">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            One simple price, per active user
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            This is a launch offer — the price goes up as we add more. Lock it in now.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            <button onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!yearly ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${yearly ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
              Yearly <span className="ml-1 text-emerald-600 dark:text-emerald-400">· save 20%</span>
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-card-hover dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-500">Launch offer</p>
            <p className="mt-3 flex items-end justify-center gap-1">
              <span className="text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">₹{price}</span>
              <span className="pb-1.5 text-sm text-slate-400">/ user / month</span>
            </p>
            {yearly && (
              <p className="mt-1.5 text-xs text-slate-400">billed ₹{price * 12} per user, per year</p>
            )}
            <ul className="mt-6 space-y-2.5 text-left text-sm text-slate-600 dark:text-slate-300">
              {[
                "Unlimited attendance, leave & payroll",
                "GPS geofencing & selfie check-in",
                "Recurring tasks, subtasks & delegation",
                "On-time performance scoring",
                "Employee directory & documents",
                "Help desk & real-time notifications",
                "Multi-branch support · App + Web",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-gradient py-3 font-semibold text-white shadow-sm transition hover:opacity-90">
              Start your 7-day trial <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-slate-400">No card required. Cancel anytime.</p>
          </div>
        </FadeIn>
      </section>

      {/* User guide */}
      <section className="border-t border-slate-100 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">New to SM HRMS?</h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              A complete PDF walkthrough — every feature, for employees and admins alike.
            </p>
          </div>
          <a href="/SM_HRMS_User_Guide.pdf" download
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
            <Download className="h-4 w-4" /> Download the user guide
          </a>
        </div>
      </section>

      {/* Get in touch */}
      <section className="border-t border-slate-100 py-16 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Get in touch</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Questions before you start?
          </h3>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <User className="h-4 w-4 text-slate-400" /> Sunil Tiwari, Founder
            </span>
            <a href="mailto:Connect@systemmaster.in" className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-300">
              <Mail className="h-4 w-4 text-slate-400" /> Connect@systemmaster.in
            </a>
            <a href="tel:+919027965956" className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-300">
              <Phone className="h-4 w-4 text-slate-400" /> +91 90279 65956
            </a>
          </div>
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Curious what else SystemMaster Automations builds?{" "}
            <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer"
              className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
              Visit www.systemmaster.in →
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoMark size={18} />
            <span>© {new Date().getFullYear()} SystemMaster Automations · SM HRMS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-600 dark:hover:text-slate-200">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-600 dark:hover:text-slate-200">Create account</Link>
            <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer" className="hover:text-slate-600 dark:hover:text-slate-200">
              www.systemmaster.in
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** The hero's signature element: an animated GPS + selfie check-in card. */
function CheckInMockup({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-white p-5 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Today · Check in</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Verified</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
          <Camera className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Priya Sharma</p>
          <p className="text-xs text-slate-400">Field Executive · Sales</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Navigation className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-medium text-emerald-700">In office</span>
          <span className="text-slate-400">· 42m from South Delhi Office</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" /> Sector 62, Noida, UP
        </div>
      </div>

      <motion.div
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
        style={{ transformOrigin: "left" }}
        className="mt-4 h-1.5 rounded-full bg-emerald-500"
      />
      <p className="mt-2 text-right text-[11px] font-medium text-emerald-600">09:14 AM · Checked in</p>
    </motion.div>
  );
}

/** App section mockup: a phone frame showing today's task list. */
function PhoneMockup({ reduce }: { reduce: boolean }) {
  const tasks = [
    { t: "Morning stock count", done: true },
    { t: "Call 3 new leads", done: true },
    { t: "Submit vendor invoice", done: false },
    { t: "Update CRM pipeline", done: false },
  ];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto w-full max-w-[260px]"
    >
      <div className="rounded-[2rem] border-[6px] border-slate-900/80 bg-white p-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-14 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-slate-900">Today's tasks</p>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">2/4</span>
        </div>
        <div className="mt-3 space-y-2">
          {tasks.map((task) => (
            <div key={task.t} className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${task.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                {task.done && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className={`text-xs ${task.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{task.t}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-accent-gradient px-3 py-2 text-center text-[11px] font-semibold text-white">
          On-time score · 92%
        </div>
      </div>
    </motion.div>
  );
}
