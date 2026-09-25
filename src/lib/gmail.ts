export async function sendGmailMessage(
  to: string,
  subject: string,
  html: string
) {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN;
  const sender =
    process.env.GOOGLE_GMAIL_SENDER || "noreply@systemmaster.in";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail sender is not configured");
  }

  // Get a fresh Google access token
  const tokenResponse = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("Gmail access token error", {
      status: tokenResponse.status,
      error: tokenData?.error,
    });

    throw new Error("Unable to authorize Gmail sender");
  }

  // Build email
  const message = [
    `From: SM HRMS <${sender}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
  ].join("\r\n");

  // Gmail API requires base64url encoding
  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw,
      }),
      cache: "no-store",
    }
  );

  if (!sendResponse.ok) {
    const errorText = await sendResponse.text();

    console.error("Gmail send error", {
      status: sendResponse.status,
      response: errorText,
    });

    throw new Error("Unable to send email");
  }

  return {
    success: true,
  };
}
