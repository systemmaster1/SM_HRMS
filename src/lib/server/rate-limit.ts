import "server-only";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const memory = new Map<string, { count: number; resetAt: number }>();

/** Hashed client IP (never stored in clear text). */
export function clientIpKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.AUTH_RATE_LIMIT_SECRET || process.env.CRON_SECRET || "sm-hrms-rate-limit")
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Durable rate limit shared by every server instance (database table
 * auth_rate_limits). Falls back to a per-instance memory counter if the
 * database function is not installed yet.
 * Returns true when the request is ALLOWED.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("smhrms_rate_limit_hit", {
      p_key: key, p_max: max, p_window_seconds: windowSeconds,
    });
    if (!error && typeof data === "boolean") return data;
  } catch {
    /* fall back below */
  }
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  cur.count += 1;
  return cur.count <= max;
}
