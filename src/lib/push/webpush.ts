import webpush from "web-push";
import type { PushOutcome } from "./fcm";

/**
 * Standard Web Push (VAPID) for browsers and installed PWAs
 * (Chrome/Edge/Firefox on desktop & Android, Safari on iPhone when the app is
 * added to the Home Screen).
 *
 * Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT.
 */
let ready: boolean | undefined;

function setup(): boolean {
  if (ready !== undefined) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:Connect@systemmaster.in", pub, priv);
  return (ready = true);
}

export const webPushConfigured = () => setup();

export async function sendWebPush(
  subscription: any,
  msg: { id: string; title: string; body: string; link: string }
): Promise<PushOutcome> {
  if (!setup()) return "error:VAPID keys not set";
  if (!subscription?.endpoint || !subscription?.keys) return "invalid";
  try {
    await webpush.sendNotification(subscription, JSON.stringify(msg), { TTL: 86400, urgency: "high" });
    return "ok";
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) return "invalid";
    return `error:${e?.statusCode || ""} ${e?.body || e?.message || e}`.slice(0, 200) as PushOutcome;
  }
}
