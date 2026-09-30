"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
export default function OrgAdminVerifyPage(){
 const router=useRouter(),[code,setCode]=useState(""),[message,setMessage]=useState("Sending verification code…"),[busy,setBusy]=useState(false);
 async function send(){setBusy(true);const r=await fetch("/api/security/org-admin-2fa/send-login-code",{method:"POST"});const j=await r.json();setMessage(j.message||j.error||"");setBusy(false);}
 useEffect(()=>{void send();},[]);
 async function verify(e:React.FormEvent){e.preventDefault();setBusy(true);const r=await fetch("/api/security/org-admin-2fa/verify-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});const j=await r.json();if(r.ok){router.replace("/dashboard");router.refresh();return;}setMessage(j.error||"Verification failed.");setBusy(false);}
 return <main className="grid min-h-screen place-items-center bg-slate-50 p-5 dark:bg-slate-950"><div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"><ShieldCheck className="h-10 w-10 text-emerald-600"/><h1 className="mt-4 text-2xl font-bold dark:text-white">Organization Admin Verification</h1><p className="mt-2 text-sm text-slate-500">For your organization&apos;s security, enter the 6-digit code sent to your registered email.</p><form onSubmit={verify} className="mt-6 space-y-4"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" className="w-full rounded-xl border px-4 py-3 text-center text-2xl tracking-[.35em] dark:border-slate-700 dark:bg-slate-950"/><button disabled={busy||code.length!==6} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Verify & Continue</button></form><button disabled={busy} onClick={send} className="mt-4 w-full text-sm text-slate-500 underline">Resend code</button><p className="mt-5 text-xs text-slate-500">{message}</p></div></main>;
}
