"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";

const money=(n:any)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));
const d=(v:any)=>v?new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
const term=(v:any)=>v==="yearly"?"12 months":v==="6_months"?"6 months":v==="3_months"?"3 months":v||"—";

export default function ReceiptPage(){
 const params=useParams();
 const paymentId=String(params?.id||""); const [payment,setPayment]=useState<any>(null),[company,setCompany]=useState<any>(null),[sub,setSub]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{(async()=>{
  try{
   const res=await fetch(`/api/billing/receipt/${encodeURIComponent(paymentId)}`,{cache:"no-store"});
   const data=await res.json();
   if(!res.ok) throw new Error(data.error||"Unable to load receipt.");
   setPayment(data.payment);setCompany(data.company);setSub(data.subscription);
  }catch(e:any){setError(e?.message||"Unable to load receipt.");}finally{setLoading(false)}
 })()},[paymentId]);
 const download=async()=>{
  const { jsPDF }=await import("jspdf");
  const autoTable=(await import("jspdf-autotable")).default;
  const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const address=company?.billing_address||company?.address||company?.registered_address||"";
  const gst=company?.gstin||company?.gst_number||company?.gst_no||"";
  const phone=company?.phone||company?.mobile||company?.contact_number||"";
  const email=company?.billing_email||company?.email||sub?.billing_email||"";
  const users=Number(payment.metadata?.users||sub?.licensed_users||0);
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text("SYSTEMMASTER AUTOMATIONS",15,18);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text("Workflow | ERP | HRMS | Automation",15,24);
  doc.setFontSize(8);doc.text("connect@systemmaster.in",195,15,{align:"right"});doc.text("+91 90279 65956",195,20,{align:"right"});doc.text("www.systemmaster.in",195,25,{align:"right"});
  doc.setDrawColor(29,78,216);doc.setLineWidth(1.2);doc.line(15,31,195,31);
  doc.setTextColor(15,23,42);doc.setFont("helvetica","bold");doc.setFontSize(22);doc.text("PAYMENT RECEIPT",15,43);
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text("SM HRMS subscription payment",15,49);
  doc.setFontSize(9);doc.text("Receipt No.",142,41);doc.setFont("helvetica","bold");doc.text(String(payment.receipt_number||"-"),195,41,{align:"right"});doc.setFont("helvetica","normal");doc.text("Payment Date",142,47);doc.setFont("helvetica","bold");doc.text(d(payment.paid_at||payment.created_at),195,47,{align:"right"});
  doc.setFillColor(7,17,38);doc.rect(15,57,180,9,"F");doc.setTextColor(255,255,255);doc.setFontSize(8);doc.text("BILL TO",19,63);
  doc.setTextColor(15,23,42);doc.setFontSize(12);doc.text(String(company?.name||"Organization"),19,73);
  doc.setFont("helvetica","normal");doc.setFontSize(8);let y=79;doc.text("Organization Code: "+String(company?.org_code||"-"),19,y);y+=5;
  if(email){doc.text("Email: "+String(email),19,y);y+=5} if(phone){doc.text("Phone: "+String(phone),19,y);y+=5} if(gst){doc.text("GSTIN: "+String(gst),19,y);y+=5}
  if(address){const lines=doc.splitTextToSize("Billing Address: "+String(address),170);doc.text(lines,19,y);y+=lines.length*4}
  const tableY=Math.max(105,y+5);
  autoTable(doc,{startY:tableY,head:[["Description","Qty","Rate / Amount"]],body:[[`SM HRMS - ${payment.plan_code||sub?.plan_code||"Subscription"} Plan\n${users?users+" licensed users | ":""}Billing period: ${term(payment.billing_cycle||sub?.billing_cycle)}\nService period: ${d(sub?.current_period_start||payment.paid_at)} to ${d(sub?.current_period_end||sub?.next_billing_at)}`,"1",money(payment.amount_paid||payment.total_amount)]],theme:"grid",headStyles:{fillColor:[29,78,216]},styles:{font:"helvetica",fontSize:8,cellPadding:4},columnStyles:{1:{halign:"center",cellWidth:18},2:{halign:"right",cellWidth:38}}});
  let fy=(doc as any).lastAutoTable.finalY+8;
  autoTable(doc,{startY:fy,margin:{left:115},body:[["Total Amount",money(payment.total_amount)],["Amount Paid",money(payment.amount_paid)],["Balance Due",money(payment.amount_due)]],theme:"grid",styles:{fontSize:8,cellPadding:3},columnStyles:{1:{halign:"right",fontStyle:"bold"}}});
  fy=(doc as any).lastAutoTable.finalY+10;
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("PAYMENT DETAILS",15,fy);doc.text("BANK DETAILS",110,fy);
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.text([`Method: ${payment.payment_method||"-"}`,`Razorpay Payment ID: ${payment.razorpay_payment_id||"-"}`,`Razorpay Order ID: ${payment.razorpay_order_id||"-"}`],15,fy+5);
  doc.text(["Account Holder: Sunil Kumar","Bank: HDFC Bank","Account No.: 50100818274415","IFSC: HDFC0003384"],110,fy+5);
  doc.setDrawColor(226,232,240);doc.line(15,276,195,276);doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text("Thank you for your business!",105,283,{align:"center"});doc.setFont("helvetica","normal");doc.setFontSize(7);doc.text("Powered by SystemMaster Automations | www.systemmaster.in",105,288,{align:"center"});doc.text("Payment receipt for SM HRMS subscription. This document is not a GST tax invoice.",105,292,{align:"center"});
  doc.save(`${payment.receipt_number||"SM-HRMS-Receipt"}.pdf`);
 };
 if(loading)return <div className="p-8 text-center text-slate-500">Loading receipt…</div>;
 if(error||!payment)return <div className="mx-auto max-w-xl p-8"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error||"Receipt not found."}</div></div>;
 const users=Number(payment.metadata?.users||sub?.licensed_users||0);
 return <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
  <div className="mx-auto mb-4 flex max-w-[210mm] justify-between gap-3 px-2 print:hidden">
   <button onClick={()=>router.back()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>Back</button>
   <button onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4"/>Download PDF</button>
  </div>
  <main className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-[12mm] text-slate-900 shadow-xl print:min-h-0 print:max-w-none print:p-[10mm] print:shadow-none">
   <header className="flex items-start justify-between gap-6 border-b-4 border-blue-700 pb-5">
    <div className="flex items-center gap-4"><img src="https://systemmaster.in/logo/systemmaster.png" alt="SystemMaster Automations" className="h-20 w-auto object-contain"/><div><div className="text-lg font-extrabold tracking-wide">SYSTEMMASTER AUTOMATIONS</div><div className="mt-1 text-xs text-slate-500">Workflow · ERP · HRMS · Automation</div></div></div>
    <div className="text-right text-xs leading-5 text-slate-600"><div className="font-semibold text-slate-900">connect@systemmaster.in</div><div>+91 90279 65956</div><div>www.systemmaster.in</div></div>
   </header>
   <section className="mt-5 flex items-start justify-between gap-6">
    <div><h1 className="text-3xl font-black tracking-tight">PAYMENT RECEIPT</h1><p className="mt-1 text-xs text-slate-500">SM HRMS subscription payment</p></div>
    <div className="min-w-56 text-sm"><div className="flex justify-between gap-6"><span className="text-slate-500">Receipt No.</span><b>{payment.receipt_number||"—"}</b></div><div className="mt-2 flex justify-between gap-6"><span className="text-slate-500">Payment Date</span><b>{d(payment.paid_at||payment.created_at)}</b></div></div>
   </section>
   <section className="mt-6 overflow-hidden rounded-xl border"><div className="bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">Bill To</div><div className="p-4"><div className="text-lg font-bold">{company?.name||"Organization"}</div><div className="mt-1 text-sm text-slate-600">{company?.org_code||""}</div>{(company?.billing_email||company?.email||sub?.billing_email)&&<div className="mt-1 text-sm text-slate-600">{company?.billing_email||company?.email||sub?.billing_email}</div>}{(company?.phone||company?.mobile||company?.contact_number)&&<div className="mt-1 text-sm text-slate-600">Phone: {company?.phone||company?.mobile||company?.contact_number}</div>}{(company?.gstin||company?.gst_number||company?.gst_no)&&<div className="mt-1 text-sm text-slate-600">GSTIN: {company?.gstin||company?.gst_number||company?.gst_no}</div>}{(company?.billing_address||company?.address||company?.registered_address)&&<div className="mt-1 text-sm text-slate-600">Billing Address: {company?.billing_address||company?.address||company?.registered_address}</div>}</div></section>
   <section className="mt-6 overflow-hidden rounded-xl border"><table className="w-full text-sm"><thead className="bg-blue-700 text-white"><tr><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-center">Qty</th><th className="px-4 py-3 text-right">Rate / Amount</th></tr></thead><tbody><tr className="align-top"><td className="px-4 py-5"><b>SM HRMS · <span className="capitalize">{payment.plan_code||sub?.plan_code||"Subscription"}</span> Plan</b><div className="mt-2 text-xs leading-5 text-slate-500">{users?users+" licensed users · ":""}Billing period: {term(payment.billing_cycle||sub?.billing_cycle)}<br/>Service period: {d(sub?.current_period_start||payment.paid_at)} to {d(sub?.current_period_end||sub?.next_billing_at)}</div></td><td className="px-4 py-5 text-center">1</td><td className="px-4 py-5 text-right font-bold">{money(payment.amount_paid||payment.total_amount)}</td></tr></tbody></table></section>
   <section className="mt-6 ml-auto w-full max-w-sm overflow-hidden rounded-xl border"><div className="flex justify-between px-4 py-3"><span>Total Amount</span><b>{money(payment.total_amount)}</b></div><div className="flex justify-between border-t px-4 py-3"><span>Amount Paid</span><b className="text-emerald-700">{money(payment.amount_paid)}</b></div><div className="flex justify-between bg-slate-950 px-4 py-4 text-white"><span className="font-bold">Balance Due</span><b>{money(payment.amount_due)}</b></div></section>
   <section className="mt-7 grid gap-5 md:grid-cols-2"><div className="rounded-xl border p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Details</div><dl className="mt-3 space-y-2 text-xs"><div><dt className="text-slate-500">Method</dt><dd className="font-semibold uppercase">{payment.payment_method||"—"}</dd></div><div><dt className="text-slate-500">Razorpay Payment ID</dt><dd className="break-all font-mono">{payment.razorpay_payment_id||"—"}</dd></div><div><dt className="text-slate-500">Razorpay Order ID</dt><dd className="break-all font-mono">{payment.razorpay_order_id||"—"}</dd></div></dl></div><div className="rounded-xl border p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Details</div><dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Account Holder</dt><dd className="font-semibold">Sunil Kumar</dd><dt className="text-slate-500">Bank</dt><dd className="font-semibold">HDFC Bank</dd><dt className="text-slate-500">Account No.</dt><dd className="font-semibold">50100818274415</dd><dt className="text-slate-500">IFSC</dt><dd className="font-semibold">HDFC0003384</dd></dl></div></section>
   <footer className="mt-10 border-t pt-5 text-center"><div className="text-base font-bold">Thank you for your business!</div><div className="mt-2 text-[10px] leading-4 text-slate-500">Powered by SystemMaster Automations · www.systemmaster.in</div><div className="mt-2 text-[10px] text-slate-400">Payment receipt for SM HRMS subscription. This document is not a GST tax invoice.</div></footer>
  </main>
  <style jsx global>{`@media print{@page{size:A4;margin:0}body{background:#fff!important}.print\\:hidden{display:none!important}}`}</style>
 </div>
}