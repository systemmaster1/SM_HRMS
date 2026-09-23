import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { fmtStampIST, istDateTime } from "@/lib/date";

/**
 * Google Sheets mirror for one company.
 *
 * Reads every row (paged - Supabase caps a single request at 1000 rows),
 * formats all times in IST, and POSTs the datasets to the company's
 * Apps Script web app. Every run is written to gsheet_sync_logs so the
 * Integrations page can show when the last sync happened and whether it worked.
 */

export type SyncTrigger = "cron" | "manual" | "auto";

type Dataset = {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  /** Column indexes that must stay plain text in Sheets (mobile numbers, codes). */
  textCols?: number[];
};

function admin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const fmt = fmtStampIST;
const s = (v: any) => (v === null || v === undefined ? "" : String(v));
const n = (v: any) => (v === null || v === undefined || v === "" ? "" : Number(v));
const hhmm = (t: any) => s(t).slice(0, 5);
const mins = (m: any) => {
  const x = Number(m);
  if (!x || isNaN(x)) return "";
  return `${Math.floor(x / 60)}h ${String(x % 60).padStart(2, "0")}m`;
};

const taskStatus = (dueDate: string, dueTime: string | null, done: string | null, fallback: string) => {
  if (!dueDate) return "";
  const due = istDateTime(dueDate, dueTime, fallback);
  if (done) return new Date(done) > due ? "Done late" : "Done on time";
  return due < new Date() ? "Not done" : "Pending";
};

/** All rows of a table for one company, newest first, paged past the 1000-row cap. */
function rowsOf(db: SupabaseClient, table: string, companyId: string, orderCol: string) {
  return fetchAll((from, to) =>
    db.from(table).select("*").eq("company_id", companyId)
      .order(orderCol, { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to));
}

async function buildDatasets(db: SupabaseClient, companyId: string): Promise<Dataset[]> {
  const people = await fetchAll((from, to) =>
    db.from("profiles").select("*").eq("company_id", companyId)
      .order("full_name").order("id").range(from, to));

  const byId = new Map<string, any>(people.map((p: any) => [p.id, p]));
  const who = (id: string) => byId.get(id)?.full_name || "";
  const code = (id: string) => byId.get(id)?.employee_code || "";
  const dept = (id: string) => byId.get(id)?.department || "";

  const [ci, ct, dg, att, lv, lt, fv, visitDefs] = await Promise.all([
    rowsOf(db, "checklist_instances", companyId, "due_date"),
    db.from("checklist_templates").select("*").eq("company_id", companyId).then((r) => r.data || []),
    rowsOf(db, "delegations", companyId, "due_date"),
    rowsOf(db, "attendance", companyId, "work_date"),
    rowsOf(db, "leaves", companyId, "from_date"),
    db.from("leave_types").select("*").eq("company_id", companyId).then((r) => r.data || []),
    rowsOf(db, "field_visits", companyId, "visit_date"),
    db.from("visit_custom_fields").select("field_key,label,sort_order")
      .eq("company_id", companyId).order("sort_order").then((r) => r.data || []),
  ]);

  const tmpl = new Map<string, any>(ct.map((t: any) => [t.id, t]));
  const types = new Map<string, any>(lt.map((t: any) => [t.id, t]));
  const datasets: Dataset[] = [];

  /* ---------- Checklist ---------- */
  datasets.push({
    name: "Checklist Tasks",
    headers: ["Due date", "Due time", "KRA ID", "Title", "Frequency", "Priority",
      "Employee", "Code", "Department", "Completed at", "Status"],
    textCols: [2, 7],
    rows: ci.map((r: any) => {
      const t = tmpl.get(r.template_id) || {};
      return [
        s(r.due_date), hhmm(r.due_time), s(t.kra_id), s(t.title), s(t.frequency), s(t.priority),
        who(r.assigned_to), code(r.assigned_to), dept(r.assigned_to),
        fmt(r.completed_at), taskStatus(r.due_date, r.due_time, r.completed_at, "09:00"),
      ];
    }),
  });

  /* ---------- Delegation ---------- */
  datasets.push({
    name: "Delegation Tasks",
    headers: ["Due date", "Due time", "KRA ID", "Title", "Description", "Priority",
      "Employee", "Code", "Department", "Assigned by", "Completed at", "Status"],
    textCols: [2, 7],
    rows: dg.map((r: any) => [
      s(r.due_date), hhmm(r.due_time), s(r.kra_id), s(r.title), s(r.description), s(r.priority),
      who(r.assigned_to), code(r.assigned_to), dept(r.assigned_to),
      who(r.assigned_by), fmt(r.completed_at),
      taskStatus(r.due_date, r.due_time, r.completed_at, "23:59"),
    ]),
  });

  /* ---------- Attendance ---------- */
  // Real columns are check_in / check_out / check_in_distance_m. The *_at
  // fallbacks keep older databases working too.
  datasets.push({
    name: "Attendance",
    headers: ["Date", "Employee", "Code", "Department", "Status", "Check in", "Check out",
      "Work hours", "Late", "Late (min)", "In office", "Distance (m)", "Check-in address",
      "Check-out address", "Auto marked"],
    textCols: [2],
    rows: att.map((r: any) => {
      const outside = r.check_in_outside ?? r.out_of_office;
      return [
        s(r.work_date), who(r.employee_id), code(r.employee_id), dept(r.employee_id),
        s(r.status), fmt(r.check_in ?? r.check_in_at), fmt(r.check_out ?? r.check_out_at),
        mins(r.work_minutes), r.is_late ? "Yes" : "No", n(r.late_minutes),
        outside === null || outside === undefined ? "" : outside ? "No" : "Yes",
        n(r.check_in_distance_m ?? r.distance_m), s(r.check_in_address), s(r.check_out_address),
        r.is_auto ? "Yes" : "No",
      ];
    }),
  });

  /* ---------- Leave ---------- */
  datasets.push({
    name: "Leave",
    headers: ["From", "To", "Employee", "Code", "Department", "Type",
      "Duration", "Days", "Status", "Reason", "Applied on"],
    textCols: [3],
    rows: lv.map((r: any) => [
      s(r.from_date), s(r.to_date), who(r.employee_id), code(r.employee_id),
      dept(r.employee_id), types.get(r.leave_type_id)?.name || "",
      s(r.day_type ?? r.duration_type).replace(/_/g, " "), n(r.days), s(r.status),
      s(r.reason), fmt(r.created_at),
    ]),
  });

  /* ---------- Field visits ---------- */
  const customHeaders = visitDefs.map((x: any) => x.label);
  const customKeys = visitDefs.map((x: any) => x.field_key);
  datasets.push({
    name: "Field Visits",
    headers: [
      "Date", "Employee", "Code", "Client / site", "Company",
      "Contact person", "Contact number", "Email", "Purpose",
      "Address", "Status", "Person met", "Outcome", "Completion notes", "Remarks",
      "Next action", "Next follow-up",
      "Scheduled", "Travel started", "Reached", "Checked in", "Meeting started", "Completed",
      ...customHeaders,
    ],
    textCols: [2, 6],
    rows: fv.map((r: any) => [
      s(r.visit_date), who(r.employee_id), code(r.employee_id),
      s(r.client_name), s(r.company_name),
      s(r.contact_person), s(r.contact_number), s(r.contact_email),
      s(r.purpose), s(r.address), s(r.status).replace(/_/g, " "),
      s(r.person_met), s(r.outcome), s(r.completion_notes), s(r.remarks),
      s(r.next_action), fmt(r.next_followup_at ?? r.next_follow_up_at),
      fmt(r.scheduled_at), fmt(r.travel_started_at), fmt(r.reached_at), fmt(r.check_in_at),
      fmt(r.meeting_started_at), fmt(r.completed_at),
      ...customKeys.map((key: string) => {
        const value = r.custom_data?.[key];
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (Array.isArray(value)) return value.join(", ");
        if (value && typeof value === "object") return JSON.stringify(value);
        return s(value);
      }),
    ]),
  });

  /* ---------- Employees ---------- */
  const manager = (id: string | null) => (id ? who(id) : "");
  datasets.push({
    name: "Employees",
    headers: ["Name", "Code", "Email", "Mobile", "Role", "Department",
      "Designation", "Reporting manager", "Employee type", "Status", "Date of joining"],
    textCols: [1, 3],
    rows: people.map((r: any) => [
      s(r.full_name), s(r.employee_code), s(r.email), s(r.phone),
      s(r.role), s(r.department), s(r.designation), manager(r.manager_id),
      s(r.employee_type), s(r.status), s(r.joined_on ?? r.date_of_joining),
    ]),
  });

  return datasets;
}

/** Sends the datasets to the Apps Script endpoint and checks the reply. */
async function deliver(url: string, secret: string, datasets: Dataset[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, datasets, sentAt: new Date().toISOString() }),
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e: any) {
    throw new Error(e?.name === "AbortError"
      ? "Google Sheets took too long to respond. The data may still be writing - check the sheet in a minute."
      : `Could not reach Google: ${e?.message || e}`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google rejected the request (${res.status}). Check that the deployment allows access to "Anyone".`);
  }

  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* Google returns HTML on some errors */ }

  if (!parsed) {
    throw new Error("Google returned an unexpected page instead of a result. Re-deploy the Apps Script as a Web app (access: Anyone) and paste the new /exec URL.");
  }
  if (parsed.ok === false) {
    throw new Error(parsed.error === "Bad secret"
      ? "The key in your Apps Script does not match this one. Copy the code again from the Integrations page, paste it over everything in the script editor, save, and re-deploy."
      : parsed.error || "The script reported a problem.");
  }
}

/**
 * Full backup for one company. Returns the number of tabs written.
 * Throws with a human-readable message on failure (also saved in the log).
 */
export async function backupCompany(companyId: string, trigger: SyncTrigger = "manual") {
  const db = admin();

  const { data: log } = await db.from("gsheet_sync_logs")
    .insert({ company_id: companyId, trigger })
    .select("id").single();

  const finish = async (patch: Record<string, any>) => {
    if (!log?.id) return;
    await db.from("gsheet_sync_logs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", log.id);
  };

  try {
    const { data: integ } = await db.from("company_integrations")
      .select("gsheet_webhook_url, gsheet_secret")
      .eq("company_id", companyId).maybeSingle();

    const url = integ?.gsheet_webhook_url?.trim();
    if (!url) throw new Error("No Google Sheet web app URL has been saved yet.");
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
      throw new Error("The web app URL must start with https://script.google.com/");
    }

    const datasets = await buildDatasets(db, companyId);
    await deliver(url, integ?.gsheet_secret || "", datasets);

    const totalRows = datasets.reduce((a, d) => a + d.rows.length, 0);
    await db.from("companies")
      .update({ gsheet_last_backup: new Date().toISOString() })
      .eq("id", companyId);
    await finish({ ok: true, tabs: datasets.length, rows_written: totalRows });

    return datasets.length;
  } catch (e: any) {
    const msg = e?.message || "The backup failed.";
    await finish({ ok: false, error: msg.slice(0, 1000) });
    throw new Error(msg);
  }
}
