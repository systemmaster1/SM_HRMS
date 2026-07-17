import { LogoFull } from "@/components/Logo";
import SignOutLink from "@/components/SignOutLink";
import { Lock, Mail } from "lucide-react";

export default function AccountLocked({ status }: { status: "disabled" | "left" }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoFull width={170} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 dark:bg-rose-500/10">
            <Lock className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {status === "left" ? "This account is no longer active" : "This account has been disabled"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {status === "left"
              ? "Your access to this organization has ended. If you believe this is a mistake, please contact your admin."
              : "Your admin has temporarily suspended this account. Please contact them to restore access."}
          </p>

          <a
            href="mailto:"
            className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Mail className="h-4 w-4" /> Contact your admin
          </a>

          <div className="mt-3">
            <SignOutLink />
          </div>
        </div>
      </div>
    </main>
  );
}
