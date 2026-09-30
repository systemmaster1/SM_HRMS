import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
export const ORG_ADMIN_2FA_COOKIE="sm_org_admin_2fa";
export const ORG_ADMIN_2FA_TTL_SECONDS=12*60*60;
export function hashOrg2fa(value:string){const secret=process.env.ORG_ADMIN_2FA_SECRET; if(!secret||secret.length<32) throw new Error("ORG_ADMIN_2FA_SECRET is not configured"); return createHash("sha256").update(`${secret}:${value}`).digest("hex");}
export function randomOrg2faToken(){return randomBytes(32).toString("hex");}
export function safeOrgHashEqual(a:string,b:string){try{const x=Buffer.from(a,"hex"),y=Buffer.from(b,"hex");return x.length===y.length&&timingSafeEqual(x,y);}catch{return false;}}

export async function hasVerifiedOrgAdmin2fa(userId:string, companyId:string){
  const admin=createAdminClient();
  const {data:pref}=await admin.from("org_admin_2fa_preferences")
    .select("enabled").eq("user_id",userId).eq("company_id",companyId).maybeSingle();
  if(!pref?.enabled) return {required:false,verified:true};
  const jar=await cookies(); const token=jar.get(ORG_ADMIN_2FA_COOKIE)?.value;
  if(!token) return {required:true,verified:false};
  const {data}=await admin.from("org_admin_2fa_sessions")
    .select("expires_at,revoked_at").eq("user_id",userId).eq("company_id",companyId)
    .eq("token_hash",hashOrg2fa(token)).is("revoked_at",null).maybeSingle();
  return {required:true,verified:!!data && new Date(data.expires_at).getTime()>Date.now()};
}
