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
  if (dErr || cErr) return NextResponse.json({ ok: false, error: dErr?.message || cErr?.message }, { status: 500 });

  const wanted = [
    ...(delegations || []).map((t: any) => ({ company_id:t.company_id,user_id:t.assigned_to,title:"Task due today",body:`${t.title}${t.due_time ? ` · due ${String(t.due_time).slice(0,5)}` : ""}`, marker:`delegation:${t.id}:${today}` })),
    ...(checklists || []).map((t: any) => ({ company_id:t.company_id,user_id:t.assigned_to,title:"Checklist due today",body:`${(t.template as any)?.title || "Checklist"}${t.due_time ? ` · due ${String(t.due_time).slice(0,5)}` : ""}`, marker:`checklist:${t.id}:${today}` })),
  ].filter((x) => x.company_id && x.user_id);

  let inserted = 0;
  for (const n of wanted) {
    const body = `${n.body} · ${n.marker}`;
    const { data: existing } = await db.from("notifications").select("id").eq("user_id", n.user_id).eq("kind", "task_reminder").eq("body", body).limit(1).maybeSingle();
    if (existing) continue;
    const { error } = await db.from("notifications").insert({ company_id:n.company_id,user_id:n.user_id,title:n.title,body,kind:"task_reminder",link:"/tasks" });
    if (!error) inserted++;
  }
  return NextResponse.json({ ok:true,date:today,openTasks:wanted.length,remindersCreated:inserted });
}
