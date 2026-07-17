import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Runs auto-attendance for every employee marked "auto_attendance" in
 * Team -> Attendance settings. Triggered by Vercel Cron every 15 minutes
 * (see vercel.json). Protected by CRON_SECRET so it can't be called by
 * anyone else.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_auto_attendance");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed: data, ranAt: new Date().toISOString() });
}
