import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, isEmail } from "@/lib/phone";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Caller must be an owner/admin of a company
  const { data: me } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!me?.company_id || !["owner", "admin"].includes(me.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can add team members." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const fullName = (body.full_name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const phoneRaw = (body.phone || "").trim();
  const role = body.role || "employee";

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (!["admin", "manager", "employee"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalisePhone(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();

  let employeeCode = (body.employee_code || "").trim();
  if (!employeeCode) {
    const { data: nextCode, error: codeErr } = await supabase.rpc("next_employee_code_v9");
    if (codeErr || !nextCode) {
      return NextResponse.json({ error: codeErr?.message || "Could not generate employee code." }, { status: 400 });
    }
    employeeCode = nextCode;
  }

  // Create the auth user (email confirmed so they can sign in immediately)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message || "Could not create the account.";
    return NextResponse.json(
      {
        error: msg.toLowerCase().includes("already")
          ? "An account with this email already exists."
          : msg,
      },
      { status: 400 }
    );
  }

  // The signup trigger created a bare profile; fill it in for this company.
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      company_id: me.company_id,
      full_name: fullName,
      email,
      phone,
      role,
      department: body.department || "",
      branch_id: body.branch_id || null,
      designation: body.designation || "",
      employee_code: employeeCode,
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
      status: "active",
      left_at: null,
      must_change_password: true,
    })
    .eq("id", created.user.id);

  if (profErr) {
    // Roll back the auth user so we don't leave an orphan
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: created.user.id, employee_code: employeeCode });
}
