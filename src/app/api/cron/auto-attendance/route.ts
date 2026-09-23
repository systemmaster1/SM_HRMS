import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Runs auto-attendance for every employee marked "auto_attendance".
 *
 * NOTE: Vercel's Hobby plan allows cron jobs only once a day, so this is NOT
 * listed in vercel.json. It is scheduled every 15 minutes inside Supabase
 * with pg_cron instead (see supabase/migrations/20260923_phase1_optional_pg_cron.sql).
 * The route is kept so it can still be triggered manually or from Vercel Pro.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_auto_attendance");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed: data, ranAt: new Date().toISOString() });
}
