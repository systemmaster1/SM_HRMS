"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { motion, FadeIn, StaggerGroup, StaggerItem, HoverLift, useReducedMotion } from "@/components/motion";
import {
  CalendarCheck, Plane, Wallet, ListChecks, Users, LifeBuoy, MapPin,
  Camera, Navigation, ShieldCheck, Check, ArrowRight, Download, Building2,
  Moon, Bell, FileText, Clock, User, Phone, Mail,
} from "lucide-react";

const employeeFeatures = [
  { icon: CalendarCheck, title: "GPS + selfie attendance", desc: "Check in with a live photo and location — no buddy punching, no disputes." },
  { icon: Plane, title: "Apply for leave in seconds", desc: "Casual, sick, earned, short leave, work-from-home — balance updates instantly." },
  { icon: ListChecks, title: "Daily tasks & recurring checklists", desc: "See what's due today; recurring work reschedules itself around holidays." },
  { icon: MapPin, title: "Field visit logging", desc: "Log client visits with GPS check-in/out — perfect for sales and service teams." },
  { icon: Users, title: "Employee directory", desc: "Find any colleague's contact, department and reporting line in one place." },
  { icon: LifeBuoy, title: "Raise a help desk ticket", desc: "IT, HR or payroll issue — raise it, track it, get notified when it's resolved." },
];

const adminFeatures = [
  { icon: Wallet, title: "Automatic payroll", desc: "Late arrivals, short leave and absences deduct automatically — every rule is yours to set." },
  { icon: Building2, title: "Multi-branch, multi-department", desc: "Run one or ten office locations, each with its own geofence and team structure." },
  { icon: ShieldCheck, title: "Full control over every account", desc: "Disable, offboard or restore any employee — their history stays on record." },
  { icon: Navigation, title: "Office geofencing", desc: "Know instantly if someone checked in from outside the office, and how far away." },
  { icon: FileText, title: "Documents & KYC on file", desc: "ID proof, bank details, address — stored against every employee, always ready." },
  { icon: Bell, title: "Real-time approvals", desc: "Leave requests reach the right manager instantly; approve or reject in one tap." },
];

export default function LandingPage() {
  const [yearly, setYearly] = useState(false);
  const reduce = useReducedMotion();

  const monthly = 19;
  const yearlyPerMonth = 15;
  const price = yearly ? yearlyPerMonth : monthly;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700">
              <LogoMark size={22} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">SM HRMS</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-slate-900">Features</a>
            <a href="#pricing" className="transition hover:text-slate-900">Pricing</a>
            <a href="/SM_HRMS_User_Guide.pdf" className="transition hover:text-slate-900">User guide</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              Sign in
            </Link>
            <Link href="/signup"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800">
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <FadeIn>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-300">
              <Clock className="h-3 w-3" /> Launch offer · ₹19/user, limited time
            </span>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Run your whole team from one screen.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/70">
              Attendance with GPS and a selfie, leave that updates itself, payroll that
              calculates on its own, and a directory everyone can trust — built for
              Indian businesses, from five people to five hundred.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/signup"
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-brand-900 transition hover:bg-slate-100">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="/SM_HRMS_User_Guide.pdf"
                className="flex items-center gap-2 rounded-lg border border-white/20 px-6 py-3 font-medium text-white transition hover:bg-white/10">
                <Download className="h-4 w-4" /> Download the guide
              </a>
            </div>
            <p className="mt-4 text-sm text-white/50">7-day free trial · No card required</p>
          </FadeIn>

          {/* Signature: live check-in mockup */}
          <FadeIn delay={0.1}>
            <CheckInMockup reduce={!!reduce} />
          </FadeIn>
        </div>
      </section>

      {/* Feature sections */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">For your team</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            What every employee gets
          </h2>
        </FadeIn>
        <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {employeeFeatures.map((f) => (
            <StaggerItem key={f.title}>
              <HoverLift className="h-full rounded-2xl border border-slate-200 p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </HoverLift>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">For the owner</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              What you control as admin
            </h2>
          </FadeIn>
          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {adminFeatures.map((f) => (
              <StaggerItem key={f.title}>
                <HoverLift className="h-full rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-600">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-3xl px-5 py-20 text-center">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            One simple price, per active user
          </h2>
          <p className="mt-3 text-slate-500">
            This is a launch offer — the price goes up as we add more. Lock it in now.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!yearly ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${yearly ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              Yearly <span className="ml-1 text-emerald-600">· save 20%</span>
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border-2 border-brand-700 p-8 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Launch offer</p>
            <p className="mt-3 flex items-end justify-center gap-1">
              <span className="text-5xl font-bold tracking-tight text-slate-900">₹{price}</span>
              <span className="pb-1.5 text-sm text-slate-400">/ user / month</span>
            </p>
            {yearly && (
              <p className="mt-1.5 text-xs text-slate-400">billed ₹{price * 12} per user, per year</p>
            )}
            <ul className="mt-6 space-y-2.5 text-left text-sm text-slate-600">
              {[
                "Unlimited attendance, leave & payroll",
                "GPS geofencing & selfie check-in",
                "Recurring tasks & delegation",
                "Employee directory & documents",
                "Help desk & notifications",
                "Multi-branch support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 font-medium text-white transition hover:bg-brand-800">
              Start your 7-day trial <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-slate-400">No card required. Cancel anytime.</p>
          </div>
        </FadeIn>
      </section>

      {/* User guide */}
      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">New to SM HRMS?</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              A complete PDF walkthrough — every feature, for employees and admins alike.
            </p>
          </div>
          <a href="/SM_HRMS_User_Guide.pdf" download
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-800">
            <Download className="h-4 w-4" /> Download the user guide
          </a>
        </div>
      </section>

      {/* Get in touch */}
      <section className="border-t border-slate-100 py-16">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Get in touch</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Questions before you start?
          </h3>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <User className="h-4 w-4 text-slate-400" /> Sunil Tiwari, Founder
            </span>
            <a href="mailto:Connect@systemmaster.in" className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-700">
              <Mail className="h-4 w-4 text-slate-400" /> Connect@systemmaster.in
            </a>
            <a href="tel:+919027965956" className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-700">
              <Phone className="h-4 w-4 text-slate-400" /> +91 90279 65956
            </a>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Curious what else SystemMaster Automations builds?{" "}
            <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer"
              className="font-medium text-brand-700 hover:text-brand-800">
              Visit www.systemmaster.in →
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoMark size={18} />
            <span>© {new Date().getFullYear()} SystemMaster Automations · SM HRMS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-600">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-600">Create account</Link>
            <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer" className="hover:text-slate-600">
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
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
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
