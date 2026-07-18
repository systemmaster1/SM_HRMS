import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backupCompany } from "@/lib/gsheet-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly Google Sheet backup for every company that has switched it on.
 * Triggered by Vercel Cron once a day (see vercel.json) and protected by
 * CRON_SECRET so nobody else can call it.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: companies, error } = await db
    .from("companies")
    .select("id, name")
    .eq("gsheet_backup_enabled", true)
    .not("gsheet_webhook_url", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: { company: string; ok: boolean; detail: string }[] = [];

  for (const c of companies || []) {
    try {
      const sheets = await backupCompany(c.id);
      results.push({ company: c.name, ok: true, detail: `${sheets} tabs written` });
    } catch (e: any) {
      results.push({ company: c.name, ok: false, detail: e?.message || "failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    companies: results.length,
    results,
    ranAt: new Date().toISOString(),
  });
}
