import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSupportMeetingEmail } from "@/lib/support-meeting-email";
export const dynamic="force-dynamic"; export const maxDuration=60;
function authorised(req:Request){const s=process.env.CRON_SECRET;return !!s&&req.headers.get("authorization")===`Bearer ${s}`;}
export async function GET(req:Request){
 if(!process.env.CRON_SECRET)return NextResponse.json({error:"CRON_SECRET is not set."},{status:500});
 if(!authorised(req))return NextResponse.json({error:"Unauthorized"},{status:401});
 const db=createAdminClient(),now=Date.now(),max=new Date(now+65*60000).toISOString();
 const {data,error}=await db.from("support_meetings").select("id,company_id,requested_by,title,starts_at,ends_at,meeting_url,attendee_email,attendee_name,confirmation_email_sent_at,reminder_60_sent_at,reminder_10_sent_at,companies(name),profiles!support_meetings_requested_by_fkey(email,full_name)").in("status",["confirmed","rescheduled"]).gt("starts_at",new Date(now-2*60000).toISOString()).lte("starts_at",max);
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 let sent=0,failed=0;
 for(const m of data||[]){
  const start=new Date(m.starts_at).getTime(),mins=(start-now)/60000;
  const profile=Array.isArray((m as any).profiles)?(m as any).profiles[0]:(m as any).profiles;
  const company=Array.isArray((m as any).companies)?(m as any).companies[0]:(m as any).companies;
  const to=m.attendee_email||profile?.email;if(!to)continue;
  const kind=mins<=12&&!m.reminder_10_sent_at?"reminder_10":mins<=62&&mins>=45&&!m.reminder_60_sent_at?"reminder_60":null;
  if(!kind)continue;
  // Claim the reminder first (conditional update). If two cron runs overlap,
  // only one of them gets the row back, so the email is never sent twice.
  const col=kind==="reminder_10"?"reminder_10_sent_at":"reminder_60_sent_at";
  const {data:claim}=await db.from("support_meetings").update({[col]:new Date().toISOString(),last_notification_error:null}).eq("id",m.id).is(col,null).select("id").maybeSingle();
  if(!claim)continue;
  try{
   await sendSupportMeetingEmail({to,attendeeName:m.attendee_name||profile?.full_name,orgName:company?.name,title:m.title,startsAt:m.starts_at,endsAt:m.ends_at,meetingUrl:m.meeting_url,kind});
   sent++;
   await db.from("notifications").insert({company_id:m.company_id,user_id:m.requested_by,title:kind==="reminder_10"?"Meeting starts in 10 minutes":"Meeting starts in 1 hour",body:m.title,kind:"support_meeting",link:"/helpdesk"});
  }catch(e:any){failed++;
   // Release the claim so the next run can retry this reminder.
   await db.from("support_meetings").update({[col]:null,last_notification_error:String(e?.message||"Email failed").slice(0,500)}).eq("id",m.id);}
 }
 return NextResponse.json({ok:true,checked:(data||[]).length,sent,failed});
}