import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { getOrgActor, isOrgAdmin } from "@/lib/server/org-actor";

export async function POST(req: Request) {
  const actor = await getOrgActor();
  if (!actor) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const supabase = actor.supabase;
  const user = { id: actor.userId };
  const me = { company_id: actor.companyId, role: actor.role };

  if (!isOrgAdmin(me.role)) {
    return NextResponse.json({ error: "Only Owner/Admin can remove employees." }, { status: 403 });
  }

  const { employee_id } = await req.json().catch(() => ({}));
  if (!employee_id) return NextResponse.json({ error: "Employee is required." }, { status: 400 });

  const { data: target } = await supabase
    .from("profiles")
    .select("id,company_id,role,full_name")
    .eq("id", employee_id)
    .single();

  if (!target || target.company_id !== me.company_id) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Company Owner cannot be removed." }, { status: 403 });
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 403 });
  }
  if (target.role === "admin" && me.role !== "owner") {
    return NextResponse.json({ error: "Only the Organization Owner can remove an Admin." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Professional "delete": preserve attendance/tasks/visits/payroll history,
  // remove active access and hide employee from the active team.
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      status: "left",
      left_at: new Date().toISOString(),
      field_tracking_enabled: false,
    })
    .eq("id", employee_id)
    .eq("company_id", me.company_id);

  if (profErr) return NextResponse.json({ error: friendlyError(profErr, "remove the employee") }, { status: 400 });

  // Disable login while preserving the auth UUID referenced by historical records.
  const { error: authErr } = await admin.auth.admin.updateUserById(employee_id, {
    ban_duration: "876000h",
  });

  if (authErr) {
    console.error("team/remove: ban failed", employee_id, authErr);
    return NextResponse.json({
      error: "Employee was removed from the active team, but their login could not be disabled. Please try again.",
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `${target.full_name || "Employee"} removed successfully. Historical reports are preserved.`,
  });
}
