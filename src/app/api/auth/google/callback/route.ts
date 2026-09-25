import { NextResponse } from "next/server";

const REDIRECT_URI =
  "https://hrms.systemmaster.in/api/auth/google/callback";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  max-width:760px;
  margin:60px auto;
  padding:24px;
  color:#0f172a;
">
  <div style="
    border:1px solid #e2e8f0;
    border-radius:16px;
    padding:28px;
    box-shadow:0 4px 20px rgba(15,23,42,.06);
  ">
    <h1 style="margin-top:0">${title}</h1>
    ${body}
  </div>
</body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    return page(
      "Authorization cancelled",
      "<p>Google authorization was cancelled. No changes were made.</p>",
      400
    );
  }

  const cookieHeader = request.headers.get("cookie") || "";

  const cookieState = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("sm_gmail_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return page(
      "Authorization failed",
      `
      <p>The authorization request is invalid or has expired.</p>
      <p>Please start Gmail authorization again.</p>
      `,
      400
    );
  }

  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return page(
      "Configuration missing",
      `
      <p>Google Gmail OAuth environment variables are not configured.</p>
      <p>Please check the Vercel environment variables.</p>
      `,
      500
    );
  }

  try {
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      }
    );

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Google OAuth token exchange failed", {
        status: tokenResponse.status,
        error: tokens?.error,
      });

      return page(
        "Authorization failed",
        `
        <p>Google token exchange failed.</p>
        <p>Please restart the Gmail authorization process.</p>
        `,
        400
      );
    }

    if (!tokens.refresh_token) {
      return page(
        "Refresh token missing",
        `
        <p>Google did not return a refresh token.</p>
        <p>Please restart authorization and allow access again.</p>
        `,
        400
      );
    }

    const safeToken = String(tokens.refresh_token)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const response = page(
      "Gmail sender authorized",
      `
      <p style="color:#15803d;font-weight:600">
        Gmail authorization completed successfully.
      </p>

      <p>
        Copy the token below directly into Vercel as:
      </p>

      <p>
        <strong>GOOGLE_GMAIL_REFRESH_TOKEN</strong>
      </p>

      <textarea
        readonly
        style="
          width:100%;
          box-sizing:border-box;
          min-height:120px;
          padding:12px;
          border:1px solid #cbd5e1;
          border-radius:8px;
          font-family:monospace;
        "
      >${safeToken}</textarea>

      <p style="margin-top:18px;color:#b91c1c;font-weight:600">
        Important: Do not send this token in WhatsApp, ChatGPT,
        email, screenshots or GitHub.
      </p>

      <p>
        Copy it directly from this page and save it in Vercel.
      </p>
      `
    );

    response.cookies.set("sm_gmail_oauth_state", "", {
      maxAge: 0,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Gmail OAuth callback error", error);

    return page(
      "Authorization failed",
      `
      <p>An unexpected server error occurred.</p>
      <p>Please restart Gmail authorization.</p>
      `,
      500
    );
  }
}
