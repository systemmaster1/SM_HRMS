import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { razorpayRequest } from "@/lib/razorpay";
import { sendPaymentReceiptEmail } from "@/lib/billing-email";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function addTerm(from: Date, term?: string | null) {
  const months = term === "yearly" ? 12 : term === "6_months" ? 6 : 3;
  const end = new Date(from); end.setUTCMonth(end.getUTCMonth() + months); return end.toISOString();
}
export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const body = await request.json();
    const companyId = String(body?.companyId || "").trim();
    const paymentId = String(body?.paymentId || "").trim();
    const orderId = String(body?.orderId || "").trim();
    if (!companyId || !paymentId || !orderId) return NextResponse.json({ error: "Payment verification details are required." }, { status: 400 });

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    const { data: platformAdmin } = await session.rpc("is_platform_admin");
    let systemAdmin = false;
    if (!platformAdmin) { const { data } = await session.rpc("is_system_admin"); systemAdmin = data === true; }
    if (profile?.company_id !== companyId && platformAdmin !== true && !systemAdmin)
      return NextResponse.json({ error: "You do not have permission to verify this payment." }, { status: 403 });

    const payment = await razorpayRequest("/payments/" + encodeURIComponent(paymentId));
    if (payment?.id !== paymentId || payment?.order_id !== orderId || payment?.status !== "captured")
      return NextResponse.json({ error: "Razorpay has not confirmed this payment as captured." }, { status: 409 });

    const { data: row, error: rowError } = await admin.from("billing_payments")
      .select("id,company_id,receipt_number,plan_code,billing_cycle,total_amount,metadata")
      .eq("company_id", companyId).eq("razorpay_order_id", orderId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if (rowError) throw rowError;
    if (!row) return NextResponse.json({ error: "Matching SM HRMS billing order was not found." }, { status: 404 });
    const amount = Number(payment.amount || 0) / 100;
    if (Math.abs(Number(row.total_amount || 0) - amount) > 0.01)
      return NextResponse.json({ error: "Razorpay amount does not match the HRMS billing order." }, { status: 409 });

    let receipt = row.receipt_number;
    if (!receipt) {
      const { data, error } = await admin.rpc("generate_billing_receipt_number");
      if (error) throw error; receipt = data;
    }
    const paidAt = new Date(Number(payment.captured_at || payment.created_at || Math.floor(Date.now()/1000))*1000).toISOString();
    const endAt = addTerm(new Date(paidAt), row.billing_cycle);
    const { error: payError } = await admin.from("billing_payments").update({
      razorpay_payment_id: paymentId, amount_paid: amount, amount_due: 0, status: "captured",
      payment_method: payment.method || null, paid_at: paidAt, receipt_number: receipt, source: "razorpay",
      metadata: { ...(row.metadata || {}), verified_via: "server_payment_verification" }
    }).eq("id", row.id);
    if (payError) throw payError;

    const seats = Number(row.metadata?.users || 0);
    const patch:any = { status:"active", last_payment_at:paidAt, last_payment_status:"captured",
      current_period_start:paidAt,current_period_end:endAt,next_billing_at:endAt,
      pending_plan_code:null,pending_plan_effective_at:null,updated_at:new Date().toISOString() };
    if(row.plan_code) patch.plan_code=row.plan_code;
    if(row.billing_cycle) patch.billing_cycle=row.billing_cycle;
    if(seats>0) patch.licensed_users=seats;
    const { error: subError } = await admin.from("company_subscriptions").update(patch).eq("company_id",companyId);
    if(subError) throw subError;

    const { data: company } = await admin.from("companies").select("name,email").eq("id",companyId).maybeSingle();
    const { data: sub } = await admin.from("company_subscriptions").select("plan_code,billing_email,current_period_end").eq("company_id",companyId).maybeSingle();
    const to = sub?.billing_email || company?.email || payment.email || null;
    if(to){
      const { data: sent } = await admin.from("billing_email_log").select("id").eq("company_id",companyId).eq("payment_id",row.id).eq("email_type","payment_success").maybeSingle();
      if(!sent){
        await sendPaymentReceiptEmail({to,companyName:company?.name||"Organization",receiptNumber:receipt||"Receipt",planCode:sub?.plan_code,amount,paymentId,paidAt,billingPeriodEnd:sub?.current_period_end});
        await admin.from("billing_email_log").insert({company_id:companyId,payment_id:row.id,email_type:"payment_success",recipient:to,status:"sent",sent_at:new Date().toISOString()});
      }
    }
    return NextResponse.json({ success:true, receiptNumber:receipt, paidAt, validUntil:endAt });
  } catch(error:any) {
    console.error("Payment verification failed:",error);
    return NextResponse.json({ error:String(error?.message||"Unable to verify payment.") },{status:500});
  }
}