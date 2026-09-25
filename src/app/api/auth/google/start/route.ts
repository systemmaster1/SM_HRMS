import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REDIRECT_URI = "https://hrms.systemmaster.in/api/auth/google/callback";
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Gmail OAuth is not configured" }, { status: 500 });
  const state = randomBytes(24).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("login_hint", process.env.GOOGLE_GMAIL_SENDER || "noreply@systemmaster.in");
  const response = NextResponse.redirect(url);
  response.cookies.set("sm_gmail_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
