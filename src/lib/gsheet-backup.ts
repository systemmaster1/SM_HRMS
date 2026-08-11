import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

const fmt = (ts?: string | null) => ts ? new Date(ts).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
}) : "";
const rawTs = (ts?: string | null) => ts ? new Date(ts).toISOString() : "";
const first = (...v: any[]) => v.find(x => x !== undefined && x !== null && x !== "") ?? "";
const taskStatus = (dueDate: string, dueTime: string | null, done: string | null, fallback: string) => {
  const due = new Date(`${dueDate}T${dueTime || fallback}`);
  if (done) return new Date(done) > due ? "Done late" : "Done on time";
  return due < new Date() ? "Not done" : "Pending";
};

type Dataset = { name: string; headers: string[]; rows: any[][] };

export async function backupCompany(companyId: string) {
  const db = admin();
  const { data: company } = await db.from("companies").select("*").eq("id", companyId).single();
  if (!company) throw new Error("Company not found.");
  if (!company.gsheet_webhook_url) throw new Error("No Google Sheet web app URL has been saved yet.");

  const { data: people } = await db.from("profiles").select("*").eq("company_id", companyId);
  const byId = new Map((people || []).map((p: any) => [p.id, p]));
  const who = (id?: string | null) => id ? (byId.get(id)?.full_name || "") : "";
  const code = (id?: string | null) => id ? (byId.get(id)?.employee_code || "") : "";
  const dept = (id?: string | null) => id ? (byId.get(id)?.department || "") : "";
  const datasets: Dataset[] = [];

  const { data: att } = await db.from("attendance").select("*").eq("company_id", companyId)
    .order("work_date", { ascending: false }).limit(15000);
  datasets.push({
    name: "Attendance",
    headers: ["Date","Employee","Code","Department","Status","Check In (IST)","Check In Server TS","Check Out (IST)","Check Out Server TS","Late","Late Minutes","Work Minutes","Check In Address","Check Out Address","Check In Lat","Check In Lng","Check Out Lat","Check Out Lng","Check In IP","Check Out IP","Outside Geofence"],
    rows: (att || []).map((r:any) => {
      const cin=first(r.check_in,r.check_in_at), cout=first(r.check_out,r.check_out_at);
      return [r.work_date,who(r.employee_id),code(r.employee_id),dept(r.employee_id),r.status||"",fmt(cin),rawTs(cin),fmt(cout),rawTs(cout),r.is_late?"Yes":"No",r.late_minutes??0,r.work_minutes??0,r.check_in_address||"",r.check_out_address||"",r.check_in_lat??"",r.check_in_lng??"",r.check_out_lat??"",r.check_out_lng??"",r.check_in_ip||"",r.check_out_ip||"",(r.check_in_outside||r.check_out_outside)?"Yes":"No"];
    }),
  });

  const { data: fv } = await db.from("field_visits").select("*").eq("company_id", companyId)
    .order("visit_date", { ascending: false }).limit(10000);
  datasets.push({
    name: "Visits Timeline",
    headers: ["Date","Employee","Code","Client / Site","Purpose","Status","Scheduled","Travel Started","Reached","Meeting Started","Check In","Check Out","Completed","Person Met","Outcome","Next Follow-up","Address","Check In Lat","Check In Lng","Last Lat","Last Lng","Last Location","Target Minutes"],
    rows: (fv||[]).map((r:any)=>[r.visit_date,who(r.employee_id),code(r.employee_id),r.client_name||"",r.purpose||"",r.status||"",fmt(r.scheduled_at),fmt(r.travel_started_at),fmt(r.reached_at),fmt(r.meeting_started_at),fmt(r.check_in),fmt(r.check_out),fmt(r.completed_at),r.person_met||"",r.outcome||"",fmt(r.next_followup_at),r.address||"",r.check_in_lat??"",r.check_in_lng??"",r.last_lat??"",r.last_lng??"",fmt(r.last_location_at),r.target_duration_minutes??""]),
  });

  const { data: events } = await db.from("tracking_events").select("*").eq("company_id", companyId)
    .order("event_time", { ascending: false }).limit(20000);
  datasets.push({
    name: "Activity Timeline",
    headers: ["Server Timestamp (IST)","Server Timestamp ISO","Employee","Code","Department","Event","Visit ID","Latitude","Longitude","Details"],
    rows: (events||[]).map((r:any)=>[fmt(r.event_time),rawTs(r.event_time),who(r.employee_id),code(r.employee_id),dept(r.employee_id),r.event_type||"",r.visit_id||"",r.latitude??"",r.longitude??"",JSON.stringify(r.details||{})]),
  });

  const { data: gps } = await db.from("employee_location_history").select("*").eq("company_id", companyId)
    .order("captured_at", { ascending: false }).limit(30000);
  datasets.push({
    name: "GPS Route History",
    headers: ["Captured (IST)","Server Timestamp ISO","Employee","Code","Visit ID","Latitude","Longitude","Accuracy m","Speed m/s","Heading","Source"],
    rows: (gps||[]).map((r:any)=>[fmt(r.captured_at),rawTs(r.captured_at),who(r.employee_id),code(r.employee_id),r.visit_id||"",r.latitude,r.longitude,r.accuracy_m??"",r.speed_mps??"",r.heading??"",r.source||""]),
  });

  const { data: live } = await db.from("employee_live_locations").select("*").eq("company_id", companyId)
    .order("updated_at", { ascending: false }).limit(5000);
  datasets.push({
    name: "Live Field Status",
    headers: ["Employee","Code","Tracking State","Permission","App State","Last Seen","Latitude","Longitude","Accuracy m","Visit ID","Last Error"],
    rows: (live||[]).map((r:any)=>[who(r.employee_id),code(r.employee_id),r.tracking_state||"",r.permission_state||"",r.app_state||"",fmt(r.last_seen_at),r.latitude??"",r.longitude??"",r.accuracy_m??"",r.visit_id||"",r.last_error||""]),
  });

  const { data: ci } = await db.from("checklist_instances").select("*").eq("company_id", companyId).order("due_date", { ascending:false }).limit(8000);
  const { data: ct } = await db.from("checklist_templates").select("*").eq("company_id", companyId);
  const tmpl = new Map((ct||[]).map((t:any)=>[t.id,t]));
  datasets.push({ name:"Checklist Tasks", headers:["Due Date","Due Time","KRA ID","Title","Frequency","Priority","Employee","Code","Department","Completed At","Status"], rows:(ci||[]).map((r:any)=>{const t:any=tmpl.get(r.template_id)||{};return[r.due_date,(r.due_time||"").slice(0,5),t.kra_id||"",t.title||"",t.frequency||"",t.priority||"",who(r.assigned_to),code(r.assigned_to),dept(r.assigned_to),fmt(r.completed_at),taskStatus(r.due_date,r.due_time,r.completed_at,"09:00")];}) });

  const { data: dg } = await db.from("delegations").select("*").eq("company_id", companyId).order("due_date", { ascending:false }).limit(8000);
  datasets.push({ name:"Delegation Tasks", headers:["Due Date","Due Time","KRA ID","Title","Description","Priority","Employee","Code","Department","Assigned By","Completed At","Status"], rows:(dg||[]).map((r:any)=>[r.due_date,(r.due_time||"").slice(0,5),r.kra_id||"",r.title||"",r.description||"",r.priority||"",who(r.assigned_to),code(r.assigned_to),dept(r.assigned_to),who(r.assigned_by),fmt(r.completed_at),taskStatus(r.due_date,r.due_time,r.completed_at,"23:59")]) });

  const { data: lv } = await db.from("leaves").select("*").eq("company_id", companyId).order("from_date", { ascending:false }).limit(8000);
  const { data: lt } = await db.from("leave_types").select("*").eq("company_id", companyId);
  const types = new Map((lt||[]).map((t:any)=>[t.id,t]));
  datasets.push({ name:"Leave", headers:["From","To","Employee","Code","Department","Type","Duration","Days","Status","Reason","Applied On"], rows:(lv||[]).map((r:any)=>[r.from_date,r.to_date,who(r.employee_id),code(r.employee_id),dept(r.employee_id),(types.get(r.leave_type_id) as any)?.name||"",r.duration_type||"",r.days??"",r.status||"",r.reason||"",fmt(r.created_at)]) });

  datasets.push({ name:"Employees", headers:["Name","Code","Email","Mobile","Role","Department","Designation","Branch ID","Status","Joining Date","Field Tracking","Tracking Mode","Tracking Interval"], rows:(people||[]).map((r:any)=>[r.full_name||"",r.employee_code||"",r.email||"",r.phone||"",r.role||"",r.department||"",r.designation||"",r.branch_id||"",r.status||"",r.date_of_joining||"",r.field_tracking_enabled?"Yes":"No",r.tracking_mode||"",r.tracking_interval_minutes??""]) });

  const res = await fetch(company.gsheet_webhook_url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({secret:company.gsheet_secret||"",generatedAt:new Date().toISOString(),datasets}), redirect:"follow" });
  const text=await res.text();
  if(!res.ok) throw new Error(`Google rejected the request (${res.status}). Check the Apps Script deployment.`);
  let parsed:any={}; try{parsed=JSON.parse(text)}catch{}
  if(parsed?.ok===false) throw new Error(parsed.error||"The Google Apps Script reported a problem.");
  await db.from("companies").update({gsheet_last_backup:new Date().toISOString()}).eq("id",companyId);
  return datasets.length;
}
