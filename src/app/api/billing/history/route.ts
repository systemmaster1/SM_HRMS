import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.company_id) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const { data, error } = await admin
      .from("billing_payments")
      .select("id,company_id,plan_code,billing_cycle,currency,subtotal,tax_amount,adjustment_amount,total_amount,amount_paid,amount_due,status,receipt_number,razorpay_payment_id,razorpay_order_id,razorpay_invoice_id,razorpay_subscription_id,payment_method,source,paid_at,created_at,metadata")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return NextResponse.json(
      { payments: data || [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("Customer billing history failed:", error);
    return NextResponse.json({ error: String(error?.message || "Unable to load payment history.") }, { status: 500 });
  }
}
