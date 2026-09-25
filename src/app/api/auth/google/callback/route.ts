import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REDIRECT_URI = "https://hrms.systemmaster.in/api/auth/google/callback";
export const dynamic = "force-dynamic";
function page(title: string, body: string, status = 200) {
  return new NextResponse("<!doctype html><html><body style='font-family:system-ui;max-width:760px;margin:60px auto;padding:24px'><h1>" + title + "</h1>" + body + "</body></html>", { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return page("Authorization cancelled", "<p>No changes were made.</p>", 400);
  const cookieState = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("sm_gmail_oauth_state="))?.split("=")[1];
  if (!code || !state || !cookieState || state !== cookieState) return page("Authorization failed", "<p>Invalid or expired authorization. Start again.</p>", 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return page("Configuration missing", "<p>Google OAuth environment variables are missing.</p>", 500);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
    cache: "no-store"
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) return page("Authorization failed", "<p>Google token exchange failed.</p>", 400);
  if (!tokens.refresh_token) return page("Refresh token missing", "<p>Google did not return a refresh token. Start authorization again with consent.</p>", 400);
  const safe = String(tokens.refresh_token).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const response = page("Gmail sender authorized", "<p>Copy this token directly to Vercel as <b>GOOGLE_GMAIL_REFRESH_TOKEN</b>. Do not send it in chat or commit it to GitHub.</p><textarea readonly style='width:100%;height:120px'>" + safe + "</textarea>");
  response.cookies.set("sm_gmail_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
