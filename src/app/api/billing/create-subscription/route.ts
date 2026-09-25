import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { razorpayRequest, razorpayKeyId } from "@/lib/razorpay";
import { calculatePlanPrice, isPaidPlan, type BillingTerm } from "@/lib/billing-pricing";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await request.json();
    const companyId = clean(body?.companyId);
    const planCode = clean(body?.planCode).toLowerCase();
    const term = clean(body?.term) as BillingTerm;
    const users = Math.floor(Number(body?.users || 0));

    if (!companyId || !planCode || !term || users < 1) {
      return NextResponse.json({ error: "Organization, paid plan, billing term and user count are required." }, { status: 400 });
    }

    if (!isPaidPlan(planCode)) {
      return NextResponse.json({ error: "Free/non-paid plans do not use Razorpay checkout." }, { status: 400 });
    }

    const admin = adminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("company_id,role,email,full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: platformAdmin } = await session.rpc("is_platform_admin");
    let systemAdmin = false;
    if (!platformAdmin) {
      const { data } = await session.rpc("is_system_admin");
      systemAdmin = data === true;
    }

    const ownsCompany = profile?.company_id === companyId;
    if (!ownsCompany && platformAdmin !== true && !systemAdmin) {
      return NextResponse.json({ error: "You do not have permission to create this organization's subscription." }, { status: 403 });
    }

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id,name,email,org_code")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) throw companyError;
    if (!company) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const quote = calculatePlanPrice(planCode, users, term);

    // Razorpay subscriptions require a Plan ID. We create/reuse one for the exact
    // per-user seat bundle + billing term, keeping the amount authoritative server-side.
    const period = quote.months === 12 ? "yearly" : "monthly";
    const interval = quote.months === 12 ? 1 : quote.months;
    const amountPaise = Math.round(quote.total * 100);

    const plan = await razorpayRequest("/plans", {
      method: "POST",
      body: JSON.stringify({
        period,
        interval,
        item: {
          name: `SM HRMS ${planCode.toUpperCase()} · ${users} users · ${quote.months} months`,
          amount: amountPaise,
          currency: "INR",
          description: `SystemMaster HRMS ${planCode} plan for ${users} licensed users`,
        },
        notes: {
          company_id: companyId,
          plan_code: planCode,
          users: String(users),
          billing_months: String(quote.months),
          discount_percent: String(quote.discountPercent),
        },
      }),
    });

    const subscription = await razorpayRequest("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: plan.id,
        total_count: 12,
        quantity: 1,
        customer_notify: 1,
        notes: {
          company_id: companyId,
          org_code: company.org_code || "",
          plan_code: planCode,
          users: String(users),
          billing_months: String(quote.months),
          quoted_total: String(quote.total),
        },
      }),
    });

    const now = new Date().toISOString();
    const { error: subError } = await admin
      .from("company_subscriptions")
      .upsert({
        company_id: companyId,
        plan_code: planCode,
        status: "past_due",
        licensed_users: users,
        custom_price_per_user: quote.baseMonthlyPerUser,
        discount_percent: quote.discountPercent,
        billing_cycle: term,
        razorpay_plan_id: plan.id,
        razorpay_subscription_id: subscription.id,
        last_payment_status: "created",
        updated_at: now,
      }, { onConflict: "company_id" });
    if (subError) throw subError;

    const { error: paymentError } = await admin
      .from("billing_payments")
      .insert({
        company_id: companyId,
        subscription_id: subscription.id,
        plan_code: planCode,
        billing_cycle: term,
        currency: "INR",
        subtotal: quote.subtotal,
        discount_amount: quote.discountAmount,
        total_amount: quote.total,
        amount_paid: 0,
        amount_due: quote.total,
        status: "created",
        razorpay_subscription_id: subscription.id,
        source: "razorpay",
        metadata: {
          users,
          months: quote.months,
          base_monthly_per_user: quote.baseMonthlyPerUser,
          effective_monthly_per_user: quote.effectiveMonthlyPerUser,
          created_by_user: user.id,
        },
        created_by: user.id,
      });
    if (paymentError) throw paymentError;

    return NextResponse.json({
      success: true,
      keyId: razorpayKeyId(),
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url || null,
      company: { id: company.id, name: company.name, email: company.email },
      quote,
      message: "Paid plan created. Access activates only after Razorpay confirms successful payment.",
    });
  } catch (error: any) {
    console.error("Create Razorpay subscription failed:", error);
    return NextResponse.json({ error: String(error?.message || "Unable to create subscription.") }, { status: 500 });
  }
}
