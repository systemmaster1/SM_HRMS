import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOrg2fa, safeOrgHashEqual, randomOrg2faToken, ORG_ADMIN_2FA_COOKIE, ORG_ADMIN_2FA_TTL_SECONDS } from "@/lib/org-admin-2fa";

export async function POST(req:Request){
  const s=await createClient(); const {data:{user}}=await s.auth.getUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:p}=await s.from("profiles").select("role,company_id").eq("id",user.id).single();
  if(!p || !["owner","admin"].includes(p.role)) return NextResponse.json({error:"Forbidden"},{status:403});
  const code=String((await req.json().catch(()=>({})))?.code||"");
  if(!/^\d{6}$/.test(code)) return NextResponse.json({error:"Enter the 6-digit OTP."},{status:400});
  const a=createAdminClient();
  const {data:c}=await a.from("org_admin_2fa_challenges").select("*").eq("user_id",user.id).eq("company_id",p.company_id).eq("purpose","login").is("consumed_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!c || new Date(c.expires_at).getTime()<=Date.now()) return NextResponse.json({error:"OTP expired. Request a new code."},{status:400});
  const n=Number(c.attempts||0)+1;
  if(!safeOrgHashEqual(hashOrg2fa(`${user.id}:${p.company_id}:login:${code}`),c.code_hash)){
    await a.from("org_admin_2fa_challenges").update({attempts:n,...(n>=Number(c.max_attempts||5)?{consumed_at:new Date().toISOString()}:{})}).eq("id",c.id);
    return NextResponse.json({error:n>=Number(c.max_attempts||5)?"Too many attempts. Request a new OTP.":"Incorrect OTP."},{status:n>=Number(c.max_attempts||5)?429:400});
  }
  await a.from("org_admin_2fa_challenges").update({consumed_at:new Date().toISOString()}).eq("id",c.id);
  const token=randomOrg2faToken(), expires=new Date(Date.now()+ORG_ADMIN_2FA_TTL_SECONDS*1000);
  const {error}=await a.from("org_admin_2fa_sessions").insert({user_id:user.id,company_id:p.company_id,token_hash:hashOrg2fa(token),expires_at:expires.toISOString()});
  if(error) return NextResponse.json({error:"Could not create verified session."},{status:500});
  const jar=await cookies(); jar.set(ORG_ADMIN_2FA_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:ORG_ADMIN_2FA_TTL_SECONDS});
  return NextResponse.json({success:true});
}
