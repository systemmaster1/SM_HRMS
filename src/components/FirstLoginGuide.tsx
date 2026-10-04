"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ListChecks, Plane, MapPin, ArrowRight, X, CheckCircle2, Inbox, Users, ShieldCheck } from "lucide-react";

const employeeSlides = [
  { icon: CalendarCheck, title: "Attendance made simple", text: "Check in, check out and see today's attendance from one place." },
  { icon: ListChecks, title: "Know what to do today", text: "Your due tasks and checklists stay together. Open a task to update status or add work proof." },
  { icon: Plane, title: "Leave without confusion", text: "Apply for leave and follow its approval status without calling HR." },
  { icon: MapPin, title: "Field work, when enabled", text: "Start visits and field activity only when your organization has enabled these features." },
];

const managerSlides = [
  { icon: CalendarCheck, title: "Your day first", text: "Home shows your own attendance and tasks, and how many requests are waiting for you." },
  { icon: Inbox, title: "Approvals in one tap", text: "Leave and due-date requests from your team collect in Approvals. Approve or reject them from your phone." },
  { icon: ListChecks, title: "Assign and follow up", text: "Give tasks to your team and see what is done, due or overdue." },
  { icon: MapPin, title: "Field team, when enabled", text: "See today's visits and where your field staff are while they are on duty." },
];

const adminSlides = [
  { icon: Users, title: "Add your team", text: "Team → Add employee. Each person gets a temporary password and must set their own on first sign-in." },
  { icon: CalendarCheck, title: "Set your rules", text: "Organization and Settings hold office timings, weekly offs, leave types and payroll rules." },
  { icon: Inbox, title: "Approvals", text: "Every leave and due-date request waiting for you is in Approvals, also on the bottom bar of the app." },
  { icon: ShieldCheck, title: "Protect your organization", text: "Turn on 2-Step Verification in Settings. Only the Owner can add Admins or transfer ownership." },
];

export default function FirstLoginGuide({ userId, role }: { userId: string; role?: string }) {
  const slides = role === "owner" || role === "admin" ? adminSlides : role === "manager" ? managerSlides : employeeSlides;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const key = `smhrms-product-tour-v1:${userId}`;

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {}
  }, [key]);

  const finish = () => {
    try { localStorage.setItem(key, "done"); } catch {}
    setOpen(false);
  };

  if (!open) return null;
  const s = slides[step];
  const Icon = s.icon;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-slate-950/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
      <div className="w-full rounded-t-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[28px] sm:p-8">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Welcome to SM HRMS
          </span>
          <button onClick={finish} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800" aria-label="Skip introduction">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-7 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{s.title}</h2>
        <p className="mt-2 text-[15px] leading-6 text-slate-600 dark:text-slate-300">{s.text}</p>

        <div className="mt-7 flex gap-1.5">
          {slides.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`} />)}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={finish} className="px-2 py-3 text-sm font-semibold text-slate-500">Skip</button>
          {step < slides.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => { finish(); router.push("/dashboard"); }} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white">
              Start using app <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
