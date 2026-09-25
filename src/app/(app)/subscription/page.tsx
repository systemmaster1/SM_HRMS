"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Loader2, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

declare global { interface Window { Razorpay?: any } }

type Plan = { code:string; name:string; price_per_user:number|null; description:string; is_custom:boolean };
type Term = "3_months"|"6_months"|"yearly";
const terms:{code:Term;label:string;months:number;discount:number}[]=[
  {code:"3_months",label:"3 months",months:3,discount:0},
  {code:"6_months",label:"6 months",months:6,discount:10},
  {code:"yearly",label:"12 months",months:12,discount:15},
];
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n);

function loadRazorpay(){
  return new Promise<boolean>((resolve)=>{
    if(window.Razorpay) return resolve(true);
    const s=document.createElement("script"); s.src="https://checkout.razorpay.com/v1/checkout.js"; s.async=true;
    s.onload=()=>resolve(true); s.onerror=()=>resolve(false); document.body.appendChild(s);
  });
}

export default function SubscriptionPage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [plans,setPlans]=useState<Plan[]>([]),[sub,setSub]=useState<any>(null),[features,setFeatures]=useState<any[]>([]);
  const [companyId,setCompanyId]=useState(""),[companyName,setCompanyName]=useState(""),[email,setEmail]=useState("");
  const [selected,setSelected]=useState("starter"),[term,setTerm]=useState<Term>("3_months"),[users,setUsers]=useState(1);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const [{data:p},{data:auth}]=await Promise.all([
      supabase.from("subscription_plans").select("*").eq("active",true).order("display_order"),
      supabase.auth.getUser(),
    ]);
    setPlans((p||[]) as Plan[]); if(!auth.user)return; setEmail(auth.user.email||"");
    const {data:profile}=await supabase.from("profiles").select("company_id").eq("id",auth.user.id).single();
    if(!profile?.company_id)return; setCompanyId(profile.company_id);
    const [{data:s},{data:f},{data:co}]=await Promise.all([
      supabase.from("company_subscriptions").select("*").eq("company_id",profile.company_id).single(),
      supabase.from("plan_features").select("*"),
      supabase.from("companies").select("name,email").eq("id",profile.company_id).single(),
    ]);
    setSub(s||null); setFeatures(f||[]); setCompanyName(co?.name||"SM HRMS");
    if(co?.email)setEmail(co.email); if(s?.plan_code)setSelected(s.plan_code); if(s?.licensed_users)setUsers(Math.max(1,s.licensed_users));
  },[supabase]);
  useEffect(()=>{load()},[load]);

  const plan=plans.find(p=>p.code===selected);
  const rate=Number(plan?.price_per_user||0);
  const tc=terms.find(t=>t.code===term)!;
  const subtotal=rate*users*tc.months, discount=subtotal*tc.discount/100, total=subtotal-discount;

  const pay=async()=>{
    if(!companyId||!selected)return; setBusy(true); setMessage("");
    try{
      const res=await fetch("/api/billing/upgrade",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,planCode:selected,term,users})});
      const data=await res.json(); if(!res.ok)throw new Error(data.error||"Unable to create payment.");
      if(!data.paymentRequired){setMessage("Plan updated successfully using your available subscription credit.");await load();return;}
      if(!(await loadRazorpay()))throw new Error("Razorpay Checkout could not be loaded.");
      const rz=new window.Razorpay({
        key:data.keyId,amount:data.amount,currency:data.currency||"INR",name:"SystemMaster Automations",
        description:`SM HRMS · ${plan?.name||selected} · ${tc.label}`,order_id:data.orderId,
        prefill:{name:companyName,email},theme:{},modal:{ondismiss:()=>setBusy(false)},
        handler:async()=>{setMessage("Payment received. Verifying and activating your plan…");setBusy(false);setTimeout(()=>{load()},2500);}
      });
      rz.on("payment.failed",(r:any)=>{setMessage(r?.error?.description||"Payment failed. Please try again.");setBusy(false)});
      rz.open();
    }catch(e:any){setMessage(e?.message||"Unable to start payment.");setBusy(false)}
  };

  const requestCancel=async()=>{const {error}=await supabase.rpc("customer_set_cancel_at_period_end",{p_cancel:true});setMessage(error?error.message:"Cancellation scheduled for the end of the billing period.");if(!error)load()};

  const fallback:Record<string,string[]>={
    starter:["Attendance","Leave Management","Team & Organization","Employee self-service"],
    business:["Everything in Starter","Task Management","Field Visits","Reports & Export"],
    pro:["Everything in Business","Live Field Tracking","Route History & KM","Advanced controls & integrations"],
    enterprise:["Everything in Pro","Custom modules","Priority onboarding","Enterprise configuration"],
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200"><WalletCards className="h-3.5 w-3.5"/> Subscription & Billing</div>
        <h1 className="mt-3 text-3xl font-bold">Choose your SM HRMS plan</h1><p className="mt-2 text-sm text-slate-300">Select a plan, licensed users and billing period, then pay securely with Razorpay.</p>
      </div>{sub&&<div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><div className="text-xs uppercase tracking-wide text-slate-400">Current plan</div><div className="mt-1 text-2xl font-bold capitalize">{sub.plan_code}</div><div className="mt-1 text-sm text-slate-300">{sub.licensed_users} users · {sub.status}</div></div>}</div>
    </section>

    {message&&<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

    <section className="grid gap-4 lg:grid-cols-4">{plans.map(p=>{
      const active=p.code===selected; const labels=features.filter(f=>f.plan_code===p.code&&f.enabled).slice(0,8).map(f=>f.feature_key.replaceAll("_"," ")) || [];
      return <button type="button" key={p.code} onClick={()=>setSelected(p.code)} className={`text-left rounded-3xl border bg-white p-5 transition ${active?"border-brand-500 ring-2 ring-brand-100":"border-slate-200 hover:border-brand-300"}`}>
        <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{p.name}</h2><p className="mt-1 text-xs text-slate-500">{p.description}</p></div>{active&&<span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase text-brand-700">Selected</span>}</div>
        <div className="mt-5"><span className="text-3xl font-bold">₹{p.price_per_user}</span><span className="text-sm text-slate-500"> / user / month</span></div>
        <div className="mt-5 space-y-2">{(labels.length?labels:(fallback[p.code]||[])).map((x:string)=><div key={x} className="flex items-start gap-2 text-sm text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><span className="capitalize">{x}</span></div>)}</div>
      </button>})}</section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.1fr]">
        <div><label className="text-sm font-semibold text-slate-800">Licensed users</label><input type="number" min={1} value={users} onChange={e=>setUsers(Math.max(1,Math.floor(Number(e.target.value)||1)))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold"/><p className="mt-2 text-xs text-slate-500">Price is calculated per licensed user.</p></div>
        <div><label className="text-sm font-semibold text-slate-800">Billing period</label><div className="mt-2 space-y-2">{terms.map(t=><button type="button" key={t.code} onClick={()=>setTerm(t.code)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold ${term===t.code?"border-brand-500 bg-brand-50 text-brand-800":"border-slate-200"}`}><span>{t.label}</span><span>{t.discount? `${t.discount}% OFF`:"Standard"}</span></button>)}</div></div>
        <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment summary</p><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>Plan</span><b>{plan?.name||"—"}</b></div><div className="flex justify-between"><span>{users} users × {tc.months} months</span><span>{money(subtotal)}</span></div>{discount>0&&<div className="flex justify-between text-emerald-300"><span>Discount ({tc.discount}%)</span><span>-{money(discount)}</span></div>}<div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-lg"><b>Total</b><b>{money(total)}</b></div></div>
          <button type="button" disabled={busy||!plan} onClick={pay} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{busy?<Loader2 className="h-5 w-5 animate-spin"/>:<CreditCard className="h-5 w-5"/>}{busy?"Preparing payment…":sub?.plan_code===selected?"Pay / Renew":"Pay & Activate"}</button>
          <p className="mt-3 text-center text-[11px] text-slate-400">Secure payment by Razorpay. Paid plan activates only after successful payment confirmation.</p>
        </div>
      </div>
    </section>

    {sub&&!sub.cancel_at_period_end&&<section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Manage subscription</h2><p className="mt-1 text-sm text-slate-500">You can schedule cancellation for the end of your paid period.</p></div><button onClick={requestCancel} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700">Cancel at period end</button></div></section>}
  </div>
}