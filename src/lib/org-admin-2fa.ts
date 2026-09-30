import { createHash, randomBytes, timingSafeEqual } from "crypto";
export const ORG_ADMIN_2FA_COOKIE="sm_org_admin_2fa";
export const ORG_ADMIN_2FA_TTL_SECONDS=12*60*60;
export function hashOrg2fa(value:string){const secret=process.env.ORG_ADMIN_2FA_SECRET; if(!secret||secret.length<32) throw new Error("ORG_ADMIN_2FA_SECRET is not configured"); return createHash("sha256").update(`${secret}:${value}`).digest("hex");}
export function randomOrg2faToken(){return randomBytes(32).toString("hex");}
export function safeOrgHashEqual(a:string,b:string){try{const x=Buffer.from(a,"hex"),y=Buffer.from(b,"hex");return x.length===y.length&&timingSafeEqual(x,y);}catch{return false;}}
