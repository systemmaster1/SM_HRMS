import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGmailMessage } from "@/lib/gmail";
import { hashAdmin2fa } from "@/lib/system-admin-2fa";
export const dynamic="force-dynamic";
const EXP=10;
export async function POST(){
  try{
    const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
    if(!user?.email) return NextResponse.json({error:"Please sign in again."},{status:401});
    const {data:allowed}=await supabase.rpc("is_platform_admin");
    if(allowed!==true) return NextResponse.json({error:"System Admin permission required."},{status:403});
    const admin=createAdminClient(); const since=new Date(Date.now()-60000).toISOString();
    const {data:recent}=await admin.from("system_admin_2fa_challenges").select("id").eq("user_id",user.id).gte("created_at",since).limit(1).maybeSingle();
    if(recent) return NextResponse.json({error:"A code was sent recently. Please wait one minute."},{status:429});
    await admin.from("system_admin_2fa_challenges").update({consumed_at:new Date().toISOString()}).eq("user_id",user.id).is("consumed_at",null);
    const code=String(randomInt(100000,1000000)); const expires=new Date(Date.now()+EXP*60000).toISOString();
    const {data:challenge,error}=await admin.from("system_admin_2fa_challenges").insert({user_id:user.id,email:user.email.toLowerCase(),code_hash:hashAdmin2fa(`${user.id}:${code}`),expires_at:expires,max_attempts:5}).select("id").single();
    if(error) throw error;
    try{ await sendGmailMessage(user.email,"SM HRMS System Admin verification code",`<div style="font-family:Arial;max-width:560px;margin:auto"><h2>SM HRMS System Admin Verification</h2><p>Use this one-time code to continue to the SystemMaster Super Admin panel:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#f8fafc;text-align:center">${code}</div><p>This code expires in ${EXP} minutes. Do not share it.</p></div>`); }
    catch(e){ await admin.from("system_admin_2fa_challenges").update({consumed_at:new Date().toISOString()}).eq("id",challenge.id); throw e; }
    return NextResponse.json({success:true,message:"Verification code sent to your registered System Admin email.",expiresInMinutes:EXP});
  }catch(e){console.error("System admin 2FA send error",e);return NextResponse.json({error:"Unable to send verification code."},{status:500});}
}
