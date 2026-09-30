import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashAdmin2fa, randomAdmin2faToken, safeHashEqual, SYSTEM_ADMIN_2FA_COOKIE, SYSTEM_ADMIN_2FA_TTL_SECONDS } from "@/lib/system-admin-2fa";
export const dynamic="force-dynamic";
export async function POST(req:Request){
 try{
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Please sign in again."},{status:401});
  const {data:allowed}=await supabase.rpc("is_platform_admin"); if(allowed!==true) return NextResponse.json({error:"System Admin permission required."},{status:403});
  const body=await req.json().catch(()=>({})); const code=String(body?.code||"").trim();
  if(!/^\d{6}$/.test(code)) return NextResponse.json({error:"Enter the 6-digit verification code."},{status:400});
  const admin=createAdminClient(); const {data:c,error}=await admin.from("system_admin_2fa_challenges").select("*").eq("user_id",user.id).is("consumed_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error) throw error; if(!c||new Date(c.expires_at).getTime()<=Date.now()) return NextResponse.json({error:"Code is invalid or expired. Request a new code."},{status:400});
  const attempts=Number(c.attempts||0); if(attempts>=Number(c.max_attempts||5)) return NextResponse.json({error:"Too many incorrect attempts. Request a new code."},{status:429});
  const ok=safeHashEqual(hashAdmin2fa(`${user.id}:${code}`),c.code_hash);
  if(!ok){const next=attempts+1;await admin.from("system_admin_2fa_challenges").update({attempts:next,...(next>=Number(c.max_attempts||5)?{consumed_at:new Date().toISOString()}:{})}).eq("id",c.id);return NextResponse.json({error:next>=Number(c.max_attempts||5)?"Too many incorrect attempts. Request a new code.":"Incorrect verification code."},{status:next>=Number(c.max_attempts||5)?429:400});}
  await admin.from("system_admin_2fa_challenges").update({consumed_at:new Date().toISOString()}).eq("id",c.id).is("consumed_at",null);
  const token=randomAdmin2faToken(); const expires=new Date(Date.now()+SYSTEM_ADMIN_2FA_TTL_SECONDS*1000).toISOString();
  await admin.from("system_admin_2fa_sessions").update({revoked_at:new Date().toISOString()}).eq("user_id",user.id).is("revoked_at",null);
  const {error:se}=await admin.from("system_admin_2fa_sessions").insert({user_id:user.id,token_hash:hashAdmin2fa(token),expires_at:expires}); if(se) throw se;
  const res=NextResponse.json({success:true}); res.cookies.set(SYSTEM_ADMIN_2FA_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:SYSTEM_ADMIN_2FA_TTL_SECONDS}); return res;
 }catch(e){console.error("System admin 2FA verify error",e);return NextResponse.json({error:"Verification failed."},{status:500});}
}
