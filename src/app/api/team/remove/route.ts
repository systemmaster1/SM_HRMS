import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single();

  if (!me?.company_id || !["owner","admin"].includes(me.role)) {
    return NextResponse.json({ error: "Only Owner/Admin can remove employees." }, { status: 403 });
  }

  const { employee_id } = await req.json();
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

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });

  // Disable login while preserving the auth UUID referenced by historical records.
  const { error: authErr } = await admin.auth.admin.updateUserById(employee_id, {
    ban_duration: "876000h",
  });

  if (authErr) {
    return NextResponse.json({
      error: `Employee was removed from active team, but login disable failed: ${authErr.message}`,
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `${target.full_name || "Employee"} removed successfully. Historical reports are preserved.`,
  });
}
