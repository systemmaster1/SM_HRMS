import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSupportMeetingEmail } from "@/lib/support-meeting-email";

export const dynamic="force-dynamic";

export async function POST(req:Request){
 try{
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return NextResponse.json({error:"Unauthorized"},{status:401});
  const db=createAdminClient();
  const token=auth.slice(7);
  const {data:{user},error:uerr}=await db.auth.getUser(token);
  if(uerr||!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:isAdmin,error:aerr}=await db.rpc("is_system_admin",{});
  // service role RPC cannot represent the caller; verify system admin table/profile instead below.
  const {data:adminRow}=await db.from("system_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(!adminRow)return NextResponse.json({error:"System admin access required"},{status:403});
  const body=await req.json();
  const {meetingId,status,meetingUrl,notes}=body||{};
  if(!meetingId)return NextResponse.json({error:"Meeting is required."},{status:400});
  const {data:before,error:berr}=await db.from("support_meetings").select("id,company_id,requested_by,title,starts_at,ends_at,status,meeting_url,attendee_email,attendee_name,companies(name),profiles!support_meetings_requested_by_fkey(email,full_name)").eq("id",meetingId).single();
  if(berr||!before)return NextResponse.json({error:berr?.message||"Meeting not found."},{status:404});
  const patch:any={updated_at:new Date().toISOString()};
  if(status)patch.status=status;if(meetingUrl!==undefined)patch.meeting_url=meetingUrl;if(notes!==undefined)patch.internal_notes=notes;
  if(status==="confirmed"||status==="rescheduled")patch.confirmation_email_sent_at=null;
  const {data:after,error}=await db.from("support_meetings").update(patch).eq("id",meetingId).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  const profile=Array.isArray((before as any).profiles)?(before as any).profiles[0]:(before as any).profiles;
  const company=Array.isArray((before as any).companies)?(before as any).companies[0]:(before as any).companies;
  const to=before.attendee_email||profile?.email;
  const kind=status==="cancelled"?"cancelled":status==="rescheduled"?"rescheduled":status==="confirmed"?"confirmed":null;
  let emailSent=false,emailError:string|null=null;
  if(kind&&to){
   try{
    await sendSupportMeetingEmail({to,attendeeName:before.attendee_name||profile?.full_name,orgName:company?.name,title:before.title,startsAt:before.starts_at,endsAt:before.ends_at,meetingUrl:after.meeting_url,kind});
    emailSent=true;
    if(kind==="confirmed"||kind==="rescheduled")await db.from("support_meetings").update({confirmation_email_sent_at:new Date().toISOString(),last_notification_error:null}).eq("id",meetingId);
   }catch(e:any){emailError=e?.message||"Email failed";await db.from("support_meetings").update({last_notification_error:emailError}).eq("id",meetingId);}
  }
  if(kind&&before.requested_by){
   await db.from("notifications").insert({company_id:before.company_id,user_id:before.requested_by,title:kind==="cancelled"?"Support meeting cancelled":kind==="rescheduled"?"Support meeting rescheduled":"Support meeting confirmed",body:before.title,kind:"support_meeting",link:"/helpdesk"});
  }
  return NextResponse.json({ok:true,emailSent,emailError});
 }catch(e:any){return NextResponse.json({error:e?.message||"Unable to update meeting."},{status:500});}
}