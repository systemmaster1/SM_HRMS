import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { verifyRazorpayWebhook } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const iso = (seconds?: number | null) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhook(raw, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = adminClient();
  const eventType = String(body?.event || "unknown");
  const eventId = request.headers.get("x-razorpay-event-id") || null;
  const payment = body?.payload?.payment?.entity || null;
  const subscription = body?.payload?.subscription?.entity || null;
  const entityId = payment?.id || subscription?.id || null;

  // Razorpay can retry webhooks. Event ID gives us idempotency where available.
  if (eventId) {
    const { data: existing } = await admin
      .from("razorpay_webhook_events")
      .select("id,processing_status")
      .eq("razorpay_event_id", eventId)
      .maybeSingle();

    if (existing?.processing_status === "processed" || existing?.processing_status === "ignored") {
      return NextResponse.json({ success: true, duplicate: true });
    }
  }

  let companyId: string | null = null;
  const subscriptionId = subscription?.id || payment?.notes?.subscription_id || null;

  if (subscriptionId) {
    const { data } = await admin
      .from("company_subscriptions")
      .select("company_id")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();
    companyId = data?.company_id || null;
  }

  if (!companyId && payment?.notes?.company_id) {
    companyId = String(payment.notes.company_id);
  }

  let logId: string | null = null;
  const logPayload = {
    razorpay_event_id: eventId,
    event_type: eventType,
    entity_id: entityId,
    company_id: companyId,
    payload: body,
    processing_status: "received",
  };

  if (eventId) {
    const { data, error } = await admin
      .from("razorpay_webhook_events")
      .upsert(logPayload, { onConflict: "razorpay_event_id" })
      .select("id")
      .single();
    if (error) throw error;
    logId = data.id;
  } else {
    const { data, error } = await admin
      .from("razorpay_webhook_events")
      .insert(logPayload)
      .select("id")
      .single();
    if (error) throw error;
    logId = data.id;
  }

  try {
    if (!companyId) {
      await admin.from("razorpay_webhook_events").update({
        processing_status: "ignored",
        processed_at: new Date().toISOString(),
        error_message: "No matching SM HRMS organization",
      }).eq("id", logId);

      return NextResponse.json({ success: true, ignored: true });
    }

    // Subscription lifecycle is authoritative for paid feature access.
    if (subscription) {
      const statusMap: Record<string, string> = {
        active: "active",
        authenticated: "active",
        pending: "past_due",
        halted: "past_due",
        paused: "paused",
        completed: "cancelled",
        cancelled: "cancelled",
      };

      const mapped = statusMap[String(subscription.status || "")] || String(subscription.status || "active");

      const patch: Record<string, any> = {
        razorpay_subscription_id: subscription.id,
        status: mapped,
        next_billing_at: iso(subscription.charge_at),
        current_period_start: iso(subscription.current_start),
        current_period_end: iso(subscription.current_end),
        updated_at: new Date().toISOString(),
      };

      if (subscription.plan_id) patch.razorpay_plan_id = subscription.plan_id;

      const { error } = await admin
        .from("company_subscriptions")
        .update(patch)
        .eq("company_id", companyId);
      if (error) throw error;
    }

    if (payment) {
      const paid = payment.status === "captured";
      const amount = Number(payment.amount || 0) / 100;
      const fee = Number(payment.fee || 0) / 100;
      const tax = Number(payment.tax || 0) / 100;

      const paymentRow = {
        company_id: companyId,
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id || null,
        razorpay_invoice_id: payment.invoice_id || null,
        razorpay_subscription_id: subscription?.id || payment?.notes?.subscription_id || null,
        currency: payment.currency || "INR",
        subtotal: Math.max(0, amount - tax),
        tax_amount: tax,
        total_amount: amount,
        amount_paid: paid ? amount : 0,
        amount_due: paid ? 0 : amount,
        status: paid ? "captured" : payment.status || "pending",
        payment_method: payment.method || null,
        paid_at: paid ? iso(payment.captured_at || payment.created_at) : null,
        source: "razorpay",
        metadata: { fee, email: payment.email || null, contact: payment.contact || null },
      };

      const { data: saved, error } = await admin
        .from("billing_payments")
        .upsert(paymentRow, { onConflict: "razorpay_payment_id" })
        .select("id,receipt_number")
        .single();
      if (error) throw error;

      if (paid && !saved.receipt_number) {
        const { data: receipt, error: receiptError } = await admin.rpc("generate_billing_receipt_number");
        if (receiptError) throw receiptError;
        await admin.from("billing_payments").update({ receipt_number: receipt }).eq("id", saved.id);
      }

      await admin.from("company_subscriptions").update({
        last_payment_at: paid ? new Date().toISOString() : undefined,
        last_payment_status: payment.status || null,
        status: paid ? "active" : undefined,
        updated_at: new Date().toISOString(),
      }).eq("company_id", companyId);
    }

    await admin.from("razorpay_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", logId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    await admin.from("razorpay_webhook_events").update({
      processing_status: "failed",
      processed_at: new Date().toISOString(),
      error_message: String(error?.message || error).slice(0, 1000),
    }).eq("id", logId);

    console.error("Razorpay webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
