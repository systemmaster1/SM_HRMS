import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayYMD } from "@/lib/date";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const today = todayYMD();
  const [{ data: delegations, error: dErr }, { data: checklists, error: cErr }] = await Promise.all([
    db.from("delegations").select("id,company_id,assigned_to,title,due_time").eq("due_date", today).is("completed_at", null),
    db.from("checklist_instances").select("id,company_id,assigned_to,due_time,template:template_id(title)").eq("due_date", today).is("completed_at", null),
  ]);
  if (dErr || cErr) { console.error("task-reminders", dErr || cErr); return NextResponse.json({ ok: false, error: "Could not read tasks." }, { status: 500 }); }

  const wanted = [
    ...(delegations || []).map((t: any) => ({ company_id:t.company_id,user_id:t.assigned_to,title:"Task due today",body:`${t.title}${t.due_time ? ` · due ${String(t.due_time).slice(0,5)}` : ""}`, marker:`delegation:${t.id}:${today}` })),
    ...(checklists || []).map((t: any) => ({ company_id:t.company_id,user_id:t.assigned_to,title:"Checklist due today",body:`${(t.template as any)?.title || "Checklist"}${t.due_time ? ` · due ${String(t.due_time).slice(0,5)}` : ""}`, marker:`checklist:${t.id}:${today}` })),
  ].filter((x) => x.company_id && x.user_id);

  // One query for markers already sent today, one bulk insert (was 2 queries per task).
  let inserted = 0;
  const userIds = Array.from(new Set(wanted.map((n) => n.user_id)));
  const sent = new Set<string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: existing, error: exErr } = await db.from("notifications")
      .select("body").eq("kind", "task_reminder").in("user_id", userIds.slice(i, i + 200))
      .gte("created_at", new Date(Date.now() - 36 * 3600_000).toISOString());
    if (exErr) return NextResponse.json({ ok: false, error: "Could not read sent reminders." }, { status: 500 });
    for (const e of existing || []) {
      const m = String(e.body || "").match(/(delegation|checklist):[0-9a-f-]+:\d{4}-\d{2}-\d{2}$/);
      if (m) sent.add(m[0]);
    }
  }
  const rows = wanted
    .filter((n) => !sent.has(n.marker))
    .map((n) => ({ company_id: n.company_id, user_id: n.user_id, title: n.title, body: `${n.body} · ${n.marker}`, kind: "task_reminder", link: "/tasks" }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("notifications").insert(rows.slice(i, i + 500));
    if (!error) inserted += rows.slice(i, i + 500).length;
    else console.error("task-reminders insert failed", error);
  }
  return NextResponse.json({ ok:true,date:today,openTasks:wanted.length,remindersCreated:inserted });
}
