import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const SYSTEM_ADMIN_2FA_COOKIE = "sm_system_admin_2fa";
export const SYSTEM_ADMIN_2FA_TTL_SECONDS = 30 * 60;

export function hashAdmin2fa(value: string) {
  const secret = process.env.SYSTEM_ADMIN_2FA_SECRET;
  if (!secret || secret.length < 32) throw new Error("SYSTEM_ADMIN_2FA_SECRET is not configured");
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}
export function randomAdmin2faToken() { return randomBytes(32).toString("hex"); }
export function safeHashEqual(a:string,b:string) {
  try { const x=Buffer.from(a,"hex"), y=Buffer.from(b,"hex"); return x.length===y.length && timingSafeEqual(x,y); } catch { return false; }
}
export async function hasVerifiedSystemAdmin2fa(userId:string) {
  const jar=await cookies(); const token=jar.get(SYSTEM_ADMIN_2FA_COOKIE)?.value;
  if(!token) return false;
  const admin=createAdminClient();
  const {data}=await admin.from("system_admin_2fa_sessions").select("user_id,expires_at,revoked_at")
    .eq("token_hash",hashAdmin2fa(token)).eq("user_id",userId).is("revoked_at",null).maybeSingle();
  return !!data && new Date(data.expires_at).getTime()>Date.now();
}
