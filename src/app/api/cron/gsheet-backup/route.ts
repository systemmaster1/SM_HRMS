import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backupCompany } from "@/lib/gsheet-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly Google Sheet sync - runs at 12:00 AM IST (18:30 UTC, see vercel.json).
 *
 * Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
 *
 *  - Without ?company=  -> lists every company with sync switched on and starts
 *                          one separate invocation per company (in parallel), so
 *                          one slow Google Sheet cannot time out the others.
 *  - With ?company=<id> -> syncs just that company.
 *
 * Every attempt is recorded in gsheet_sync_logs.
 */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set on the server." }, { status: 500 });
  }
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const one = url.searchParams.get("company");

  /* ---------- Single company ---------- */
  if (one) {
    try {
      const tabs = await backupCompany(one, "cron");
      return NextResponse.json({ ok: true, company: one, tabs });
    } catch (e: any) {
      return NextResponse.json({ ok: false, company: one, error: e?.message }, { status: 500 });
    }
  }

  /* ---------- Fan out to every enabled company ---------- */
  const db = createAdminClient();
  const { data: companies, error } = await db
    .from("companies")
    .select("id, name, company_integrations!inner(gsheet_webhook_url)")
    .eq("gsheet_backup_enabled", true)
    .not("company_integrations.gsheet_webhook_url", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const auth = req.headers.get("authorization")!;
  const results = await Promise.allSettled(
    (companies || []).map(async (c: any) => {
      const target = new URL(url.pathname, url.origin);
      target.searchParams.set("company", c.id);
      const res = await fetch(target, {
        headers: { authorization: auth },
        cache: "no-store",
        signal: AbortSignal.timeout(58_000),
      });
      const body = await res.json().catch(() => ({}));
      return { company: c.name, ok: res.ok && body.ok !== false, detail: body.error || `${body.tabs ?? 0} tabs` };
    })
  );

  const summary = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { company: (companies as any[])[i]?.name, ok: false, detail: "Still running or timed out - see sync log" }
  );

  return NextResponse.json({
    ok: true,
    companies: summary.length,
    results: summary,
    ranAt: new Date().toISOString(),
  });
}
