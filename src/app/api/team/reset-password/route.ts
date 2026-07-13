import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * An owner/admin (or the employee's reporting manager) sets a new
 * password for a team member who has forgotten theirs.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!me?.company_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { employee_id, password } = await req.json();

  if (!employee_id || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // Target must be in the same company
  const { data: target } = await supabase
    .from("profiles")
    .select("id, company_id, role, manager_id")
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", employee_id);

  return NextResponse.json({ ok: true });
}
