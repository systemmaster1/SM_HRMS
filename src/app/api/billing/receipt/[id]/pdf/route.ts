import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

function adminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error("Supabase server configuration is missing");
 return createAdminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
const esc=(v:any)=>String(v??"").replace(/[&<>"]/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]||m));
const money=(v:any)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v||0));
const date=(v:any)=>v?new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await createClient();const {data:{user}}=await session.auth.getUser();
  if(!user)return new NextResponse("Unauthorized",{status:401});
  const {id}=await params,admin=adminClient();
  const {data:profile}=await admin.from("profiles").select("company_id").eq("id",user.id).maybeSingle();
  if(!profile?.company_id)return new NextResponse("Organization not found",{status:404});
  const {data:p}=await admin.from("billing_payments").select("*").eq("id",id).eq("company_id",profile.company_id).maybeSingle();
  if(!p)return new NextResponse("Receipt not found",{status:404});
  const [{data:c},{data:s}]=await Promise.all([
   admin.from("companies").select("*").eq("id",profile.company_id).maybeSingle(),
   admin.from("company_subscriptions").select("*").eq("company_id",profile.company_id).maybeSingle()
  ]);
  const address=c?.billing_address||c?.address||c?.registered_address||"";
  const gst=c?.gstin||c?.gst_number||c?.gst_no||"";
  const phone=c?.phone||c?.mobile||c?.contact_number||"";
  const email=c?.billing_email||c?.email||s?.billing_email||"";
  const users=Number(p.metadata?.users||s?.licensed_users||0);
  const period=p.billing_cycle==="yearly"?"12 months":p.billing_cycle==="6_months"?"6 months":p.billing_cycle==="3_months"?"3 months":p.billing_cycle||"—";
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.receipt_number||"SM-HRMS-Receipt")}</title><style>
  @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0f172a;background:#fff}.page{width:210mm;min-height:297mm;padding:14mm 15mm;position:relative}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #1d4ed8;padding-bottom:12px}.brand{font-size:21px;font-weight:800}.muted{color:#64748b}.small{font-size:11px;line-height:1.55}.title{display:flex;justify-content:space-between;margin:20px 0}.title h1{font-size:30px;margin:0}.box{border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;margin-top:18px}.head{background:#071126;color:#fff;padding:9px 14px;font-size:11px;font-weight:700;text-transform:uppercase}.body{padding:14px}.client{font-size:18px;font-weight:700;margin-bottom:5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 25px;font-size:12px}.items{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}.items th{background:#1d4ed8;color:white;padding:10px;text-align:left}.items td{padding:16px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}.right{text-align:right!important}.totals{width:330px;margin:20px 0 0 auto;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden}.row{display:flex;justify-content:space-between;padding:10px 13px;font-size:12px;border-bottom:1px solid #e2e8f0}.row:last-child{background:#071126;color:#fff;border:0;font-weight:700}.pay{margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:1px solid #dbe3ef;border-radius:10px;padding:13px;font-size:11px;line-height:1.65}.foot{position:absolute;left:15mm;right:15mm;bottom:13mm;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;font-size:10px;color:#64748b}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><div class="page">
  <div class="top"><div><div class="brand">SYSTEMMASTER AUTOMATIONS</div><div class="muted small">Workflow · ERP · HRMS · Automation</div></div><div class="small right"><b>connect@systemmaster.in</b><br>+91 90279 65956<br>www.systemmaster.in</div></div>
  <div class="title"><div><h1>PAYMENT RECEIPT</h1><div class="muted small">SM HRMS subscription payment</div></div><div class="small right">Receipt No. &nbsp; <b>${esc(p.receipt_number||"—")}</b><br><br>Payment Date &nbsp; <b>${date(p.paid_at||p.created_at)}</b></div></div>
  <div class="box"><div class="head">Bill To</div><div class="body"><div class="client">${esc(c?.name||"Organization")}</div><div class="grid"><div>Organization Code: <b>${esc(c?.org_code||"—")}</b></div>${email?`<div>Email: <b>${esc(email)}</b></div>`:""}${phone?`<div>Phone: <b>${esc(phone)}</b></div>`:""}${gst?`<div>GSTIN: <b>${esc(gst)}</b></div>`:""}${address?`<div style="grid-column:1/-1">Billing Address: <b>${esc(address)}</b></div>`:""}</div></div></div>
  <table class="items"><thead><tr><th>Description</th><th>Qty</th><th class="right">Amount</th></tr></thead><tbody><tr><td><b>SM HRMS · ${esc(p.plan_code||s?.plan_code||"Subscription")} Plan</b><br><span class="muted">${users?users+" licensed users · ":""}${esc(period)}<br>Service period: ${date(s?.current_period_start||p.paid_at)} to ${date(s?.current_period_end||s?.next_billing_at)}</span></td><td>1</td><td class="right"><b>${money(p.amount_paid||p.total_amount)}</b></td></tr></tbody></table>
  <div class="totals"><div class="row"><span>Total Amount</span><b>${money(p.total_amount)}</b></div><div class="row"><span>Amount Paid</span><b>${money(p.amount_paid)}</b></div><div class="row"><span>Balance Due</span><b>${money(p.amount_due)}</b></div></div>
  <div class="pay"><div class="card"><b>PAYMENT DETAILS</b><br>Method: ${esc(p.payment_method||"—")}<br>Razorpay Payment ID: ${esc(p.razorpay_payment_id||"—")}<br>Razorpay Order ID: ${esc(p.razorpay_order_id||"—")}</div><div class="card"><b>BANK DETAILS</b><br>Account Holder: Sunil Kumar<br>Bank: HDFC Bank<br>Account No.: 50100818274415<br>IFSC: HDFC0003384</div></div>
  <div class="foot"><b>Thank you for your business!</b><br>Powered by SystemMaster Automations · www.systemmaster.in<br>Payment receipt for SM HRMS subscription. This document is not a GST tax invoice.</div>
  </div><script>window.onload=()=>window.print()</script></body></html>`;
  return new NextResponse(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`attachment; filename="${esc(p.receipt_number||"SM-HRMS-Receipt")}.html"`,"Cache-Control":"no-store"}});
 }catch(e:any){return new NextResponse(String(e?.message||"Unable to create receipt"),{status:500})}
}