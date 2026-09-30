import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ADMIN_2FA_COOKIE, hashOrg2fa } from "@/lib/org-admin-2fa";
import { SYSTEM_ADMIN_2FA_COOKIE, hashAdmin2fa } from "@/lib/system-admin-2fa";

export async function POST(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const jar=await cookies();
  const orgToken=jar.get(ORG_ADMIN_2FA_COOKIE)?.value;
  const sysToken=jar.get(SYSTEM_ADMIN_2FA_COOKIE)?.value;
  if(user){
    const admin=createAdminClient();
    if(orgToken) await admin.from("org_admin_2fa_sessions").update({revoked_at:new Date().toISOString()}).eq("user_id",user.id).eq("token_hash",hashOrg2fa(orgToken)).is("revoked_at",null);
    if(sysToken) await admin.from("system_admin_2fa_sessions").update({revoked_at:new Date().toISOString()}).eq("user_id",user.id).eq("token_hash",hashAdmin2fa(sysToken)).is("revoked_at",null);
  }
  const res=NextResponse.json({success:true});
  res.cookies.set(ORG_ADMIN_2FA_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
  res.cookies.set(SYSTEM_ADMIN_2FA_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
  return res;
}
