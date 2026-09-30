import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGmailMessage } from "@/lib/gmail";
import { hashOrg2fa } from "@/lib/org-admin-2fa";

export async function POST() {
  try {
    const s=await createClient(); const {data:{user}}=await s.auth.getUser();
    if(!user?.email) return NextResponse.json({error:"Sign in again."},{status:401});
    const {data:p}=await s.from("profiles").select("role,company_id").eq("id",user.id).single();
    if(!p || !["owner","admin"].includes(p.role)) return NextResponse.json({error:"Forbidden"},{status:403});
    const a=createAdminClient();
    const {data:pref}=await a.from("org_admin_2fa_preferences").select("enabled").eq("user_id",user.id).eq("company_id",p.company_id).maybeSingle();
    if(!pref?.enabled) return NextResponse.json({error:"2-Step Verification is not enabled."},{status:400});
    const since=new Date(Date.now()-60000).toISOString();
    const {data:recent}=await a.from("org_admin_2fa_challenges").select("id").eq("user_id",user.id).eq("purpose","login").gte("created_at",since).limit(1).maybeSingle();
    if(recent) return NextResponse.json({error:"Please wait one minute before requesting another code."},{status:429});
    await a.from("org_admin_2fa_challenges").update({consumed_at:new Date().toISOString()}).eq("user_id",user.id).eq("purpose","login").is("consumed_at",null);
    const code=String(randomInt(100000,1000000));
    const {error}=await a.from("org_admin_2fa_challenges").insert({user_id:user.id,company_id:p.company_id,email:user.email.toLowerCase(),purpose:"login",code_hash:hashOrg2fa(`${user.id}:${p.company_id}:login:${code}`),expires_at:new Date(Date.now()+600000).toISOString(),max_attempts:5});
    if(error) throw error;
    await sendGmailMessage(user.email,"SM HRMS Organization Admin sign-in code",`<h2>SM HRMS Security Verification</h2><p>Your sign-in code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</div><p>This code expires in 10 minutes. Do not share it.</p>`);
    return NextResponse.json({success:true,message:"OTP sent to your registered email."});
  } catch(e){console.error(e);return NextResponse.json({error:"Unable to send OTP."},{status:500});}
}
