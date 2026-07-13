import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import LeaveActions from "@/components/LeaveActions";
import { isAdminRole, type Role } from "@/lib/types";
import { Plane } from "lucide-react";

export default async function LeavePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user!.id).single();
  const admin = isAdminRole(profile?.role as Role);

  const { data: leaves } = await supabase
    .from("leaves")
    .select("*, profiles:employee_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(60);

  const pending = leaves?.filter((l) => l.status === "pending").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle={
          admin
            ? `${pending} request${pending === 1 ? "" : "s"} awaiting your approval.`
            : "Your leave requests and their status."
        }
      />
      <Card>
        {leaves && leaves.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {leaves.map((l: any) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {l.profiles?.full_name || "—"}
                    </p>
                    <Badge value={l.leave_type} />
                    <Badge value={l.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {l.from_date} → {l.to_date}
                    {l.reason && ` · ${l.reason}`}
                  </p>
                </div>
                {admin && l.status === "pending" && <LeaveActions leaveId={l.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Plane}
            title="No leave requests"
            hint="Requests submitted by your team will appear here for approval."
          />
        )}
      </Card>
    </div>
  );
}
