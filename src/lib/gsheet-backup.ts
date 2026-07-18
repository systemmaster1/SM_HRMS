import { createClient } from "@supabase/supabase-js";

/** Server-side admin client (service role) — never exposed to the browser. */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const fmt = (ts: string | null) =>
  ts ? new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) : "";

const taskStatus = (dueDate: string, dueTime: string | null, done: string | null, fallback: string) => {
  const due = new Date(`${dueDate}T${dueTime || fallback}`);
  if (done) return new Date(done) > due ? "Done late" : "Done on time";
  return due < new Date() ? "Not done" : "Pending";
};

/**
 * Builds every dataset for one company and POSTs it to that company's
 * Apps Script web app. Returns how many tabs were sent.
 */
export async function backupCompany(companyId: string) {
  const db = admin();

  const { data: company } = await db
    .from("companies").select("*").eq("id", companyId).single();

  if (!company) throw new Error("Company not found.");
  if (!company.gsheet_webhook_url) throw new Error("No Google Sheet web app URL has been saved yet.");

  /* ---------- People lookup ---------- */
  const { data: people } = await db
    .from("profiles").select("*").eq("company_id", companyId);

  const byId = new Map((people || []).map((p: any) => [p.id, p]));
  const who = (id: string) => byId.get(id)?.full_name || "";
  const code = (id: string) => byId.get(id)?.employee_code || "";
  const dept = (id: string) => byId.get(id)?.department || "";

  const datasets: { name: string; headers: string[]; rows: any[][] }[] = [];

  /* ---------- Checklist ---------- */
  const { data: ci } = await db
    .from("checklist_instances").select("*").eq("company_id", companyId)
    .order("due_date", { ascending: false }).limit(5000);

  const { data: ct } = await db
    .from("checklist_templates").select("*").eq("company_id", companyId);
  const tmpl = new Map((ct || []).map((t: any) => [t.id, t]));

  datasets.push({
    name: "Checklist Tasks",
    headers: ["Due date", "Due time", "KRA ID", "Title", "Frequency", "Priority",
              "Employee", "Code", "Department", "Completed at", "Status"],
    rows: (ci || []).map((r: any) => {
      const t = tmpl.get(r.template_id) || {};
      return [
        r.due_date, (r.due_time || "").slice(0, 5), t.kra_id || "", t.title || "",
        t.frequency || "", t.priority || "",
        who(r.assigned_to), code(r.assigned_to), dept(r.assigned_to),
        fmt(r.completed_at), taskStatus(r.due_date, r.due_time, r.completed_at, "09:00"),
      ];
    }),
  });

  /* ---------- Delegation ---------- */
  const { data: dg } = await db
    .from("delegations").select("*").eq("company_id", companyId)
    .order("due_date", { ascending: false }).limit(5000);

  datasets.push({
    name: "Delegation Tasks",
    headers: ["Due date", "Due time", "KRA ID", "Title", "Description", "Priority",
              "Employee", "Code", "Department", "Assigned by", "Completed at", "Status"],
    rows: (dg || []).map((r: any) => [
      r.due_date, (r.due_time || "").slice(0, 5), r.kra_id || "", r.title || "",
      r.description || "", r.priority || "",
      who(r.assigned_to), code(r.assigned_to), dept(r.assigned_to),
      who(r.assigned_by), fmt(r.completed_at),
      taskStatus(r.due_date, r.due_time, r.completed_at, "23:59"),
    ]),
  });

  /* ---------- Attendance ---------- */
  const { data: att } = await db
    .from("attendance").select("*").eq("company_id", companyId)
    .order("work_date", { ascending: false }).limit(10000);

  datasets.push({
    name: "Attendance",
    headers: ["Date", "Employee", "Code", "Department", "Status", "Check in",
              "Check out", "Late", "Distance (m)", "Address"],
    rows: (att || []).map((r: any) => [
      r.work_date, who(r.employee_id), code(r.employee_id), dept(r.employee_id),
      r.status || "", fmt(r.check_in_at), fmt(r.check_out_at),
      r.is_late ? "Yes" : "No", r.distance_m ?? "", r.check_in_address || "",
    ]),
  });

  /* ---------- Leave ---------- */
  const { data: lv } = await db
    .from("leaves").select("*").eq("company_id", companyId)
    .order("from_date", { ascending: false }).limit(5000);

  const { data: lt } = await db
    .from("leave_types").select("*").eq("company_id", companyId);
  const types = new Map((lt || []).map((t: any) => [t.id, t]));

  datasets.push({
    name: "Leave",
    headers: ["From", "To", "Employee", "Code", "Department", "Type",
              "Duration", "Days", "Status", "Reason", "Applied on"],
    rows: (lv || []).map((r: any) => [
      r.from_date, r.to_date, who(r.employee_id), code(r.employee_id),
      dept(r.employee_id), types.get(r.leave_type_id)?.name || "",
      r.duration_type || "", r.days ?? "", r.status || "",
      r.reason || "", fmt(r.created_at),
    ]),
  });

  /* ---------- Field visits ---------- */
  const { data: fv } = await db
    .from("field_visits").select("*").eq("company_id", companyId)
    .order("visit_date", { ascending: false }).limit(5000);

  datasets.push({
    name: "Field Visits",
    headers: ["Date", "Employee", "Code", "Client / site", "Purpose",
              "Address", "Status", "Checked in", "Checked out"],
    rows: (fv || []).map((r: any) => [
      r.visit_date, who(r.employee_id), code(r.employee_id),
      r.client_name || "", r.purpose || "", r.address || "",
      r.status || "", fmt(r.check_in_at), fmt(r.check_out_at),
    ]),
  });

  /* ---------- Employees ---------- */
  datasets.push({
    name: "Employees",
    headers: ["Name", "Code", "Email", "Mobile", "Role", "Department",
              "Designation", "Status", "Date of joining"],
    rows: (people || []).map((r: any) => [
      r.full_name || "", r.employee_code || "", r.email || "", r.phone || "",
      r.role || "", r.department || "", r.designation || "",
      r.status || "", r.date_of_joining || "",
    ]),
  });

  /* ---------- Deliver ---------- */
  const res = await fetch(company.gsheet_webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: company.gsheet_secret || "", datasets }),
    redirect: "follow",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Google rejected the request (${res.status}). Check that the deployment allows access to "Anyone".`);
  }

  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { /* Google may return HTML on error */ }

  if (parsed && parsed.ok === false) {
    throw new Error(parsed.error === "Bad secret"
      ? "The key in your Apps Script does not match this one. Copy the code again from the Integrations page, paste it over everything in the script editor, save, and re-deploy."
      : parsed.error || "The script reported a problem.");
  }

  await db.from("companies")
    .update({ gsheet_last_backup: new Date().toISOString() })
    .eq("id", companyId);

  return datasets.length;
}
