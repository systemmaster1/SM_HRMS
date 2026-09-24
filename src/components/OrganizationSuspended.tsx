import { Ban } from "lucide-react";
import SignOutLink from "@/components/SignOutLink";

/** Whole-app block when SystemMaster has suspended the organization. */
export default function OrganizationSuspended({ orgName, orgCode, reason }: {
  orgName?: string | null; orgCode?: string | null; reason?: string | null;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
          <Ban className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Account suspended</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Access for <b>{orgName || "your organization"}</b>{orgCode ? ` (${orgCode})` : ""} is currently suspended.
          Your data is safe and will be available again once the account is re-activated.
        </p>
        {reason && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">Reason: {reason}</p>}
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Please contact SystemMaster support to restore access.
        </p>
        <div className="mt-6"><SignOutLink /></div>
      </div>
    </div>
  );
}
