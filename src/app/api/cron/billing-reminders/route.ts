import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBillingReminderEmail } from "@/lib/billing-email";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function dayRange(daysAhead: number) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + daysAhead);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const results = { due10: 0, dueToday: 0, skipped: 0, failed: 0 };

  async function processWindow(daysAhead: number, emailType: "due_10_days" | "due_today") {
    const range = dayRange(daysAhead);
    const { data: subs, error } = await admin
      .from("company_subscriptions")
      .select("company_id,plan_code,billing_email,next_billing_at,status")
      .gte("next_billing_at", range.start)
      .lt("next_billing_at", range.end)
      .not("plan_code", "in", '("free","trial")')
      .neq("status", "cancelled");

    if (error) throw error;

    for (const sub of subs || []) {
      try {
        const { data: company } = await admin.from("companies").select("name,email").eq("id", sub.company_id).maybeSingle();
        const to = sub.billing_email || company?.email;
        if (!to || !sub.next_billing_at) { results.skipped++; continue; }

        const { data: payment } = await admin
          .from("billing_payments")
          .select("id,amount_due")
          .eq("company_id", sub.company_id)
          .gt("amount_due", 0)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: already } = await admin
          .from("billing_email_log")
          .select("id")
          .eq("company_id", sub.company_id)
          .eq("email_type", emailType)
          .eq("due_at", sub.next_billing_at)
          .maybeSingle();

        if (already) { results.skipped++; continue; }

        await sendBillingReminderEmail({
          to,
          companyName: company?.name || "Organization",
          planCode: sub.plan_code,
          amountDue: Number(payment?.amount_due || 0),
          dueAt: sub.next_billing_at,
          kind: emailType,
        });

        await admin.from("billing_email_log").insert({
          company_id: sub.company_id,
          payment_id: payment?.id || null,
          email_type: emailType,
          recipient: to,
          status: "sent",
          due_at: sub.next_billing_at,
          sent_at: new Date().toISOString(),
        });

        if (emailType === "due_10_days") results.due10++;
        else results.dueToday++;
      } catch (error) {
        results.failed++;
        console.error("Billing reminder failed", sub.company_id, error);
      }
    }
  }

  try {
    await processWindow(10, "due_10_days");
    await processWindow(0, "due_today");
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("Billing reminder cron failed", error);
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
