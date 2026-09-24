import crypto from "crypto";

/**
 * Firebase Cloud Messaging (HTTP v1) for the Android app - no extra packages.
 *
 * Needs the Vercel env var FIREBASE_SERVICE_ACCOUNT = the full JSON of a
 * Firebase service-account key (paste the JSON as-is, or base64 of it).
 */
type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export type PushOutcome = "ok" | "invalid" | `error:${string}`;

let account: ServiceAccount | null | undefined;
let cachedToken: { value: string; exp: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return (account = null);
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    parsed.private_key = String(parsed.private_key || "").replace(/\\n/g, "\n");
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error("incomplete");
    return (account = parsed);
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return (account = null);
  }
}

export const fcmConfigured = () => serviceAccount() !== null;

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Google auth failed (${res.status}): ${json.error_description || json.error || "unknown"}`);
  }
  cachedToken = { value: json.access_token, exp: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

export async function sendFcm(
  token: string,
  msg: { id: string; title: string; body: string; link: string }
): Promise<PushOutcome> {
  const sa = serviceAccount();
  if (!sa) return "error:FIREBASE_SERVICE_ACCOUNT not set";

  try {
    const bearer = await accessToken(sa);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: { link: msg.link, notification_id: msg.id, title: msg.title, body: msg.body },
          android: {
            priority: "HIGH",
            ttl: "86400s",
            notification: {
              channel_id: "alerts",
              sound: "default",
              tag: msg.id,
              notification_priority: "PRIORITY_HIGH",
              default_vibrate_timings: true,
            },
          },
        },
      }),
      cache: "no-store",
    });

    if (res.ok) return "ok";

    const err: any = await res.json().catch(() => ({}));
    const codes: string[] = (err?.error?.details || []).map((d: any) => d.errorCode).filter(Boolean);
    const message: string = err?.error?.message || "";
    if (res.status === 404 || codes.includes("UNREGISTERED") ||
        (res.status === 400 && /registration token/i.test(message))) {
      return "invalid";
    }
    return `error:${res.status} ${codes.join(",") || message}`.slice(0, 200) as PushOutcome;
  } catch (e: any) {
    return `error:${e?.message || e}`.slice(0, 200) as PushOutcome;
  }
}
