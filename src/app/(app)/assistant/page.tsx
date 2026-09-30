import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SMAssistant from "@/components/SMAssistant";
export default async function AssistantPage(){
 const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect("/login");
 const {data:p}=await s.from("profiles").select("role").eq("id",user.id).single();
 const {data:allowed}=await s.rpc("ai_access_allowed");
 return <div className="mx-auto max-w-4xl">
   {!allowed?<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">SM Assistant is not enabled for your role or account. Contact your organization administrator.</div>
   :<SMAssistant role={p?.role||"employee"} embedded />}
 </div>
}