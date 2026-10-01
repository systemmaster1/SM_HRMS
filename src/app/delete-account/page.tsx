import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { ArrowLeft, ShieldCheck, Trash2 } from "lucide-react";

export const metadata = {
  title: "Account & Data Deletion · SM HRMS",
  description: "How to request deletion of your SM HRMS account and personal data.",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2"><LogoMark size={38} /><span className="font-bold">SM HRMS</span></Link>
          <Link href="/login" className="flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> Sign in</Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-rose-50 text-rose-700"><Trash2 className="h-6 w-6" /></div>
          <h1 className="mt-5 text-2xl font-bold">Account & data deletion</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">SM HRMS is operated by SystemMaster Automations. You can request deletion of your account and associated personal data at any time.</p>
          <h2 className="mt-7 font-semibold">How to request deletion</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <li>Email <a className="font-semibold text-brand-700" href="mailto:connect@systemmaster.in?subject=SM%20HRMS%20Account%20Deletion%20Request">connect@systemmaster.in</a> from your registered email address.</li>
            <li>Use subject <b>SM HRMS Account Deletion Request</b> and include your registered email/mobile number and organization name.</li>
            <li>We may verify the request before deletion to protect your account.</li>
          </ol>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <b>Organization records:</b> attendance, payroll, statutory or other employment records controlled by your employer may need to be retained for legitimate business or legal obligations. Where applicable, your personal account access will be removed and deletion/retention will be coordinated with the organization that controls the workspace.
          </div>
          <div className="mt-6 flex gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><p>For privacy questions, contact SystemMaster Automations at <a className="font-semibold text-brand-700" href="mailto:connect@systemmaster.in">connect@systemmaster.in</a>.</p></div>
          <p className="mt-6 text-xs text-slate-400">Last updated: 1 October 2026</p>
        </div>
      </div>
    </main>
  );
}
