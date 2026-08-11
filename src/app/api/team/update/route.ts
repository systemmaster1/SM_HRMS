import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, isEmail } from "@/lib/phone";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single();

  if (!me?.company_id || !["owner","admin"].includes(me.role)) {
    return NextResponse.json({ error: "Only Owner/Admin can edit employees." }, { status: 403 });
  }

  const body = await req.json();
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

  // Company Owner cannot be demoted through Employee Edit.
  if (current.role === "owner" && role !== "owner") {
    return NextResponse.json({ error: "Company Owner role cannot be changed here." }, { status: 403 });
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
        : `Could not update login account: ${authErr.message}`,
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
    auto_in_time: body.auto_in_time || "09:30",
    auto_out_time: body.auto_out_time || "18:30",

    field_tracking_enabled: !!body.field_tracking_enabled,
    employee_type: body.employee_type || "office",
    tracking_mode: body.tracking_mode || "working_hours",
    tracking_interval_minutes: Number(body.tracking_interval_minutes || 5),
    tracking_stale_after_minutes: Number(body.tracking_stale_after_minutes || 10),
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
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Employee profile and login details updated successfully.",
  });
}
