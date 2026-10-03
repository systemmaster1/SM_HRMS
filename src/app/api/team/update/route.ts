import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, isEmail } from "@/lib/phone";
import { friendlyError } from "@/lib/errors";
import { getOrgActor, isOrgAdmin, canAssignRole, idsBelongToCompany } from "@/lib/server/org-actor";

export async function POST(req: Request) {
  const actor = await getOrgActor();
  if (!actor) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const me = { company_id: actor.companyId, role: actor.role };

  if (!isOrgAdmin(me.role)) {
    return NextResponse.json({ error: "Only Owner/Admin can edit employees." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const employeeId = body.employee_id as string;
  if (!employeeId) {
    return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: current, error: currentErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", me.company_id)
    .single();

  if (currentErr || !current) {
    return NextResponse.json({ error: "Employee not found in your company." }, { status: 404 });
  }

  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phoneRaw = String(body.phone || "").trim();
  const role = String(body.role || current.role || "employee");

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Enter a valid login email." }, { status: 400 });
  }
  if (!["owner","admin","manager","employee"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  // The Owner's record (login email, role, status) can be changed only by the
  // Owner. Otherwise an Admin could move the Owner's login email to an address
  // they control and take over the organization.
  if (current.role === "owner" && actor.userId !== employeeId) {
    return NextResponse.json({ error: "Only the Organization Owner can edit the Owner's details." }, { status: 403 });
  }
  // Company Owner cannot be demoted through Employee Edit.
  if (current.role === "owner" && role !== "owner") {
    return NextResponse.json({ error: "Company Owner role cannot be changed here." }, { status: 403 });
  }
  // Nobody can be promoted to Owner here; only the Owner can grant/remove Admin.
  if (role !== current.role && !canAssignRole(me.role, current.role, role)) {
    return NextResponse.json({
      error: role === "owner"
        ? "Ownership can only be moved with Transfer Ownership."
        : "Only the Organization Owner can grant or remove the Admin role.",
    }, { status: 403 });
  }
  // Admins cannot edit other Admins' login details; the Owner manages Admins.
  if (current.role === "admin" && me.role !== "owner" && actor.userId !== employeeId) {
    return NextResponse.json({ error: "Only the Organization Owner can edit another Admin." }, { status: 403 });
  }

  // Reporting managers and branch must belong to this organization.
  const okPeople = await idsBelongToCompany(admin, me.company_id, "profiles",
    [body.manager_id, body.work_manager_id, body.field_manager_id]);
  const okBranch = await idsBelongToCompany(admin, me.company_id, "branches", [body.branch_id]);
  if (!okPeople || !okBranch) {
    return NextResponse.json({ error: "Selected manager or branch is not part of your organization." }, { status: 400 });
  }

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalisePhone(phoneRaw);
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    }
  }

  // Keep Auth email synchronized with profile email.
  // This is a server-side admin operation; secret/service role is never exposed to the browser.
  const authPatch: Record<string, any> = {
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  };

  const { error: authErr } = await admin.auth.admin.updateUserById(employeeId, authPatch);
  if (authErr) {
    return NextResponse.json({
      error: authErr.message.toLowerCase().includes("already")
        ? "This login email is already used by another account."
        : friendlyError(authErr, "update the login account"),
    }, { status: 400 });
  }

  const profilePatch: Record<string, any> = {
    full_name: fullName,
    email,
    phone,
    role,
    department: body.department || "",
    designation: body.designation || "",
    branch_id: body.branch_id || null,
    employee_code: String(body.employee_code || current.employee_code || "").trim(),

    manager_id: body.manager_id || null,
    work_manager_id: body.work_manager_id || null,
    field_manager_id: body.field_manager_id || null,

    photo_required: !!body.photo_required,
    auto_attendance: !!body.auto_attendance,
    // null = follow the company weekly off; otherwise days 0 (Sun) … 6 (Sat)
    ...(body.weekly_off_mode !== undefined ? {
      weekly_off_days: body.weekly_off_mode === "custom" && Array.isArray(body.weekly_off_days)
        ? body.weekly_off_days
            .map((d: unknown) => Number(d))
            .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
            .slice(0, 6)
        : null,
    } : {}),
    auto_in_time: body.auto_in_time || "09:30",
    auto_out_time: body.auto_out_time || "18:30",

    field_tracking_enabled: !!body.field_tracking_enabled,
    employee_type: body.employee_type || "office",
    tracking_mode: body.tracking_mode || "working_hours",
    tracking_interval_minutes: Math.min(60, Math.max(1, Math.round(Number(body.tracking_interval_minutes) || 5))),
    tracking_stale_after_minutes: Math.min(240, Math.max(2, Math.round(Number(body.tracking_stale_after_minutes) || 10))),
    route_history_enabled: body.route_history_enabled !== false,

    notify_hr_manager: body.notify_hr_manager !== false,
    notify_work_manager: body.notify_work_manager !== false,
    notify_field_manager: body.notify_field_manager !== false,

    access_permissions: body.access_permissions || current.access_permissions || {},
  };

  const { error: profErr } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", employeeId)
    .eq("company_id", me.company_id);

  if (profErr) {
    // Try to restore the previous Auth email if DB update fails after Auth update.
    await admin.auth.admin.updateUserById(employeeId, {
      email: current.email,
      email_confirm: true,
      user_metadata: { full_name: current.full_name },
    });
    return NextResponse.json({ error: friendlyError(profErr, "save the employee") }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Employee profile and login details updated successfully.",
  });
}
