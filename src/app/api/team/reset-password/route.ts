import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { getOrgActor } from "@/lib/server/org-actor";

/**
 * An owner/admin (or the employee's reporting manager) sets a new
 * password for a team member who has forgotten theirs.
 */
export async function POST(req: Request) {
  const actor = await getOrgActor();
  if (!actor) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const supabase = actor.supabase;
  const user = { id: actor.userId };
  const me = { company_id: actor.companyId, role: actor.role };

  const { employee_id, password } = await req.json().catch(() => ({}));

  if (!employee_id || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  // Target must be in the same company
  const { data: target } = await supabase
    .from("profiles")
    .select("id, company_id, role, manager_id, status")
    .eq("id", employee_id)
    .single();

  if (!target || target.company_id !== me.company_id) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  const isAdmin = ["owner", "admin"].includes(me.role);
  const isTheirManager = target.manager_id === user.id;

  if (!isAdmin && !isTheirManager) {
    return NextResponse.json(
      { error: "You can only reset passwords for your direct reports." },
      { status: 403 }
    );
  }

  // Admin passwords are reset only by the Owner (or by the Admin via email OTP).
  if (target.role === "admin" && me.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Organization Owner can reset an Admin's password." },
      { status: 403 }
    );
  }
  if (target.status && target.status !== "active") {
    return NextResponse.json({ error: "This employee is not active." }, { status: 400 });
  }

  // Nobody may reset the owner's password this way — the owner uses email OTP.
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "The owner must reset their password by email." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(employee_id, { password });
  if (error) {
    return NextResponse.json({ error: friendlyError(error, "reset the password") }, { status: 400 });
  }

  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", employee_id);

  return NextResponse.json({ ok: true });
}
