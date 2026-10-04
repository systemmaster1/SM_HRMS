import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, isEmail } from "@/lib/phone";
import { timingSafeEqual } from "crypto";
import { rateLimit, clientIpKey } from "@/lib/server/rate-limit";

function sameSecret(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

/**
 * Privacy-safe login resolver.
 *
 * The public browser may pass an email through, but mobile-number resolution is
 * deliberately server-only. The associated email is never returned to an
 * unauthenticated browser. This endpoint therefore no longer provides phone ->
 * email account enumeration.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`login:${clientIpKey(req)}`, 10, 600))) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.identifier || "").trim();

  if (isEmail(id)) {
    return NextResponse.json(
      { mode: "email", email: id.toLowerCase() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const phone = normalisePhone(id);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid email or 10-digit mobile number." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Phone login is handled only by a trusted server-to-server caller. A browser
  // must never receive the account email resolved from a phone number.
  const supplied = req.headers.get("x-sm-auth-internal") || "";
  const expected = process.env.AUTH_INTERNAL_SECRET || "";
  if (!expected || !supplied || !sameSecret(supplied, expected)) {
    return NextResponse.json(
      {
        error:
          "For privacy protection, mobile-number sign-in is temporarily unavailable. Please sign in with your registered email.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_for_phone", { p_phone: phone });
  if (error || !data) {
    return NextResponse.json(
      { error: "Incorrect credentials. Please try again." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { mode: "internal", email: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
