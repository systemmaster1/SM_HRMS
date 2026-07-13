import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalisePhone, isEmail } from "@/lib/phone";

/**
 * Accepts either an email or a mobile number and returns the email
 * to sign in with. This lets users log in with their phone number.
 */
export async function POST(req: Request) {
  const { identifier } = await req.json();
  const id = (identifier || "").trim();

  if (isEmail(id)) {
    return NextResponse.json({ email: id.toLowerCase() });
  }

  const phone = normalisePhone(id);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid email or 10-digit mobile number." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_for_phone", { p_phone: phone });

  if (error || !data) {
    return NextResponse.json(
      { error: "No account found for that mobile number." },
      { status: 404 }
    );
  }

  return NextResponse.json({ email: data });
}
