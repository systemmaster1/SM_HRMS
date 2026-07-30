import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { MasterManager } from "@/components/masters/master-manager";

export const dynamic = "force-dynamic";

export default async function MastersPage() {
  const session = await getSession();
  if (!session || !can(session.role, "masters.manage")) redirect("/dashboard");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink dark:text-slate-100">Masters</h1>
        <p className="text-sm text-ink-muted">Manage the reference lists used across the system.</p>
      </div>
      <MasterManager />
    </div>
  );
}
