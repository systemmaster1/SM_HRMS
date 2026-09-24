import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFcm } from "@/lib/push/fcm";
import { sendWebPush } from "@/lib/push/webpush";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Called by the database (trigger on public.notifications, via pg_net)
 * right after a notification row is inserted. Sends it as a phone / browser
 * push to every device of that user.
 *
 * Protected by PUSH_WEBHOOK_SECRET. The payload only carries the id; the
 * text is always read from the database, so the call cannot be spoofed.
 */
export async function POST(req: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notification_id } = await req.json().catch(() => ({}));
  if (!notification_id) return NextResponse.json({ error: "notification_id missing" }, { status: 400 });

  const db = createAdminClient();
  const { data: n } = await db.from("notifications")
    .select("id, user_id, title, body, link, pushed_at")
    .eq("id", notification_id).maybeSingle();

  if (!n) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (n.pushed_at) return NextResponse.json({ ok: true, skipped: "already pushed" });
  if (!n.user_id) return NextResponse.json({ ok: true, skipped: "no user" });

  const { data: devices } = await db.from("push_devices")
    .select("id, platform, token, subscription")
    .eq("user_id", n.user_id);

  const link = typeof n.link === "string" && n.link.startsWith("/") ? n.link : "/dashboard";
  const msg = {
    id: String(n.id),
    title: String(n.title || "SM HRMS").slice(0, 120),
    body: String(n.body || "").slice(0, 400),
    link,
  };

  const results = await Promise.all((devices || []).map(async (d: any) => ({
    d,
    outcome: d.platform === "android" ? await sendFcm(d.token, msg) : await sendWebPush(d.subscription, msg),
  })));

  // Phones that uninstalled the app / browsers that unsubscribed: forget them.
  const dead = results.filter((r) => r.outcome === "invalid").map((r) => r.d.id);
  if (dead.length) await db.from("push_devices").delete().in("id", dead);

  const sent = results.filter((r) => r.outcome === "ok");
  const errors = results.filter((r) => r.outcome.startsWith("error:")).map((r) => r.outcome);
  const summary = !results.length
    ? "no devices"
    : `sent ${sent.length}/${results.length}` +
      (dead.length ? `, removed ${dead.length} old` : "") +
      (errors.length ? `, ${errors[0]}` : "");

  await db.from("notifications")
    .update({ pushed_at: new Date().toISOString(), push_result: summary.slice(0, 300) })
    .eq("id", n.id);

  if (sent.length) {
    await db.from("push_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .in("id", sent.map((r) => r.d.id));
  }

  return NextResponse.json({ ok: true, result: summary });
}
