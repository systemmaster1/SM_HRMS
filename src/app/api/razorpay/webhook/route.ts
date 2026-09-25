import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { sendPaymentReceiptEmail, sendBillingReminderEmail } from "@/lib/billing-email";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const iso = (seconds?: number | null) => seconds ? new Date(seconds * 1000).toISOString() : null;\n\nfunction addBillingTerm(from: Date, term?: string | null) {\n  const months = term === "yearly" ? 12 : term === "6_months" ? 6 : 3;\n  const end = new Date(from);\n  end.setUTCMonth(end.getUTCMonth() + months);\n  return end.toISOString();\n}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyRazorpayWebhook(raw, signature)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const admin = adminClient();
  const eventType = String(body?.event || "unknown");
  const eventId = request.headers.get("x-razorpay-event-id") || null;
  const payment = body?.payload?.payment?.entity || null;
  const subscription = body?.payload?.subscription?.entity || null;
  const entityId = payment?.id || subscription?.id || null;

  if (eventId) {
    const { data: existing } = await admin.from("razorpay_webhook_events").select("id,processing_status").eq("razorpay_event_id", eventId).maybeSingle();
    if (existing?.processing_status === "processed" || existing?.processing_status === "ignored") {
      return NextResponse.json({ success: true, duplicate: true });
    }
  }

  let companyId: string | null = null;
  const subscriptionId = subscription?.id || payment?.notes?.subscription_id || null;
  if (subscriptionId) {
    const { data } = await admin.from("company_subscriptions").select("company_id").eq("razorpay_subscription_id", subscriptionId).maybeSingle();
    companyId = data?.company_id || null;
  }
  if (!companyId && payment?.notes?.company_id) companyId = String(payment.notes.company_id);

  const logPayload = { razorpay_event_id:eventId, event_type:eventType, entity_id:entityId, company_id:companyId, payload:body, processing_status:"received" };
  let logId: string;
  if (eventId) {
    const { data, error } = await admin.from("razorpay_webhook_events").upsert(logPayload,{onConflict:"razorpay_event_id"}).select("id").single();
    if (error) throw error; logId=data.id;
  } else {
    const { data, error } = await admin.from("razorpay_webhook_events").insert(logPayload).select("id").single();
    if (error) throw error; logId=data.id;
  }

  try {
    if (!companyId) {
      await admin.from("razorpay_webhook_events").update({processing_status:"ignored",processed_at:new Date().toISOString(),error_message:"No matching SM HRMS organization"}).eq("id",logId);
      return NextResponse.json({success:true,ignored:true});
    }

    if (subscription) {
      // authenticated is intentionally NOT active: paid access requires confirmed payment.
      const statusMap: Record<string,string> = { active:"active", authenticated:"past_due", pending:"past_due", halted:"past_due", paused:"paused", completed:"cancelled", cancelled:"cancelled" };
      const mapped=statusMap[String(subscription.status||"")] || "past_due";
      const patch: Record<string,any> = {
        razorpay_subscription_id:subscription.id,status:mapped,next_billing_at:iso(subscription.charge_at),
        current_period_start:iso(subscription.current_start),current_period_end:iso(subscription.current_end),updated_at:new Date().toISOString()
      };
      if(subscription.plan_id) patch.razorpay_plan_id=subscription.plan_id;
      const {error}=await admin.from("company_subscriptions").update(patch).eq("company_id",companyId);
      if(error) throw error;
    }

    if (payment) {
      const paid=payment.status==="captured";
      const failed=payment.status==="failed";
      const amount=Number(payment.amount||0)/100, fee=Number(payment.fee||0)/100, tax=Number(payment.tax||0)/100;

      const paymentRow:any={
        company_id:companyId,razorpay_payment_id:payment.id,razorpay_order_id:payment.order_id||null,
        razorpay_invoice_id:payment.invoice_id||null,razorpay_subscription_id:subscription?.id||payment?.notes?.subscription_id||null,
        currency:payment.currency||"INR",subtotal:Math.max(0,amount-tax),tax_amount:tax,total_amount:amount,
        amount_paid:paid?amount:0,amount_due:paid?0:amount,status:paid?"captured":payment.status||"pending",
        payment_method:payment.method||null,paid_at:paid?iso(payment.captured_at||payment.created_at):null,
        source:"razorpay",metadata:{fee,email:payment.email||null,contact:payment.contact||null}
      };
      // Orders are created in billing_payments before checkout. Update that row
      // instead of inserting a second row for the captured payment.
      const {data:existingPayment}=payment.order_id
        ? await admin.from("billing_payments").select("id,receipt_number,plan_code,billing_cycle,metadata").eq("razorpay_order_id",payment.order_id).order("created_at",{ascending:false}).limit(1).maybeSingle()
        : {data:null};
      let saved:any;
      if(existingPayment?.id){
        const {data,error}=await admin.from("billing_payments").update(paymentRow).eq("id",existingPayment.id).select("id,receipt_number,plan_code,billing_cycle,metadata").single();
        if(error) throw error; saved=data;
      }else{
        const {data,error}=await admin.from("billing_payments").upsert(paymentRow,{onConflict:"razorpay_payment_id"}).select("id,receipt_number,plan_code,billing_cycle,metadata").single();
        if(error) throw error; saved=data;
      }

      let receiptNumber=saved.receipt_number;
      if(paid&&!receiptNumber){
        const {data:receipt,error:receiptError}=await admin.rpc("generate_billing_receipt_number");
        if(receiptError) throw receiptError;
        receiptNumber=receipt;
        const {error:updateReceiptError}=await admin.from("billing_payments").update({receipt_number:receipt}).eq("id",saved.id);
        if(updateReceiptError) throw updateReceiptError;
      }

      const subPatch: Record<string,any>={last_payment_status:payment.status||null,updated_at:new Date().toISOString()};
      if(paid){
        const paidAt = paymentRow.paid_at || new Date().toISOString();
        subPatch.last_payment_at=paidAt;
        subPatch.status="active";
        // A paid Razorpay order is the source of truth for activating a pending
        // plan. Never activate a paid plan merely because checkout was opened.
        if(saved?.plan_code) subPatch.plan_code=saved.plan_code;
        const seats=Number(saved?.metadata?.users||0);
        if(seats>0) subPatch.licensed_users=seats;
        if(saved?.billing_cycle) subPatch.billing_cycle=saved.billing_cycle;
        subPatch.current_period_start=paidAt;
        subPatch.current_period_end=addBillingTerm(new Date(paidAt),saved?.billing_cycle);
        subPatch.next_billing_at=subPatch.current_period_end;
        subPatch.pending_plan_code=null;
        subPatch.pending_plan_effective_at=null;
      }
      else if(failed){subPatch.status="past_due";}
      const {error:subError}=await admin.from("company_subscriptions").update(subPatch).eq("company_id",companyId);
      if(subError) throw subError;

      const {data:company}=await admin.from("companies").select("name,email").eq("id",companyId).maybeSingle();
      const {data:sub}=await admin.from("company_subscriptions").select("plan_code,billing_email,current_period_end").eq("company_id",companyId).maybeSingle();
      const to=sub?.billing_email||company?.email||payment.email||null;

      if(to&&paid){
        const {data:already}=await admin.from("billing_email_log").select("id").eq("company_id",companyId).eq("payment_id",saved.id).eq("email_type","payment_success").maybeSingle();
        if(!already){
          await sendPaymentReceiptEmail({to,companyName:company?.name||"Organization",receiptNumber:receiptNumber||"Receipt",planCode:sub?.plan_code,amount,paymentId:payment.id,paidAt:paymentRow.paid_at,billingPeriodEnd:sub?.current_period_end});
          await admin.from("billing_email_log").insert({company_id:companyId,payment_id:saved.id,email_type:"payment_success",recipient:to,status:"sent",sent_at:new Date().toISOString()});
        }
      }

      if(to&&failed){
        const {data:already}=await admin.from("billing_email_log").select("id").eq("company_id",companyId).eq("payment_id",saved.id).eq("email_type","payment_failed").maybeSingle();
        if(!already){
          await sendBillingReminderEmail({to,companyName:company?.name||"Organization",planCode:sub?.plan_code,amountDue:amount,dueAt:new Date().toISOString(),kind:"payment_failed"});
          await admin.from("billing_email_log").insert({company_id:companyId,payment_id:saved.id,email_type:"payment_failed",recipient:to,status:"sent",sent_at:new Date().toISOString()});
        }
      }
    }

    await admin.from("razorpay_webhook_events").update({processing_status:"processed",processed_at:new Date().toISOString(),error_message:null}).eq("id",logId);
    return NextResponse.json({success:true});
  } catch(error:any){
    await admin.from("razorpay_webhook_events").update({processing_status:"failed",processed_at:new Date().toISOString(),error_message:String(error?.message||error).slice(0,1000)}).eq("id",logId);
    console.error("Razorpay webhook processing failed:",error);
    return NextResponse.json({error:"Webhook processing failed"},{status:500});
  }
}
