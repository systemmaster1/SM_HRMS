import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { razorpayRequest, razorpayKeyId } from "@/lib/razorpay";
import { isPaidPlan, type BillingTerm } from "@/lib/billing-pricing";
import { calculateUpgradeProration } from "@/lib/billing-proration";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const clean = (value: unknown) => String(value || "").trim();

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await request.json();
    const companyId = clean(body?.companyId);
    const newPlanCode = clean(body?.planCode).toLowerCase();
    const newTerm = clean(body?.term) as BillingTerm;
    const users = Math.floor(Number(body?.users || 0));

    if (!companyId || !newPlanCode || !newTerm || users < 1 || !isPaidPlan(newPlanCode)) {
      return NextResponse.json({ error: "Valid organization, paid plan, billing term and user count are required." }, { status: 400 });
    }

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    const { data: platformAdmin } = await session.rpc("is_platform_admin");
    let systemAdmin = false;
    if (!platformAdmin) {
      const { data } = await session.rpc("is_system_admin");
      systemAdmin = data === true;
    }

    if (profile?.company_id !== companyId && platformAdmin !== true && !systemAdmin) {
      return NextResponse.json({ error: "You do not have permission to upgrade this organization." }, { status: 403 });
    }

    const { data: current, error: currentError } = await admin
      .from("company_subscriptions")
      .select("plan_code,status,current_period_start,current_period_end,razorpay_subscription_id")
      .eq("company_id", companyId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "Current subscription was not found." }, { status: 404 });

    const { data: company, error: companyError } = await admin
      .from("companies").select("id,name,email,org_code").eq("id", companyId).single();
    if (companyError) throw companyError;

    const { data: lastPaid } = await admin
      .from("billing_payments")
      .select("amount_paid")
      .eq("company_id", companyId)
      .in("status", ["paid", "captured"])
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const quote = calculateUpgradeProration({
      oldPlanCode: current.plan_code || "",
      newPlanCode,
      users,
      newTerm,
      currentPeriodStart: current.current_period_start,
      currentPeriodEnd: current.current_period_end,
      previousAmountPaid: lastPaid?.amount_paid || 0,
    });

    // If existing unused value fully covers the upgrade, no Razorpay charge is created.
    if (quote.payableNow <= 0) {
      const now = new Date().toISOString();
      const { error: adjError } = await admin.from("billing_adjustments").insert({
        company_id: companyId,
        adjustment_type: "upgrade_credit",
        amount: quote.unusedCredit,
        description: `Upgrade credit: ${current.plan_code} → ${newPlanCode}`,
        old_plan: current.plan_code,
        new_plan: newPlanCode,
        effective_at: now,
        created_by: user.id,
        metadata: quote,
      });
      if (adjError) throw adjError;

      const { error: subError } = await admin.from("company_subscriptions").update({
        plan_code: newPlanCode,
        status: "active",
        licensed_users: users,
        custom_price_per_user: quote.baseMonthlyPerUser,
        discount_percent: quote.discountPercent,
        billing_cycle: newTerm,
        pending_plan_code: null,
        pending_plan_effective_at: null,
        updated_at: now,
      }).eq("company_id", companyId);
      if (subError) throw subError;

      return NextResponse.json({ success: true, paymentRequired: false, quote });
    }

    // One-time Razorpay order charges only the prorated balance.
    const order = await razorpayRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(quote.payableNow * 100),
        currency: "INR",
        receipt: `UPG-${companyId.slice(0, 8)}-${Date.now()}`,
        notes: {
          company_id: companyId,
          old_plan: current.plan_code || "",
          new_plan: newPlanCode,
          users: String(users),
          term: newTerm,
          unused_credit: String(quote.unusedCredit),
        },
      }),
    });

    const { data: paymentRow, error: paymentError } = await admin.from("billing_payments").insert({
      company_id: companyId,
      plan_code: newPlanCode,
      billing_cycle: newTerm,
      currency: "INR",
      subtotal: quote.total,
      adjustment_amount: -quote.unusedCredit,
      total_amount: quote.payableNow,
      amount_paid: 0,
      amount_due: quote.payableNow,
      status: "created",
      razorpay_order_id: order.id,
      source: "razorpay",
      metadata: {
        kind: "upgrade",
        old_plan: current.plan_code,
        new_plan: newPlanCode,
        users,
        unused_credit: quote.unusedCredit,
        full_new_plan_total: quote.total,
      },
      created_by: user.id,
    }).select("id").single();
    if (paymentError) throw paymentError;

    const { error: adjError } = await admin.from("billing_adjustments").insert([
      {
        company_id: companyId,
        payment_id: paymentRow.id,
        adjustment_type: "upgrade_credit",
        amount: quote.unusedCredit,
        description: `Unused subscription credit: ${current.plan_code} → ${newPlanCode}`,
        old_plan: current.plan_code,
        new_plan: newPlanCode,
        created_by: user.id,
        metadata: { remaining_ratio: quote.remainingRatio, remaining_days: quote.remainingDays },
      },
      {
        company_id: companyId,
        payment_id: paymentRow.id,
        adjustment_type: "upgrade_charge",
        amount: quote.payableNow,
        description: `Upgrade balance payable: ${current.plan_code} → ${newPlanCode}`,
        old_plan: current.plan_code,
        new_plan: newPlanCode,
        created_by: user.id,
        metadata: quote,
      },
    ]);
    if (adjError) throw adjError;

    // Do NOT activate the new paid plan yet. Webhook/payment verification does that.
    const { error: pendingError } = await admin.from("company_subscriptions").update({
      pending_plan_code: newPlanCode,
      pending_plan_effective_at: new Date().toISOString(),
      licensed_users: users,
      last_payment_status: "created",
      updated_at: new Date().toISOString(),
    }).eq("company_id", companyId);
    if (pendingError) throw pendingError;

    return NextResponse.json({
      success: true,
      paymentRequired: true,
      keyId: razorpayKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentRecordId: paymentRow.id,
      company: { id: company.id, name: company.name, email: company.email },
      quote,
      message: "Upgrade balance calculated. New paid plan activates only after successful Razorpay payment.",
    });
  } catch (error: any) {
    console.error("Razorpay upgrade creation failed:", error);
    return NextResponse.json({ error: String(error?.message || "Unable to create upgrade payment.") }, { status: 500 });
  }
}
